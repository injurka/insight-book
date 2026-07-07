#!/bin/bash
# Exit on error
set -e

echo "Configuring Android project for Firebase and Permissions..."

# Paths
ANDROID_DIR="apps/client/src-tauri/gen/android"
MANIFEST_PATH="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
PROJECT_GRADLE="$ANDROID_DIR/build.gradle"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
MAIN_ACTIVITY="$ANDROID_DIR/app/src/main/java/ru/insightbook/insightbook/MainActivity.kt"

# 1. Inject Permissions into AndroidManifest.xml
if [ -f "$MANIFEST_PATH" ]; then
    echo "Updating AndroidManifest.xml..."
    # Add permissions before the <application tag if not already present
    if ! grep -q "RECORD_AUDIO" "$MANIFEST_PATH"; then
        sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' "$MANIFEST_PATH"
    fi
fi

# 2. Add Google Services to project build.gradle
if [ -f "$PROJECT_GRADLE" ]; then
    echo "Updating project build.gradle..."
    # Add classpath 'com.google.gms:google-services:4.4.0' to dependencies
    if ! grep -q "google-services" "$PROJECT_GRADLE"; then
        sed -i 's/dependencies {/dependencies {\n        classpath '\''com.google.gms:google-services:4.4.0'\''/' "$PROJECT_GRADLE"
    fi
fi

# 3. Add Firebase plugins and dependencies to app build.gradle
if [ -f "$APP_GRADLE" ]; then
    echo "Updating app build.gradle..."
    # Add apply plugin: 'com.google.gms.google-services' and dependencies
    if ! grep -q "google-services" "$APP_GRADLE"; then
        # Insert plugins block if not exists or apply it
        sed -i '1s/^/apply plugin: '\''com.google.gms.google-services'\''\n/' "$APP_GRADLE"
        # Add dependency
        sed -i '/dependencies {/a \    implementation platform('\''com.google.firebase:firebase-bom:32.7.0'\'')\n    implementation '\''com.google.firebase:firebase-messaging'\''' "$APP_GRADLE"
    fi
fi

# 4. Update MainActivity.kt to handle FCM token retrieval
if [ -f "$MAIN_ACTIVITY" ]; then
    echo "Updating MainActivity.kt..."
    cat << 'EOF' > "$MAIN_ACTIVITY"
package ru.insightbook.insightbook

import android.os.Bundle
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import tauri.TauriActivity

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Fetch token initially
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                fcmToken = task.result
            }
        }
    }

    companion object {
        @Volatile
        var fcmToken: String? = null
        
        @Volatile
        var isRequesting: Boolean = false

        @JvmStatic
        fun getFcmToken(): String? {
            return fcmToken
        }

        @JvmStatic
        fun requestFcmToken(activity: MainActivity) {
            if (isRequesting) return
            isRequesting = true

            // Request permission on Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
                }
            }

            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    fcmToken = task.result
                }
                isRequesting = false
            }
        }
    }
}
EOF
fi

echo "Android project configured successfully!"
