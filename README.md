# swipswaps Portfolio – 3D Tag Cloud with Live Backend

Interactive 3D visualization of GitHub repositories with **single‑click locking**, **double‑click to open GitHub**, real‑time search over README content, and **no‑mixed‑content** HTTPS connection when your local backend is running.

## ✨ Features

- **3D tag cloud** – repositories float in a rotating sphere.
- **Single‑click lock** – repository details (description, language, stars) stay pinned in the right panel.
- **Double‑click** – opens the GitHub repository page.
- **Hover preview** – floating tooltip shows the repository description.
- **Search** – queries real README content from your repositories via a local SQLite index.
- **Related repositories** – shows six other recently‑updated repos when a repo is locked.
- **Smart fallback** – on GitHub Pages, if your local backend is *not* running, the page automatically falls back to the GitHub API (cloud still works).

## 🚀 Running the Local Backend (Full Interactivity)

To get the green **🟢 Server: Online** badge and fully working search **on the live GitHub Pages site**, you need to run the backend with an HTTPS proxy. This avoids browser mixed‑content warnings (HTTPS page → HTTPS localhost).

### Prerequisites

- **Node.js** (v18 or later)
- **npm** (comes with Node)
- **mkcert** (to generate a trusted local HTTPS certificate)

### One‑time Setup

```bash
# 1. Install mkcert (Fedora / RHEL)
sudo dnf install nss-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# For Debian/Ubuntu, use: sudo apt install libnss3-tools

# 2. Install the local CA and generate a certificate for localhost
mkcert -install
mkcert localhost 127.0.0.1 ::1
Install Dependencies & Start
bash
# Install Node dependencies (if not already done)
npm install

# Start the backend + HTTPS proxy
./start-secure.sh
Keep this terminal open. You will see:

text
🚀 Starting backend on port 8000...
🔒 Using cert: localhost+2.pem
🔒 Using key:  localhost+2-key.pem
✅ Both services running. Backend: http://localhost:8000, Proxy: https://localhost:8443
Now open the live GitHub Pages URL in a private/incognito window (to avoid cache):

👉 https://swipswaps.github.io/swipswaps-portfolio-showcase/

The debug panel (bottom left) will show:

text
🌐 API base URL: https://localhost:8443
✅ Loaded 50 repos from backend
🟢 Server: Online
No browser warnings – the badge is green, search works, and the site connects directly to your local backend over HTTPS.

🔧 How It Works
The frontend (index.html) detects the hostname.

On github.io, it sets API_BASE = "https://localhost:8443".

On localhost, it uses http://localhost:8000 directly.

start-secure.sh launches:

Your SQLite backend on port 8000 (HTTP).

local-ssl-proxy on port 8443 (HTTPS) using the trusted certificate from mkcert.

The GitHub Pages page (served over HTTPS) fetches https://localhost:8443/api/... – same protocol, so the browser does not block the request as mixed content.

🧹 Cleaning Up
Certificate files (localhost+*.pem) are already in .gitignore – they stay local.

To stop the backend and proxy, press Ctrl+C in the terminal running ./start-secure.sh.

❓ Troubleshooting
Issue	Solution
command not found: mkcert	Install mkcert as shown above, or use sudo dnf install mkcert if available.
Proxy fails with no start line	Regenerate certificates: mkcert -uninstall && mkcert -install && mkcert localhost 127.0.0.1 ::1
Port 8000 already in use	Run sudo fuser -k 8000/tcp and restart ./start-secure.sh.
Green badge still red after refresh	Hard refresh (Ctrl+Shift+R) or open a private window – the cached old index.html may still be serving.
📦 Project Structure
server.js – Express backend using better-sqlite3, indexes READMEs into code_index.db.

start-secure.sh – Launcher for backend + HTTPS proxy.

index.html – Frontend with Three.js CSS2DRenderer, dynamic API base detection.

package.json – Dependencies (express, better-sqlite3, etc.).

🌐 Live Demo
The site always works statically (thanks to GitHub Pages). For the full experience (search, common‑code patterns), run the local backend and enjoy the green badge.

Made with ♥ by José Melendez
GitHub · X/Twitter
