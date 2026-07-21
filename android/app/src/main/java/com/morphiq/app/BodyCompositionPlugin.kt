package com.morphiq.app

import android.content.Intent
import android.util.Log
import androidx.activity.result.ActivityResultCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.BoneMassRecord
import androidx.health.connect.client.records.BodyWaterMassRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Percentage
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
import java.time.Instant
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs

@CapacitorPlugin(name = "BodyComposition")
class BodyCompositionPlugin : Plugin() {

    private val tag = "BodyCompositionPlugin"
    private lateinit var healthConnectClient: HealthConnectClient
    private var available: Boolean = false

    private lateinit var permissionsLauncher: ActivityResultLauncher<Set<String>>
    private val requestPermissionContext = AtomicReference<RequestPermissionContext?>()

    data class RequestPermissionContext(val pluginCall: PluginCall)

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

        val callback: ActivityResultCallback<Set<String>> = ActivityResultCallback { grantedPermissions ->
            val contextRef = requestPermissionContext.getAndSet(null)
            if (contextRef != null) {
                val result = JSObject()
                val readPermissions = JSObject()
                for (perm in requiredPermissions) {
                    readPermissions.put(perm, grantedPermissions.contains(perm))
                }
                result.put("permissions", readPermissions)
                contextRef.pluginCall.resolve(result)
            }
        }
        permissionsLauncher = activity.registerForActivityResult(contract, callback)
    }

    private val requiredPermissions = setOf(
        "android.permission.health.READ_BODY_FAT",
        "android.permission.health.READ_LEAN_BODY_MASS",
        "android.permission.health.READ_BONE_MASS",
        "android.permission.health.READ_BODY_WATER_MASS",
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.WRITE_BODY_FAT",
        "android.permission.health.WRITE_LEAN_BODY_MASS",
        "android.permission.health.WRITE_BONE_MASS",
        "android.permission.health.WRITE_BODY_WATER_MASS",
        "android.permission.health.WRITE_WEIGHT"
    )

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        ensureClientInitialized()
        val result = JSObject()
        result.put("available", available)
        call.resolve(result)
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
                val result = JSObject()
                val readPermissions = JSObject()
                for (perm in requiredPermissions) {
                    readPermissions.put(perm, granted.contains(perm))
                }
                result.put("permissions", readPermissions)
                call.resolve(result)
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
                requestPermissionContext.set(RequestPermissionContext(call))
                permissionsLauncher.launch(requiredPermissions)
            } catch (e: Exception) {
                requestPermissionContext.set(null)
                call.reject("Failed to launch permissions request: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun queryBodyComposition(call: PluginCall) {
        if (!ensureClientInitialized()) {
            call.reject("Health Connect Client is not initialized.")
            return
        }

        val startDateStr = call.getString("startDate")
        val endDateStr = call.getString("endDate")
        if (startDateStr == null || endDateStr == null) {
            call.reject("Missing parameters: startDate and endDate are required.")
            return
        }

        val startInstant = Instant.parse(startDateStr)
        val endInstant = Instant.parse(endDateStr)
        val timeRange = TimeRangeFilter.between(startInstant, endInstant)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = healthConnectClient.permissionController.getGrantedPermissions()
                
                val weights: List<WeightRecord> = if (granted.contains("android.permission.health.READ_WEIGHT")) {
                    healthConnectClient.readRecords(ReadRecordsRequest<WeightRecord>(WeightRecord::class, timeRange)).records
                } else emptyList()

                val bodyFats: List<BodyFatRecord> = if (granted.contains("android.permission.health.READ_BODY_FAT")) {
                    healthConnectClient.readRecords(ReadRecordsRequest<BodyFatRecord>(BodyFatRecord::class, timeRange)).records
                } else emptyList()

                val leanMasses: List<LeanBodyMassRecord> = if (granted.contains("android.permission.health.READ_LEAN_BODY_MASS")) {
                    healthConnectClient.readRecords(ReadRecordsRequest<LeanBodyMassRecord>(LeanBodyMassRecord::class, timeRange)).records
                } else emptyList()

                val boneMasses: List<BoneMassRecord> = if (granted.contains("android.permission.health.READ_BONE_MASS")) {
                    healthConnectClient.readRecords(ReadRecordsRequest<BoneMassRecord>(BoneMassRecord::class, timeRange)).records
                } else emptyList()

                val bodyWaters: List<BodyWaterMassRecord> = if (granted.contains("android.permission.health.READ_BODY_WATER_MASS")) {
                    healthConnectClient.readRecords(ReadRecordsRequest<BodyWaterMassRecord>(BodyWaterMassRecord::class, timeRange)).records
                } else emptyList()

                // Map of timestamp (epochSecond) to record values
                val combined = mutableMapOf<Long, MutableMap<String, Any>>()

                for (r in weights) {
                    val sec = r.time.epochSecond
                    val map = combined.getOrPut(sec) { mutableMapOf() }
                    map["weight"] = r.weight.inKilograms
                    map["time"] = r.time.toString()
                }

                for (r in bodyFats) {
                    val sec = findClosestTimestamp(r.time.epochSecond, combined.keys) ?: r.time.epochSecond
                    val map = combined.getOrPut(sec) { mutableMapOf() }
                    map["bodyFat"] = r.percentage.value
                    if (!map.containsKey("time")) {
                        map["time"] = r.time.toString()
                    }
                }

                for (r in leanMasses) {
                    val sec = findClosestTimestamp(r.time.epochSecond, combined.keys) ?: r.time.epochSecond
                    val map = combined.getOrPut(sec) { mutableMapOf() }
                    map["leanMass"] = r.mass.inKilograms
                    if (!map.containsKey("time")) {
                        map["time"] = r.time.toString()
                    }
                }

                for (r in boneMasses) {
                    val sec = findClosestTimestamp(r.time.epochSecond, combined.keys) ?: r.time.epochSecond
                    val map = combined.getOrPut(sec) { mutableMapOf() }
                    map["boneMass"] = r.mass.inKilograms
                    if (!map.containsKey("time")) {
                        map["time"] = r.time.toString()
                    }
                }

                for (r in bodyWaters) {
                    val sec = findClosestTimestamp(r.time.epochSecond, combined.keys) ?: r.time.epochSecond
                    val map = combined.getOrPut(sec) { mutableMapOf() }
                    map["bodyWaterMass"] = r.mass.inKilograms
                    if (!map.containsKey("time")) {
                        map["time"] = r.time.toString()
                    }
                }

                val recordsArray = JSArray()
                for ((_, map) in combined) {
                    if (map.containsKey("bodyFat") || map.containsKey("weight") || map.containsKey("leanMass")) {
                        val obj = JSObject()
                        obj.put("timestamp", map["time"])
                        obj.put("weight", map["weight"] ?: 0.0)
                        obj.put("bodyFat", map["bodyFat"] ?: 0.0)
                        obj.put("leanMass", map["leanMass"] ?: 0.0)
                        obj.put("boneMass", map["boneMass"] ?: 0.0)
                        obj.put("bodyWaterMass", map["bodyWaterMass"] ?: 0.0)
                        recordsArray.put(obj)
                    }
                }

                val result = JSObject()
                result.put("records", recordsArray)
                call.resolve(result)

            } catch (e: Exception) {
                Log.e(tag, "Error querying body composition records", e)
                call.reject("Failed to query body composition records: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun saveBodyComposition(call: PluginCall) {
        if (!ensureClientInitialized()) {
            call.reject("Health Connect client not initialized")
            return
        }

        val timestampStr = call.getString("timestamp") ?: Instant.now().toString()
        val weight = call.getDouble("weight")
        val bodyFat = call.getDouble("bodyFat")
        val leanMass = call.getDouble("leanMass")
        val boneMass = call.getDouble("boneMass")
        val bodyWaterMass = call.getDouble("bodyWaterMass")

        if (weight == null) {
            call.reject("Missing parameter: weight is required.")
            return
        }

        val time = Instant.parse(timestampStr)
        val metadata = Metadata.manualEntry()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = healthConnectClient.permissionController.getGrantedPermissions()
                val records = mutableListOf<Record>()

                if (granted.contains("android.permission.health.WRITE_WEIGHT")) {
                    records.add(WeightRecord(
                        time = time,
                        zoneOffset = null,
                        weight = Mass.kilograms(weight),
                        metadata = metadata
                    ))
                }

                if (bodyFat != null && bodyFat > 0 && granted.contains("android.permission.health.WRITE_BODY_FAT")) {
                    records.add(BodyFatRecord(
                        time = time,
                        zoneOffset = null,
                        percentage = Percentage(bodyFat),
                        metadata = metadata
                    ))
                }

                if (leanMass != null && leanMass > 0 && granted.contains("android.permission.health.WRITE_LEAN_BODY_MASS")) {
                    records.add(LeanBodyMassRecord(
                        time = time,
                        zoneOffset = null,
                        mass = Mass.kilograms(leanMass),
                        metadata = metadata
                    ))
                }

                if (boneMass != null && boneMass > 0 && granted.contains("android.permission.health.WRITE_BONE_MASS")) {
                    records.add(BoneMassRecord(
                        time = time,
                        zoneOffset = null,
                        mass = Mass.kilograms(boneMass),
                        metadata = metadata
                    ))
                }

                if (bodyWaterMass != null && bodyWaterMass > 0 && granted.contains("android.permission.health.WRITE_BODY_WATER_MASS")) {
                    records.add(BodyWaterMassRecord(
                        time = time,
                        zoneOffset = null,
                        mass = Mass.kilograms(bodyWaterMass),
                        metadata = metadata
                    ))
                }

                if (records.isNotEmpty()) {
                    healthConnectClient.insertRecords(records)
                }
                call.resolve()
            } catch (e: Exception) {
                Log.e(tag, "Failed to save body composition records", e)
                call.reject("Failed to save body composition records: ${e.message}")
            }
        }
    }

    private fun findClosestTimestamp(target: Long, keys: Set<Long>): Long? {
        if (keys.isEmpty()) return null
        for (k in keys) {
            if (abs(k - target) <= 300) { // 5-minute tolerance window
                return k
            }
        }
        return null
    }
}
