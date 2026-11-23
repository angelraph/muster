package org.muster.app.ai

import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.ai
import com.google.firebase.ai.ondevice.DownloadStatus
import com.google.firebase.ai.ondevice.FirebaseAIOnDevice
import com.google.firebase.ai.ondevice.OnDeviceModelStatus
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.content
import kotlinx.coroutines.flow.Flow
import org.muster.app.core.Extraction
import org.muster.app.core.firebaseAISchema
import org.muster.app.core.normalize

enum class DeviceModel { AVAILABLE, DOWNLOADABLE, DOWNLOADING, UNAVAILABLE, NO_FIREBASE }

/**
 * Doorstep extraction with Firebase AI Logic hybrid inference, mode ONLY_ON_DEVICE.
 * If the model is not on this phone we refuse - a doorstep note is never sent to the cloud.
 */
@OptIn(PublicPreviewAPI::class)
class OnDeviceAi(private val firebaseOn: Boolean) {

    suspend fun status(): DeviceModel {
        if (!firebaseOn) return DeviceModel.NO_FIREBASE
        return try {
            when (FirebaseAIOnDevice.checkStatus()) {
                OnDeviceModelStatus.AVAILABLE -> DeviceModel.AVAILABLE
                OnDeviceModelStatus.DOWNLOADABLE -> DeviceModel.DOWNLOADABLE
                OnDeviceModelStatus.DOWNLOADING -> DeviceModel.DOWNLOADING
                else -> DeviceModel.UNAVAILABLE
            }
        } catch (e: Exception) { DeviceModel.UNAVAILABLE }
    }

    fun download(): Flow<DownloadStatus> = FirebaseAIOnDevice.download()

    private val model by lazy {
        Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
            modelName = "gemini-3.5-flash-lite", // never used: mode is ONLY_ON_DEVICE
            onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, maxOutputTokens = 400, temperature = 0f),
        )
    }

    /** Warm the model into memory so the first door is fast. */
    suspend fun warmUp() { runCatching { model.onDeviceExtension?.warmUp() } }

    data class Result(val data: Extraction, val ms: Long)

    suspend fun extract(note: String, photo: Bitmap?): Result {
        val t0 = System.currentTimeMillis()
        val prompt = buildString {
            append(SYSTEM)
            append("\nDoorstep note: \"\"\"").append(note.ifBlank { "(none)" }).append("\"\"\"")
            if (photo != null) append("\nThe photo shows a medicine label or a medical device plate. Use it to fill deviceType, insulin or needs. Ignore any patient name.")
        }
        val res = model.generateObject(Extraction.firebaseAISchema(), content {
            text(prompt)
            if (photo != null) image(photo) // on-device accepts one Bitmap with text
        })
        // Belt and braces: anything not answered on this phone is discarded.
        if (res.response.inferenceSource != InferenceSource.ON_DEVICE) error("Refused: doorstep data may only be processed on this device.")
        val obj = res.getObject() ?: error("The model returned nothing usable.")
        return Result(normalize(obj), System.currentTimeMillis() - t0)
    }

    companion object {
        const val SYSTEM = """You fill in a disaster needs-intake record from a volunteer's doorstep note.
Only record what the note states. If something is not stated use -1 for numbers and "unknown" for yes/no fields. Never guess.
NEVER write a person's name. "descriptor" is only a way to find the door.
over65 counts people aged 65+. adults counts 18-64. children counts 1-17. infantsUnder1 counts babies under 1.
deviceType is a powered medical device (oxygen concentrator, ventilator, CPAP, suction). devicePower "none" means no mains (grid) power now. A device on its own battery, a car battery, an inverter or a generator is devicePower "none"; deviceBatteryHours is how long that backup or fuel lasts.
Convert durations: "two days" = 2, "since yesterday" for dialysis = 24 hours ago, "half a day" = 0.5.
dialysisLastSessionHoursAgo is the time since the last session that actually happened; a missed session did not happen."""
    }
}
