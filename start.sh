#!/bin/bash
cd /workspace/eyewear-platform/server
node server.js &
sleep 5
cd /workspace/eyewear-platform
node proxy-server.js &
wait
