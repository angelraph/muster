package org.muster.app

import android.Manifest
import android.graphics.Bitmap
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.journeyapps.barcodescanner.BarcodeEncoder
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.google.zxing.BarcodeFormat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.muster.app.ai.DeviceModel
import org.muster.app.ai.Speech
import org.muster.app.core.*
import org.muster.app.ui.IntakeForm
import org.muster.app.ui.MusterViewModel
import java.util.UUID

private val BUILDINGS = demoBuildings()
private val P1 = Color(0xFFEF4444); private val P2 = Color(0xFFF59E0B); private val P3 = Color(0xFF22C55E); private val OVER = Color(0xFFFF1F5A)
private fun pColor(a: Assessment) = if (a.overdue) OVER else when (a.priority) { Priority.P1 -> P1; Priority.P2 -> P2; Priority.P3 -> P3 }
private val INCIDENT = mapOf("flood" to "Flood", "hurricane" to "Hurricane", "heat_wave" to "Heat wave", "earthquake" to "Earthquake", "wildfire" to "Wildfire")

class MainActivity : ComponentActivity() {
    private val vm: MusterViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme(colorScheme = darkColorScheme()) { Surface(Modifier.fillMaxSize()) { App(vm) } } }
    }
}

private sealed interface Screen {
    data object Doors : Screen
    data class Capture(val building: String?) : Screen
    data class Confirm(val building: String?, val draft: Extraction, val source: String, val existing: Household? = null) : Screen
    data class Saved(val h: Household) : Screen
    data object Team : Screen
    data object Handoff : Screen
}

@Composable
private fun App(vm: MusterViewModel) {
    val role by vm.role.collectAsStateWithLifecycle()
    if (role == "none") { JoinScreen(vm); return }
    var screen by remember { mutableStateOf<Screen>(Screen.Doors) }
    val now by produceState(System.currentTimeMillis()) { while (true) { value = System.currentTimeMillis(); delay(1000) } }

    Column(Modifier.fillMaxSize().systemBarsPadding()) {
        Banner(vm)
        Box(Modifier.weight(1f)) {
            when (val s = screen) {
                Screen.Doors -> Doors(vm, now, onPick = { b -> screen = if (vm.model.value == DeviceModel.AVAILABLE) Screen.Capture(b) else Screen.Confirm(b, Extraction(), "tap") },
                    onRevisit = { h -> screen = Screen.Confirm(h.buildingId, h.x, "tap", h) },
                    onTeam = { screen = Screen.Team }, onHandoff = { screen = Screen.Handoff })
                is Screen.Capture -> Capture(vm, s.building, onDone = { x, src -> screen = Screen.Confirm(s.building, x, src) }, onBack = { screen = Screen.Doors })
                is Screen.Confirm -> Confirm(vm, s, now, onSaved = { screen = Screen.Saved(it) }, onCancel = { screen = Screen.Doors })
                is Screen.Saved -> Saved(vm, s.h, now) { screen = Screen.Doors }
                Screen.Team -> Team(vm, now) { screen = Screen.Doors }
                Screen.Handoff -> Handoff(vm) { screen = Screen.Doors }
            }
        }
    }
}

@Composable
private fun Banner(vm: MusterViewModel) {
    val model by vm.model.collectAsStateWithLifecycle()
    val cfg by vm.config.collectAsStateWithLifecycle()
    val dl by vm.download.collectAsStateWithLifecycle()
    val list by vm.households.collectAsStateWithLifecycle()
    val me by vm.me.collectAsStateWithLifecycle()
    val ok = model == DeviceModel.AVAILABLE
    Column(Modifier.fillMaxWidth().background(if (ok) Color(0xFF072A3D) else Color(0xFF1E2433)).padding(12.dp)) {
        Text("${INCIDENT[cfg.incidentType] ?: cfg.incidentType} · ${list.count { it.reportedBy == me }} captured by you", fontWeight = FontWeight.Bold)
        Text(when (model) {
            DeviceModel.AVAILABLE -> "On-device AI ready. Doorstep notes are read on this phone and never uploaded."
            DeviceModel.DOWNLOADABLE -> "On-device AI can be installed on this phone."
            DeviceModel.DOWNLOADING -> "On-device AI is downloading…"
            DeviceModel.UNAVAILABLE -> "No AI on this phone. Tap mode. Nothing leaves this phone until it syncs."
            DeviceModel.NO_FIREBASE -> "Demo mode (no Firebase config). Tap mode."
        }, fontSize = 13.sp)
        if (model == DeviceModel.DOWNLOADABLE) TextButton({ vm.installModel() }) { Text(dl ?: "Install on-device AI") }
    }
}

@Composable
private fun JoinScreen(vm: MusterViewModel) {
    var code by remember { mutableStateOf("") }
    var err by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Join incident ${vm.repo.incidentId}", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("Ask your coordinator for the join code. You need signal only once.")
        OutlinedTextField(code, { code = it }, label = { Text("Join code") }, singleLine = true)
        Button({ vm.join(code) { err = true } }) { Text("Join") }
        if (err) Text("That code did not work.", color = P1)
    }
}

@Composable
private fun Doors(vm: MusterViewModel, now: Long, onPick: (String?) -> Unit, onRevisit: (Household) -> Unit, onTeam: () -> Unit, onHandoff: () -> Unit) {
    val list by vm.households.collectAsStateWithLifecycle()
    val cfg by vm.config.collectAsStateWithLifecycle()
    val recheck = list.map { it to assess(it.x, cfg.incidentType, cfg.rulebook, it.reportedAt, now) }
        .filter { it.second.nextCheckBy <= now + 30 * 60_000 }.sortedBy { it.second.nextCheckBy }
    val visited = list.mapNotNull { it.buildingId }.toSet()
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                OutlinedButton(onTeam) { Text("Team list") }
                OutlinedButton(onHandoff) { Text("QR handoff") }
                OutlinedButton({ onPick(null) }) { Text("Not listed") }
            }
        }
        if (recheck.isNotEmpty()) {
            item { Text("Recheck due (${recheck.size})", fontWeight = FontWeight.Bold, color = P2, modifier = Modifier.padding(top = 8.dp)) }
            items(recheck.take(5), key = { "r" + it.first.id }) { (h, a) ->
                Row(Modifier.fillMaxWidth().clickable { onRevisit(h) }.padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Tag(priorityText(a.priority), pColor(a)); Text(label(h.buildingId))
                    Text(if (a.nextCheckBy < now) "overdue ${formatLeft(now - a.nextCheckBy)}" else "in ${formatLeft(a.nextCheckBy - now)}", fontSize = 13.sp)
                }
            }
        }
        item { Text("Which door?", fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp)) }
        items(BUILDINGS, key = { it.id }) { b ->
            val v = b.id in visited
            OutlinedCard(Modifier.fillMaxWidth().clickable { onPick(b.id) }) {
                Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(b.label); Text(if (v) "visited" else "not checked", color = if (v) P3 else Color.LightGray, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun Capture(vm: MusterViewModel, building: String?, onDone: (Extraction, String) -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var note by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<Bitmap?>(null) }
    var busy by remember { mutableStateOf(false) }
    var err by remember { mutableStateOf<String?>(null) }
    var stopMic by remember { mutableStateOf<(() -> Unit)?>(null) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { photo = it }
    val micPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) stopMic = Speech.listen(ctx, { note = it }, { stopMic = null })
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(label(building), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("Say or type what you see. Names are not needed.", color = Color.LightGray)
        OutlinedTextField(note, { note = it }, Modifier.fillMaxWidth().heightIn(min = 120.dp),
            placeholder = { Text("e.g. Grandma on oxygen, concentrator dead, battery maybe three hours. Baby 8 months, formula for half a day.") })
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (vm.speechOnDevice) Button({ if (stopMic != null) { stopMic?.invoke(); stopMic = null } else micPerm.launch(Manifest.permission.RECORD_AUDIO) },
                colors = if (stopMic != null) ButtonDefaults.buttonColors(containerColor = P1) else ButtonDefaults.buttonColors()) { Text(if (stopMic != null) "Stop" else "Speak") }
            OutlinedButton({ camera.launch(null) }) { Text("Photo of label") }
        }
        photo?.let { Image(it.asImageBitmap(), "Label photo (stays on this phone)", Modifier.height(140.dp)) }
        err?.let { Text(it, color = P1) }
        Button(enabled = !busy && (note.isNotBlank() || photo != null), onClick = {
            busy = true; err = null
            scope.launch {
                try { val r = vm.ai.extract(note, photo); if (note.isNotBlank()) pendingNote = note; onDone(r.data.let { if (it.descriptor.isBlank()) it else it }, "on_device") }
                catch (e: Exception) {
                    // Fail closed: never fall back to the cloud with a doorstep note.
                    err = "On-device model unavailable (${e.message}). Nothing was sent anywhere."
                    onDone(Extraction(), "tap")
                } finally { busy = false }
            }
        }) { Text(if (busy) "Reading on this phone…" else "Read on this phone") }
        TextButton({ onDone(Extraction(), "tap") }) { Text("Tap instead") }
        TextButton(onBack) { Text("Back") }
        Text("Voice is offered only when this phone can recognise speech on the device. Note and photo never leave this phone.", fontSize = 12.sp, color = Color.Gray)
    }
}

private var pendingNote: String? = null

@Composable
private fun Confirm(vm: MusterViewModel, s: Screen.Confirm, now: Long, onSaved: (Household) -> Unit, onCancel: () -> Unit) {
    val cfg by vm.config.collectAsStateWithLifecycle()
    val me by vm.me.collectAsStateWithLifecycle()
    val list by vm.households.collectAsStateWithLifecycle()
    var draft by remember(s) { mutableStateOf(s.draft) }
    val a = assess(draft, cfg.incidentType, cfg.rulebook, now, now)
    val asks = askKeys(draft)
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(label(s.building), fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Tag(if (s.source == "on_device") "On this phone" else "Tapped", if (s.source == "on_device") Color(0xFF0C4A6E) else Color(0xFF334155))
            }
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Tag(priorityText(a.priority), pColor(a))
                        a.deadline?.let { Text("Time to harm: ${formatLeft(it - now)}", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
                    }
                    a.hazards.forEach { Text("• ${it.label}") }
                    if (a.hazards.isEmpty()) Text("No time-critical need found yet. That does not mean safe.", color = Color.LightGray)
                    if (asks.isNotEmpty()) Text("Ask before you leave: highlighted fields.", color = Color(0xFFFDE68A))
                }
            }
            if (s.source == "on_device") Text("Filled on this phone. Check every field: you are the source of truth.", fontSize = 12.sp, color = Color.Gray)
            IntakeForm(draft, cfg.incidentType, asks) { draft = it }
        }
        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button({
                val existing = s.existing ?: list.find { it.buildingId == s.building && it.reportedBy == me && s.building != null }
                val h = Household(existing?.id ?: UUID.randomUUID().toString(), vm.repo.incidentId, s.building, System.currentTimeMillis(), me,
                    s.source, cfg.rulebook.version, (existing?.visits ?: 0) + 1, draft)
                pendingNote?.let { vm.repo.keepPrivateNote(h.id, it) }; pendingNote = null
                onSaved(h)
            }, Modifier.weight(1f)) { Text("Save household") }
            OutlinedButton(onCancel) { Text("Cancel") }
        }
    }
}

@Composable
private fun Saved(vm: MusterViewModel, h: Household, now: Long, onNext: () -> Unit) {
    val cfg by vm.config.collectAsStateWithLifecycle()
    var synced by remember(h.id) { mutableStateOf<Boolean?>(null) }
    LaunchedEffect(h.id) { vm.repo.save(h) { synced = it } }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Saved", fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text(if (synced == true) "Synced to the coordinator." else "Saved on this phone. It will sync as soon as any signal appears.")
        Text("Next check: ${formatLeft(assess(h.x, cfg.incidentType, cfg.rulebook, h.reportedAt, now).nextCheckBy - now)} from now", color = Color.LightGray)
        Button(onNext) { Text("Next door") }
    }
}

@Composable
private fun Team(vm: MusterViewModel, now: Long, onBack: () -> Unit) {
    val list by vm.households.collectAsStateWithLifecycle()
    val cfg by vm.config.collectAsStateWithLifecycle()
    val rows = list.map { it to assess(it.x, cfg.incidentType, cfg.rulebook, it.reportedAt, now) }
        .sortedWith(compareBy({ !it.second.overdue }, { it.second.priority.ordinal }, { it.second.deadline ?: Long.MAX_VALUE }))
    Column(Modifier.fillMaxSize().padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { TextButton(onBack) { Text("← Doors") }; Text("By time to harm", fontWeight = FontWeight.Bold) }
        if (!vm.repo.firebaseOn) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            INCIDENT.forEach { (k, l) -> FilterChip(cfg.incidentType == k, { vm.repo.setLocalIncident(k); vm.refreshConfig() }, { Text(l, fontSize = 11.sp) }) }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(rows, key = { it.first.id }) { (h, a) ->
                OutlinedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Tag(if (a.overdue) "Overdue" else priorityText(a.priority), pColor(a)); Text(label(h.buildingId), fontWeight = FontWeight.Bold)
                        }
                        a.deadline?.let { Text("Time to harm: ${formatLeft(it - now)}", fontWeight = FontWeight.Bold) }
                        a.hazards.forEach { z -> Text("• ${z.label}" + (z.ask?.let { " · Ask: $it" } ?: "")) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Handoff(vm: MusterViewModel, onBack: () -> Unit) {
    val list by vm.households.collectAsStateWithLifecycle()
    val me by vm.me.collectAsStateWithLifecycle()
    val mine = list.filter { it.reportedBy == me }
    val frames = remember(mine) { HandoffCodec.encode(vm.repo.flatJson(mine)) }
    var i by remember { mutableIntStateOf(0) }
    LaunchedEffect(frames) { while (true) { delay(700); i = (i + 1) % frames.size } }
    val collector = remember { HandoffCodec.Collector() }
    var status by remember { mutableStateOf("") }
    lateinit var scan: androidx.activity.compose.ManagedActivityResultLauncher<ScanOptions, com.journeyapps.barcodescanner.ScanIntentResult>
    scan = rememberLauncherForActivityResult(ScanContract()) { r ->
        val text = r.contents ?: return@rememberLauncherForActivityResult
        collector.add(text)
        if (collector.complete) {
            val got = vm.repo.fromFlatJson(collector.json()); got.forEach { vm.repo.save(it) }
            status = "${got.size} households now on this phone. They sync when you reach signal."
        } else {
            status = "Received ${collector.received}/${collector.total} frames"
            scan.launch(ScanOptions().setPrompt(status).setBeepEnabled(false).setOrientationLocked(true))
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { TextButton(onBack) { Text("← Doors") }; Text("QR handoff · no network used", fontWeight = FontWeight.Bold) }
        if (mine.isEmpty()) Text("You have no records to hand off yet.") else {
            Text("${mine.size} households · frame ${i + 1}/${frames.size}")
            val bmp = remember(frames, i) { BarcodeEncoder().encodeBitmap(frames[i], BarcodeFormat.QR_CODE, 720, 720) }
            Image(bmp.asImageBitmap(), "QR frame", Modifier.size(300.dp).background(Color.White))
        }
        Button({ scan.launch(ScanOptions().setPrompt("Point at your teammate's QR code").setBeepEnabled(false).setOrientationLocked(true)) }) { Text("Scan a teammate") }
        if (status.isNotEmpty()) Text(status)
    }
}

@Composable
private fun Tag(text: String, color: Color) {
    Text(text, Modifier.background(color, MaterialTheme.shapes.small).padding(horizontal = 8.dp, vertical = 2.dp), fontSize = 12.sp, fontWeight = FontWeight.Bold)
}

private fun label(id: String?) = BUILDINGS.find { it.id == id }?.label ?: "Unmapped location"
