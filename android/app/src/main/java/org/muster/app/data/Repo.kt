package org.muster.app.data

import android.content.Context
import com.google.firebase.Firebase
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import org.muster.app.BuildConfig
import org.muster.app.core.Extraction
import org.muster.app.core.Household
import org.muster.app.core.Rulebook
import java.util.UUID

data class LiveConfig(val incidentType: String, val rulebook: Rulebook, val cloudEnabled: Boolean)

/** Firestore when google-services.json is present, otherwise a local demo store on this phone. */
class Repo(private val ctx: Context) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    val incidentId = BuildConfig.INCIDENT_ID
    val firebaseOn: Boolean = BuildConfig.HAS_FIREBASE && FirebaseApp.getApps(ctx).isNotEmpty()
    private val prefs = ctx.getSharedPreferences("muster", Context.MODE_PRIVATE)
    private val local = MutableStateFlow(loadLocal())

    val defaultRulebook: Rulebook =
        json.decodeFromString(Rulebook.serializer(), ctx.assets.open("rulebook.example.json").bufferedReader().readText())

    // ---------- identity & membership ----------
    suspend fun volunteerId(): String {
        if (!firebaseOn) return prefs.getString("vid", null) ?: ("local-" + UUID.randomUUID().toString().take(8)).also { prefs.edit().putString("vid", it).apply() }
        val auth = Firebase.auth
        return auth.currentUser?.uid ?: auth.signInAnonymously().await().user!!.uid
    }

    suspend fun role(): String {
        if (!firebaseOn) return "volunteer"
        val cached = prefs.getString("role.$incidentId", null)
        return try {
            val snap = Firebase.firestore.collection("incidents").document(incidentId).collection("members").document(volunteerId()).get().await()
            val r = if (snap.exists()) snap.getString("role") ?: "volunteer" else "none"
            if (r != "none") prefs.edit().putString("role.$incidentId", r).apply()
            r
        } catch (e: Exception) { cached ?: "none" }
    }

    suspend fun join(code: String) {
        Firebase.firestore.collection("incidents").document(incidentId).collection("members").document(volunteerId())
            .set(mapOf("code" to code.trim(), "role" to "volunteer", "joinedAt" to System.currentTimeMillis())).await()
        prefs.edit().putString("role.$incidentId", "volunteer").apply()
    }

    // ---------- households ----------
    fun households(): Flow<List<Household>> = if (!firebaseOn) local else callbackFlow {
        val reg = Firebase.firestore.collection("incidents").document(incidentId).collection("households")
            .addSnapshotListener { snap, _ -> if (snap != null) trySend(snap.documents.mapNotNull { d -> d.data?.let(::fromDoc) }) }
        awaitClose { reg.remove() }
    }

    /** Written to the device first (Firestore offline cache is on by default); syncs whenever signal appears. */
    fun save(h: Household, onSynced: (Boolean) -> Unit = {}) {
        if (!firebaseOn) {
            local.value = local.value.filterNot { it.id == h.id } + h
            prefs.edit().putString("households", json.encodeToString(kotlinx.serialization.builtins.ListSerializer(Household.serializer()), local.value)).apply()
            onSynced(true); return
        }
        Firebase.firestore.collection("incidents").document(incidentId).collection("households").document(h.id).set(toDoc(h))
            .addOnCompleteListener { onSynced(it.isSuccessful) }
    }

    // ---------- door-hanger attempts, resident check-ins, agency registry (same collections as the web app) ----------
    data class Attempt(val token: String, val buildingId: String, val at: Long)
    data class Registry(val buildingId: String, val risks: List<String>)

    private val ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    fun newToken(): String { val r = java.security.SecureRandom(); return (1..8).map { ALPHA[r.nextInt(ALPHA.length)] }.joinToString("") }

    suspend fun recordAttempt(buildingId: String): Attempt {
        val a = Attempt(newToken(), buildingId, System.currentTimeMillis())
        if (firebaseOn) Firebase.firestore.collection("incidents").document(incidentId).collection("attempts").document(a.token)
            .set(mapOf("token" to a.token, "buildingId" to a.buildingId, "at" to a.at, "by" to volunteerId())) // queues offline
        return a
    }

    fun attempts(): Flow<List<Attempt>> = if (!firebaseOn) MutableStateFlow(emptyList()) else callbackFlow {
        val reg = Firebase.firestore.collection("incidents").document(incidentId).collection("attempts")
            .addSnapshotListener { snap, _ -> if (snap != null) trySend(snap.documents.mapNotNull { d ->
                runCatching { Attempt(d.getString("token")!!, d.getString("buildingId")!!, (d.get("at") as Number).toLong()) }.getOrNull() }) }
        awaitClose { reg.remove() }
    }

    fun selfReported(): Flow<Set<String>> = if (!firebaseOn) MutableStateFlow(emptySet()) else callbackFlow {
        val reg = Firebase.firestore.collection("incidents").document(incidentId).collection("selfReports")
            .addSnapshotListener { snap, _ -> if (snap != null) trySend(snap.documents.mapNotNull { it.getString("buildingId") }.toSet()) }
        awaitClose { reg.remove() }
    }

    fun registry(): Flow<List<Registry>> = if (!firebaseOn) MutableStateFlow(emptyList()) else callbackFlow {
        val reg = Firebase.firestore.collection("incidents").document(incidentId).collection("registry")
            .addSnapshotListener { snap, _ -> if (snap != null) trySend(snap.documents.mapNotNull { d ->
                @Suppress("UNCHECKED_CAST") runCatching { Registry(d.getString("buildingId")!!, (d.get("risks") as List<String>)) }.getOrNull() }) }
        awaitClose { reg.remove() }
    }

    // ---------- Inference Ledger: every AI call on this phone, stored only on this phone ----------
    data class LedgerEntry(val at: Long, val task: String, val mode: String, val source: String, val ms: Long, val bytesUp: Long, val reason: String)
    val ledger = MutableStateFlow(loadLedger())
    fun logCall(e: LedgerEntry) {
        ledger.value = (listOf(e) + ledger.value).take(300)
        val arr = org.json.JSONArray(ledger.value.map { org.json.JSONObject(mapOf("at" to it.at, "task" to it.task, "mode" to it.mode, "source" to it.source, "ms" to it.ms, "bytesUp" to it.bytesUp, "reason" to it.reason)) })
        prefs.edit().putString("ledger", arr.toString()).apply()
    }
    private fun loadLedger(): List<LedgerEntry> = runCatching {
        val a = org.json.JSONArray(prefs.getString("ledger", "[]"))
        (0 until a.length()).map { i -> a.getJSONObject(i).let { LedgerEntry(it.getLong("at"), it.getString("task"), it.getString("mode"), it.getString("source"), it.getLong("ms"), it.getLong("bytesUp"), it.getString("reason")) } }
    }.getOrDefault(emptyList())

    var fieldMode: String
        get() = prefs.getString("fieldMode", "off") ?: "off"
        set(v) { prefs.edit().putString("fieldMode", v).apply() }

    // Doorstep notes never sync: kept only in this app's private storage.
    fun keepPrivateNote(id: String, note: String) = prefs.edit().putString("private.$id", note).apply()

    private fun loadLocal(): List<Household> = prefs.getString("households", null)?.let {
        runCatching { json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(Household.serializer()), it) }.getOrNull()
    } ?: emptyList()

    /** Flat document, same field names as the web app and the Firestore rules allow-list. */
    fun toDoc(h: Household): Map<String, Any?> {
        val x = json.encodeToJsonElement(Extraction.serializer(), h.x).jsonObject.mapValues { (_, v) ->
            when (v) {
                is JsonPrimitive -> if (v.isString) v.content else v.longOrNull ?: v.doubleOrNull ?: v.booleanOrNull
                else -> (v as kotlinx.serialization.json.JsonArray).map { (it as JsonPrimitive).content }
            }
        }
        return x + mapOf(
            "id" to h.id, "incidentId" to h.incidentId, "buildingId" to h.buildingId, "reportedAt" to h.reportedAt,
            "reportedBy" to h.reportedBy, "source" to h.source, "rulebookVersion" to h.rulebookVersion, "visits" to h.visits,
        )
    }

    fun fromDoc(d: Map<String, Any?>): Household? = runCatching {
        val obj = JsonObject(d.filterKeys { it in EXTRACTION_KEYS }.mapValues { (_, v) ->
            when (v) {
                is String -> JsonPrimitive(v)
                is Long, is Int -> JsonPrimitive(v.toLong())
                is Number -> JsonPrimitive(v.toDouble())
                is List<*> -> kotlinx.serialization.json.JsonArray(v.map { JsonPrimitive(it.toString()) })
                else -> JsonPrimitive(v?.toString())
            }
        })
        Household(
            id = d["id"] as String, incidentId = d["incidentId"] as String, buildingId = d["buildingId"] as String?,
            reportedAt = (d["reportedAt"] as Number).toLong(), reportedBy = d["reportedBy"] as String,
            source = d["source"] as String, rulebookVersion = d["rulebookVersion"] as String,
            visits = (d["visits"] as Number).toInt(), x = json.decodeFromJsonElement(Extraction.serializer(), obj),
        )
    }.getOrNull()

    // ---------- QR handoff uses the web app's flat format so phones and laptops interoperate ----------
    fun flatJson(list: List<Household>): String = kotlinx.serialization.json.JsonArray(list.map { h ->
        JsonObject(toDoc(h).mapValues { (_, v) ->
            when (v) {
                null -> kotlinx.serialization.json.JsonNull
                is String -> JsonPrimitive(v); is Number -> JsonPrimitive(v); is Boolean -> JsonPrimitive(v)
                is List<*> -> kotlinx.serialization.json.JsonArray(v.map { JsonPrimitive(it.toString()) })
                else -> JsonPrimitive(v.toString())
            }
        })
    }).toString()

    fun fromFlatJson(text: String): List<Household> =
        (json.parseToJsonElement(text) as kotlinx.serialization.json.JsonArray).mapNotNull { el ->
            val m = el.jsonObject.mapValues { (_, v) ->
                when (v) {
                    is kotlinx.serialization.json.JsonNull -> null
                    is JsonPrimitive -> if (v.isString) v.content else v.longOrNull ?: v.doubleOrNull ?: v.booleanOrNull
                    is kotlinx.serialization.json.JsonArray -> v.map { (it as JsonPrimitive).content }
                    else -> null
                }
            }
            fromDoc(m)
        }

    // ---------- Remote Config: the coordinator's switches ----------
    suspend fun liveConfig(): LiveConfig {
        if (!firebaseOn) return LiveConfig(prefs.getString("incidentType", "flood")!!, defaultRulebook, true)
        val rc = Firebase.remoteConfig
        rc.setConfigSettingsAsync(remoteConfigSettings { minimumFetchIntervalInSeconds = 60 })
        rc.setDefaultsAsync(mapOf("incident_type" to "flood", "cloud_enabled" to true,
            "rulebook_json" to ctx.assets.open("rulebook.example.json").bufferedReader().readText()))
        runCatching { rc.fetchAndActivate().await() } // offline: last activated values
        val rb = runCatching { json.decodeFromString(Rulebook.serializer(), rc.getString("rulebook_json")) }.getOrDefault(defaultRulebook)
        return LiveConfig(rc.getString("incident_type"), rb, rc.getBoolean("cloud_enabled"))
    }

    fun setLocalIncident(type: String) = prefs.edit().putString("incidentType", type).apply()

    companion object {
        val EXTRACTION_KEYS = setOf("descriptor", "adults", "over65", "children", "infantsUnder1", "livesAlone", "deviceType",
            "devicePower", "deviceBatteryHours", "dialysis", "dialysisLastSessionHoursAgo", "insulin", "insulinRefrigerated",
            "insulinSupplyDays", "hasCooling", "mobilityLimited", "waterDaysLeft", "infantFormulaDaysLeft", "needs")
    }
}
