#!/bin/bash

# Test setup script to start Redis for tests

set -e

echo "🐳 Starting Redis container for tests..."

# Stop and remove existing test Redis container if it exists
docker-compose -f docker-compose.test.yml down || true

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