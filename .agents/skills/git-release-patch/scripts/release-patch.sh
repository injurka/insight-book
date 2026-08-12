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

# Increment patch version
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
NEW_TAG="v$NEW_VERSION"

echo "Creating new patch release: $NEW_TAG (incremented from $LATEST_TAG)"

# Check if the tag already exists locally
if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
  echo "Error: Tag $NEW_TAG already exists locally!"
  exit 1
fi

# Check for uncommitted changes in working directory before proceeding
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Uncommitted changes detected in working directory!"
  echo "Please commit your working changes first (e.g. using git-commit skill) before releasing."
  exit 1
fi

# Update package.json version
echo "Updating package.json to version $NEW_VERSION..."
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '$NEW_VERSION'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n', 'utf8');"
git add package.json

# Determine current branch and check for unpushed local commits
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
UPSTREAM=$(git rev-parse --abbrev-ref @{u} 2>/dev/null || true)

if [ -n "$UPSTREAM" ]; then
  UNPUSHED_COUNT=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
else
  UNPUSHED_COUNT=$(git rev-list --count origin/"$CURRENT_BRANCH"..HEAD 2>/dev/null || echo 0)
fi

if [ "$UNPUSHED_COUNT" -gt 0 ]; then
  echo "Unpushed local commit(s) detected ($UNPUSHED_COUNT commit(s)). Amending latest commit with updated package.json..."
  git commit --amend --no-edit
else
  echo "No unpushed local commits found. Creating release commit..."
  git commit --allow-empty -m "chore(release): $NEW_TAG"
fi

echo "Pushing branch $CURRENT_BRANCH to remote origin..."
git push origin "$CURRENT_BRANCH"

# Create annotated tag
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
echo "Successfully created tag $NEW_TAG locally."

# Push tag to remote
echo "Pushing tag $NEW_TAG to remote origin..."
git push origin "$NEW_TAG"
echo "Successfully released and pushed $NEW_TAG!"
