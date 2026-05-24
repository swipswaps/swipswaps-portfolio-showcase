#!/bin/bash
# Start both backend (HTTP on 8000) and HTTPS proxy (8443) with trusted cert
trap 'echo "🛑 Stopping both services..."; kill 0' SIGINT SIGTERM EXIT

echo "🚀 Starting backend on port 8000..."
node server.js &
BACKEND_PID=$!

sleep 2
echo "🔒 Starting HTTPS proxy on port 8443 -> localhost:8000"
# Use the generated cert files (mkcert creates localhost+2.pem etc. - find the actual names)
CERT_FILE=$(ls localhost*.pem 2>/dev/null | head -1)
KEY_FILE=$(ls localhost*-key.pem 2>/dev/null | head -1)
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    local-ssl-proxy --source 8443 --target 8000 --key "$KEY_FILE" --cert "$CERT_FILE" &
else
    echo "⚠️ Certificate files not found, using self-signed (may still warn)"
    local-ssl-proxy --source 8443 --target 8000 &
fi
PROXY_PID=$!

echo "✅ Both services running. Backend: http://localhost:8000, Proxy: https://localhost:8443"
echo "   Press Ctrl+C to stop both."

wait
