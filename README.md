# swipswaps Portfolio - 3D Tag Cloud

Interactive 3D visualization of GitHub repositories with real-time filtering and click-to-open functionality.

## Live Site

[https://swipswaps.github.io/swipswaps-portfolio-showcase/](https://swipswaps.github.io/swipswaps-portfolio-showcase/)

## Features

- 🎯 **3D Tag Cloud** - Repositories arranged on a sphere using Fibonacci distribution
- 🔍 **Real-time Filtering** - Type to filter repositories by name
- 🖱️ **Drag to Rotate** - Full OrbitControls support
- 💡 **Hover Tooltips** - Shows language, stars, and last update
- 🔗 **Click to Open** - Opens GitHub repository in new tab
- 📊 **Live Stats** - Shows total repos, stars, and visible count
- 🗄️ **PostgreSQL Backend** - Persistent storage with automatic GitHub sync

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Modern browser with WebGL support

### Setup Backend (Optional - for local data persistence)

```bash
# Install PostgreSQL
sudo dnf install postgresql-server postgresql-contrib  # Fedora/RHEL
# OR
sudo apt install postgresql postgresql-contrib        # Debian/Ubuntu

# Initialize
sudo postgresql-setup --initdb
sudo systemctl start postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE portfolio;"
sudo -u postgres psql -c "CREATE USER portfolio_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE portfolio TO portfolio_user;"

# Run schema
psql -h localhost -U portfolio_user -d portfolio < schema.sql

# Run sync script
./sync_repos.sh

Run Local Server
bash

# Using Python (no backend needed - static only)
python3 -m http.server 8000

# Using Node (with PostgreSQL backend)
npm install
node server.js

Architecture
text

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GitHub API    │────▶│   PostgreSQL    │────▶│   WebSocket     │
│  (source of     │     │  (persistent    │     │  (live updates) │
│   truth)        │     │   storage)      │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Three.js      │◀────│   Express API   │◀────│   Browser       │
│  (3D rendering) │     │  (REST + WS)    │     │  (client)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘

File Structure
text

/
├── index.html          # Main 3D tag cloud (Three.js + OrbitControls)
├── schema.sql          # PostgreSQL database schema
├── server.js           # Node.js backend (Express + WebSocket + PG)
├── sync_repos.sh       # GitHub sync script (run via cron)
├── repos.json          # Fallback data (when API rate-limited)
├── README.md           # This file
└── LICENSE             # MIT License

Technologies
Component	Technology	Purpose
3D Rendering	Three.js	WebGL-based 3D visualization
Camera Controls	OrbitControls	Drag-to-rotate, zoom
Database	PostgreSQL 15+	Persistent repository storage
Real-time	WebSocket + LISTEN/NOTIFY	Live updates on data changes
Text Rendering	CanvasTexture + Sprites	Labels that always face camera
Distribution	Fibonacci Sphere	Even point distribution on sphere
Citations

    Three.js Documentation - 3D rendering engine

    OrbitControls Example - Camera controls

    Fibonacci Sphere Algorithm - Even point distribution

    PostgreSQL LISTEN/NOTIFY - Real-time notifications

    GitHub REST API - Repository data source

License

MIT © Jose Melendez

Links: GitHub | X/Twitter | Portfolio
