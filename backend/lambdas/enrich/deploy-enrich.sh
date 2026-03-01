#!/bin/bash

# Deploy /enrich Lambda with dependencies

set -e

echo "📦 Building /enrich Lambda package..."

# Clean previous build
rm -rf package function.zip

# Install dependencies
pip3 install -r requirements.txt -t package/ --quiet

# Copy Lambda function
cp lambda_function.py package/

# Create zip
cd package
zip -r ../function.zip . -q
cd ..

echo "✅ Package built: function.zip"
echo "   Size: $(du -h function.zip | cut -f1)"
