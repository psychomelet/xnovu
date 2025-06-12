#!/bin/bash

# Test teardown script to stop Redis after tests

set -e

# Skip teardown in CI environment
if [ "$CI" = "true" ]; then
  echo "🚀 Running in CI environment - skipping Docker teardown"
  exit 0
fi

echo "🧹 Cleaning up test environment..."

# Stop and remove Redis container
docker-compose -f docker-compose.test.yml down >/dev/null 2>&1

echo "✅ Test environment cleaned up!"