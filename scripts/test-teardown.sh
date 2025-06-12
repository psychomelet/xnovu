#!/bin/bash

# Test Teardown Script
# Cleans up test environment after integration tests

echo "Cleaning up test environment..."

# Stop and remove Temporal test container if it exists
if [ "$(docker ps -a -q -f name=temporal-test)" ]; then
  echo "Stopping Temporal test container..."
  docker stop temporal-test
  docker rm temporal-test
fi

echo "Test environment cleanup complete"