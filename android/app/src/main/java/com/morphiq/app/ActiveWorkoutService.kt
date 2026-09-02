package com.morphiq.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ActiveWorkoutService : Service() {

    companion object {
        const val CHANNEL_ID = "active_workout_native_v2"
        const val NOTIFICATION_ID = 9001

        const val ACTION_START = "ACTION_START"
        const val ACTION_UPDATE = "ACTION_UPDATE"
        // No ACTION_STOP: the plugin calls `stopService`, because delivering an
        // action means starting the service, which the background restriction
        // forbids at exactly the moment stopping matters.

        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_START_TIME = "EXTRA_START_TIME"
        const val EXTRA_SETS_COUNT = "EXTRA_SETS_COUNT"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Strength Training"
                val startTimeMs = intent.getLongExtra(EXTRA_START_TIME, System.currentTimeMillis())
                val setsCount = intent.getIntExtra(EXTRA_SETS_COUNT, 0)
                startWorkoutForeground(title, startTimeMs, setsCount)
            }
            ACTION_UPDATE -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Strength Training"
                val startTimeMs = intent.getLongExtra(EXTRA_START_TIME, System.currentTimeMillis())
                val setsCount = intent.getIntExtra(EXTRA_SETS_COUNT, 0)
                updateNotification(title, startTimeMs, setsCount)
            }
        }
        // NOT sticky. A sticky restart redelivers a null intent, so the `when`
        // above matches nothing and `startForeground` is never called — and
        // Android 14 kills the process for that with
        // ForegroundServiceDidNotStartInTimeException. The session itself now
        // survives in storage, and the resume sheet is the deliberate way back
        // into it, so there is nothing for a restarted service to recover.
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Active Workout Tracker",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Live workout timer and set counter for Samsung Lock Screen & Status Bar"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(null, null)
                enableVibration(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, startTimeMs: Long, setsCount: Int): Notification {
        createNotificationChannel()

        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Clean ongoing notification: chronometer timer + sets count.
        // No MediaSession, no MediaStyle, no media controls, no progress bar.
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("$setsCount sets logged · Tap to open")
            .setSubText("Live Workout")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setColor(Color.parseColor("#0381FE"))
            .setUsesChronometer(true)
            .setWhen(startTimeMs)
            .setShowWhen(true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun startWorkoutForeground(title: String, startTimeMs: Long, setsCount: Int) {
        val notification = buildNotification(title, startTimeMs, setsCount)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val fgsType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            }
            startForeground(NOTIFICATION_ID, notification, fgsType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(title: String, startTimeMs: Long, setsCount: Int) {
        val notification = buildNotification(title, startTimeMs, setsCount)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }
}