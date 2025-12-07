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
MODE=${1:-dev} # Default to dev

# Check if make is installed
if ! command -v make &> /dev/null
then
    echo "�️ Installing Make..."
    sudo apt-get update && sudo apt-get install -y make
fi

if [ "$MODE" = "prod" ]; then
    make docker-prod
else
    make docker-dev
fi
