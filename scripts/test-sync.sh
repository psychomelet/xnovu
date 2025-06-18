#!/bin/bash

# Test script for the simplified sync process

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

echo "🧪 Testing XNovu Sync Process"
echo "============================="
echo ""

# Check if required environment variables are set
if [ -z "$NOVU_SECRET_KEY" ]; then
    echo "❌ Error: NOVU_SECRET_KEY is not set"
    echo "Please set it in your .env file"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Supabase credentials are not set"
    echo "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file"
    exit 1
fi

echo "✅ Environment variables are configured"
echo ""

# Test help command
echo "📖 Testing help command..."
pnpm xnovu sync --help
echo ""

# Test dry run (just show what would happen)
echo "🔍 Running sync in development mode..."
echo "This will:"
echo "  1. Start Next.js server on port 4000"
echo "  2. Create a public tunnel"
echo "  3. Sync workflows to Novu Cloud"
echo "  4. Update database"
echo "  5. Clean up resources"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

# Run the sync
pnpm xnovu sync

echo ""
echo "✅ Sync test completed!"