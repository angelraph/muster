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
import org.muster.app.ui.Ic
import org.muster.app.ui.M
import org.muster.app.ui.MusterTheme
import org.muster.app.ui.Glyph
import org.muster.app.ui.CapsStyle
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
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
        setContent {
            val mode by vm.fieldMode.collectAsStateWithLifecycle()
            MusterTheme(mode) { Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { App(vm) } }
        }
    }
}

private sealed interface Screen {
    data object Home : Screen
    data object More : Screen
    data object Ledger : Screen
    data class Hanger(val a: org.muster.app.data.Repo.Attempt) : Screen
    data object Doors : Screen
    data class Capture(val building: String?) : Screen
    data class Confirm(val building: String?, val draft: Extraction, val source: String, val existing: Household? = null) : Screen
    data class Saved(val h: Household) : Screen
    data object Team : Screen
    data object Handoff : Screen
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App(vm: MusterViewModel) {
    val role by vm.role.collectAsStateWithLifecycle()
    if (role == "…") { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }; return }
    var welcomed by remember { mutableStateOf(vm.repo.welcomed) }
    if (!welcomed) { Welcome { vm.repo.welcomed = true; welcomed = true }; return }
    if (role == "none") { JoinScreen(vm); return }
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    val now by produceState(System.currentTimeMillis()) { while (true) { value = System.currentTimeMillis(); delay(1000) } }
    val scope = rememberCoroutineScope()
    val tab = when (screen) { Screen.Home -> 0; Screen.Team -> 2; Screen.More, Screen.Ledger -> 3; else -> 1 }
    // Android Back: sub-screens return to their tab, tabs return Home, Home exits.
    androidx.activity.compose.BackHandler(enabled = screen != Screen.Home) {
        screen = when (screen) { is Screen.Capture, is Screen.Confirm, is Screen.Saved, Screen.Handoff, is Screen.Hanger -> Screen.Doors; Screen.Ledger -> Screen.More; else -> Screen.Home }
    }
    val noAnswer: (String?) -> Unit = { b -> if (b != null) scope.launch { screen = Screen.Hanger(vm.repo.recordAttempt(b)) } }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopBar(vm, onLedger = { screen = Screen.Ledger }) },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                listOf(Triple("Home", Ic.home, Screen.Home), Triple("Doors", Ic.door, Screen.Doors), Triple("Team", Ic.team, Screen.Team), Triple("More", Ic.more, Screen.More))
                    .forEachIndexed { i, (t, ic, dest) ->
                        NavigationBarItem(selected = tab == i, onClick = { screen = dest }, icon = { Icon(ic, t) }, label = { Text(t) },
                            colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.secondaryContainer))
                    }
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad)) {
            if (screen !is Screen.Home && screen !is Screen.More && screen !is Screen.Ledger) Banner(vm)
            Box(Modifier.weight(1f)) {
                when (val s = screen) {
                    Screen.Home -> Home(vm, now, go = { screen = it })
                    Screen.More -> More(vm, onLedger = { screen = Screen.Ledger })
                    Screen.Ledger -> LedgerScreen(vm) { screen = Screen.More }
                    is Screen.Hanger -> DoorHanger(s.a) { screen = Screen.Doors }
                    Screen.Doors -> Doors(vm, now, onPick = { b -> screen = if (vm.model.value == DeviceModel.AVAILABLE) Screen.Capture(b) else Screen.Confirm(b, Extraction(), "tap") },
                        onRevisit = { h -> screen = Screen.Confirm(h.buildingId, h.x, "tap", h) },
                        onTeam = { screen = Screen.Team }, onHandoff = { screen = Screen.Handoff })
                    is Screen.Capture -> Capture(vm, s.building, onDone = { x, src -> screen = Screen.Confirm(s.building, x, src) }, onBack = { screen = Screen.Doors }, onNoAnswer = { noAnswer(s.building) })
                    is Screen.Confirm -> Confirm(vm, s, now, onSaved = { screen = Screen.Saved(it) }, onCancel = { screen = Screen.Doors }, onNoAnswer = { noAnswer(s.building) })
                    is Screen.Saved -> Saved(vm, s.h, now) { screen = Screen.Doors }
                    Screen.Team -> Team(vm, now) { screen = Screen.Doors }
                    Screen.Handoff -> Handoff(vm) { screen = Screen.Doors }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TopBar(vm: MusterViewModel, onLedger: () -> Unit) {
    val ledger by vm.repo.ledger.collectAsStateWithLifecycle()
    val mode by vm.fieldMode.collectAsStateWithLifecycle()
    val doorstepUp = ledger.filter { it.task == "extract" }.sumOf { it.bytesUp }
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Image(androidx.compose.ui.res.painterResource(R.mipmap.ic_launcher_foreground), null, Modifier.size(40.dp))
                Text("Muster", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
            }
        },
        actions = {
            Pill(if (mode == "off") "Field" else if (mode == "field") "Field on" else "Night", if (mode == "off") MaterialTheme.colorScheme.onSurfaceVariant else M.amber) { vm.cycleFieldMode() }
            Spacer(Modifier.width(6.dp))
            Pill("$doorstepUp B up", M.ok, onLedger)
            Spacer(Modifier.width(8.dp))
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun Pill(text: String, color: Color, onClick: () -> Unit) {
    Text(text, Modifier.border(1.dp, color.copy(alpha = .5f), RoundedCornerShape(50)).clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 5.dp),
        color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
}

@Composable
private fun Home(vm: MusterViewModel, now: Long, go: (Screen) -> Unit) {
    val list by vm.households.collectAsStateWithLifecycle()
    val cfg by vm.config.collectAsStateWithLifecycle()
    val me by vm.me.collectAsStateWithLifecycle()
    val model by vm.model.collectAsStateWithLifecycle()
    val attempts by vm.attempts.collectAsStateWithLifecycle()
    val rows = list.map { assess(it.x, cfg.incidentType, cfg.rulebook, it.reportedAt, now) }
    val visited = list.mapNotNull { it.buildingId }.toSet()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("${(INCIDENT[cfg.incidentType] ?: cfg.incidentType).uppercase()} RESPONSE · ${NEIGHBOURHOOD_NAME.uppercase()}", style = CapsStyle, color = MaterialTheme.colorScheme.secondary)
        Text("Find them before their clock runs out.", style = MaterialTheme.typography.headlineMedium)
        Text("Check every door. Muster works out who has the least time, even with no signal.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Stat("${rows.count { it.priority == Priority.P1 || it.overdue }}", "urgent", M.p1, Modifier.weight(1f))
            Stat("${rows.count { it.overdue }}", "overdue", M.over, Modifier.weight(1f))
            Stat("${BUILDINGS.size - visited.size}", "unchecked", MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Stat("${list.count { it.reportedBy == me }}", "by you", M.cyan, Modifier.weight(1f))
            Stat("${attempts.size}", "no answer", M.amber, Modifier.weight(1f))
            Stat("${list.size}", "households", MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
        }
        Button({ go(Screen.Doors) }, Modifier.fillMaxWidth().height(58.dp), shape = RoundedCornerShape(16.dp)) {
            Glyph(Ic.door, Color.White); Spacer(Modifier.width(10.dp)); Text("Go to the next door", fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton({ go(Screen.Team) }, Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(14.dp)) { Glyph(Ic.team); Spacer(Modifier.width(8.dp)); Text("Team list") }
            OutlinedButton({ go(Screen.Handoff) }, Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(14.dp)) { Glyph(Ic.qr); Spacer(Modifier.width(8.dp)); Text("QR handoff") }
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Glyph(Ic.shield, if (model == DeviceModel.AVAILABLE) M.cyan else MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(if (model == DeviceModel.AVAILABLE) "On-device AI ready" else "Tap mode on this phone", fontWeight = FontWeight.Bold)
                }
                Text(if (model == DeviceModel.AVAILABLE) "Speak or type at the door. Gemini Nano fills the record on this phone. Nothing is uploaded."
                     else "This phone has no on-device AI, so you tap the answers. Same rules, same sync, nothing leaves the phone until it syncs.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
            }
        }
        Text("Map data $NEIGHBOURHOOD_ATTRIBUTION. Needs intake and logistics only. Not medical advice.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Stat(n: String, l: String, color: Color, modifier: Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.padding(12.dp)) { Text(n, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = color); Text(l, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

private const val SITE = "https://muster-hybrid.web.app/#"

@Composable
private fun More(vm: MusterViewModel, onLedger: () -> Unit) {
    val uri = androidx.compose.ui.platform.LocalUriHandler.current
    val items = listOf(
        "How it works" to "/how", "Features" to "/features", "FAQ" to "/faq", "Privacy" to "/privacy",
        "Safety & limits" to "/safety", "For response agencies" to "/agencies", "For judges" to "/judges", "About & credits" to "/about",
        "Coordinator board (web)" to "/board", "Muster website" to "/",
    )
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("More", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)) }
        item { MoreRow("Inference Ledger", "Every AI call on this phone: where it ran, time, bytes sent, why", Ic.shield, onLedger) }
        item { MoreRow("Field mode", "Big text for gloves and rain, then red night mode", Ic.sliders) { vm.cycleFieldMode() } }
        item { Text("LEARN", style = CapsStyle, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp)) }
        items(items, key = { it.first }) { (t, path) -> MoreRow(t, null, Ic.ext) { uri.openUri(SITE + path) } }
        item { Text("Incident ${vm.repo.incidentId} · $NEIGHBOURHOOD_NAME · map $NEIGHBOURHOOD_ATTRIBUTION · v${BuildConfig.VERSION_NAME}", fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 16.dp)) }
    }
}

@Composable
private fun MoreRow(title: String, sub: String?, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) { Text(title, fontWeight = FontWeight.SemiBold); sub?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            Glyph(icon, MaterialTheme.colorScheme.onSurfaceVariant, 18)
        }
    }
}

@Composable
private fun LedgerScreen(vm: MusterViewModel, onBack: () -> Unit) {
    val list by vm.repo.ledger.collectAsStateWithLifecycle()
    val up = list.filter { it.task == "extract" }.sumOf { it.bytesUp }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Row(verticalAlignment = Alignment.CenterVertically) { IconButton(onBack) { Glyph(Ic.back) }; Text("Inference Ledger", style = MaterialTheme.typography.titleLarge) } }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = M.okBg), shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(1.dp, M.ok.copy(alpha = .4f))) {
                Column(Modifier.padding(16.dp)) { Text("$up B", fontSize = 34.sp, fontWeight = FontWeight.ExtraBold, color = M.ok); Text("doorstep data uploaded from this phone") }
            }
        }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Stat("${list.count { it.source == "on_device" }}", "on this phone", M.cyan, Modifier.weight(1f))
            Stat("${list.count { it.source == "refused" }}", "refused (fail closed)", MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
        } }
        if (list.isEmpty()) item { Text("No AI calls yet. On phones with Gemini Nano, each doorstep reading appears here. Tap mode makes no AI calls at all.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(list) { e ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text("${if (e.source == "on_device") "On this phone" else "Refused"} · ${e.mode} · ${e.ms} ms · ${e.bytesUp} B up", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text(e.reason, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun DoorHanger(a: org.muster.app.data.Repo.Attempt, onDone: () -> Unit) {
    val url = "$SITE/r/${a.token}"
    val bmp = remember(a.token) { BarcodeEncoder().encodeBitmap(url, BarcodeFormat.QR_CODE, 720, 720) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Nobody answered at ${label(a.buildingId)}. It stays on the list as no answer, with a recheck. Show or copy this code for the resident.",
            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(20.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("We came to check on you.", color = Color(0xFF0B1220), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                Text("When you have signal, scan this code and tell the response team if you are OK or need help.", color = Color(0xFF334155), fontSize = 14.sp)
                Image(bmp.asImageBitmap(), "Resident check-in QR code", Modifier.size(220.dp))
                Text("or open muster-hybrid.web.app/#/r and enter", color = Color(0xFF475569), fontSize = 12.sp)
                Text("${a.token.take(4)}-${a.token.drop(4)}", color = Color(0xFF0B1220), fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 3.sp)
                Text("In an emergency, call 911.", color = Color(0xFFBE123C), fontWeight = FontWeight.Bold)
            }
        }
        Button(onDone, Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(16.dp)) { Text("Done, next door", fontWeight = FontWeight.Bold) }
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
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).background(if (ok) Color(0xFF072A3D) else MaterialTheme.colorScheme.surface, RoundedCornerShape(14.dp)).padding(12.dp)) {
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

/** First launch only: the landing page's story in three swipes, then join. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun Welcome(onDone: () -> Unit) {
    val pages = listOf(
        Triple("Find them before their clock runs out.", "After a disaster, many people die in the days after the storm: the oxygen runs out, the insulin goes warm, someone living alone is never checked.", Ic.home),
        Triple("Works with every tower down.", "Knock, tap or speak what you see. The phone works out who has the least time. Records sync the moment any phone finds signal, or hop phone to phone by QR.", Ic.wifiOff),
        Triple("Private by design.", "No names, ever. Notes and photos stay on this phone. The AI never decides who gets help first: the agency's rulebook does, and you confirm every answer.", Ic.shield),
    )
    val pager = androidx.compose.foundation.pager.rememberPagerState { pages.size }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Image(androidx.compose.ui.res.painterResource(R.mipmap.ic_launcher_foreground), null, Modifier.size(44.dp))
            Text("Muster", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
            Spacer(Modifier.weight(1f))
            TextButton(onDone) { Text("Skip") }
        }
        androidx.compose.foundation.pager.HorizontalPager(pager, Modifier.weight(1f)) { i ->
            val (title, body, icon) = pages[i]
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
                Box(Modifier.size(72.dp).background(if (i == 0) M.brand else if (i == 1) M.over else M.panel2, RoundedCornerShape(22.dp)), contentAlignment = Alignment.Center) {
                    Glyph(icon, Color.White, 34)
                }
                Spacer(Modifier.height(28.dp))
                Text(title, style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(14.dp))
                Text(body, fontSize = 17.sp, lineHeight = 26.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.Center) {
            repeat(pages.size) { i ->
                Box(Modifier.padding(4.dp).size(width = if (pager.currentPage == i) 22.dp else 8.dp, height = 8.dp)
                    .background(if (pager.currentPage == i) M.cyan else MaterialTheme.colorScheme.outline, RoundedCornerShape(50)))
            }
        }
        Button({ if (pager.currentPage < pages.size - 1) scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } else onDone() },
            Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(16.dp)) {
            Text(if (pager.currentPage < pages.size - 1) "Next" else "Join the response", fontWeight = FontWeight.Bold, fontSize = 17.sp)
        }
        Text("Needs intake and logistics only. Not medical advice.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 10.dp))
    }
}

@Composable
private fun JoinScreen(vm: MusterViewModel) {
    var code by remember { mutableStateOf("") }
    var err by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)) {
        Image(androidx.compose.ui.res.painterResource(R.mipmap.ic_launcher_foreground), null, Modifier.size(72.dp))
        Text("Join the response", style = MaterialTheme.typography.headlineMedium)
        Text("Incident ${vm.repo.incidentId} · $NEIGHBOURHOOD_NAME. Ask your coordinator for the join code. You need signal only once.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(code, { code = it.uppercase() }, Modifier.fillMaxWidth(), label = { Text("Join code") }, placeholder = { Text("e.g. ABCD-1234") }, singleLine = true)
        Button({ vm.join(code) { err = true } }, Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), enabled = code.isNotBlank()) { Text("Join incident", fontWeight = FontWeight.Bold) }
        Text("No account, no name, no email. You join anonymously.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    val attempts by vm.attempts.collectAsStateWithLifecycle()
    val registry by vm.registry.collectAsStateWithLifecycle()
    val selfRep by vm.selfReported.collectAsStateWithLifecycle()
    val tried = attempts.map { it.buildingId }.toSet()
    val risk = registry.associate { it.buildingId to it.risks }
    val doors = BUILDINGS.sortedBy { if (risk.containsKey(it.id) && it.id !in visited) 0 else 1 }
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
                Row(Modifier.fillMaxWidth().clickable { onRevisit(h) }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Tag(priorityText(a.priority), pColor(a))
                    Column(Modifier.weight(1f)) {
                        Text(label(h.buildingId), fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        Text(if (a.nextCheckBy < now) "recheck overdue ${formatLeft(now - a.nextCheckBy)}" else "recheck in ${formatLeft(a.nextCheckBy - now)}", fontSize = 12.sp, color = if (a.nextCheckBy < now) M.over else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        item { Text("Which door?", fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp)) }
        items(doors, key = { it.id }) { b ->
            val v = b.id in visited
            val t = !v && b.id in tried
            val r = if (v) null else risk[b.id]
            val (stateText, stateColor) = when {
                v -> "visited" to P3
                b.id in selfRep -> "resident checked in" to M.ok
                t -> "no answer, hanger left" to M.amber
                r != null -> "known risk: ${r.joinToString()}" to M.over
                else -> "not checked" to MaterialTheme.colorScheme.onSurfaceVariant
            }
            Card(Modifier.fillMaxWidth().clickable { onPick(b.id) }, shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = if (v) Color(0xFF0D2A1B) else MaterialTheme.colorScheme.surface),
                border = androidx.compose.foundation.BorderStroke(if (r != null) 2.dp else 1.dp, if (r != null) M.over else if (t) M.amber else MaterialTheme.colorScheme.outline)) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
                    Text(b.label, fontWeight = FontWeight.SemiBold)
                    Text(stateText, color = stateColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun Capture(vm: MusterViewModel, building: String?, onDone: (Extraction, String) -> Unit, onBack: () -> Unit, onNoAnswer: () -> Unit) {
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
                val t0 = System.currentTimeMillis()
                try {
                    val r = vm.ai.extract(note, photo); if (note.isNotBlank()) pendingNote = note
                    vm.repo.logCall(org.muster.app.data.Repo.LedgerEntry(System.currentTimeMillis(), "extract", "ONLY_ON_DEVICE", "on_device", r.ms, 0,
                        "Doorstep data: only on this phone. There may be no signal, and medical details should not leave the phone." + if (photo != null) " (note + label photo)" else ""))
                    onDone(r.data, "on_device")
                }
                catch (e: Exception) {
                    vm.repo.logCall(org.muster.app.data.Repo.LedgerEntry(System.currentTimeMillis(), "extract", "ONLY_ON_DEVICE", "refused", System.currentTimeMillis() - t0, 0,
                        "On-device model unavailable, so nothing was sent anywhere and the tap form opened. (${e.message})"))
                    // Fail closed: never fall back to the cloud with a doorstep note.
                    err = "On-device model unavailable (${e.message}). Nothing was sent anywhere."
                    onDone(Extraction(), "tap")
                } finally { busy = false }
            }
        }) { Text(if (busy) "Reading on this phone…" else "Read on this phone") }
        TextButton({ onDone(Extraction(), "tap") }) { Text("Tap instead") }
        if (building != null) OutlinedButton(onNoAnswer, Modifier.fillMaxWidth()) { Text("Nobody answered: leave a door-hanger") }
        TextButton(onBack) { Text("Back") }
        Text("Voice is offered only when this phone can recognise speech on the device. Note and photo never leave this phone.", fontSize = 12.sp, color = Color.Gray)
    }
}

private var pendingNote: String? = null

@Composable
private fun Confirm(vm: MusterViewModel, s: Screen.Confirm, now: Long, onSaved: (Household) -> Unit, onCancel: () -> Unit, onNoAnswer: () -> Unit) {
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
            if (s.building != null && s.existing == null) OutlinedButton(onNoAnswer, Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) { Text("Nobody answered: leave a door-hanger") }
            IntakeForm(draft, cfg.incidentType, asks) { draft = it }
        }
        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button({
                val existing = s.existing ?: list.find { it.buildingId == s.building && it.reportedBy == me && s.building != null }
                val h = Household(existing?.id ?: UUID.randomUUID().toString(), vm.repo.incidentId, s.building, System.currentTimeMillis(), me,
                    s.source, cfg.rulebook.version, (existing?.visits ?: 0) + 1, draft)
                pendingNote?.let { vm.repo.keepPrivateNote(h.id, it) }; pendingNote = null
                onSaved(h)
            }, Modifier.weight(1f).height(54.dp), shape = RoundedCornerShape(16.dp)) { Text("Save household", fontWeight = FontWeight.Bold) }
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
