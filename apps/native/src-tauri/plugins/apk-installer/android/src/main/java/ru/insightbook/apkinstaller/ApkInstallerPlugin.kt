package ru.insightbook.apkinstaller

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun setSystemBarsTheme(invoke: Invoke) {
        try {
            val dark = invoke.getArgs().getBoolean("dark")
            activity.runOnUiThread {
                try {
                    val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
                    // Android's "light appearance" means dark icons on a light background.
                    controller.isAppearanceLightStatusBars = !dark
                    controller.isAppearanceLightNavigationBars = !dark
                    invoke.resolveObject(true)
                } catch (e: Exception) {
                    invoke.reject("Failed to update system bars: ${e.message}")
                }
            }
        } catch (e: Exception) {
            invoke.reject("Invalid system bars theme: ${e.message}")
        }
    }

    @Command
    fun setImmersiveMode(invoke: Invoke) {
        try {
            val enabled = invoke.getArgs().getBoolean("enabled")
            activity.runOnUiThread {
                try {
                    val window = activity.window
                    val controller = WindowCompat.getInsetsController(window, window.decorView)

                    // Edge-to-edge: контент рисуется под системными панелями,
                    // либо возвращаем стандартную подгонку окна.
                    WindowCompat.setDecorFitsSystemWindows(window, !enabled)

                    if (enabled) {
                        // Полноэкранный режим: прячем статус-бар и навигацию,
                        // свайп от края временно показывает панели.
                        controller.systemBarsBehavior =
                            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                        controller.hide(WindowInsetsCompat.Type.systemBars())
                    } else {
                        controller.show(WindowInsetsCompat.Type.systemBars())
                    }

                    invoke.resolveObject(true)
                } catch (e: Exception) {
                    invoke.reject("Failed to update immersive mode: ${e.message}")
                }
            }
        } catch (e: Exception) {
            invoke.reject("Invalid immersive mode args: ${e.message}")
        }
    }

    @Command
    fun setScreenOrientation(invoke: Invoke) {
        try {
            val mode = invoke.getArgs().optString("mode", "unspecified")
            activity.runOnUiThread {
                activity.requestedOrientation = when (mode) {
                    "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                    else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                }
                invoke.resolveObject(true)
            }
        } catch (e: Exception) {
            invoke.reject("Invalid screen orientation args: ${e.message}")
        }
    }

    @Command
    fun installApk(invoke: Invoke) {
        try {
            val path = invoke.getArgs().getString("path")
            val apk = File(path)
            if (!apk.isFile) {
                invoke.reject("Downloaded APK does not exist")
                return
            }

            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                apk,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            invoke.resolveObject(true)
        } catch (e: Exception) {
            invoke.reject("Failed to open APK installer: ${e.message}")
        }
    }
}
