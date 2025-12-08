#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Supabase Project Initialization...${NC}"

# 1. Check Prerequisites
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Error: npm/npx is not installed.${NC}"
    exit 1
fi

# 2. Login
echo -e "\n${BLUE}🔑 Logging into Supabase...${NC}"
npx supabase login

# 3. Link Project
echo -e "\n${BLUE}🔗 Linking Project...${NC}"
# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found. Please copy .env.development.example to .env and fill it.${NC}"
    exit 1
fi

# Extract Project ID from .env or ask user
# We look for SUPABASE_URL and extract the project ref (subdomain)
# URL format: https://<project_ref>.supabase.co
PROJECT_REF=$(grep SUPABASE_URL .env | cut -d '=' -f2 | sed 's/"//g' | cut -d '/' -f3 | cut -d '.' -f1)

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}⚠️  Could not auto-detect Project ID from SUPABASE_URL in .env${NC}"
    read -p "Please enter your Supabase Project Reference ID: " PROJECT_REF
else
    echo -e "Detected Project ID: ${GREEN}$PROJECT_REF${NC}"
fi

# Link
npx supabase link --project-ref "$PROJECT_REF"

# 4. Push Secrets (Env Vars)
echo -e "\n${BLUE}wm  Pushing Secrets to Supabase...${NC}"
npx supabase secrets set --env-file .env

# 5. Push Database Schema
echo -e "\n${BLUE}🗄️  Pushing Database Schema...${NC}"
npx supabase db push

# 6. Deploy Edge Functions
echo -e "\n${BLUE}⚡ Deploying Edge Functions...${NC}"
npx supabase functions deploy --no-verify-jwt

echo -e "\n${GREEN}✅ Supabase Initialization Complete!${NC}"
echo -e "Your backend is ready."
