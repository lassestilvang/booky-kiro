#!/bin/bash

# Sample API Requests for Bookmark Manager Platform
# This script demonstrates common API operations using curl
#
# Usage: ./scripts/sample-api-requests.sh
#
# Prerequisites:
# - API server running on localhost:3000
# - Demo user created (run: node scripts/create-demo-user.js)

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
DEMO_EMAIL="${DEMO_USER_EMAIL:-demo@example.com}"
DEMO_PASSWORD="${DEMO_USER_PASSWORD:-Demo123!}"

echo "========================================"
echo "Bookmark Manager API - Sample Requests"
echo "========================================"
echo "API: $API_BASE_URL"
echo "User: $DEMO_EMAIL"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Register User
echo -e "\n${BLUE}1. Register User${NC}"
echo "POST /v1/auth/register"
curl -X POST "$API_BASE_URL/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DEMO_EMAIL\",
    \"password\": \"$DEMO_PASSWORD\",
    \"name\": \"Demo User\"
  }" \
  -w "\nStatus: %{http_code}\n" \
  -s || echo "User may already exist"

# 2. Login
echo -e "\n${BLUE}2. Login${NC}"
echo "POST /v1/auth/login"
LOGIN_RESPONSE=$(curl -X POST "$API_BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DEMO_EMAIL\",
    \"password\": \"$DEMO_PASSWORD\"
  }" \
  -s)

echo "$LOGIN_RESPONSE" | jq '.'
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to get access token"
  exit 1
fi

echo -e "${GREEN}✓ Logged in successfully${NC}"

# 3. Get User Profile
echo -e "\n${BLUE}3. Get User Profile${NC}"
echo "GET /v1/user"
curl -X GET "$API_BASE_URL/v1/user" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 4. Create Collection
echo -e "\n${BLUE}4. Create Collection${NC}"
echo "POST /v1/collections"
COLLECTION_RESPONSE=$(curl -X POST "$API_BASE_URL/v1/collections" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Bookmarks",
    "icon": "bookmark"
  }' \
  -s)

echo "$COLLECTION_RESPONSE" | jq '.'
COLLECTION_ID=$(echo "$COLLECTION_RESPONSE" | jq -r '.id')
echo -e "${GREEN}✓ Collection created: $COLLECTION_ID${NC}"

# 5. Create Bookmark
echo -e "\n${BLUE}5. Create Bookmark${NC}"
echo "POST /v1/bookmarks"
BOOKMARK_RESPONSE=$(curl -X POST "$API_BASE_URL/v1/bookmarks" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://github.com\",
    \"title\": \"GitHub\",
    \"excerpt\": \"Where the world builds software\",
    \"type\": \"article\",
    \"collectionId\": \"$COLLECTION_ID\",
    \"tags\": [\"development\", \"git\", \"tools\"]
  }" \
  -s)

echo "$BOOKMARK_RESPONSE" | jq '.'
BOOKMARK_ID=$(echo "$BOOKMARK_RESPONSE" | jq -r '.id')
echo -e "${GREEN}✓ Bookmark created: $BOOKMARK_ID${NC}"

# 6. List Bookmarks
echo -e "\n${BLUE}6. List Bookmarks${NC}"
echo "GET /v1/bookmarks"
curl -X GET "$API_BASE_URL/v1/bookmarks?limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 7. Get Bookmark Details
echo -e "\n${BLUE}7. Get Bookmark Details${NC}"
echo "GET /v1/bookmarks/$BOOKMARK_ID"
curl -X GET "$API_BASE_URL/v1/bookmarks/$BOOKMARK_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 8. Update Bookmark
echo -e "\n${BLUE}8. Update Bookmark${NC}"
echo "PUT /v1/bookmarks/$BOOKMARK_ID"
curl -X PUT "$API_BASE_URL/v1/bookmarks/$BOOKMARK_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "GitHub - Updated",
    "excerpt": "The complete developer platform to build, scale, and deliver secure software"
  }' \
  -s | jq '.'

# 9. Create Tag
echo -e "\n${BLUE}9. Create Tag${NC}"
echo "POST /v1/tags"
TAG_RESPONSE=$(curl -X POST "$API_BASE_URL/v1/tags" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "important",
    "color": "#FF0000"
  }' \
  -s)

echo "$TAG_RESPONSE" | jq '.'

# 10. List Tags
echo -e "\n${BLUE}10. List Tags${NC}"
echo "GET /v1/tags"
curl -X GET "$API_BASE_URL/v1/tags" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 11. Search Bookmarks
echo -e "\n${BLUE}11. Search Bookmarks${NC}"
echo "GET /v1/search?q=github"
curl -X GET "$API_BASE_URL/v1/search?q=github" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 12. Filter Bookmarks by Tags
echo -e "\n${BLUE}12. Filter Bookmarks by Tags${NC}"
echo "GET /v1/bookmarks?tags=development,git"
curl -X GET "$API_BASE_URL/v1/bookmarks?tags=development,git" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 13. Create Highlight (Pro feature)
echo -e "\n${BLUE}13. Create Highlight (Pro feature)${NC}"
echo "POST /v1/highlights"
HIGHLIGHT_RESPONSE=$(curl -X POST "$API_BASE_URL/v1/highlights" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bookmarkId\": \"$BOOKMARK_ID\",
    \"textSelected\": \"Where the world builds software\",
    \"color\": \"#FFFF00\",
    \"annotationMd\": \"Key tagline for GitHub\",
    \"positionContext\": {
      \"before\": \"\",
      \"after\": \"\"
    }
  }" \
  -s)

echo "$HIGHLIGHT_RESPONSE" | jq '.'
if echo "$HIGHLIGHT_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Highlight created${NC}"
else
  echo "Note: Highlights require Pro plan"
fi

# 14. List Collections
echo -e "\n${BLUE}14. List Collections${NC}"
echo "GET /v1/collections"
curl -X GET "$API_BASE_URL/v1/collections" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 15. Export Collection
echo -e "\n${BLUE}15. Export Collection${NC}"
echo "GET /v1/export/$COLLECTION_ID?format=json"
curl -X GET "$API_BASE_URL/v1/export/$COLLECTION_ID?format=json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.' | head -20

# 16. Get User Stats
echo -e "\n${BLUE}16. Get User Stats${NC}"
echo "GET /v1/user/stats"
curl -X GET "$API_BASE_URL/v1/user/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -s | jq '.'

# 17. Bulk Operations (Pro feature)
echo -e "\n${BLUE}17. Bulk Tag Application (Pro feature)${NC}"
echo "POST /v1/bookmarks/bulk"
curl -X POST "$API_BASE_URL/v1/bookmarks/bulk" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bookmarkIds\": [\"$BOOKMARK_ID\"],
    \"action\": \"add_tags\",
    \"params\": {
      \"tags\": [\"bulk-tagged\"]
    }
  }" \
  -s | jq '.'

echo -e "\n${GREEN}========================================"
echo "✓ Sample API requests completed!"
echo "========================================${NC}"
echo ""
echo "Summary of operations:"
echo "  ✓ User authentication"
echo "  ✓ Collection management"
echo "  ✓ Bookmark CRUD operations"
echo "  ✓ Tag management"
echo "  ✓ Search functionality"
echo "  ✓ Export functionality"
echo "  ✓ Pro features (highlights, bulk ops)"
echo ""
echo "Access Token (for manual testing):"
echo "$ACCESS_TOKEN"
echo ""
