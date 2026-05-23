# swipswaps Portfolio – 3D Tag Cloud with Locked Selection

Interactive 3D visualization of GitHub repositories with **single‑click locking**, **double‑click to open GitHub**, full right‑click support, and high contrast accessibility.

## Live Site

[https://swipswaps.github.io/swipswaps-portfolio-showcase/](https://swipswaps.github.io/swipswaps-portfolio-showcase/)

## Key Features

- 🎯 **3D Tag Cloud** – Repositories arranged on a sphere using Fibonacci distribution  
- 🖱️ **Single‑click Lock** – Click any repo to lock its details in the right panel; hovering over other repos does **not** change the view  
- 🔗 **Double‑click to Open** – Opens the GitHub repository in a new tab (also locks the repo)  
- 🖱️ **Right‑click Enabled** – Full browser context menu works (inspect, save, etc.)  
- 📍 **Persistent Scroll Position** – Scrolling inside the info panel is preserved when content updates  
- 🎨 **High Contrast UI** – Light text on dark backgrounds, fully readable (WCAG compliant)  
- 🔍 **Real‑time Search** – Filter repositories by name, language, or description  
- 📊 **Live Stats** – Shows total repos, stars, and visible count (dynamic)  
- 🧹 **Clean Visuals** – No distracting cylinders or lines, just the word cloud with glow effects on hover  
- 📡 **Verbose Debug Panel** – Real‑time logs with download/clear buttons  

## Recent Improvements (2026-05-23)

| Issue | Solution |
|-------|----------|
| Hover detection unreliable (missed labels) | **Bounding‑box detection** – uses actual DOM element rectangles |
| Right‑click disabled | Re‑enabled with `contextmenu` listener |
| Single‑click accidentally opened GitHub | Changed to **double‑click** to open, single‑click **locks selection** |
| Related repositories list jumped on hover | Removed `transform` and border‑change, only background colour changes |
| Info panel jumped to top on hover/click | **Scroll position preserved** – saves and restores `scrollTop` |
| Text unreadable (dark on dark) | High‑contrast colours (`#e8edf5`, `#aaccff`, `#88aacc`) |
| Pink cylinders (bad UX) | **Removed completely** – clean 3D cloud only |

## Local Development

### Prerequisites
- Node.js 18+ (optional, for backend)
- PostgreSQL 15+ (optional, for persistent storage)
- Modern browser with WebGL support

### Running with Static Server (no backend)

```bash
python3 -m http.server 8000
# or
npx serve .
Then open http://localhost:8000

Running with Full Backend (PostgreSQL + real‑time sync)
bash
# Install dependencies
npm install

# Set up PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE portfolio;"
sudo -u postgres psql -c "CREATE USER portfolio_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE portfolio TO portfolio_user;"

# Run schema
psql -h localhost -U portfolio_user -d portfolio < schema.sql

# Start server
node server.js
File Structure
text
/
├── index.html          # Main 3D tag cloud (final version with locked selection)
├── schema.sql          # PostgreSQL database schema
├── server.js           # Node.js backend (Express + WebSocket + PG)
├── sync_repos.sh       # GitHub sync script
├── repos.json          # Fallback data
├── README.md           # This file
├── notes/              # Archived old versions
└── LICENSE             # MIT License
Technologies
Component	Technology	Purpose
3D Rendering	Three.js	WebGL‑based 3D visualisation
Camera Controls	OrbitControls	Drag to rotate, zoom
Text Rendering	CSS2DRenderer	Labels always face camera
Distribution	Fibonacci sphere	Even point distribution
Database (optional)	PostgreSQL 15+	Persistent storage
Real‑time (optional)	WebSocket + LISTEN/NOTIFY	Live updates
Usage Guide
Rotate view – Drag with mouse/touch

Select (lock) a repository – Single‑click on any 3D label

The right panel now shows that repo’s details and related repos

Hovering over other labels will not change the panel

Open GitHub – Double‑click on any label

Right‑click – Works normally (inspect, copy, etc.)

Search – Type in the search box to filter repositories (results appear in a collapsible section)

Scroll – Inside the info panel, scroll freely; the position is remembered when you lock a new repo

Credits
Three.js – threejs.org

OrbitControls – examples/jsm/controls/OrbitControls.js

CSS2DRenderer – for always‑facing labels

GitHub REST API – repository data

License
MIT © José Melendez

GitHub | X/Twitter