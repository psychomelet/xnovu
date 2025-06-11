#!/bin/bash

# Script to update GitHub environment secrets from .env.local file
# Usage: ./scripts/update-github-env.sh

ENV_FILE=".env.local"
GITHUB_ENV="Test"

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found!"
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed!"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI!"
    echo "Please run: gh auth login"
    exit 1
fi

echo "Updating GitHub environment '$GITHUB_ENV' with secrets from $ENV_FILE..."
echo ""

# Read .env.local file line by line
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Parse key=value pairs
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove surrounding quotes if present
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        
        echo "Setting secret: $key"
        
        # Use gh CLI to set the secret
        if gh secret set "$key" -e "$GITHUB_ENV" --body "$value" 2>/dev/null; then
            echo "✓ Successfully set $key"
        else
            echo "✗ Failed to set $key"
        fi
        echo ""
    fi
done < "$ENV_FILE"

echo "Done! All secrets have been processed."
echo ""
echo "To verify the secrets were set, run:"
echo "gh secret list -e $GITHUB_ENV"