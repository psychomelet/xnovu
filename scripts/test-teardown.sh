#!/bin/bash

# Test teardown script to stop Redis after tests

set -e

echo "🧹 Cleaning up test environment..."

# Stop and remove Redis container
docker-compose -f docker-compose.test.yml down

echo "✅ Test environment cleaned up!"