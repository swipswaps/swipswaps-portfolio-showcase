require('dotenv').config();
const envalid = require('envalid');
const { str, num } = envalid;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { query, validationResult } = require('express-validator');
const winston = require('winston');
const Database = require('better-sqlite3');

// ----- ENVIRONMENT VALIDATION -----
const env = envalid.cleanEnv(process.env, {
  PORT: num({ default: 8000 }),
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'debug'], default: 'info' }),
  GITHUB_TOKEN: str({ default: '' }),
});

// ----- LOGGER -----
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
if (env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

const app = express();
const port = env.PORT;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ----- RATE LIMITING -----
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many search requests' } });
const commonCodeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// ----- SQLITE INITIALISATION -----
const db = new Database('code_index.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS repo_code (
    repo_name TEXT PRIMARY KEY,
    content TEXT,
    updated_at INTEGER
  );
`);

// Helper: fetch README from GitHub
async function fetchReadme(repoName) {
  const fetch = (await import('node-fetch')).default;
  const url = `https://api.github.com/repos/swipswaps/${repoName}/readme`;
  const headers = {};
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    // content is base64 encoded
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return content;
  } catch (err) {
    logger.error(`Failed to fetch README for ${repoName}: ${err.message}`);
    return null;
  }
}

// Refresh the code index – fetch READMEs for all repos and store in SQLite
async function refreshCodeIndex() {
  logger.info('Refreshing code index from GitHub...');
  // First get the list of repositories
  const fetch = (await import('node-fetch')).default;
  const reposUrl = 'https://api.github.com/users/swipswaps/repos?sort=pushed&direction=desc&per_page=100';
  const headers = {};
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const reposRes = await fetch(reposUrl, { headers });
  if (!reposRes.ok) throw new Error(`GitHub API error: ${reposRes.status}`);
  const repos = await reposRes.json();

  const stmt = db.prepare(`INSERT OR REPLACE INTO repo_code (repo_name, content, updated_at) VALUES (?, ?, ?)`);
  for (const repo of repos) {
    const readme = await fetchReadme(repo.name);
    if (readme) {
      stmt.run(repo.name, readme, Date.now());
      logger.debug(`Indexed ${repo.name}`);
    } else {
      logger.warn(`No README for ${repo.name}`);
    }
    // Small delay to avoid hitting secondary rate limits
    await new Promise(r => setTimeout(r, 200));
  }
  logger.info(`Code index refreshed – ${repos.length} repos processed`);
}

// On startup, try to load existing index; if empty or older than 1 day, refresh
function ensureIndex() {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM repo_code').get();
  const oneDay = 24 * 60 * 60 * 1000;
  const oldest = db.prepare('SELECT MIN(updated_at) as min FROM repo_code').get();
  if (row.cnt === 0 || (Date.now() - (oldest.min || 0)) > oneDay) {
    refreshCodeIndex().catch(err => logger.error(`Index refresh failed: ${err.message}`));
  } else {
    logger.info(`Using existing code index (${row.cnt} repos)`);
  }
}

// ----- API ENDPOINTS -----
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Repository list endpoint (cached in memory, same as before)
let cachedRepos = null;
let lastRepoFetch = 0;
app.get('/api/repos', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedRepos && now - lastRepoFetch < 60000) return res.json(cachedRepos);
    const fetch = (await import('node-fetch')).default;
    const url = 'https://api.github.com/users/swipswaps/repos?sort=pushed&direction=desc&per_page=50';
    const headers = {};
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const response = await fetch(url, { headers });
    const repos = await response.json();
    cachedRepos = repos.map(repo => ({
      name: repo.name,
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count,
      url: repo.html_url,
      date: repo.pushed_at ? repo.pushed_at.slice(0,10) : '2026-01-01',
      description: repo.description || '',
      tags: []
    }));
    lastRepoFetch = now;
    res.json(cachedRepos);
  } catch (err) {
    logger.error(`/api/repos error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// Search endpoint – searches the README content stored in SQLite
app.get('/api/search-code', searchLimiter, query('q').trim().isLength({ min: 2, max: 100 }), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid query', details: errors.array() });
  const q = req.query.q.toLowerCase();
  const stmt = db.prepare(`SELECT repo_name, content FROM repo_code WHERE LOWER(content) LIKE ?`);
  const rows = stmt.all(`%${q}%`);
  const results = rows.slice(0, 20).map(row => ({
    repo_name: row.repo_name,
    content: row.content.slice(0, 300), // return first 300 chars as preview
    similarity: 0.5
  }));
  res.json({ results, query: q });
});

// Common code endpoint (remains as before, but could be removed – kept for compatibility)
const REPO_CODE = {}; // empty – no longer used
app.get('/api/common-code', commonCodeLimiter, (req, res) => res.json({ common: [] }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server and initialise index

// ----- GITHUB CODE SEARCH (uses GitHub API, requires GITHUB_TOKEN in .env) -----
app.get('/api/search-github', async (req, res) => {
  const { q: query, lang = '', page = 1 } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(401).json({ error: 'GITHUB_TOKEN not set in .env' });
  }
  // Search only within your repositories (swipswaps/*)
  let searchQuery = `${query} repo:swipswaps/*`;
  if (lang) searchQuery += ` language:${lang}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=30&page=${page}`;
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message });
    }
    const results = data.items.map(item => ({
      repo: item.repository.full_name,
      file: item.path,
      url: item.html_url,
      score: item.score,
    }));
    res.json({ query, lang, page, total_count: data.total_count, results });
  } catch (err) {
    console.error('GitHub search error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  logger.info(`Backend running on http://localhost:${port}`);
  ensureIndex();
});
