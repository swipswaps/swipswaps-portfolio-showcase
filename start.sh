#!/bin/bash
cd "$(dirname "$0")"

PORT=8000

trap 'echo "🛑 Stopping server..."; exit' INT TERM

echo "🔍 Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ and try again."
    exit 1
fi

if [ ! -f "server.js" ]; then
    echo "❌ server.js not found in current directory."
    exit 1
fi

# List of required packages (including better-sqlite3)
REQUIRED_PKGS="express cors node-fetch helmet compression express-rate-limit express-validator winston envalid node-cache dotenv better-sqlite3"

# Install dependencies if node_modules is missing or any package is missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install $REQUIRED_PKGS --silent
else
    # Check if better-sqlite3 is installed (it might be missing from earlier)
    if ! npm list better-sqlite3 > /dev/null 2>&1; then
        echo "⚠️  better-sqlite3 missing, installing..."
        npm install better-sqlite3 --silent
    fi
    # Also ensure other critical packages are present (optional, but safe)
    for pkg in $REQUIRED_PKGS; do
        if ! npm list "$pkg" > /dev/null 2>&1; then
            echo "⚠️  $pkg missing, installing all dependencies..."
            npm install $REQUIRED_PKGS --silent
            break
        fi
    done
    echo "✅ Dependencies already installed."
fi

echo "🧹 Checking for processes using port $PORT..."
if command -v lsof &> /dev/null; then
    PID=$(lsof -t -i:$PORT)
elif command -v fuser &> /dev/null; then
    PID=$(fuser $PORT/tcp 2>/dev/null | awk '{print $1}')
else
    PID=""
fi

if [ -n "$PID" ]; then
    if ps -p $PID -o comm= | grep -q "node"; then
        echo "🔄 Killing old Node.js process (PID $PID) on port $PORT..."
        kill -9 $PID 2>/dev/null
        sleep 1
    else
        echo "⚠️  Port $PORT is already in use by a non-Node process (PID $PID)."
        echo "   Please stop that process manually or change PORT in .env"
        exit 1
    fi
else
    echo "✅ Port $PORT is free."
fi

echo "🚀 Starting backend server on http://localhost:$PORT"
echo "   API endpoints: /api/health, /api/repos, /api/search-code"
echo "   (Search now queries real README content via SQLite)"
echo "   Press Ctrl+C to stop."

node server.js
