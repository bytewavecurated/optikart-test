#!/bin/bash
cd /workspace/eyewear-platform/server
node server.js &
SERVER_PID=$!
cd /workspace/eyewear-platform
node proxy-server.js &
PROXY_PID=$!
echo "Servers started - Server PID: $SERVER_PID, Proxy PID: $PROXY_PID"
wait
