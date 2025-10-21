#!/bin/bash

# Test Grok API endpoint
# Usage: ./test-grok.sh

echo "Testing Grok API for Lighter project..."
echo "========================================="
echo ""

# Test the deployed endpoint
URL="https://otcxfun.netlify.app/api/grok/lighter?name=Lighter&twitter=x.com/lighter&refresh=true"

echo "Fetching from: $URL"
echo ""
echo "Response:"
echo "----------"

curl -s "$URL" | jq '.'

echo ""
echo "========================================="
echo "Test complete!"

