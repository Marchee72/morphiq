package com.morphiq.app

import android.content.Intent
import android.os.Build
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ActiveWorkout")
class ActiveWorkoutPlugin : Plugin() {

    private val tag = "ActiveWorkoutPlugin"

    /**
     * Hands an intent to the service without betting the process on it.
     *
     * Android 12 forbids starting a service from the background, and says so by
     * throwing `BackgroundServiceStartNotAllowedException`. Capacitor lets that
     * escape onto the main thread instead of rejecting the call, so the JS
     * `try/catch` around every one of these never ran — the app died instead.
     * That is not a hypothetical: the bar cancels the notification on mount
     * whenever no session is running, which is most launches, and the app is
     * still background at that moment.
     *
     * Rejecting is the honest answer. The web fallback in
     * `ActiveWorkoutNotification.ts` already treats it as "use a local
     * notification instead", and a missing notification beats a dead app.
     */
    private fun deliver(call: PluginCall, intent: Intent, foreground: Boolean) {
        try {
            if (foreground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve()
        } catch (e: Exception) {
            Log.w(tag, "Could not deliver ${intent.action} from the background", e)
            call.reject("Workout service unavailable in background: ${e.message}")
        }
    }

    @PluginMethod
    fun startWorkout(call: PluginCall) {
        val title = call.getString("title") ?: "Strength Training"
        val startTimeMs = call.getLong("startTimeMs") ?: System.currentTimeMillis()
        val setsCount = call.getInt("setsCount") ?: 0

        val context = context
        val intent = Intent(context, ActiveWorkoutService::class.java).apply {
            action = ActiveWorkoutService.ACTION_START
            putExtra(ActiveWorkoutService.EXTRA_TITLE, title)
            putExtra(ActiveWorkoutService.EXTRA_START_TIME, startTimeMs)
            putExtra(ActiveWorkoutService.EXTRA_SETS_COUNT, setsCount)
        }

        deliver(call, intent, foreground = true)
    }

    @PluginMethod
    fun updateWorkout(call: PluginCall) {
        val title = call.getString("title") ?: "Strength Training"
        val startTimeMs = call.getLong("startTimeMs") ?: System.currentTimeMillis()
        val setsCount = call.getInt("setsCount") ?: 0

        val context = context
        val intent = Intent(context, ActiveWorkoutService::class.java).apply {
            action = ActiveWorkoutService.ACTION_UPDATE
            putExtra(ActiveWorkoutService.EXTRA_TITLE, title)
            putExtra(ActiveWorkoutService.EXTRA_START_TIME, startTimeMs)
            putExtra(ActiveWorkoutService.EXTRA_SETS_COUNT, setsCount)
        }
        deliver(call, intent, foreground = false)
    }

    /**
     * `stopService` rather than an ACTION_STOP intent.
     *
     * Delivering the action means *starting* the service to tell it to stop,
     * which is the thing the background restriction forbids — so the one call
     * that must work when the app is not on screen was the one that could not.
     * Stopping is never restricted, and destroying the service takes its
     * foreground notification down with it, which is all `ACTION_STOP` did.
     */
    @PluginMethod
    fun stopWorkout(call: PluginCall) {
        context.stopService(Intent(context, ActiveWorkoutService::class.java))
        call.resolve()
    }
}
