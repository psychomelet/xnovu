#!/bin/bash

# Test Setup Script
# Sets up required services for integration tests

set -e

echo "Setting up test environment..."

# Start Temporal dev server if needed for tests
if [ "$RUN_TEMPORAL_TESTS" = "true" ]; then
  echo "Starting Temporal dev server for tests..."
  docker run -d \
    --name temporal-test \
    -p 7233:7233 \
    temporalio/auto-setup:latest
  
  # Wait for Temporal to be ready
  echo "Waiting for Temporal to be ready..."
  sleep 10
fi

echo "Test environment setup complete"