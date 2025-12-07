#!/bin/bash

# 1. Install Docker (if not installed)
if ! command -v docker &> /dev/null
then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed! You might need to logout and login again."
else
    echo "✅ Docker is already installed."
fi

# 2. Install Docker Compose (if needed, usually included in new docker versions)
# ...

# 3. Setup Environment
if [ ! -f .env ]; then
    echo "⚠️ .env file not found! Copying from .env.example..."
    cp .env.example .env
    echo "Please edit .env with your credentials."
    exit 1
fi

# 4. Launch Services
echo "🚀 Launching Services..."
docker compose up --build -d

echo "✅ Deployment Complete!"
echo "   - Frontend Kiosk: http://localhost:8080"
echo "   - Web App:        http://localhost:5174"
