#!/bin/bash

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "Starting Backend..."
cd backend
# Install python deps if needed (optional check)
# pip install -r requirements.txt
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

echo "Starting Frontend..."
cd frontend
# Install npm deps if needed (optional check)
# npm install
npm run dev -- --port 5173 &
FRONTEND_PID=$!
cd ..

echo "Starting Documentation Server..."
cd docs
# Simple python server for docs
python3 -m http.server 3000 &
DOCS_PID=$!
cd ..

echo "System Running!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Docs:     http://localhost:3000"
echo "Press CTRL+C to stop."

wait
