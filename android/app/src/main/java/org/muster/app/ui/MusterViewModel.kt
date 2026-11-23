package org.muster.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.muster.app.ai.DeviceModel
import org.muster.app.ai.OnDeviceAi
import org.muster.app.ai.Speech
import org.muster.app.core.Household
import org.muster.app.data.LiveConfig
import org.muster.app.data.Repo
import com.google.firebase.ai.ondevice.DownloadStatus

class MusterViewModel(app: Application) : AndroidViewModel(app) {
    val repo = Repo(app)
    val ai = OnDeviceAi(repo.firebaseOn)

    val households: StateFlow<List<Household>> = repo.households().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val config = MutableStateFlow(LiveConfig("flood", repo.defaultRulebook, true))
    val model = MutableStateFlow(DeviceModel.UNAVAILABLE)
    val download = MutableStateFlow<String?>(null)
    val me = MutableStateFlow("")
    val role = MutableStateFlow("…")
    val speechOnDevice = Speech.available(app)
    val attempts = repo.attempts().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val selfReported = repo.selfReported().stateIn(viewModelScope, SharingStarted.Eagerly, emptySet())
    val registry = repo.registry().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val fieldMode = MutableStateFlow(repo.fieldMode)
    fun cycleFieldMode() { val n = when (fieldMode.value) { "off" -> "field"; "field" -> "night"; else -> "off" }; fieldMode.value = n; repo.fieldMode = n }

    init {
        viewModelScope.launch {
            me.value = runCatching { repo.volunteerId() }.getOrDefault("offline-" + System.currentTimeMillis())
            role.value = repo.role()
        }
        viewModelScope.launch {
            model.value = ai.status()
            if (model.value == DeviceModel.AVAILABLE) ai.warmUp()
        }
        // Remote Config: the next time this phone has any signal it picks up the coordinator's switches.
        viewModelScope.launch { while (true) { config.value = repo.liveConfig(); delay(30_000) } }
    }

    fun refreshConfig() = viewModelScope.launch { config.value = repo.liveConfig() }

    fun join(code: String, onError: () -> Unit) = viewModelScope.launch {
        try { repo.join(code); role.value = repo.role() } catch (e: Exception) { onError() }
    }

    fun installModel() = viewModelScope.launch {
        ai.download().collect { s ->
            download.value = when (s) {
                is DownloadStatus.DownloadStarted -> "Starting download (${s.bytesToDownload / 1_000_000} MB)"
                is DownloadStatus.DownloadInProgress -> "Downloaded ${s.totalBytesDownloaded / 1_000_000} MB"
                is DownloadStatus.DownloadCompleted -> null
                is DownloadStatus.DownloadFailed -> "Download failed. Try again on Wi-Fi."
                else -> download.value
            }
        }
        model.value = ai.status()
    }
}
