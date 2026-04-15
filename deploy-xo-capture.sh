#!/bin/bash
# ============================================================================
# XO Capture (Quickstart) -- Deployment Script
# Intellagentic Ltd AWS Account (290528720671)
# ============================================================================
#
# USAGE:
#   ./deploy-xo-capture.sh              # Build + S3 sync + CloudFront invalidation
#   ./deploy-xo-capture.sh --skip-build # S3 sync + CloudFront invalidation only
#   ./deploy-xo-capture.sh --build-only # Build only, no deploy
#
# PREREQUISITES:
#   - AWS CLI configured with credentials for account 290528720671
#   - Node.js and npm installed
#   - Run from the xo-capture project root
#
# TEAM:
#   Ken Scott       -- Co-Founder & President
#   Vamsi Nama      -- Developer (IAM user: vamsi_nama)
#   Teebo Jamme     -- Developer (IAM user: teebo_jamme)
#
# ============================================================================

set -e

# ---------------------------------------------------------------------------
# CONFIGURATION -- Update these if resources change in the new account
# ---------------------------------------------------------------------------
AWS_REGION="eu-west-2"
S3_BUCKET="xo-prototype-frontend-mv"
CLOUDFRONT_DISTRIBUTION_ID="E7PWZX8BT02CE"
AWS_PROFILE="intellagentic"
BUILD_DIR="dist"
PROJECT_NAME="XO Capture (Quickstart)"

# ---------------------------------------------------------------------------
# COLOR OUTPUT
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# PARSE ARGUMENTS
# ---------------------------------------------------------------------------
SKIP_BUILD=false
BUILD_ONLY=false

for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            ;;
        --build-only)
            BUILD_ONLY=true
            ;;
        --help|-h)
            echo "Usage: ./deploy-xo-capture.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-build   Skip npm build, deploy existing $BUILD_DIR"
            echo "  --build-only   Build only, do not deploy to S3/CloudFront"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            echo "Run with --help for usage."
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# PREFLIGHT CHECKS
# ---------------------------------------------------------------------------
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ${PROJECT_NAME} -- Deploy${NC}"
echo -e "${BLUE}  Account: 290528720671 (Intellagentic)${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verify we are in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}ERROR: package.json not found.${NC}"
    echo "Run this script from the xo-capture project root."
    echo "  cd ~/Desktop/xo-prototype && ./deploy-xo-capture.sh"
    exit 1
fi

# Verify AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI not found. Install it first.${NC}"
    exit 1
fi

# Verify correct AWS account
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query "Account" --output text 2>/dev/null || true)
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}ERROR: AWS credentials not configured or expired.${NC}"
    echo "Run: aws configure"
    exit 1
fi

if [ "$ACCOUNT_ID" != "290528720671" ]; then
    echo -e "${YELLOW}WARNING: You are targeting AWS account ${ACCOUNT_ID}${NC}"
    echo -e "${YELLOW}Expected Intellagentic account: 290528720671${NC}"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

CALLER=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query "Arn" --output text 2>/dev/null)
echo -e "${GREEN}Authenticated as:${NC} $CALLER"
echo -e "${GREEN}Account:${NC}          $ACCOUNT_ID"
echo -e "${GREEN}Region:${NC}           $AWS_REGION"
echo -e "${GREEN}S3 Bucket:${NC}        $S3_BUCKET"
echo -e "${GREEN}CloudFront:${NC}       $CLOUDFRONT_DISTRIBUTION_ID"
echo ""

# ---------------------------------------------------------------------------
# BUILD
# ---------------------------------------------------------------------------
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}[1/3] Building production bundle...${NC}"

    # Install dependencies if node_modules is missing or package-lock changed
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
        echo "     Installing dependencies..."
        npm install --silent
    fi

    npm run build

    if [ ! -d "$BUILD_DIR" ]; then
        echo -e "${RED}ERROR: Build directory '$BUILD_DIR' not found after build.${NC}"
        echo "Check your vite/webpack config -- expected output in '$BUILD_DIR'."
        exit 1
    fi

    FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l | tr -d ' ')
    BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
    echo -e "${GREEN}     Build complete: $FILE_COUNT files, $BUILD_SIZE${NC}"
    echo ""
else
    echo -e "${YELLOW}[1/3] Skipping build (--skip-build)${NC}"
    if [ ! -d "$BUILD_DIR" ]; then
        echo -e "${RED}ERROR: Build directory '$BUILD_DIR' does not exist. Run without --skip-build.${NC}"
        exit 1
    fi
    echo ""
fi

# Exit here if build-only mode
if [ "$BUILD_ONLY" = true ]; then
    echo -e "${GREEN}Build complete. Exiting (--build-only).${NC}"
    exit 0
fi

# ---------------------------------------------------------------------------
# S3 SYNC
# ---------------------------------------------------------------------------
echo -e "${BLUE}[2/3] Syncing to S3 (s3://${S3_BUCKET})...${NC}"

aws s3 sync "$BUILD_DIR/" "s3://${S3_BUCKET}/" \
    --delete \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --no-progress

echo -e "${GREEN}     S3 sync complete.${NC}"
echo ""

# ---------------------------------------------------------------------------
# CLOUDFRONT INVALIDATION
# ---------------------------------------------------------------------------
echo -e "${BLUE}[3/3] Invalidating CloudFront cache (${CLOUDFRONT_DISTRIBUTION_ID})...${NC}"

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --profile "$AWS_PROFILE" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}     Invalidation created: ${INVALIDATION_ID}${NC}"
echo -e "${YELLOW}     Cache propagation takes 1-5 minutes.${NC}"
echo ""

# ---------------------------------------------------------------------------
# DONE
# ---------------------------------------------------------------------------
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  DEPLOYED SUCCESSFULLY${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  URL:  ${BLUE}https://xo.intellagentic.io${NC}"
echo -e "  CDN:  ${BLUE}https://${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net${NC}"
echo ""
echo -e "  ${YELLOW}Hard refresh (Cmd+Shift+R) if you don't see changes.${NC}"
echo ""
