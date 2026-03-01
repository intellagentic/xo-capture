#!/bin/bash

# Deploy /gdrive Lambda with Google API dependencies

set -e

echo "Building /gdrive Lambda package..."

# Clean previous build
rm -rf package function.zip

# Install dependencies (targeting Lambda's Linux runtime)
pip3 install -r requirements.txt -t package/ --quiet

# Copy Lambda function and auth helper
cp lambda_function.py package/
cp ../shared/auth_helper.py package/

# Create zip
cd package
zip -r ../function.zip . -q
cd ..

echo "Package built: function.zip"
echo "   Size: $(du -h function.zip | cut -f1)"
