package org.muster.app.ui

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Muster palette, same tokens as the web app (web/src/styles.css).
object M {
    val bg = Color(0xFF060B17); val panel = Color(0xFF0E1628); val panel2 = Color(0xFF131D34); val line = Color(0x29A3B4CC)
    val text = Color(0xFFEAF0FA); val muted = Color(0xFF8D9AB3)
    val brand = Color(0xFF1E8BFF); val cyan = Color(0xFF38BDF8); val violet = Color(0xFFA78BFA)
    val p1 = Color(0xFFEF4444); val p2 = Color(0xFFF59E0B); val p3 = Color(0xFF22C55E); val over = Color(0xFFFF1F5A); val amber = Color(0xFFFBBF24)
    val okBg = Color(0x1A22C55E); val ok = Color(0xFF86EFAC)
}

@Composable
fun MusterTheme(mode: String, content: @Composable () -> Unit) {
    val night = mode == "night"
    val scheme = if (night) darkColorScheme(
        background = Color.Black, surface = Color(0xFF0C0000), surfaceVariant = Color(0xFF140202), primary = Color(0xFFB91C1C), onPrimary = Color(0xFFFFD0D0),
        secondary = Color(0xFFFF6B6B), onBackground = Color(0xFFFF8A8A), onSurface = Color(0xFFFF8A8A), onSurfaceVariant = Color(0xFFB35C5C),
        outline = Color(0x47FF5A5A), error = Color(0xFFFF2D2D), secondaryContainer = Color(0xFF2A0606), onSecondaryContainer = Color(0xFFFF9A9A),
    ) else darkColorScheme(
        background = M.bg, surface = M.panel, surfaceVariant = M.panel2, primary = M.brand, onPrimary = Color.White,
        secondary = M.cyan, onBackground = M.text, onSurface = M.text, onSurfaceVariant = M.muted, outline = Color(0x40A3B4CC),
        error = M.over, secondaryContainer = Color(0xFF15305A), onSecondaryContainer = Color.White, surfaceContainer = M.panel, surfaceContainerHigh = M.panel2,
    )
    val base = Typography()
    val type = base.copy(
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold),
    )
    val d = LocalDensity.current
    val scale = if (mode == "off") 1f else 1.18f
    CompositionLocalProvider(LocalDensity provides Density(d.density, d.fontScale * scale)) {
        MaterialTheme(colorScheme = scheme, typography = type, content = content)
    }
}

/** Stroke icons drawn from the same 24px set as the website. */
object Ic {
    private fun icon(name: String, vararg paths: String): ImageVector {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        paths.forEach { b.addPath(addPathNodes(it), stroke = SolidColor(Color.White), strokeLineWidth = 1.8f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round) }
        return b.build()
    }
    val home = icon("home", "M3 11.5 12 4l9 7.5", "M5.5 9.5V20h13V9.5", "M10 20v-5h4v5")
    val door = icon("door", "M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17", "M14.8 12.5h.01")
    val team = icon("team", "M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5Z", "M9 4v13.5M15 6.5V20")
    val more = icon("more", "M4 7h16M4 12h16M4 17h16")
    val shield = icon("shield", "M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6Z", "m9 12 2.2 2.2L15.5 10")
    val qr = icon("qr", "M3.5 3.5h6v6h-6Z", "M14.5 3.5h6v6h-6Z", "M3.5 14.5h6v6h-6Z", "M14.5 14.5h2.5v2.5M20.5 14.5v.01M17 20.5h3.5V18M14.5 20.5v-2")
    val sliders = icon("sliders", "M4 7h10M18 7h2M4 17h4M12 17h8", "M14 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M8 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0")
    val arrow = icon("arrow", "M5 12h14M13 6l6 6-6 6")
    val back = icon("back", "M19 12H5M11 6l-6 6 6 6")
    val ext = icon("ext", "M7 17 17 7M8 7h9v9")
    val clock = icon("clock", "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17", "M12 7.5V12l3 2")
    val wifiOff = icon("wifioff", "M3 3l18 18", "M8.5 16.4a5 5 0 0 1 7 0", "M12 19.5h.01")
}

@Composable
fun Glyph(v: ImageVector, tint: Color = MaterialTheme.colorScheme.onSurface, size: Int = 20) =
    Icon(v, contentDescription = null, tint = tint, modifier = Modifier.size(size.dp))

val CapsStyle = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
