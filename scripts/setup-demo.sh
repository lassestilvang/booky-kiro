#!/bin/bash

# Complete Demo Setup Script
# 
# This script sets up a complete demo environment with:
# - Demo user with Pro plan
# - 50+ sample bookmarks
# - Collections with hierarchy
# - Tags, highlights, and shared collections
#
# Usage: ./scripts/setup-demo.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo -e "${BLUE}"
echo "========================================"
echo "Bookmark Manager - Demo Setup"
echo "========================================"
echo -e "${NC}"

# Check if API is running
echo -e "${YELLOW}Checking API server...${NC}"
if curl -s "$API_BASE_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ API server is running${NC}"
else
  echo -e "${RED}✗ API server is not running${NC}"
  echo ""
  echo "Please start the API server first:"
  echo "  cd packages/backend"
  echo "  npm run dev"
  echo ""
  exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js is not installed${NC}"
  exit 1
fi

# Step 1: Create demo user
echo ""
echo -e "${BLUE}Step 1: Creating demo user with Pro plan...${NC}"
node scripts/create-demo-user.js

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Failed to create demo user${NC}"
  exit 1
fi

# Step 2: Seed demo data
echo ""
echo -e "${BLUE}Step 2: Seeding demo data...${NC}"
node scripts/seed-demo-data.js

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Failed to seed demo data${NC}"
  exit 1
fi

# Success message
echo ""
echo -e "${GREEN}"
echo "========================================"
echo "✓ Demo setup completed successfully!"
echo "========================================"
echo -e "${NC}"
echo ""
echo "Demo Account:"
echo "  Email: demo@example.com"
echo "  Password: Demo123!"
echo "  Plan: Pro (all features enabled)"
echo ""
echo "What's included:"
echo "  ✓ 10 collections with hierarchy"
echo "  ✓ 50+ bookmarks across various categories"
echo "  ✓ Tags on all bookmarks"
echo "  ✓ 4 highlights with annotations"
echo "  ✓ 1 public shared collection"
echo ""
echo "Next steps:"
echo "  1. Open the web app: http://localhost:5173"
echo "  2. Login with the credentials above"
echo "  3. Explore the demo data"
echo ""
echo "Optional:"
echo "  - Run API tests: ./scripts/sample-api-requests.sh"
echo "  - View scripts documentation: cat scripts/README.md"
echo ""
