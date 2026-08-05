#!/bin/bash
# Exit on error
set -e

echo "Configuring Android project permissions..."

# Paths
ANDROID_DIR="apps/native/src-tauri/gen/android"
MANIFEST_PATH="$ANDROID_DIR/app/src/main/AndroidManifest.xml"

# Inject permissions into AndroidManifest.xml
if [ -f "$MANIFEST_PATH" ]; then
    echo "Updating AndroidManifest.xml..."
    # Add permissions before the <application tag if not already present
    if ! grep -q "RECORD_AUDIO" "$MANIFEST_PATH"; then
        sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />' "$MANIFEST_PATH"
    fi
fi

echo "Android project configured successfully!"
