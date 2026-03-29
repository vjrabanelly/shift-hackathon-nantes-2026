package com.shift.ballad.ui.main

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.shift.ballad.R

enum class BalladButtonState {
    /** Aucune balade — animation de pulse douce pour inciter au premier usage */
    IdleEmpty,

    /** Des balades existent — bouton statique */
    IdleReady,

    /** Enrichissement en cours — anneaux expansifs */
    Loading,
}

@Composable
fun BalladButton(
    state: BalladButtonState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    buttonSize: Dp = 200.dp,
    ringAreaSize: Dp = 300.dp,
) {
    val ringColor = MaterialTheme.colorScheme.primary

    // Animation de pulse douce (IdleEmpty)
    val pulseScale = remember { Animatable(1f) }
    LaunchedEffect(state) {
        if (state == BalladButtonState.IdleEmpty) {
            while (true) {
                pulseScale.animateTo(1.08f, animationSpec = tween(900, easing = FastOutSlowInEasing))
                pulseScale.animateTo(1f, animationSpec = tween(900, easing = FastOutSlowInEasing))
            }
        } else {
            pulseScale.animateTo(1f, animationSpec = tween(200))
        }
    }

    // Anneaux expansifs (Loading) — 3 anneaux avec phase-offset
    val infiniteTransition = rememberInfiniteTransition(label = "ballad_rings")
    val ring1 by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "ring1",
    )
    val ring2 by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2000, delayMillis = 600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "ring2",
    )
    val ring3 by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2000, delayMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "ring3",
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier,
    ) {
        // Les anneaux sont dessinés en overlay autour du bouton via drawBehind
        Box(
            contentAlignment = Alignment.Center,
        ) {
            // Anneaux expansifs en overlay (ne prennent pas de place dans le layout)
            if (state == BalladButtonState.Loading) {
                Canvas(
                    modifier = Modifier
                        .size(ringAreaSize)
                        .align(Alignment.Center),
                ) {
                    val baseRadius = size.minDimension / 2f
                    listOf(ring1, ring2, ring3).forEach { fraction ->
                        val ringRadius = baseRadius * (0.45f + fraction * 0.55f)
                        val alpha = (1f - fraction) * 0.45f
                        drawCircle(
                            color = ringColor.copy(alpha = alpha),
                            radius = ringRadius,
                            style = Stroke(width = 2.5.dp.toPx()),
                        )
                    }
                }
            }

            // Bouton rond central
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(buttonSize)
                    .graphicsLayer {
                        scaleX = pulseScale.value
                        scaleY = pulseScale.value
                    }
                    .clip(CircleShape)
                    .clickable(onClick = onClick),
            ) {
                Crossfade(targetState = state, label = "button_icon") { currentState ->
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(buttonSize)) {
                        when (currentState) {
                            BalladButtonState.Loading -> Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Annuler la génération",
                                tint = Color(0xFF37332A),
                                modifier = Modifier.size(48.dp),
                            )
                            else -> Image(
                                painter = painterResource(id = R.drawable.ic_ballad_logo),
                                contentDescription = "Générer une balade",
                                modifier = Modifier.size(buttonSize),
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        if (state != BalladButtonState.Loading) {
            Text(
                text = "Time to custom",
                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
    }
}
