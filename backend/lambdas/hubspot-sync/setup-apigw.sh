#!/bin/bash
set -e

P="--profile intellagentic --region eu-west-2"
API="odvopohlp3"
URI="arn:aws:apigateway:eu-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-2:290528720671:function:xo-hubspot-sync/invocations"

# Resource ID -> Path -> HTTP Method
# 4yjghp /hubspot/connect POST
# xie9uh /hubspot/callback GET
# coid6a /hubspot/status GET
# ndu7hj /hubspot/sync POST
# 4fzm8x /hubspot/sync/push POST
# nttu4j /hubspot/sync/pull POST
# okwm2u /hubspot/mapping GET
# oqa3dl /hubspot/conflicts GET
# h933u1 /hubspot/conflicts/resolve POST

ROUTES=(
  "xie9uh:GET:/hubspot/callback"
  "coid6a:GET:/hubspot/status"
  "ndu7hj:POST:/hubspot/sync"
  "4fzm8x:POST:/hubspot/sync/push"
  "nttu4j:POST:/hubspot/sync/pull"
  "okwm2u:GET:/hubspot/mapping"
  "oqa3dl:GET:/hubspot/conflicts"
  "h933u1:POST:/hubspot/conflicts/resolve"
)

for route in "${ROUTES[@]}"; do
  IFS=':' read -r RES_ID METHOD PATHNAME <<< "$route"

  echo "=== $METHOD $PATHNAME ($RES_ID) ==="

  # Main method
  aws apigateway put-method $P --rest-api-id $API --resource-id $RES_ID --http-method $METHOD --authorization-type NONE --no-cli-pager > /dev/null
  echo "  put-method $METHOD"

  aws apigateway put-integration $P --rest-api-id $API --resource-id $RES_ID --http-method $METHOD --type AWS_PROXY --integration-http-method POST --uri "$URI" --content-handling CONVERT_TO_TEXT --no-cli-pager > /dev/null
  echo "  put-integration $METHOD -> Lambda"

  aws apigateway put-method-response $P --rest-api-id $API --resource-id $RES_ID --http-method $METHOD --status-code 200 --response-models '{"application/json":"Empty"}' --no-cli-pager > /dev/null
  echo "  put-method-response 200"

  aws apigateway put-integration-response $P --rest-api-id $API --resource-id $RES_ID --http-method $METHOD --status-code 200 --response-templates '{"application/json":""}' --no-cli-pager > /dev/null
  echo "  put-integration-response 200"

  # OPTIONS (CORS)
  aws apigateway put-method $P --rest-api-id $API --resource-id $RES_ID --http-method OPTIONS --authorization-type NONE --no-cli-pager > /dev/null
  echo "  put-method OPTIONS"

  aws apigateway put-integration $P --rest-api-id $API --resource-id $RES_ID --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' --no-cli-pager > /dev/null
  echo "  put-integration OPTIONS (MOCK)"

  aws apigateway put-method-response $P --rest-api-id $API --resource-id $RES_ID --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Credentials":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --response-models '{"application/json":"Empty"}' --no-cli-pager > /dev/null
  echo "  put-method-response OPTIONS 200"

  aws apigateway put-integration-response $P --rest-api-id $API --resource-id $RES_ID --http-method OPTIONS --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Credentials\":\"'true'\",\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'DELETE,GET,OPTIONS,POST,PUT'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --no-cli-pager > /dev/null
  echo "  put-integration-response OPTIONS CORS"

  echo ""
done

echo "All routes wired."
