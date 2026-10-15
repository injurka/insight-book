package ru.insightbook.apkinstaller

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

class SyncProgressService : Service() {
    private var isForeground = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> showAsForeground(intent)
            else -> stopSelf(startId)
        }

        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (isForeground)
            stopForeground(STOP_FOREGROUND_REMOVE)

        super.onDestroy()
    }

    private fun showAsForeground(intent: Intent) {
        val notification = buildNotification(intent)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        isForeground = true
    }

    private fun createNotificationChannel() {
        createNotificationChannel(this)
    }

    private fun buildNotification(intent: Intent): Notification {
        return buildNotification(
            this,
            intent.getStringExtra(EXTRA_TITLE).orEmpty(),
            intent.getStringExtra(EXTRA_BODY).orEmpty(),
            intent.getIntExtra(EXTRA_PROGRESS, 0),
        )
    }

    companion object {
        private const val CHANNEL_ID = "insightbook_sync_progress"
        private const val NOTIFICATION_ID = 4102
        private const val ACTION_START = "ru.insightbook.apkinstaller.SYNC_START"
        private const val EXTRA_TITLE = "notification_title"
        private const val EXTRA_BODY = "notification_body"
        private const val EXTRA_PROGRESS = "notification_progress"

        fun start(context: Context, title: String, body: String, progress: Int) {
            createNotificationChannel(context)
            val intent = createIntent(context, ACTION_START, title, body, progress)
            ContextCompat.startForegroundService(context, intent)
        }

        fun update(context: Context, title: String, body: String, progress: Int) {
            createNotificationChannel(context)

            try {
                NotificationManagerCompat.from(context).notify(
                    NOTIFICATION_ID,
                    buildNotification(context, title, body, progress),
                )
            } catch (e: SecurityException) {
                context.stopService(Intent(context, SyncProgressService::class.java))
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SyncProgressService::class.java))
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
        }

        private fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O)
                return

            val channel = NotificationChannel(
                CHANNEL_ID,
                "InsightBook sync",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Progress while preparing a book for offline reading"
                setShowBadge(false)
            }

            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        private fun buildNotification(
            context: Context,
            title: String,
            body: String,
            progress: Int,
        ): Notification {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val contentIntent = launchIntent?.let {
                PendingIntent.getActivity(
                    context,
                    NOTIFICATION_ID,
                    it,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }

            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_sync_notification)
                .setContentTitle(title)
                .setContentText(body.lineSequence().firstOrNull().orEmpty())
                .setSubText("${progress.coerceIn(0, 100)}%")
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setOngoing(true)
                .setProgress(100, progress.coerceIn(0, 100), false)
                .build()
        }

        private fun createIntent(
            context: Context,
            action: String,
            title: String,
            body: String,
            progress: Int,
        ): Intent = Intent(context, SyncProgressService::class.java)
            .setAction(action)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
            .putExtra(EXTRA_PROGRESS, progress)
    }
}
