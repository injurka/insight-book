#!/bin/bash
# Exit on error
set -e

echo "Configuring Android project..."

# Resolve paths independently from the caller's working directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/gen/android"
MANIFEST_PATH="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
FILE_PATHS_PATH="$ANDROID_DIR/app/src/main/res/xml/file_paths.xml"

# Inject permissions into AndroidManifest.xml
if [ -f "$MANIFEST_PATH" ]; then
    echo "Updating AndroidManifest.xml..."
    # Add audio permissions before the <application tag if not already present
    if ! grep -q "RECORD_AUDIO" "$MANIFEST_PATH"; then
        sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />' "$MANIFEST_PATH"
    fi
    # Add APK installation permission if not already present
    if ! grep -q "REQUEST_INSTALL_PACKAGES" "$MANIFEST_PATH"; then
        sed -i '/<application/i \    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />' "$MANIFEST_PATH"
    fi
else
    echo "AndroidManifest.xml not found. Run 'bun run tauri:android:init' first." >&2
    exit 1
fi

# Configure FileProvider for APK update cache path
if [ -f "$FILE_PATHS_PATH" ]; then
    echo "Checking file_paths.xml..."
    if ! grep -q 'name="updates"' "$FILE_PATHS_PATH"; then
        sed -i 's|</paths>|    <cache-path name="updates" path="updates/" />\n</paths>|' "$FILE_PATHS_PATH"
        echo "Added APK update cache-path to file_paths.xml"
    fi
fi

echo "Android project configured successfully!"
