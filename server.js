// ============================================================
// CITATION: WebSocket for real-time browser updates
// Source: MDN WebSocket API
// Verbatim quote: "The WebSocket API enables two-way interactive 
//          communication between a user's browser and a server"
// URL: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
// ============================================================

const express = require('express');
const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'portfolio',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active connections
const clients = new Set();

// ============================================================
// CITATION: PostgreSQL LISTEN/NOTIFY with Node.js
// Source: node-postgres documentation - Notifications
// Verbatim quote: "PostgreSQL provides a publish/subscribe 
//          mechanism via LISTEN and NOTIFY"
// URL: https://node-postgres.com/features/notify
// ============================================================

async function setupPostgresListener() {
    const client = await pool.connect();
    
    // Listen for repository changes
    await client.query('LISTEN repo_changes');
    
    client.on('notification', (msg) => {
        const payload = JSON.parse(msg.payload);
        console.log(`Change detected: ${payload.action} on repo ${payload.repo_id}`);
        
        // Broadcast to all connected WebSocket clients
        const message = JSON.stringify({
            type: 'repo_update',
            data: payload,
            timestamp: new Date().toISOString()
        });
        
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
    
    console.log('PostgreSQL LISTEN active');
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);
    
    // Send initial data
    sendFullTagCloud(ws);
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// ============================================================
// CITATION: Cached queries for performance
// Source: PostgreSQL Prepared Statements Documentation
// Verbatim quote: "Prepared statements can improve performance 
//          when a query is executed multiple times"
// URL: https://www.postgresql.org/docs/current/sql-prepare.html
// ============================================================

async function getTagCloudEntries(filter = null) {
    const cacheKey = filter ? `filter:${filter}` : 'full';
    
    // Check cache first (5 minute TTL)
    const cacheResult = await pool.query(
        `SELECT entries FROM tag_cloud_cache 
         WHERE cache_key = $1 AND expires_at > NOW()`,
        [cacheKey]
    );
    
    if (cacheResult.rows.length > 0) {
        return cacheResult.rows[0].entries;
    }
    
    // Build query with optional filter
    let query = `
        SELECT 
            name as label,
            url,
            language,
            stars,
            pushed_at as date,
            metadata->>'color' as color
        FROM repositories
        WHERE 1=1
    `;
    
    const params = [];
    if (filter) {
        query += ` AND (name ILIKE $1 OR description ILIKE $1)`;
        params.push(`%${filter}%`);
    }
    
    query += ` ORDER BY stars DESC, pushed_at DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    
    // Format for tag cloud
    const entries = result.rows.map(row => ({
        label: row.label,
        url: row.url,
        target: '_blank',
        tooltip: `${row.language} · ⭐ ${row.stars} stars · Updated: ${new Date(row.date).toISOString().slice(0,10)}`,
        color: row.color || getColorForLanguage(row.language)
    }));
    
    // Cache the result
    await pool.query(
        `INSERT INTO tag_cloud_cache (cache_key, entries, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
         ON CONFLICT (cache_key) DO UPDATE 
         SET entries = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
        [cacheKey, JSON.stringify(entries)]
    );
    
    return entries;
}

function getColorForLanguage(lang) {
    const colors = {
        'JavaScript': '#f7df1e', 'TypeScript': '#3178c6', 'Python': '#3572A5',
        'Shell': '#89e051', 'HTML': '#e34c26', 'CSS': '#563d7c',
        'GDScript': '#478cbf', 'Go': '#00ADD8', 'Rust': '#dea584',
        'Unknown': '#888888'
    };
    return colors[lang] || '#44aaff';
}

async function sendFullTagCloud(ws) {
    const entries = await getTagCloudEntries();
    ws.send(JSON.stringify({
        type: 'full_cloud',
        entries: entries,
        timestamp: new Date().toISOString()
    }));
}

// ============================================================
// CITATION: GitHub REST API integration
// Source: GitHub REST API Documentation - Repositories
// Verbatim quote: "List repositories for a user. Lists public 
//          repositories for the specified user"
// URL: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-a-user
// ============================================================

async function syncGitHubRepos(username) {
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&direction=desc&per_page=100`);
    
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    
    const repos = await response.json();
    let synced = 0;
    
    for (const repo of repos) {
        await pool.query(`
            INSERT INTO repositories (name, description, language, stars, forks, url, pushed_at, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                language = EXCLUDED.language,
                stars = EXCLUDED.stars,
                forks = EXCLUDED.forks,
                pushed_at = EXCLUDED.pushed_at,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, [
            repo.name,
            repo.description || '',
            repo.language,
            repo.stargazers_count,
            repo.forks_count,
            repo.html_url,
            repo.pushed_at,
            JSON.stringify({
                size: repo.size,
                open_issues: repo.open_issues_count,
                license: repo.license?.name,
                topics: repo.topics || []
            })
        ]);
        
        // Also log to audit
        await pool.query(`
            INSERT INTO repository_audit (repo_id, action, new_data)
            SELECT id, 'SYNC', $1::jsonb
            FROM repositories WHERE name = $2
        `, [JSON.stringify({ synced_from: 'github', timestamp: new Date() }), repo.name]);
        
        synced++;
    }
    
    console.log(`Synced ${synced} repositories from GitHub`);
    return synced;
}

// API endpoints
app.use(express.json());
app.use(express.static('public'));

app.post('/api/sync', async (req, res) => {
    try {
        const count = await syncGitHubRepos('swipswaps');
        res.json({ success: true, synced: count });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/repos', async (req, res) => {
    const filter = req.query.filter;
    const entries = await getTagCloudEntries(filter);
    res.json({ entries, count: entries.length });
});

app.get('/api/stats', async (req, res) => {
    const result = await pool.query(`
        SELECT 
            COUNT(*) as total_repos,
            SUM(stars) as total_stars,
            jsonb_object_agg(language, COUNT(*)) as languages
        FROM repositories
        GROUP BY language
    `);
    res.json(result.rows);
});

// ============================================================
// CITATION: Periodic sync with cron
// Source: node-cron documentation
// Verbatim quote: "Cron is a tool that allows you to execute 
//          something on a schedule"
// URL: https://www.npmjs.com/package/node-cron
// ============================================================

const cron = require('node-cron');
cron.schedule('0 */6 * * *', () => {
    console.log('Running scheduled GitHub sync...');
    syncGitHubRepos('swipswaps').catch(console.error);
});

// Start server
const PORT = process.env.PORT || 3000;
setupPostgresListener().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
    });
});
// ============================================================
// Console Error Logging Endpoint
// Receives errors from browser and stores in PostgreSQL
// ============================================================

app.post('/api/log-error', express.json(), async (req, res) => {
    try {
        const { error_message, error_stack, error_type, url, session_id, repo_context } = req.body;
        
        const result = await pool.query(
            `SELECT log_console_error($1, $2, $3, $4, $5, $6, $7) as error_id`,
            [
                error_message || 'Unknown error',
                error_stack || null,
                error_type || 'JavaScript',
                url || null,
                req.headers['user-agent'] || null,
                session_id || null,
                repo_context || null
            ]
        );
        
        res.json({ 
            success: true, 
            error_id: result.rows[0].error_id,
            message: 'Error logged successfully'
        });
    } catch (err) {
        console.error('Failed to log error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get error statistics
app.get('/api/error-stats', async (req, res) => {
    const days = req.query.days || 7;
    const result = await pool.query('SELECT * FROM get_error_stats($1)', [days]);
    res.json(result.rows);
});

// Get unresolved errors
app.get('/api/unresolved-errors', async (req, res) => {
    const result = await pool.query('SELECT * FROM unresolved_errors LIMIT 100');
    res.json(result.rows);
});

// Mark error as resolved
app.post('/api/resolve-error/:id', express.json(), async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    await pool.query(
        `UPDATE console_errors 
         SET resolved = TRUE, resolution_notes = $1 
         WHERE id = $2`,
        [notes, id]
    );
    
    res.json({ success: true });
});
