#!/bin/bash

# Script to verify a tunnel URL

if [ -z "$1" ]; then
    echo "Usage: $0 <tunnel-url>"
    echo "Example: $0 https://fuzzy-cats-jump.loca.lt/api/novu"
    exit 1
fi

TUNNEL_URL=$1

echo "🔍 Verifying tunnel: $TUNNEL_URL"
echo "================================"
echo ""

# Test 1: Basic connectivity
echo "1. Testing basic connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL")
echo "   HTTP Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Tunnel is accessible!"
elif [ "$HTTP_CODE" = "503" ]; then
    echo "   ❌ Tunnel exists but server is not responding (503 - Service Unavailable)"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️  Tunnel is working but endpoint not found (404)"
else
    echo "   ❌ Unexpected response code: $HTTP_CODE"
fi

echo ""

# Test 2: Response headers
echo "2. Checking response headers..."
curl -I "$TUNNEL_URL" 2>/dev/null | head -n 5

echo ""

# Test 3: Try to get actual response
echo "3. Attempting to get response body..."
RESPONSE=$(curl -s "$TUNNEL_URL" | head -c 200)
if [ -n "$RESPONSE" ]; then
    echo "   Response preview:"
    echo "   $RESPONSE"
else
    echo "   No response body received"
fi

echo ""
echo "✅ Tunnel verification complete!"