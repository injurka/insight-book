#!/bin/bash
# Exit on error
set -e

echo "Configuring Android project for Firebase and Permissions..."

# Paths
ANDROID_DIR="apps/client/src-tauri/gen/android"
MANIFEST_PATH="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
PROJECT_GRADLE="$ANDROID_DIR/build.gradle"
PROJECT_GRADLE_KTS="$ANDROID_DIR/build.gradle.kts"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
APP_GRADLE_KTS="$ANDROID_DIR/app/build.gradle.kts"
MAIN_ACTIVITY="$ANDROID_DIR/app/src/main/java/ru/insightbook/insightbook/MainActivity.kt"

# 1. Inject Permissions and Services into AndroidManifest.xml
if [ -f "$MANIFEST_PATH" ]; then
    echo "Updating AndroidManifest.xml..."
    # Add permissions before the <application tag if not already present
    if ! grep -q "RECORD_AUDIO" "$MANIFEST_PATH"; then
        sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' "$MANIFEST_PATH"
    fi
    # Add service declaration inside <application> tag
    if ! grep -q "MyFirebaseMessagingService" "$MANIFEST_PATH"; then
        sed -i '/<\/application>/i \        <service\n            android:name=".MyFirebaseMessagingService"\n            android:exported="false">\n            <intent-filter>\n                <action android:name="com.google.firebase.MESSAGING_EVENT" />\n            </intent-filter>\n        </service>' "$MANIFEST_PATH"
    fi
fi

# 2. Add Google Services to project build.gradle(.kts)
if [ -f "$PROJECT_GRADLE" ]; then
    echo "Updating project build.gradle..."
    if ! grep -q "google-services" "$PROJECT_GRADLE"; then
        sed -i 's/dependencies {/dependencies {\n        classpath '\''com.google.gms:google-services:4.4.0'\''/' "$PROJECT_GRADLE"
    fi
elif [ -f "$PROJECT_GRADLE_KTS" ]; then
    echo "Updating project build.gradle.kts..."
    if ! grep -q "google-services" "$PROJECT_GRADLE_KTS"; then
        sed -i 's/dependencies {/dependencies {\n        classpath("com.google.gms:google-services:4.4.0")/' "$PROJECT_GRADLE_KTS"
    fi
fi

# 3. Add Firebase plugins and dependencies to app build.gradle(.kts)
if [ -f "$APP_GRADLE" ]; then
    echo "Updating app build.gradle..."
    if ! grep -q "google-services" "$APP_GRADLE"; then
        sed -i '1s/^/apply plugin: '\''com.google.gms.google-services'\''\n/' "$APP_GRADLE"
        sed -i '/dependencies {/a \    implementation platform('\''com.google.firebase:firebase-bom:32.7.0'\'')\n    implementation '\''com.google.firebase:firebase-messaging'\''' "$APP_GRADLE"
    fi
elif [ -f "$APP_GRADLE_KTS" ]; then
    echo "Updating app build.gradle.kts..."
    if ! grep -q "google-services" "$APP_GRADLE_KTS"; then
        if grep -q "plugins {" "$APP_GRADLE_KTS"; then
            sed -i '/plugins {/a \    id("com.google.gms.google-services")' "$APP_GRADLE_KTS"
        else
            sed -i '1s/^/plugins {\n    id("com.google.gms.google-services")\n}\n/' "$APP_GRADLE_KTS"
        fi
        sed -i '/dependencies {/a \    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))\n    implementation("com.google.firebase:firebase-messaging")' "$APP_GRADLE_KTS"
    fi
fi

# 4. Update MainActivity.kt to handle FCM token retrieval
if [ -f "$MAIN_ACTIVITY" ]; then
    echo "Updating MainActivity.kt..."
    cat << 'EOF' > "$MAIN_ACTIVITY"
package ru.insightbook.insightbook

import android.os.Bundle
import android.os.Build
import android.content.Context
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Load initial token from SharedPreferences if available
        val sharedPref = applicationContext.getSharedPreferences("insight_push", Context.MODE_PRIVATE)
        _fcmToken = sharedPref.getString("fcm_token", null)

        // Fetch token initially
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    _fcmToken = token
                    sharedPref.edit().putString("fcm_token", token).apply()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    companion object {
        @Volatile
        var _fcmToken: String? = null
        
        @Volatile
        var isRequesting: Boolean = false

        @JvmStatic
        fun getFcmToken(): String? {
            return _fcmToken
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

            try {
                FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val token = task.result
                        _fcmToken = token
                        val sharedPref = activity.applicationContext.getSharedPreferences("insight_push", Context.MODE_PRIVATE)
                        sharedPref.edit().putString("fcm_token", token).apply()
                    }
                    isRequesting = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                isRequesting = false
            }
        }
    }
}
EOF
fi

# 5. Create MyFirebaseMessagingService.kt
MESSAGING_SERVICE="$ANDROID_DIR/app/src/main/java/ru/insightbook/insightbook/MyFirebaseMessagingService.kt"
if [ -f "$MAIN_ACTIVITY" ]; then
    echo "Creating MyFirebaseMessagingService.kt..."
    cat << 'EOF' > "$MESSAGING_SERVICE"
package ru.insightbook.insightbook

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService

class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        MainActivity._fcmToken = token
        
        val sharedPref = applicationContext.getSharedPreferences("insight_push", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            apply()
        }
    }
}
EOF
fi

echo "Android project configured successfully!"
