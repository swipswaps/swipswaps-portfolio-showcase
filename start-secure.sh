#!/bin/bash
trap 'echo "🛑 Stopping both services..."; kill 0' SIGINT SIGTERM EXIT

echo "🚀 Starting backend on port 8000..."
node server.js &
BACKEND_PID=$!
sleep 2

# Find the exact certificate files created by mkcert
CERT_FILE=$(ls localhost+*.pem 2>/dev/null | grep -v key | head -1)
KEY_FILE=$(ls localhost+*-key.pem 2>/dev/null | head -1)

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo "❌ Certificate files not found. Run mkcert again:"
    echo "   mkcert localhost 127.0.0.1 ::1"
    exit 1
fi

echo "🔒 Using cert: $CERT_FILE"
echo "🔒 Using key:  $KEY_FILE"

# Verify the files are not empty
if [ ! -s "$CERT_FILE" ] || [ ! -s "$KEY_FILE" ]; then
    echo "❌ Certificate or key file is empty. Regenerate with mkcert."
    exit 1
fi

echo "🔒 Starting HTTPS proxy on port 8443 -> localhost:8000"
local-ssl-proxy --source 8443 --target 8000 --key "$KEY_FILE" --cert "$CERT_FILE" &
PROXY_PID=$!

echo "✅ Both services running. Backend: http://localhost:8000, Proxy: https://localhost:8443"
echo "   Press Ctrl+C to stop both."
wait
