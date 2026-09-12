#!/bin/bash
# Exit on error
set -e

echo "Configuring Android project permissions..."

# Resolve paths independently from the caller's working directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/gen/android"
MANIFEST_PATH="$ANDROID_DIR/app/src/main/AndroidManifest.xml"

# Inject permissions into AndroidManifest.xml
if [ -f "$MANIFEST_PATH" ]; then
    echo "Updating AndroidManifest.xml..."
    # Add permissions before the <application tag if not already present
    if ! grep -q "RECORD_AUDIO" "$MANIFEST_PATH"; then
        sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />' "$MANIFEST_PATH"
    fi
else
    echo "AndroidManifest.xml not found. Run 'bun run tauri:android:init' first." >&2
    exit 1
fi

echo "Android project configured successfully!"
