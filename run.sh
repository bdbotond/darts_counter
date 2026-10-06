#!/usr/bin/env bash
PORT=${1:-8000}
echo "Starting Darts Counter & Tournament server on http://localhost:$PORT ..."
echo "Press Ctrl+C to stop."
python3 -m http.server "$PORT"
