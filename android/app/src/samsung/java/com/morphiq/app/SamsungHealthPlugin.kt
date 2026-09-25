package com.morphiq.app

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.HealthDataStore
import com.samsung.android.sdk.health.data.data.HealthDataPoint
import com.samsung.android.sdk.health.data.error.HealthDataException
import com.samsung.android.sdk.health.data.error.ResolvablePlatformException
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.request.DataType
import com.samsung.android.sdk.health.data.request.DataTypes
import com.samsung.android.sdk.health.data.request.LocalDateFilter
import com.samsung.android.sdk.health.data.request.LocalTimeFilter
import com.samsung.android.sdk.health.data.request.LocalTimeGroup
import com.samsung.android.sdk.health.data.request.LocalTimeGroupUnit
import com.samsung.android.sdk.health.data.request.Ordering
import com.samsung.android.sdk.health.data.request.ReadDataRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Everything MorphIQ reads that Samsung Health holds — body composition, sleep,
 * workouts, steps and active calories — straight from it, through the Samsung
 * Health Data SDK. Health Connect stays the fallback, and the only source of
 * resting heart rate and HRV, which this SDK does not expose.
 *
 * Health Connect gets only weight, body fat, BMR and height out of a Galaxy
 * Watch measurement; skeletal muscle, fat mass and body water stay inside
 * Samsung Health, and Health Connect has no record type for skeletal muscle at
 * all. This is the only door to them.
 *
 * Sleep comes from here too: Samsung's own `DURATION` is the figure the watch
 * shows, which Health Connect's copy of the session did not reproduce.
 *
 * Built only when the SDK's AAR sits in `app/libs` (see `build.gradle`), and
 * registered by name from `MainActivity`, so a checkout without the AAR still
 * builds — the JS side then sees the plugin as unavailable.
 *
 * Without a Samsung partnership the SDK only answers while Samsung Health's
 * developer mode ("Developer Mode for Data Read") is on.
 */
@CapacitorPlugin(name = "SamsungHealth")
class SamsungHealthPlugin : Plugin() {

    private val readPermissions = setOf(
        Permission.of(DataTypes.BODY_COMPOSITION, AccessType.READ),
        Permission.of(DataTypes.SLEEP, AccessType.READ),
        Permission.of(DataTypes.EXERCISE, AccessType.READ),
        Permission.of(DataTypes.STEPS, AccessType.READ),
        Permission.of(DataTypes.ACTIVITY_SUMMARY, AccessType.READ),
        Permission.of(DataTypes.ENERGY_SCORE, AccessType.READ),
    )

    private fun store(): HealthDataStore = HealthDataService.getStore(context.applicationContext)

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", runCatching { store() }.isSuccess)
        call.resolve(result)
    }

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            val granted = runCatching { store().getGrantedPermissions(readPermissions) }
                .getOrDefault(emptySet())
            call.resolve(JSObject().put("granted", granted.containsAll(readPermissions)))
        }
    }

    /** Samsung Health's own permission popup; resolves with what is granted afterwards. */
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = store().requestPermissions(readPermissions, activity)
                call.resolve(JSObject().put("granted", granted.containsAll(readPermissions)))
            } catch (e: HealthDataException) {
                // Samsung Health missing, outdated or disabled: its own screen fixes it.
                if (e is ResolvablePlatformException && e.hasResolution) e.resolve(activity)
                call.resolve(JSObject().put("granted", false))
            }
        }
    }

    private fun timeFilter(call: PluginCall): LocalTimeFilter? {
        val start = call.getString("startDate") ?: return null
        val end = call.getString("endDate") ?: return null
        val zone = ZoneId.systemDefault()
        return LocalTimeFilter.of(
            LocalDateTime.ofInstant(Instant.parse(start), zone),
            LocalDateTime.ofInstant(Instant.parse(end), zone),
        )
    }

    /** Every page of a read; one page stops short on a long history. */
    private suspend fun readAll(
        builder: ReadDataRequest.DualTimeBuilder<HealthDataPoint>,
        filter: LocalTimeFilter,
    ): List<HealthDataPoint> {
        builder.setLocalTimeFilter(filter).setOrdering(Ordering.ASC)
        val points = mutableListOf<HealthDataPoint>()
        var token: String? = null
        do {
            token?.let { builder.setPageToken(it) }
            val response = store().readData(builder.build())
            points += response.dataList
            token = response.pageToken
        } while (!token.isNullOrEmpty())
        return points
    }

    @PluginMethod
    fun queryBodyComposition(call: PluginCall) {
        val filter = timeFilter(call) ?: run {
            call.reject("startDate and endDate are required")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val records = JSArray()
                for (point in readAll(DataTypes.BODY_COMPOSITION.readDataRequestBuilder, filter)) {
                    val weight = point.getValue(DataType.BodyCompositionType.WEIGHT) ?: continue
                    val obj = JSObject()
                    obj.put("timestamp", point.startTime.toString())
                    obj.put("weight", weight.toDouble())
                    obj.put("bodyFat", (point.getValue(DataType.BodyCompositionType.BODY_FAT) ?: 0f).toDouble())
                    obj.put("skeletalMuscleMass", (point.getValue(DataType.BodyCompositionType.SKELETAL_MUSCLE_MASS) ?: 0f).toDouble())
                    obj.put("totalBodyWater", (point.getValue(DataType.BodyCompositionType.TOTAL_BODY_WATER) ?: 0f).toDouble())
                    records.put(obj)
                }
                call.resolve(JSObject().put("records", records))
            } catch (e: Exception) {
                call.reject("Samsung Health read failed: ${e.message}")
            }
        }
    }

    /** Same shape as `WellnessPlugin.querySleep`, so the JS side can take either. */
    @PluginMethod
    fun querySleep(call: PluginCall) {
        val filter = timeFilter(call) ?: run {
            call.reject("startDate and endDate are required")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val zone = ZoneId.systemDefault()
                val sessions = JSArray()
                for (point in readAll(DataTypes.SLEEP.readDataRequestBuilder, filter)) {
                    val end = point.endTime ?: continue
                    val stages = point.getValue(DataType.SleepType.SESSIONS).orEmpty().flatMap { it.stages.orEmpty() }
                    val minutesIn = { type: DataType.SleepType.StageType ->
                        stages.filter { it.stage == type }
                            .sumOf { java.time.Duration.between(it.startTime, it.endTime).toMinutes() }
                    }
                    // Samsung's own total is what the watch shows; stages only
                    // when it is missing, and then without the awake ones.
                    val total = point.getValue(DataType.SleepType.DURATION)?.toMinutes()
                        ?: (minutesIn(DataType.SleepType.StageType.LIGHT) + minutesIn(DataType.SleepType.StageType.DEEP) +
                            minutesIn(DataType.SleepType.StageType.REM))

                    sessions.put(
                        JSObject()
                            .put("startDate", point.startTime.toString())
                            .put("endDate", end.toString())
                            .put("day", end.atZone(zone).toLocalDate().toString())
                            .put("totalMinutes", total)
                            .put("deepMinutes", minutesIn(DataType.SleepType.StageType.DEEP))
                            .put("remMinutes", minutesIn(DataType.SleepType.StageType.REM))
                            .put("lightMinutes", minutesIn(DataType.SleepType.StageType.LIGHT))
                            .put("awakeMinutes", minutesIn(DataType.SleepType.StageType.AWAKE))
                            .put("score", point.getValue(DataType.SleepType.SLEEP_SCORE) ?: 0)
                    )
                }
                call.resolve(JSObject().put("sessions", sessions))
            } catch (e: Exception) {
                call.reject("Samsung Health sleep read failed: ${e.message}")
            }
        }
    }

    /**
     * One entry per exercise session, in the shape `capacitor-health`'s
     * workouts are mapped from on the JS side.
     */
    @PluginMethod
    fun queryWorkouts(call: PluginCall) {
        val filter = timeFilter(call) ?: run {
            call.reject("startDate and endDate are required")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val workouts = JSArray()
                for (point in readAll(DataTypes.EXERCISE.readDataRequestBuilder, filter)) {
                    val type = point.getValue(DataType.ExerciseType.EXERCISE_TYPE)?.name ?: "OTHER"
                    val title = point.getValue(DataType.ExerciseType.CUSTOM_TITLE)
                    val sessions = point.getValue(DataType.ExerciseType.SESSIONS).orEmpty()
                    for ((i, s) in sessions.withIndex()) {
                        val strides = s.count?.takeIf { s.countType == DataType.ExerciseType.CountType.STRIDE } ?: 0
                        workouts.put(
                            JSObject()
                                .put("id", "${point.uid}_$i")
                                .put("type", s.exerciseType?.name ?: type)
                                .put("title", s.customTitle ?: title ?: "")
                                .put("startDate", s.startTime.toString())
                                .put("durationMinutes", s.duration.toMinutes())
                                .put("calories", s.calories.toDouble())
                                .put("distanceMeters", (s.distance ?: 0f).toDouble())
                                .put("meanHeartRate", (s.meanHeartRate ?: 0f).toDouble())
                                .put("maxHeartRate", (s.maxHeartRate ?: 0f).toDouble())
                                .put("steps", strides)
                        )
                    }
                }
                call.resolve(JSObject().put("workouts", workouts))
            } catch (e: Exception) {
                call.reject("Samsung Health workout read failed: ${e.message}")
            }
        }
    }

    /** Daily totals, keyed by local date: `steps` or `active-calories`. */
    @PluginMethod
    fun queryDailyTotals(call: PluginCall) {
        val filter = timeFilter(call) ?: run {
            call.reject("startDate and endDate are required")
            return
        }
        val kind = call.getString("dataType")
        val daily = LocalTimeGroup.of(LocalTimeGroupUnit.DAILY, 1)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // ponytail: one page; daily buckets over the weeks asked for fit in it.
                val rows: List<Pair<String, Double>> = when (kind) {
                    "steps" -> store().aggregateData(
                        DataType.StepsType.TOTAL.requestBuilder.setLocalTimeFilterWithGroup(filter, daily).build()
                    ).dataList.map { it.getStartLocalDateTime().toLocalDate().toString() to (it.value ?: 0L).toDouble() }
                    "active-calories" -> store().aggregateData(
                        DataType.ActivitySummaryType.TOTAL_ACTIVE_CALORIES_BURNED.requestBuilder
                            .setLocalTimeFilterWithGroup(filter, daily).build()
                    ).dataList.map { it.getStartLocalDateTime().toLocalDate().toString() to (it.value ?: 0f).toDouble() }
                    else -> {
                        call.reject("dataType must be steps or active-calories")
                        return@launch
                    }
                }
                val days = JSArray()
                for ((date, value) in rows) days.put(JSObject().put("date", date).put("value", value))
                call.resolve(JSObject().put("days", days))
            } catch (e: Exception) {
                call.reject("Samsung Health $kind read failed: ${e.message}")
            }
        }
    }

    /**
     * Samsung's Energy Score, one per day, 0-100.
     *
     * Keyed by the record's start plus twelve hours: a day-level record may be
     * stamped at local or at UTC midnight, and noon lands on the same calendar
     * day either way — plain midnight would put every score on the day before
     * anywhere west of Greenwich.
     */
    @PluginMethod
    fun queryEnergyScore(call: PluginCall) {
        val start = call.getString("startDate")
        val end = call.getString("endDate")
        if (start == null || end == null) {
            call.reject("startDate and endDate are required")
            return
        }
        val zone = ZoneId.systemDefault()
        val filter = LocalDateFilter.of(
            Instant.parse(start).atZone(zone).toLocalDate(),
            Instant.parse(end).atZone(zone).toLocalDate(),
        )

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val builder = DataTypes.ENERGY_SCORE.readDataRequestBuilder.setLocalDateFilter(filter)
                val days = JSArray()
                var token: String? = null
                do {
                    token?.let { builder.setPageToken(it) }
                    val response = store().readData(builder.build())
                    for (point in response.dataList) {
                        val score = point.getValue(DataType.EnergyScoreType.ENERGY_SCORE) ?: continue
                        val day = point.startTime.plus(java.time.Duration.ofHours(12)).atZone(zone).toLocalDate()
                        days.put(JSObject().put("day", day.toString()).put("score", score.toDouble()))
                    }
                    token = response.pageToken
                } while (!token.isNullOrEmpty())
                call.resolve(JSObject().put("days", days))
            } catch (e: Exception) {
                call.reject("Samsung Health energy score read failed: ${e.message}")
            }
        }
    }
}
