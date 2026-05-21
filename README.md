# 3D Portfolio Word Cloud — Repository Timeline Visualization

An interactive Three.js visualization that displays GitHub repositories as a 3D word cloud arranged on a timeline by last push date.

## Features

- 🌐 **Live GitHub API integration** — fetches your actual repositories
- 📦 **Offline fallback** — uses `repos.json` when API rate limit is exceeded (60/hour)
- 🎨 **Language-coded colors** — each repository's color reflects its primary language
- 📅 **Timeline depth** — older repos appear further back, newer repos forward
- ✨ **Glowing 3D spheres** with interactive CSS2D labels
- 🖱️ **Orbit controls** — drag to rotate, scroll to zoom
- 🔗 **Click to open** — any sphere or label opens the GitHub repository

## Technology Stack

- Three.js (r0.160.0)
- CSS2DRenderer for crisp text labels
- GitHub REST API
- OrbitControls for camera movement

## Local Development

```bash
# Serve locally
python3 -m http.server 8000
# Open http://localhost:8000

Deployment

This repository is configured for GitHub Pages. The site is live at:
https://swipswaps.github.io/swipswaps-portfolio-showcase/
Credits

Built with Three.js and the GitHub API.

Jose Melendez · GitHub