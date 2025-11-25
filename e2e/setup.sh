#!/bin/bash

# E2E Test Setup Script
# This script prepares the environment for running E2E tests

set -e

echo "🚀 Setting up E2E test environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Start Docker services
echo "📦 Starting Docker services..."
npm run docker:up

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
until docker exec $(docker ps -qf "name=postgres") pg_isready > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check Redis
until docker exec $(docker ps -qf "name=redis") redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done
echo "✅ Redis is ready"

# Build all packages
echo "🔨 Building packages..."
npm run build

# Install Playwright browsers if not already installed
echo "🌐 Installing Playwright browsers..."
pnpm --filter @bookmark-manager/frontend exec playwright install chromium

echo "✅ E2E test environment is ready!"
echo ""
echo "You can now run E2E tests with:"
echo "  npm run test:e2e          # Run all tests"
echo "  npm run test:e2e:ui       # Run with UI"
echo "  npm run test:e2e:headed   # Run in headed mode"
echo "  npm run test:e2e:debug    # Run in debug mode"
