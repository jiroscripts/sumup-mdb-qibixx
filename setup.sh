#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🍓 Raspberry Pi Kiosk Setup Script${NC}"
echo "-----------------------------------"

# 1. Update System
echo -e "\n${BLUE}📦 Updating System Packages...${NC}"
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo -e "\n${BLUE}🐳 Installing Docker...${NC}"
    curl -sSL https://get.docker.com | sh
    
    echo -e "\n${BLUE}👤 Adding user $USER to docker group...${NC}"
    sudo usermod -aG docker $USER
    
    echo -e "${RED}⚠️  You will need to logout and login again for docker group changes to take effect.${NC}"
else
    echo -e "\n${GREEN}✅ Docker is already installed.${NC}"
fi

# 3. Install Docker Compose (if not included in plugin)
# Usually included now, but good to check
if ! docker compose version &> /dev/null; then
     echo -e "\n${BLUE}🐳 Installing Docker Compose Plugin...${NC}"
     sudo apt-get install -y docker-compose-plugin
fi

# 4. Install Make (if not installed)
if ! command -v make &> /dev/null; then
    echo -e "\n${BLUE}🛠️  Installing Make...${NC}"
    sudo apt-get install -y make
fi

# 5. Configuration Setup
echo -e "\n${BLUE}⚙️  Setting up Configuration...${NC}"

if [ ! -f .env ]; then
    if [ -f .env.kiosk.example ]; then
        echo "Copying .env.kiosk.example to .env..."
        cp .env.kiosk.example .env
        echo -e "${GREEN}✅ Created .env file.${NC}"
        echo -e "${RED}👉 ACTION REQUIRED: Please edit .env and set your KIOSK_EMAIL and KIOSK_PASSWORD!${NC}"
    else
        echo -e "${RED}❌ Error: .env.kiosk.example not found! Are you in the project root?${NC}"
    fi
else
    echo -e "${GREEN}✅ .env file already exists.${NC}"
fi

# 6. Final Instructions
echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
echo "-----------------------------------"
echo "Next Steps:"
echo "1. Edit the .env file:  nano .env"
echo "2. Start Production:    make docker-prod"
echo "3. Start Dev Mode:      make docker-dev"
