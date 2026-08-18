package com.morphiq.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Asks Health Connect whether anything arrived while the app was closed, and
 * puts a notification up if so.
 *
 * Health Connect has no push: no observer, no broadcast, nothing that wakes an
 * app when a record lands. Asking on a timer is the only mechanism there is, so
 * this is what "background sync" can mean at all.
 *
 * It deliberately does not import anything. The database is Dexie, which lives
 * inside the WebView, and a worker runs with no WebView — there is nowhere to
 * put a record from here. So the division is: this notices, the notification
 * gets you to open the app, and the sync in `App.tsx` does the actual import on
 * mount and resume. Anything more ambitious would mean a second copy of the
 * store in native code.
 *
 * Changes are read through the changes token rather than by re-reading records
 * and comparing timestamps. It is both less code and more correct: Samsung
 * writes records with past timestamps when a watch syncs late, and a
 * `max(timestamp) > lastSeen` check silently drops every one of those.
 */
class HealthSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "morphiq_health_sync"

        private const val TAG = "HealthSyncWorker"
        private const val PREFS = "morphiq_health_sync"
        private const val KEY_TOKEN = "changes_token"
        private const val CHANNEL_ID = "health_sync_v1"

        /** 9001 is the live-workout notification; this must not replace it. */
        private const val NOTIFICATION_ID = 9002

        /**
         * The record types worth waking someone for. Steps are left out on
         * purpose — they change all day, so watching them would mean a
         * notification every 15 minutes.
         */
        private val TRACKED_TYPES = setOf(
            WeightRecord::class,
            BodyFatRecord::class,
            ExerciseSessionRecord::class,
        )

        /**
         * 15 minutes is WorkManager's floor and only a floor: Doze defers this,
         * and Samsung's own battery management ("put unused apps to sleep")
         * stops it outright unless the user excludes the app.
         */
        fun enable(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<HealthSyncWorker>(15, TimeUnit.MINUTES).build(),
            )
        }

        fun disable(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            // Drop the token too, so re-enabling starts from a fresh baseline
            // instead of announcing everything that happened while it was off.
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().remove(KEY_TOKEN).apply()
        }
    }

    override suspend fun doWork(): Result {
        val client = runCatching { HealthConnectClient.getOrCreate(applicationContext) }
            .getOrNull() ?: return Result.success() // Health Connect not installed.

        val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        return try {
            // First run only establishes the baseline. Without a previous token
            // there is no "change" to report, and announcing the whole history
            // on the first tick would be pure noise.
            var token = prefs.getString(KEY_TOKEN, null)
            if (token == null) {
                val fresh = client.getChangesToken(ChangesTokenRequest(recordTypes = TRACKED_TYPES))
                prefs.edit().putString(KEY_TOKEN, fresh).apply()
                return Result.success()
            }

            var sawBodyRecord = false
            var sawExercise = false
            var hasMore = true

            while (hasMore) {
                val response = client.getChanges(token!!)
                if (response.changesTokenExpired) {
                    // Tokens expire after 30 days. Nothing to report — clear it
                    // and let the next run take a fresh baseline.
                    prefs.edit().remove(KEY_TOKEN).apply()
                    return Result.success()
                }
                for (change in response.changes) {
                    if (change !is UpsertionChange) continue
                    when (change.record) {
                        is WeightRecord, is BodyFatRecord -> sawBodyRecord = true
                        is ExerciseSessionRecord -> sawExercise = true
                    }
                }
                token = response.nextChangesToken
                hasMore = response.hasMore
            }
            prefs.edit().putString(KEY_TOKEN, token).apply()

            if (sawBodyRecord || sawExercise) notifyNewData(sawBodyRecord, sawExercise)
            Result.success()
        } catch (e: SecurityException) {
            // READ_HEALTH_DATA_IN_BACKGROUND was never granted or has been
            // revoked. Retrying cannot fix that, so stop rather than loop.
            Log.w(TAG, "Background health read not permitted", e)
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Health change check failed", e)
            Result.retry()
        }
    }

    private fun notifyNewData(sawBodyRecord: Boolean, sawExercise: Boolean) {
        val manager = applicationContext
            .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    applicationContext.getString(R.string.health_sync_channel_name),
                    // Unlike the live-workout channel, this one is worth a sound:
                    // it fires rarely and its whole point is to be noticed.
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    description = applicationContext.getString(R.string.health_sync_channel_desc)
                    lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                }
            )
        }

        val body = when {
            sawBodyRecord && sawExercise -> R.string.health_sync_body_both
            sawBodyRecord -> R.string.health_sync_body_measurement
            else -> R.string.health_sync_body_workout
        }

        val launch = applicationContext.packageManager
            .getLaunchIntentForPackage(applicationContext.packageName)
        val pendingIntent = PendingIntent.getActivity(
            applicationContext, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle(applicationContext.getString(R.string.health_sync_title))
            .setContentText(applicationContext.getString(body))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setColor(Color.parseColor("#0381FE"))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .build()

        // POST_NOTIFICATIONS may be denied on API 33+; that is the user's call
        // and must not fail the run.
        runCatching { manager.notify(NOTIFICATION_ID, notification) }
            .onFailure { Log.w(TAG, "Could not post health sync notification", it) }
    }
}
