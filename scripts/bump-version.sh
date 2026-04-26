#!/bin/bash
# =============================================================================
# Bump Version Script - Semantic Versioning
# Usage: ./scripts/bump-version.sh [patch|minor|major]
# Example: ./scripts/bump-version.sh patch  → v0.0.1
#          ./scripts/bump-version.sh minor  → v0.1.0
#          ./scripts/bump-version.sh major  → v1.0.0
# =============================================================================

set -e

TYPE=${1:-patch}
if [[ ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "❌ Invalid version type: $TYPE"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

# Get current version from latest v* tag
CURRENT=$(git describe --tags --match "v*" --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT=${CURRENT#v}

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case $TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW="v${MAJOR}.${MINOR}.${PATCH}"

echo "========================================"
echo "  🚀 AgentHive Cloud Version Bump"
echo "========================================"
echo "  Current: v$CURRENT"
echo "  Type:    $TYPE"
echo "  New:     $NEW"
echo "========================================"

read -p "Proceed? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "📌 Creating annotated tag..."
git tag -a "$NEW" -m "Release $NEW"

echo "📤 Pushing tag to origin..."
git push origin "$NEW"

echo ""
echo "✅ Tag $NEW pushed successfully!"
echo ""
echo "CI will now build and push images with tag: $NEW"
echo ""
echo "To deploy this version, update .env.prod:"
echo "  API_IMAGE=crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/api:$NEW"
echo "  LANDING_IMAGE=crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/landing:$NEW"
echo "  ..."
