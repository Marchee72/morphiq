package com.morphiq.app

import android.content.Intent
import android.os.Build
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ActiveWorkout")
class ActiveWorkoutPlugin : Plugin() {

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }

        call.resolve()
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
        context.startService(intent)

        call.resolve()
    }

    @PluginMethod
    fun stopWorkout(call: PluginCall) {
        val context = context
        val intent = Intent(context, ActiveWorkoutService::class.java).apply {
            action = ActiveWorkoutService.ACTION_STOP
        }
        context.startService(intent)

        call.resolve()
    }
}
