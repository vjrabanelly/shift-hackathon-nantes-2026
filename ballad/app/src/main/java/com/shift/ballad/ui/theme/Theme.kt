package com.shift.ballad.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = DarkTaupe,
    onPrimary = OffWhite,
    secondary = WarmBeige,
    onSecondary = DeepBrown,
    tertiary = MidGray,
    background = OffWhite,
    onBackground = DeepBrown,
    surface = OffWhite,
    onSurface = DeepBrown,
    onSurfaceVariant = MidGray,
    error = ErrorRed,
)

private val DarkColorScheme = darkColorScheme(
    primary = WarmBeige,
    onPrimary = DeepBrown,
    secondary = MidGray,
    onSecondary = OffWhite,
    tertiary = Color(0xFF8A8478),
    background = DeepBrown,
    onBackground = OffWhite,
    surface = Color(0xFF2A2720),
    onSurface = OffWhite,
    onSurfaceVariant = WarmBeige,
    error = ErrorRedLight,
)

@Composable
fun HikeBuddyTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
