#!/bin/bash
set -e
echo "Building xo-brief-download Lambda..."
rm -rf node_modules function.zip
npm install --production --quiet
zip -r function.zip index.js node_modules/ -q
echo "Package: $(du -h function.zip | cut -f1)"
echo "Deploying..."
aws lambda update-function-code \
  --function-name xo-brief-download \
  --zip-file fileb://function.zip \
  --region eu-west-2 \
  --profile intellagentic
echo "Done."
