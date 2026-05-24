# Skills v0007 – Overcoming Recalcitrance & Audit Compliance  
*Extended with backend deployment, HTTPS proxy, GitHub API integration, and safe process management*

## Core principle
**Capture raw, verbatim output from the source, displayed live in your terminal. Never hide, summarise, or redirect to a file only.**

## 21‑point verbatim log checklist (required for audit)
1. Browser console errors (file, line, col)
2. Browser console warnings (CSP, etc.)
3. All `console.log()`
4. Network failures (URL, status, error text)
5. Script load failures (CDN URL, error event)
6. Uncaught exceptions (stack trace)
7. Unhandled promise rejections (reason + stack)
8. CSP violations (directive, blocked resource)
9. Backend stdout (every line)
10. Backend stderr (including `EADDRINUSE`)
11. API request/response bodies (raw JSON)
12. Three.js component load status (exact error)
13. Frontend custom logs (`logVerbose`)
14. Hover/click/lock events
15. Search progress (query, result count, error)
16. Packet sniff (HTTP headers, body) – when requested
17. Stack traces for any error
18. System events (port binding, signals)
19. Progress messages (“Three.js loaded”, “Creating labels”)
20. Status updates (backend online/offline, fetch success/fallback)
21. Verbatim error string from browser engine – no placeholders.

## Audit‑specific mandates (from audit_0011.sh)
- **No conditional database bypass** – PostgreSQL must be used unconditionally (no `USE_POSTGRES=false`).
- **Execution evidence must contain real `psql` output**, not a skip message.
- **Database writes required** – `INSERT INTO diagnostic_runs, metrics, events, fixes`.
- **Self‑healing queries must include `WHERE run_id` or `WHERE created_at`** (to ensure adaptive logic).
- **No placeholders (`...`) in execution evidence** – show real row counts, timings.
- **Capture and log `run_id`** from the database.
- **Include retry loops** for database operations.
- **All database operations must have `# VERIFIES WITH` comments**.
- **Explicit citation of PostgreSQL docs** in a `CITATION CHECK` block.

## Critical rule for LLMs
When providing a capture script, **must** print captured output to the terminal in real time.  
Forbidden:
- Redirecting stdout/stderr to `/dev/null`
- Headless Puppeteer without `dumpio: true`
- Writing only to a file without terminal output
- Assuming the user will open DevTools

## File editing – avoid `sed` (use Python/awk)
**Fragile `sed` causes silent failures.** Use these instead:
- **Whole file replacement**: `cat > file << 'EOF' … EOF`
- **Python** for any regex or multi‑line edits:  
  `python3 -c "import re; f=open('file','r'); c=f.read(); f.close(); c=re.sub(r'pat','repl',c); open('file','w').write(c)"`
- **`awk`** for simple line replacements:  
  `awk '/old/ {print "new"; next} 1' file > tmp && mv tmp file`

Only use `sed -i.bak` for trivial single‑line substitutions, and always test on a copy.

## Debugging frontend failures – when the in‑page debug panel is stuck on “Initializing…”

If the debug panel never updates (remains “Initializing…”), the frontend script **failed before the first `logVerbose` call**. The in‑page panel is useless in this state. **Do not rely on it.**

### Immediate actions (mandatory)
1. **Hard refresh** the browser (`Ctrl+Shift+R` on Linux/Windows, `Cmd+Shift+R` on Mac) or open the page in an **incognito/private window** to bypass the cache.
2. **Open the browser’s DevTools** (`F12` or right‑click → Inspect) and go to the **Console** tab. **This is the source of truth.** Every JavaScript error, module load failure, and CSP violation appears here.
3. **Check the Network tab** for failed requests (e.g., `three.module.js` returning 404 or being blocked).

## DOM safety rules (added in v0005)
- **Every call to `document.getElementById()` must be followed by a null check** before accessing `.innerHTML` or `.addEventListener`.
- **Log a meaningful error** when an element is missing: `logToDebug('Element missing: ' + id, true)`.
- **Do not assume the DOM is ready** – if the script runs before elements exist, use `DOMContentLoaded` or place the script at the end of `<body>`.
- **When using `async/await` inside a module script (or plain script), the DOM is already parsed** if the script is placed at the end of `<body>`. However, dynamically loaded content (e.g., `startApp()` called after Three.js loads) must re‑query elements because they may not have been available earlier.

### Example of safe element handling
```javascript
const element = document.getElementById('status-area');
if (element) {
    element.innerHTML = '<div class="online">🟢 Server: Online</div>';
} else {
    logToDebug('status-area element not found', true);
}
Mandatory use of the unified capture script
Do not debug by manually opening the browser. Always run the Puppeteer capture script that prints all browser console messages to your terminal:

bash
node capture_all_verbatim.js
(Script provided below.)

Minimal working capture script (browser + backend, terminal live)
Save as capture_all_verbatim.js:

javascript
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
function tee(msg) { process.stdout.write(msg + '\n'); }
const backend = spawn('node', ['server.js']);
backend.stdout.on('data', d => tee(`[BACKEND] ${d}`));
backend.stderr.on('data', d => tee(`[BACKEND ERR] ${d}`));
setTimeout(async () => {
    const browser = await puppeteer.launch({ headless: false, dumpio: true });
    const page = await browser.newPage();
    page.on('console', msg => tee(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => tee(`[PAGE ERROR] ${err.message}`));
    page.on('requestfailed', req => tee(`[FAILED] ${req.url()} - ${req.failure().errorText}`));
    await page.goto('http://localhost:8000');
    process.on('SIGINT', async () => { await browser.close(); backend.kill(); process.exit(0); });
}, 2000);
Checklist when the 3D cloud (or any frontend feature) fails to appear
Is the backend running? (./start.sh or node server.js)

Does curl http://localhost:8000/api/health return {"status":"ok"}?

Is the Three.js CDN accessible? (curl -I https://unpkg.com/three@0.128.0/build/three.module.js)

Have you hard‑refreshed the browser? (Ctrl+Shift+R)

Have you looked at the DevTools Console? (You must – the in‑page panel is not enough.)

Are there any CSP violations? (Check Console – they appear as warnings.)

Does the import map point to a valid URL? (Try changing to https://cdn.skypack.dev/three@0.128.0/build/three.module.js)

Have you run the Puppeteer capture script to see the exact browser errors in your terminal?

DOM element safety – does every getElementById have a null check? (Added in v0005)

Example: fixing a broken CDN
If the CDN is blocked or returns an error, replace the import map URL. Use Python for safety:

bash
python3 -c "
with open('index.html', 'r') as f:
    content = f.read()
content = content.replace('https://unpkg.com/three@0.128.0', 'https://cdn.skypack.dev/three@0.128.0')
with open('index.html', 'w') as f:
    f.write(content)
print('CDN replaced')
"
Summary of v0005/v0006 core rules
The in‑page debug panel is not a reliable error source – it only shows logs after the script starts.

Always use the Puppeteer capture script to print real browser console messages to your terminal.

If the script fails before logVerbose runs, open DevTools Console – the answer is there.

Do not assume the cache is cleared – hard refresh or use incognito mode.

CDN failures are common – verify reachability and fallback to a working CDN.

Every DOM element access must be null‑checked – otherwise silent “Cannot set properties of null” errors will break the UI.

Recalcitrance is overcome when the hidden message is displayed verbatim in your terminal – not when a workaround pretends to fix the symptom.

Request compliance and logs — what, why, how (added in v0006)
This section was written from a real debugging thread where the same UI bug
(single-click not locking) survived multiple fixes. Every wasted cycle traced
back to one of three log failures below. Treat these as hard rules.

The compliance principle for logs
A claim about runtime behaviour is only compliant if a log line proves it.
"It should work," "the handler fires," "the guard is correct" are not claims —
they are guesses until a captured line shows the variable's actual value. The
log is the evidence; the assertion is not. If the deciding variable is not in
the log, the log is incomplete, not the diagnosis complete.

WHAT to log — instrument the decision, not the outcome
The bug was a dragged guard returning early. Logging "click fired" and
"locked / not locked" was useless because it showed the outcome, not the
decision. The fix only became findable once the log showed the inputs to
the branch that decided: the flag's value, the coordinates it compared, and
the buttons held.

Log every variable a conditional reads, at the moment it reads it.

Log the value on BOTH paths (taken and not-taken), so "absent" is never
ambiguous. A missing line must mean "code never reached," not "we forgot."

For event handlers, log e.button / e.buttons / coordinates — the raw
inputs, not your interpretation of them.

WHY a single contradicting line outweighs many confirming ones
In this thread, dozens of dragged=true lines looked like proof the guard was
permanently broken. One dragged=false line at a dead-space click disproved
that and pointed at autoRotate as the real mechanism. Hunt for the line
that breaks your hypothesis, not the lines that confirm it. One contradiction
invalidates a confirmed-cause claim (it becomes a hypothesis again). Confirming
lines never upgrade a hypothesis to a fact — only the absence of any
contradiction across the full input range does.

HOW to display logs — the stale-tab trap
Repeated dead ends were caused by the browser running a cached copy of the
page while the file on disk had already been patched. The log proves which file
is live; trust the log, not the filename.

Put a unique build marker in each instrumented build (e.g. a distinctive
emoji tag like 🐞 DOWN). If that marker is absent from a fresh log, the
browser is running an old tab — the test is invalid, redo it. Do not analyse
a log whose markers don't match the build you just wrote.

A plain reload (Ctrl+R) often keeps old JS. Prefer closing the tab and
opening a new one, or a hard refresh (Ctrl+Shift+R), or incognito.

Confirm the live file independently: grep -n "<title>\|<unique-marker>" index.html before trusting any behavioural log.

The in-page debug panel only shows lines after the script starts; if it
reads "Initializing…", the script died earlier — DevTools Console is the
source of truth (see v0005).

The diagnostic-before-fix loop (made explicit)
State the hypothesis and the ONE variable that would confirm or kill it.

Add logging for that variable on both branches — no behaviour change.

Verify the build marker appears in a fresh log (else stale tab — redo).

Read the line that decides. If it contradicts the hypothesis, return to 1.

Only after a log line confirms the cause, apply the fix.

After the fix, the same log line must now show the corrected value verbatim.

Auto-rotation / moving-target hit-tests (domain note)
When a scene auto-rotates, elements slide under a stationary cursor, so
mousemove fires with no user motion. Any drag-vs-click guard that watches
mousemove deltas against a fixed mousedown point will read "dragged" falsely.
Measure drag at mouseup from the mousedown point, OR gate the guard on
e.buttons !== 0 (a real drag holds a button; auto-rotation hover does not).

New patterns from v0007 (portfolio project)
1. Dynamic API base detection (for GitHub Pages + localhost)
Pattern (JavaScript, inside startApp()):

javascript
const getAPIBase = () => {
    if (typeof window === 'undefined') return 'http://localhost:8000';
    const hostname = window.location.hostname;
    if (hostname.includes('github.io')) return 'https://localhost:8443';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    return `http://${hostname}:8000`;
};
const API_BASE = getAPIBase();
window.logToDebug(`🌐 API base URL: ${API_BASE}`);
2. Local HTTPS proxy with trusted certificate (no browser warnings)
Launcher script (start-secure.sh):

bash
#!/bin/bash
trap cleanup SIGINT SIGTERM EXIT
cleanup() { pkill -P $$ 2>/dev/null; wait; exit 0; }
node server.js &
sleep 2
CERT_FILE=$(ls localhost+*.pem 2>/dev/null | grep -v key | head -1)
KEY_FILE=$(ls localhost+*-key.pem 2>/dev/null | head -1)
local-ssl-proxy --source 8443 --target 8000 --key "$KEY_FILE" --cert "$CERT_FILE" &
wait
3. Trust proxy setting (silence express-rate-limit warnings)
javascript
app.set('trust proxy', 1);
4. Safe signal handling in bash – avoid kill 0
Use pkill -P $$ instead of kill 0.

5. GitHub API token management (.env, repo‑scoped search)
Store token in .env. Endpoint: /api/search-github?q=... uses repo:swipswaps/*.

6. Search mode toggle (frontend UI)
html
<select id="searchMode">
    <option value="readme">📄 Search READMEs (local)</option>
    <option value="github">🔍 Search code (GitHub API) – requires backend running</option>
</select>
7. Double‑click propagation prevention
javascript
document.querySelector('.info-panel').addEventListener('click', (e) => e.stopPropagation());
document.querySelector('.info-panel').addEventListener('dblclick', (e) => e.stopPropagation());
8. Logging the decision, not the outcome
Log inputs to conditionals (e.g., dragged, e.buttons).

9. Stale tab detection
Include a unique build marker and verify it appears in a fresh log.

Summary – v0007 adds
Dynamic API base detection, HTTPS local proxy, trust proxy, safe bash signal handling, GitHub token management, search mode toggle, click propagation prevention, stricter log‑the‑decision discipline.

text
