#!/bin/bash

# Start Temporal services for development
echo "Starting Temporal services..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "Error: Docker or docker-compose is not installed"
    exit 1
fi

# Use docker compose if available (newer syntax)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Start Temporal services
$COMPOSE_CMD up -d temporal temporal-postgres temporal-ui temporal-admin-tools

# Wait for Temporal to be ready
echo "Waiting for Temporal to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:7233 > /dev/null 2>&1; then
        echo "✅ Temporal is ready!"
        echo ""
        echo "Temporal UI: http://localhost:8080"
        echo "Temporal Server: localhost:7233"
        echo ""
        echo "To view logs: $COMPOSE_CMD logs -f temporal"
        echo "To stop: $COMPOSE_CMD down"
        exit 0
    fi
    
    attempt=$((attempt + 1))
    echo "Waiting for Temporal... ($attempt/$max_attempts)"
    sleep 2
done

echo "❌ Temporal failed to start after $max_attempts attempts"
echo "Check logs with: $COMPOSE_CMD logs temporal"
exit 1