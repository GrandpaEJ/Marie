#!/bin/bash

# Marie Release Script
# Rebuilds the vault and publishes binaries to GitHub

set -e

REPO="GrandpaEJ/Marie"

# Check for gh cli
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed."
    exit 1
fi

# Confirm build
read -p "🔨 Rebuild binaries and update vault? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔒 Running pnpm lock..."
    pnpm lock
else
    echo "⏩ Skipping rebuild. Using existing binaries in bin/"
fi

# Get version
VERSION="v$(date +%Y.%m.%d-%H%M)"
read -p "🏷️ Enter tag name (default: $VERSION): " USER_TAG
TAG_NAME="${USER_TAG:-$VERSION}"

echo "📦 Creating release $TAG_NAME..."

# Create the release
gh release create "$TAG_NAME" \
    --repo "$REPO" \
    --title "Marie Native Binaries $TAG_NAME" \
    --notes "Automated build of native binaries for Marie Core." \
    --generate-notes

echo "🚀 Uploading binaries..."

# Create a temporary directory for renaming
mkdir -p temp_release
cp bin/x64/guardian temp_release/guardian-x64
cp bin/x64/llm temp_release/llm-x64
cp bin/arm64/guardian temp_release/guardian-arm64
cp bin/arm64/llm temp_release/llm-arm64

# Upload all at once
gh release upload "$TAG_NAME" --repo "$REPO" temp_release/* bin/guardian bin/llm --clobber


# Cleanup
rm -rf temp_release

echo "✅ Release $TAG_NAME published successfully!"
echo "🔗 https://github.com/$REPO/releases/tag/$TAG_NAME"

