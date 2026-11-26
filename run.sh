#!/usr/bin/env bash
# NexusEDA Startup Script

PORT=8501
HOST="0.0.0.0"

echo "=================================================="
echo " Starting NexusEDA Data Intelligence & Visual Explorer"
echo " Running on http://localhost:${PORT}"
echo "=================================================="

exec python3 -m uvicorn main:app --host ${HOST} --port ${PORT}
