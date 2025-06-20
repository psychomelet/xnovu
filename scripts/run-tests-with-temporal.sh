#!/bin/bash

# Start Temporal server in the background
echo "Starting Temporal server in background..."
pnpm temporal:start &
TEMPORAL_PID=$!

# Wait for Temporal to be ready
echo "Waiting for Temporal server to be ready..."
for i in {1..30}; do
  if pnpm temporal:check 2>/dev/null; then
    echo "✓ Temporal server is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ Temporal server failed to start"
    kill $TEMPORAL_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

# Run the actual tests
echo "Running tests..."
jest --runInBand "$@"
TEST_EXIT_CODE=$?

# Stop Temporal server
echo "Stopping Temporal server..."
kill $TEMPORAL_PID 2>/dev/null
wait $TEMPORAL_PID 2>/dev/null

# Exit with the test exit code
exit $TEST_EXIT_CODE