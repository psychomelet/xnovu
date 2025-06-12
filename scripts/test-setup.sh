#!/bin/bash

# Test setup script to start Redis for tests

set -e

# Check if running in CI environment
if [ "$CI" = "true" ]; then
  echo "🚀 Running in CI environment - using GitHub Actions Redis service"
  # Verify Redis is accessible
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
      echo "✅ Redis service is ready!"
      exit 0
    else
      echo "❌ Redis service not responding"
      exit 1
    fi
  else
    echo "✅ Skipping Redis check - CI provides Redis service"
    exit 0
  fi
fi

echo "🐳 Starting Redis container for tests (local development)..."

# Stop any existing Redis instances on port 6379
echo "🛑 Stopping any existing Redis instances on port 6379..."
# Kill any process using port 6379
lsof -ti:6379 | xargs -r kill -9 2>/dev/null || true

# Stop and remove existing test Redis container if it exists
docker-compose -f docker-compose.test.yml down || true

# Also stop any other containers that might be using port 6379
# Find containers using port 6379 by checking port bindings
docker ps --format "table {{.ID}}	{{.Ports}}" | grep "6379" | awk '{print $1}' | grep -v "CONTAINER" | xargs -r docker stop 2>/dev/null || true
docker ps -a --format "table {{.ID}}	{{.Ports}}" | grep "6379" | awk '{print $1}' | grep -v "CONTAINER" | xargs -r docker rm 2>/dev/null || true

# Start Redis container
docker-compose -f docker-compose.test.yml up -d

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
timeout=30
counter=0

while [ $counter -lt $timeout ]; do
  if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready!"
    break
  fi
  
  echo "Waiting for Redis... ($counter/$timeout)"
  sleep 1
  counter=$((counter + 1))
done

if [ $counter -eq $timeout ]; then
  echo "❌ Redis failed to start within $timeout seconds"
  docker-compose -f docker-compose.test.yml logs redis-test
  exit 1
fi

echo "🚀 Test environment ready!"