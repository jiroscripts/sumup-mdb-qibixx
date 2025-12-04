#!/bin/bash

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "Starting Backend..."
# Launch from root so relative imports work
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting Frontend..."
cd frontend
npm run dev -- --port 5173 &
FRONTEND_PID=$!
cd ..

echo "Starting Documentation Server..."
cd docs
python3 -m http.server 3000 &
DOCS_PID=$!
cd ..

echo "System Running!"
echo "Backend: http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:5173"
echo "Docs:     http://127.0.0.1:3000"
echo "Press CTRL+C to stop."

wait