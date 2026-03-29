package com.shift.ballad.hikeride

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RideScreen(
    viewModel: RideViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(uiState.openOsmAndUri) {
        val uri = uiState.openOsmAndUri ?: return@LaunchedEffect
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/gpx+xml")
            addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val osmandPackages = listOf("net.osmand.plus", "net.osmand")
        val launched = osmandPackages.any { pkg ->
            intent.setPackage(pkg)
            runCatching { context.startActivity(intent) }.isSuccess
        }
        if (!launched) {
            intent.setPackage(null)
            context.startActivity(android.content.Intent.createChooser(intent, "Ouvrir avec…"))
        }
        viewModel.onOsmAndOpened()
    }

    val gpxLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { viewModel.onGpxFileSelected(it) }
    }

    LaunchedEffect(uiState.launchGpxPicker) {
        if (uiState.launchGpxPicker) {
            gpxLauncher.launch(arrayOf("application/gpx+xml", "application/octet-stream", "text/xml"))
            viewModel.onGpxPickerLaunched()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gérer mes Rides") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Retour"
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            if (!uiState.isEnriching) {
                ExtendedFloatingActionButton(
                    onClick = viewModel::checkKeysAndLaunchGpxPicker,
                    text = { Text("Générer un nouveau trajet") },
                    icon = { Text("🚴") }
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (uiState.isEnriching) {
                CircularProgressIndicator(modifier = Modifier.padding(bottom = 8.dp))
                Text(
                    text = "Enrichissement en cours…",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
            }

            uiState.enrichmentError?.let { error ->
                Text(
                    text = "Erreur enrichissement : $error",
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
            }

            if (uiState.routes.isEmpty() && !uiState.isEnriching) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Aucun Ride sauvegardé pour le moment.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxWidth()) {
                    items(uiState.routes) { route ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = route,
                                    style = MaterialTheme.typography.bodyLarge,
                                    modifier = Modifier.weight(1f)
                                )
                                Row {
                                    IconButton(onClick = { viewModel.openRoute(route) }) {
                                        Icon(
                                            imageVector = Icons.Default.PlayArrow,
                                            contentDescription = "Ouvrir $route",
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                    IconButton(onClick = { viewModel.deleteRoute(route) }) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Supprimer $route",
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                    item {
                        Spacer(modifier = Modifier.height(80.dp)) // Espace pour le FAB
                    }
                }
            }
        }
    }
}
