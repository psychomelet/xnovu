#!/bin/bash

# Script to clean up Temporal namespaces by prefix
# Usage: ./cleanup-temporal-namespaces.sh <namespace-prefix> [--env <env-name>]
# Examples:
#   ./cleanup-temporal-namespaces.sh test-ns-                    # Use default/local temporal
#   ./cleanup-temporal-namespaces.sh test-ns- --env hooloovoo   # Use hooloovoo environment

# Check if prefix argument is provided
if [ $# -eq 0 ]; then
    echo "Error: No namespace prefix provided"
    echo "Usage: $0 <namespace-prefix> [--env <env-name>]"
    echo "Examples:"
    echo "  $0 test-ns-unit-                    # Use default/local temporal"
    echo "  $0 test-ns- --env hooloovoo        # Use hooloovoo environment"
    exit 1
fi

NAMESPACE_PREFIX=$1
USE_ENV_CONFIG=false
ENV_NAME=""

# Check for --env parameter
if [ $# -ge 3 ] && [ "$2" = "--env" ]; then
    USE_ENV_CONFIG=true
    ENV_NAME=$3
fi

# Load environment variables if .env exists and not using --env
if [ "$USE_ENV_CONFIG" = false ] && [ -f .env ]; then
    source .env
fi

# Use TEMPORAL_ADDRESS from env or default (only if not using --env)
if [ "$USE_ENV_CONFIG" = false ]; then
    TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
    TEMPORAL_TLS="${TEMPORAL_TLS:-false}"
    
    # Convert string to boolean
    if [ "$TEMPORAL_TLS" = "true" ]; then
        USE_TLS=true
    else
        USE_TLS=false
    fi
fi

echo "================================================"
echo "Temporal Namespace Cleanup Script"
echo "================================================"
if [ "$USE_ENV_CONFIG" = true ]; then
    echo "Environment: $ENV_NAME"
else
    echo "Server: $TEMPORAL_ADDRESS"
    echo "TLS: $USE_TLS"
fi
echo "Prefix: $NAMESPACE_PREFIX"
echo ""

# Get all namespaces with the specified prefix
echo "Searching for namespaces with prefix '$NAMESPACE_PREFIX'..."
if [ "$USE_ENV_CONFIG" = true ]; then
    namespaces=$(temporal --env "$ENV_NAME" operator namespace list 2>&1 | \
      grep -A1 "NamespaceInfo.Name.*${NAMESPACE_PREFIX}" | \
      grep "NamespaceInfo.Name" | \
      awk '{print $2}')
else
    if [ "$USE_TLS" = true ]; then
        namespaces=$(temporal operator namespace list --address "$TEMPORAL_ADDRESS" --tls 2>&1 | \
          grep -A1 "NamespaceInfo.Name.*${NAMESPACE_PREFIX}" | \
          grep "NamespaceInfo.Name" | \
          awk '{print $2}')
    else
        namespaces=$(temporal operator namespace list --address "$TEMPORAL_ADDRESS" 2>&1 | \
          grep -A1 "NamespaceInfo.Name.*${NAMESPACE_PREFIX}" | \
          grep "NamespaceInfo.Name" | \
          awk '{print $2}')
    fi
fi

# Check if any namespaces were found
if [ -z "$namespaces" ]; then
    echo "No namespaces found with prefix '$NAMESPACE_PREFIX'"
    exit 0
fi

# Count total namespaces
total=$(echo "$namespaces" | wc -l)
echo "Found $total namespace(s) to delete:"
echo "$namespaces" | sed 's/^/  - /'
echo ""

# Confirm deletion
read -p "Are you sure you want to delete these $total namespace(s)? (yes/y/no): " confirm
if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
    echo "Deletion cancelled"
    exit 0
fi

echo ""
echo "Starting deletion process..."
echo ""

# Counter for progress
count=0
success=0
failed=0

# Delete each namespace
for namespace in $namespaces; do
    count=$((count + 1))
    echo "[$count/$total] Deleting namespace: $namespace"
    
    # Attempt to delete the namespace
    if [ "$USE_ENV_CONFIG" = true ]; then
        result=$(temporal --env "$ENV_NAME" operator namespace delete \
            --namespace "$namespace" \
            --yes 2>&1)
    else
        if [ "$USE_TLS" = true ]; then
            result=$(temporal operator namespace delete \
                --namespace "$namespace" \
                --address "$TEMPORAL_ADDRESS" \
                --tls \
                --yes 2>&1)
        else
            result=$(temporal operator namespace delete \
                --namespace "$namespace" \
                --address "$TEMPORAL_ADDRESS" \
                --yes 2>&1)
        fi
    fi
    
    if echo "$result" | grep -q "has been deleted"; then
        echo "  ✓ Successfully deleted $namespace"
        success=$((success + 1))
    else
        echo "  ✗ Failed to delete $namespace"
        failed=$((failed + 1))
    fi
done

echo ""
echo "================================================"
echo "Cleanup Summary"
echo "================================================"
echo "Total namespaces processed: $count"
echo "Successfully deleted: $success"
echo "Failed to delete: $failed"
echo ""

# Final verification
if [ "$USE_ENV_CONFIG" = true ]; then
    remaining=$(temporal --env "$ENV_NAME" operator namespace list 2>&1 | \
      grep -c "NamespaceInfo.Name.*${NAMESPACE_PREFIX}")
else
    if [ "$USE_TLS" = true ]; then
        remaining=$(temporal operator namespace list --address "$TEMPORAL_ADDRESS" --tls 2>&1 | \
          grep -c "NamespaceInfo.Name.*${NAMESPACE_PREFIX}")
    else
        remaining=$(temporal operator namespace list --address "$TEMPORAL_ADDRESS" 2>&1 | \
          grep -c "NamespaceInfo.Name.*${NAMESPACE_PREFIX}")
    fi
fi
echo "Remaining namespaces with prefix '$NAMESPACE_PREFIX': $remaining"

if [ $remaining -eq 0 ]; then
    echo ""
    echo "✅ All namespaces with prefix '$NAMESPACE_PREFIX' have been successfully deleted!"
else
    echo ""
    echo "⚠️  Some namespaces with prefix '$NAMESPACE_PREFIX' still remain. You may need to run the script again."
fi