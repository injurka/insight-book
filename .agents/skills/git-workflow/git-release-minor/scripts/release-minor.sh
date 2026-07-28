#!/usr/bin/env bash
set -e

# Fetch tags from remote to ensure we have the latest version history
echo "Fetching tags from remote..."
git fetch --tags origin || echo "Warning: Failed to fetch tags. Proceeding with local tags."

# Find the latest semver-like tag
LATEST_TAG=$(git tag -l "v*.*.*" | sort -V | tail -n 1)

if [ -z "$LATEST_TAG" ]; then
  echo "No semantic version tags found. Starting from v0.0.0."
  LATEST_TAG="v0.0.0"
else
  echo "Latest tag found: $LATEST_TAG"
fi

# Remove leading 'v'
VERSION=${LATEST_TAG#v}

# Split version into components
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

# Validate that components are integers
if ! [[ "$MAJOR" =~ ^[0-9]+$ ]] || ! [[ "$MINOR" =~ ^[0-9]+$ ]] || ! [[ "$PATCH" =~ ^[0-9]+$ ]]; then
  echo "Error: Latest tag '$LATEST_TAG' does not conform to vMAJOR.MINOR.PATCH format."
  exit 1
fi

# Increment minor version, reset patch to 0
NEW_MINOR=$((MINOR + 1))
NEW_TAG="v$MAJOR.$NEW_MINOR.0"

echo "Creating new minor release: $NEW_TAG (incremented from $LATEST_TAG)"

# Check if the tag already exists locally
if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
  echo "Error: Tag $NEW_TAG already exists locally!"
  exit 1
fi

# Create annotated tag
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
echo "Successfully created tag $NEW_TAG locally."

# Push tag to remote
echo "Pushing tag $NEW_TAG to remote origin..."
git push origin "$NEW_TAG"
echo "Successfully released and pushed $NEW_TAG!"
