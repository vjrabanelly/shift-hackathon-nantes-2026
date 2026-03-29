package com.shift.ballad.ui.main

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.shift.ballad.hikecore.route.EnrichmentStep
import com.shift.ballad.hikeride.RideViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    rideViewModel: RideViewModel,
    onOpenSettings: () -> Unit,
    onOpenApiKeys: () -> Unit,
    onOpenOffboarding: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by rideViewModel.uiState.collectAsState()
    val context = LocalContext.current
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    BackHandler(enabled = true) { /* ne rien faire */ }

    LaunchedEffect(uiState.openOsmAndUri) {
        val uri = uiState.openOsmAndUri ?: return@LaunchedEffect
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/gpx+xml")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val osmandPackages = listOf("net.osmand.plus", "net.osmand")
        val launched = osmandPackages.any { pkg ->
            intent.setPackage(pkg)
            runCatching { context.startActivity(intent) }.isSuccess
        }
        if (!launched) {
            intent.setPackage(null)
            context.startActivity(Intent.createChooser(intent, "Ouvrir avec…"))
        }
        rideViewModel.onOsmAndOpened()
    }

    val gpxLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { rideViewModel.onGpxFileSelected(it) }
    }

    LaunchedEffect(uiState.launchGpxPicker) {
        if (uiState.launchGpxPicker) {
            gpxLauncher.launch(arrayOf("application/gpx+xml", "application/octet-stream", "text/xml"))
            rideViewModel.onGpxPickerLaunched()
        }
    }

    val buttonState = when {
        uiState.isEnriching -> BalladButtonState.Loading
        uiState.routes.isEmpty() -> BalladButtonState.IdleEmpty
        else -> BalladButtonState.IdleReady
    }

    val onButtonClick: () -> Unit = {
        if (uiState.isEnriching) rideViewModel.cancelEnrichment()
        else rideViewModel.checkKeysAndLaunchGpxPicker()
    }

    val gradient = Brush.verticalGradient(
        colors = listOf(
            Color(0xFFFFFFFF),
            Color(0xFFF5F0EA),
            Color(0xFFEDE6DC),
        )
    )

    // Drawer droit : on inverse la direction de layout pour que le drawer s'ouvre depuis la droite
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            gesturesEnabled = uiState.routes.isNotEmpty(),
            drawerContent = {
                // On remet Ltr pour le contenu du drawer
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    ModalDrawerSheet {
                        Text(
                            text = "Mes balades",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 20.dp),
                        )
                        LazyColumn {
                            items(uiState.routes) { route ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 4.dp)
                                        .clickable {
                                            scope.launch { drawerState.close() }
                                            rideViewModel.selectRoute(route)
                                        },
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                    ) {
                                        Text(
                                            text = route,
                                            style = MaterialTheme.typography.bodyMedium,
                                            modifier = Modifier.weight(1f),
                                        )
                                        IconButton(onClick = { rideViewModel.deleteRoute(route) }) {
                                            Icon(
                                                imageVector = Icons.Default.Delete,
                                                contentDescription = "Supprimer $route",
                                                tint = MaterialTheme.colorScheme.error,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
        ) {
            // Contenu principal — on remet Ltr
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Box(
                    modifier = modifier
                        .fillMaxSize()
                        .background(gradient)
                ) {
                    Scaffold(
                        containerColor = Color.Transparent,
                        topBar = {
                            TopAppBar(
                                colors = TopAppBarDefaults.topAppBarColors(
                                    containerColor = Color.Transparent,
                                ),
                                title = {},
                                navigationIcon = {
                                    IconButton(onClick = onOpenOffboarding) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                                            contentDescription = "Quitter l'app",
                                        )
                                    }
                                },
                                actions = {
                                    IconButton(onClick = onOpenSettings) {
                                        Icon(
                                            imageVector = Icons.Default.Person,
                                            contentDescription = "Paramètres",
                                        )
                                    }
                                    IconButton(onClick = onOpenApiKeys) {
                                        Icon(
                                            imageVector = Icons.Default.Lock,
                                            contentDescription = "Clés API",
                                        )
                                    }
                                    IconButton(onClick = {
                                        try {
                                            context.startActivity(Intent("com.android.settings.TTS_SETTINGS"))
                                        } catch (e: Exception) {
                                            // Paramètres de synthèse vocale non disponibles
                                        }
                                    }) {
                                        Icon(
                                            imageVector = Icons.Default.RecordVoiceOver,
                                            contentDescription = "Synthèse vocale",
                                        )
                                    }
                                    if (uiState.routes.isNotEmpty()) {
                                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                            Icon(
                                                imageVector = Icons.Default.Menu,
                                                contentDescription = "Mes balades",
                                            )
                                        }
                                    }
                                }
                            )
                        },
                        modifier = Modifier.fillMaxSize(),
                    ) { paddingValues ->
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(paddingValues)
                                .padding(horizontal = 32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Spacer(Modifier.height(24.dp))
                            Text(
                                text = "Transformez votre balade en expérience sonore",
                                style = MaterialTheme.typography.headlineSmall,
                                color = MaterialTheme.colorScheme.onBackground,
                                textAlign = TextAlign.Center,
                            )
                            Box(
                                modifier = Modifier.weight(1f),
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Spacer(modifier = Modifier.height(70.dp))
                                    BalladButton(
                                        state = buttonState,
                                        onClick = onButtonClick,
                                    )
                                    uiState.enrichmentError?.let { error ->
                                        Spacer(Modifier.height(16.dp))
                                        Text(
                                            text = error,
                                            color = MaterialTheme.colorScheme.error,
                                            style = MaterialTheme.typography.bodyMedium,
                                            textAlign = TextAlign.Center,
                                        )
                                    }
                                    if (uiState.enrichmentStep != null) {
                                        Spacer(Modifier.height(24.dp))
                                    }
                                    EnrichmentProgressSection(currentStep = uiState.enrichmentStep)
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
private fun EnrichmentProgressSection(
    currentStep: EnrichmentStep?,
    modifier: Modifier = Modifier,
) {
    val steps = listOf(
        EnrichmentStep.ParseGpx to "Chargement du GPX",
        EnrichmentStep.DiscoveringPois to "Récupération des points d'intérêt",
        EnrichmentStep.RankingPois to "Classement des points",
        EnrichmentStep.GeneratingTexts to "Génération des descriptions via OpenAI",
        EnrichmentStep.GeneratingAudio to "Génération des audios via Mistral",
    )
    AnimatedVisibility(visible = currentStep != null, modifier = modifier) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            steps.forEach { (step, label) ->
                val isPast = currentStep != null && step.ordinal < currentStep.ordinal
                val isCurrent = step == currentStep
                EnrichmentStepRow(label = label, isPast = isPast, isCurrent = isCurrent)
            }
        }
    }
}

@Composable
private fun EnrichmentStepRow(
    label: String,
    isPast: Boolean,
    isCurrent: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when {
            isPast -> Icon(
                imageVector = Icons.Default.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            isCurrent -> CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
            )
            else -> Box(modifier = Modifier.size(16.dp), contentAlignment = Alignment.Center) {
                Box(modifier = Modifier.padding(0.dp))
                Text(
                    text = "·",
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
        Text(
            text = label,
            style = if (isCurrent) {
                MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold)
            } else {
                MaterialTheme.typography.bodySmall
            },
            color = when {
                isCurrent -> MaterialTheme.colorScheme.onBackground
                isPast -> MaterialTheme.colorScheme.onBackground
                else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            },
        )
    }
}
