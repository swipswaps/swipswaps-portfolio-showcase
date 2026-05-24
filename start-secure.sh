#!/bin/bash
# Start backend and HTTPS proxy, kill only children on exit (no suicide)
set -e

cleanup() {
    echo "🛑 Stopping services..."
    # Kill only the processes we started, not the entire process group
    pkill -P $$ 2>/dev/null || true
    wait 2>/dev/null
    echo "✅ Stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "🚀 Starting backend on port 8000..."
node server.js &
BACKEND_PID=$!

sleep 2
echo "🔒 Starting HTTPS proxy on port 8443 -> localhost:8000"
# Find certificate files
CERT_FILE=$(ls localhost+*.pem 2>/dev/null | grep -v key | head -1)
KEY_FILE=$(ls localhost+*-key.pem 2>/dev/null | head -1)

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo "⚠️ Certificate files not found – using self-signed (may still warn)"
    local-ssl-proxy --source 8443 --target 8000 &
else
    local-ssl-proxy --source 8443 --target 8000 --key "$KEY_FILE" --cert "$CERT_FILE" &
fi
PROXY_PID=$!

echo "✅ Both services running. Backend: http://localhost:8000, Proxy: https://localhost:8443"
echo "   Press Ctrl+C to stop both."

# Wait for both child processes
wait $BACKEND_PID $PROXY_PID 2>/dev/null
