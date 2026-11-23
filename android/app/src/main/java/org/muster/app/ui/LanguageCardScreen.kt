package org.muster.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.muster.app.core.LanguageCard

/** Full-screen card the volunteer hands to the resident: questions in their language, big tap answers. */
@Composable
fun LanguageCardScreen(onDone: (Map<String, Any>) -> Unit, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val langs = remember { LanguageCard.langs(ctx) }
    val prefs = remember { ctx.getSharedPreferences("muster", 0) }
    val en = langs.first()
    var lang by remember { mutableStateOf<LanguageCard.Lang?>(null) }
    var stage by remember { mutableStateOf("pick") }
    var answers by remember { mutableStateOf<Map<String, Any>>(emptyMap()) }
    var history by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    val L = lang ?: en
    val q = LanguageCard.next(answers)
    val asked = LanguageCard.FLOW.count { it.askIf(answers) }

    // Closing never throws answers away: whatever the resident tapped goes to the form for the volunteer to check.
    val finish = { if (answers.isNotEmpty()) onDone(answers) else onClose() }
    fun answer(v: Any) {
        val cur = q ?: return
        history = history + listOf(answers); answers = answers + (cur.id to v)
        if (LanguageCard.next(answers) == null) stage = "thanks"
    }
    fun back() {
        when {
            stage == "thanks" || (stage == "q" && history.isNotEmpty()) -> { answers = history.lastOrNull() ?: emptyMap(); history = history.dropLast(1); stage = "q" }
            stage == "q" -> stage = "consent"
            else -> stage = "pick"
        }
    }

    Dialog(onDismissRequest = finish, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().systemBarsPadding().padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (stage != "pick") TextButton(::back) { Text("← Back") } else Text("Hand the phone to the resident", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.weight(1f))
                    if (stage == "q") Text("${answers.size + 1} / $asked", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(finish) { Text(if (answers.isNotEmpty()) "Done" else "Close") }
                }
                CompositionLocalProvider(LocalLayoutDirection provides if (stage != "pick" && L.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        when (stage) {
                            "pick" -> {
                                Text("Choose your language", style = MaterialTheme.typography.headlineMedium)
                                val last = prefs.getString("lang", null)
                                langs.chunked(2).forEach { row ->
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        row.forEach { l ->
                                            Choice(l.name, if (l.english != l.name) l.english else null, Modifier.weight(1f), highlight = l.code == last) {
                                                lang = l; stage = "consent"; prefs.edit().putString("lang", l.code).apply()
                                            }
                                        }
                                        if (row.size == 1) Spacer(Modifier.weight(1f))
                                    }
                                }
                                Text("Works with no signal: every phrase is stored on this phone. ${LanguageCard.review}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            "consent" -> {
                                Text(L.card["hello"].orEmpty(), style = MaterialTheme.typography.headlineSmall)
                                Text(L.card["consent"].orEmpty(), fontSize = 18.sp, lineHeight = 27.sp)
                                if (L.code != "en") Sub(en.card["consent"])
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Choice(L.card["agree"].orEmpty(), null, Modifier.weight(1f), yes = true) { stage = "q" }
                                    Choice(L.card["decline"].orEmpty(), null, Modifier.weight(1f)) { onClose() }
                                }
                            }
                            "q" -> q?.let { cur ->
                                LinearProgressIndicator(progress = { answers.size / asked.toFloat() }, Modifier.fillMaxWidth())
                                Text(L.q[cur.id].orEmpty(), fontSize = 28.sp, lineHeight = 36.sp, fontWeight = FontWeight.Bold)
                                if (L.code != "en") Sub(en.q[cur.id])
                                Sub(L.card["point"])
                                val sub = { k: String -> if (L.code != "en") en.card[k] else null }
                                val opts: List<Triple<String, String?, Any>> = when (cur.kind) {
                                    LanguageCard.Kind.COUNT -> (1..6).map { Triple(if (it == 6) "6+" else "$it", null, it) }
                                    LanguageCard.Kind.DAYS -> (0..3).map { Triple(if (it == 3) "3+" else "$it", L.card["days"], it) }
                                    LanguageCard.Kind.WHEN -> listOf("today", "yesterday", "twoDays", "threeDays").mapIndexed { i, k -> Triple(L.card[k].orEmpty(), sub(k), i) }
                                    LanguageCard.Kind.YESNO -> listOf(Triple(L.card["yes"].orEmpty(), sub("yes"), "yes"), Triple(L.card["no"].orEmpty(), sub("no"), "no"), Triple(L.card["unsure"].orEmpty(), sub("unsure"), "unsure"))
                                }
                                val perRow = if (opts.size > 4) 3 else if (opts.size == 4) 2 else 1
                                opts.chunked(perRow).forEach { row ->
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        row.forEach { (t, s, v) -> Choice(t, s, Modifier.weight(1f), yes = v == "yes") { answer(v) } }
                                    }
                                }
                            }
                            else -> {
                                Text(L.card["thanks"].orEmpty(), style = MaterialTheme.typography.headlineSmall)
                                if (L.code != "en") Sub(en.card["thanks"])
                                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                                    Choice("Volunteer: check the answers", "Fills the form. You confirm every field before saving.", Modifier.fillMaxWidth(), yes = true) { onDone(answers) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Sub(t: String?) { if (!t.isNullOrBlank()) Text(t, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }

@Composable
private fun Choice(title: String, sub: String?, modifier: Modifier, yes: Boolean = false, highlight: Boolean = false, onClick: () -> Unit) {
    val border = if (yes) Color(0xFF22C55E) else if (highlight) M.cyan else MaterialTheme.colorScheme.outline
    Column(modifier.heightIn(min = 72.dp).border(2.dp, border.copy(alpha = .6f), RoundedCornerShape(18.dp))
        .background(if (yes) Color(0x1A22C55E) else Color(0x0AFFFFFF), RoundedCornerShape(18.dp))
        .clickable(onClick = onClick).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(title, fontSize = 21.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        if (sub != null) Text(sub, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}
