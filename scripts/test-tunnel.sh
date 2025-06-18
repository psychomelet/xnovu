#!/bin/bash

# Test script for verifying tunnel functionality

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Source .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "📋 Loading environment variables from .env..."
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "⚠️  Warning: .env file not found at $PROJECT_ROOT/.env"
fi

echo "🌐 Testing XNovu Tunnel Creation"
echo "================================"
echo ""

# Check environment
if [ -z "$NOVU_SECRET_KEY" ]; then
    echo "⚠️  Warning: NOVU_SECRET_KEY is not set"
    echo "The sync will fail without it, but we can still test the tunnel"
fi

echo "📋 This test will:"
echo "  1. Start a Next.js server on a random port"
echo "  2. Create a public tunnel"
echo "  3. Keep the tunnel alive for testing"
echo "  4. Display the tunnel URL for verification"
echo ""
echo "You can then test the tunnel by visiting the URL in a browser"
echo "or using curl to verify it's accessible"
echo ""
echo "Press Ctrl+C twice to stop the server and tunnel when done"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Run sync with keep-alive to test the tunnel
echo ""
echo "🚀 Starting sync with --keep-alive flag..."
echo ""

# Capture the output to show the tunnel URL
pnpm xnovu sync --keep-alive 2>&1 | tee /tmp/tunnel-test.log &
SYNC_PID=$!

# Wait a bit for the tunnel to be created
sleep 10

# Extract and display the tunnel URL
echo ""
echo "📡 Tunnel Information:"
echo "====================="
grep "Tunnel URL:" /tmp/tunnel-test.log || echo "Waiting for tunnel creation..."

# Keep the script running
wait $SYNC_PID