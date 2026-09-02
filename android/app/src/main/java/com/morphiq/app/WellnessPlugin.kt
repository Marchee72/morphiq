package com.morphiq.app

import android.util.Log
import androidx.activity.result.ActivityResultCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicReference

/**
 * The readings behind the wellness questionnaire that a phone can answer for you.
 *
 * `capacitor-health` covers workouts, steps, calories, distance and heart rate,
 * and nothing else — its `HealthPermission` union has no sleep and its
 * `queryAggregated` no sleep bucket. Sleep and resting heart rate have to come
 * straight from Health Connect, which is what this does.
 *
 * A plugin of its own rather than more methods on [BodyCompositionPlugin]:
 * that class is named after what it reads, and sleep is not body composition.
 *
 * What is deliberately **not** here: stress, mood and soreness. Health Connect
 * has no record type for any of them and Samsung's own scores are proprietary,
 * so those four scales are asked in the app and always will be.
 */
@CapacitorPlugin(name = "Wellness")
class WellnessPlugin : Plugin() {

    private val tag = "WellnessPlugin"
    private lateinit var healthConnectClient: HealthConnectClient
    private var available: Boolean = false

    private lateinit var permissionsLauncher: ActivityResultLauncher<Set<String>>
    private val requestPermissionContext = AtomicReference<PluginCall?>()

    private val requiredPermissions = setOf(
        "android.permission.health.READ_SLEEP",
        "android.permission.health.READ_RESTING_HEART_RATE",
        "android.permission.health.READ_HEART_RATE_VARIABILITY"
    )

    private fun ensureClientInitialized(): Boolean {
        if (!::healthConnectClient.isInitialized) {
            try {
                healthConnectClient = HealthConnectClient.getOrCreate(context)
                available = true
            } catch (e: Exception) {
                Log.e(tag, "Failed to initialize HealthConnectClient", e)
                available = false
                return false
            }
        }
        return true
    }

    override fun load() {
        super.load()
        ensureClientInitialized()

        val contract: ActivityResultContract<Set<String>, Set<String>> =
            PermissionController.createRequestPermissionResultContract()

        val callback: ActivityResultCallback<Set<String>> = ActivityResultCallback { granted ->
            val pending = requestPermissionContext.getAndSet(null) ?: return@ActivityResultCallback
            val permissions = JSObject()
            for (perm in requiredPermissions) permissions.put(perm, granted.contains(perm))
            pending.resolve(JSObject().put("permissions", permissions))
        }
        permissionsLauncher = activity.registerForActivityResult(contract, callback)
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        ensureClientInitialized()
        call.resolve(JSObject().put("available", available))
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        if (!ensureClientInitialized()) {
            call.reject("Health Connect not available")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = healthConnectClient.permissionController.getGrantedPermissions()
                val permissions = JSObject()
                for (perm in requiredPermissions) permissions.put(perm, granted.contains(perm))
                call.resolve(JSObject().put("permissions", permissions))
            } catch (e: Exception) {
                call.reject("Failed to check permissions: ${e.message}")
            }
        }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (!ensureClientInitialized()) {
            call.reject("Health Connect not available")
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                requestPermissionContext.set(call)
                permissionsLauncher.launch(requiredPermissions)
            } catch (e: Exception) {
                requestPermissionContext.set(null)
                call.reject("Failed to launch permissions request: ${e.message}")
            }
        }
    }

    private fun timeRange(call: PluginCall): TimeRangeFilter? {
        val start = call.getString("startDate") ?: return null
        val end = call.getString("endDate") ?: return null
        return try {
            TimeRangeFilter.between(Instant.parse(start), Instant.parse(end))
        } catch (e: Exception) {
            Log.e(tag, "Unparseable time range", e)
            null
        }
    }

    /**
     * Sleep sessions with their stages summed.
     *
     * The session is keyed by the day it **ends**, not the day it starts: a
     * night beginning at 23:40 belongs to the morning you woke up in, which is
     * the day whose readiness it explains.
     *
     * Stage totals are summed from the stages rather than taken from the session
     * length, because the session spans the awake stretches too — reporting its
     * whole duration as sleep would credit you for the hour spent staring at
     * the ceiling.
     */
    @PluginMethod
    fun querySleep(call: PluginCall) {
        if (!ensureClientInitialized()) {
            call.reject("Health Connect Client is not initialized.")
            return
        }
        val range = timeRange(call) ?: run {
            call.reject("startDate and endDate are required ISO instants")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val records = healthConnectClient
                    .readRecords(ReadRecordsRequest<SleepSessionRecord>(SleepSessionRecord::class, range))
                    .records

                val sessions = JSArray()
                for (record in records) {
                    val stageMinutes = { types: Set<Int> ->
                        record.stages
                            .filter { types.contains(it.stage) }
                            .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
                    }

                    val asleep = stageMinutes(
                        setOf(
                            SleepSessionRecord.STAGE_TYPE_LIGHT,
                            SleepSessionRecord.STAGE_TYPE_DEEP,
                            SleepSessionRecord.STAGE_TYPE_REM,
                            SleepSessionRecord.STAGE_TYPE_SLEEPING
                        )
                    )

                    // A source that writes a session with no stages at all still
                    // knows how long you were in bed; fall back to that rather
                    // than reporting a night of zero minutes.
                    val total = if (asleep > 0) asleep
                    else Duration.between(record.startTime, record.endTime).toMinutes()

                    sessions.put(
                        JSObject()
                            .put("startDate", record.startTime.toString())
                            .put("endDate", record.endTime.toString())
                            .put("day", record.endTime.atZone(ZoneId.systemDefault()).toLocalDate().toString())
                            .put("totalMinutes", total)
                            .put("deepMinutes", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_DEEP)))
                            .put("remMinutes", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_REM)))
                            .put("lightMinutes", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_LIGHT)))
                            .put("awakeMinutes", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_AWAKE)))
                    )
                }

                call.resolve(JSObject().put("sessions", sessions))
            } catch (e: Exception) {
                Log.e(tag, "Failed to read sleep", e)
                call.reject("Failed to read sleep: ${e.message}")
            }
        }
    }

    /**
     * Resting heart rate, and HRV where the watch writes it.
     *
     * Both in one call because both are read for the same reason and over the
     * same window. HRV is wrapped separately: plenty of watches never write
     * `HeartRateVariabilityRmssdRecord`, and a device without it must not lose
     * its resting heart rate to the same failure.
     */
    @PluginMethod
    fun queryHeartSignals(call: PluginCall) {
        if (!ensureClientInitialized()) {
            call.reject("Health Connect Client is not initialized.")
            return
        }
        val range = timeRange(call) ?: run {
            call.reject("startDate and endDate are required ISO instants")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val zone = ZoneId.systemDefault()

                val resting = JSArray()
                healthConnectClient
                    .readRecords(ReadRecordsRequest<RestingHeartRateRecord>(RestingHeartRateRecord::class, range))
                    .records
                    .forEach {
                        resting.put(
                            JSObject()
                                .put("day", it.time.atZone(zone).toLocalDate().toString())
                                .put("bpm", it.beatsPerMinute)
                        )
                    }

                val hrv = JSArray()
                try {
                    healthConnectClient
                        .readRecords(
                            ReadRecordsRequest<HeartRateVariabilityRmssdRecord>(
                                HeartRateVariabilityRmssdRecord::class, range
                            )
                        )
                        .records
                        .forEach {
                            hrv.put(
                                JSObject()
                                    .put("day", it.time.atZone(zone).toLocalDate().toString())
                                    .put("rmssd", it.heartRateVariabilityMillis)
                            )
                        }
                } catch (e: Exception) {
                    // Normal, not an error: many watches never write HRV.
                    Log.i(tag, "No HRV available: ${e.message}")
                }

                call.resolve(JSObject().put("restingHeartRate", resting).put("hrv", hrv))
            } catch (e: Exception) {
                Log.e(tag, "Failed to read heart signals", e)
                call.reject("Failed to read heart signals: ${e.message}")
            }
        }
    }
}
