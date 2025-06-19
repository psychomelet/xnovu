#!/bin/bash

# Script to clean up Temporal namespaces by prefix
# Usage: ./cleanup-temporal-namespaces.sh <namespace-prefix> <env-name>
# Examples:
#   ./cleanup-temporal-namespaces.sh test-ns- lan         # Use lan environment
#   ./cleanup-temporal-namespaces.sh test-ns- hooloovoo   # Use hooloovoo environment

# Check if arguments are provided
if [ $# -lt 2 ]; then
    echo "Error: Missing required arguments"
    echo "Usage: $0 <namespace-prefix> <env-name>"
    echo "Examples:"
    echo "  $0 test-ns- lan         # Use lan environment"
    echo "  $0 test-ns- hooloovoo   # Use hooloovoo environment"
    exit 1
fi

NAMESPACE_PREFIX=$1
ENV_NAME=$2

echo "================================================"
echo "Temporal Namespace Cleanup Script"
echo "================================================"
echo "Environment: $ENV_NAME"
echo "Prefix: $NAMESPACE_PREFIX"
echo ""

# Get all namespaces with the specified prefix
echo "Searching for namespaces with prefix '$NAMESPACE_PREFIX'..."
namespaces=$(temporal --env "$ENV_NAME" operator namespace list 2>&1 | \
  grep -A1 "NamespaceInfo.Name.*${NAMESPACE_PREFIX}" | \
  grep "NamespaceInfo.Name" | \
  awk '{print $2}')

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
    result=$(temporal --env "$ENV_NAME" operator namespace delete \
        --namespace "$namespace" \
        --yes 2>&1)
    
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
remaining=$(temporal --env "$ENV_NAME" operator namespace list 2>&1 | \
  grep -c "NamespaceInfo.Name.*${NAMESPACE_PREFIX}")
echo "Remaining namespaces with prefix '$NAMESPACE_PREFIX': $remaining"

if [ $remaining -eq 0 ]; then
    echo ""
    echo "✅ All namespaces with prefix '$NAMESPACE_PREFIX' have been successfully deleted!"
else
    echo ""
    echo "⚠️  Some namespaces with prefix '$NAMESPACE_PREFIX' still remain. You may need to run the script again."
fi