@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)

package com.shift.ballad.ui.onboarding

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.shift.ballad.hikeapikeys.ApiKeysViewModel
import com.shift.ballad.ui.settings.SettingsBody
import com.shift.ballad.ui.settings.SettingsViewModel
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(
    apiKeysViewModel: ApiKeysViewModel,
    settingsViewModel: SettingsViewModel,
    onFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pagerState = rememberPagerState(pageCount = { 4 })
    val scope = rememberCoroutineScope()

    Scaffold { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            HorizontalPager(
                state = pagerState,
                userScrollEnabled = false,
                modifier = Modifier.weight(1f),
            ) { page ->
                when (page) {
                    0 -> OsmAndOnboardingPage(
                        onNext = { scope.launch { pagerState.animateScrollToPage(1) } }
                    )
                    1 -> TtsOnboardingPage(
                        onNext = { scope.launch { pagerState.animateScrollToPage(2) } }
                    )
                    2 -> ApiKeysOnboardingPage(
                        viewModel = apiKeysViewModel,
                        onNext = { scope.launch { pagerState.animateScrollToPage(3) } }
                    )
                    3 -> PreferencesOnboardingPage(
                        viewModel = settingsViewModel,
                        onFinished = onFinished,
                    )
                }
            }

            // Indicateur de page — points Material 3, sans dépendance accompanist
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                repeat(4) { index ->
                    val isSelected = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 4.dp)
                            .size(if (isSelected) 10.dp else 8.dp)
                            .clip(CircleShape)
                            .background(
                                if (isSelected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun OsmAndOnboardingPage(onNext: () -> Unit) {
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Ballad fonctionne avec OsmAnd",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Ballad génère des balades enrichies et les envoie directement à OsmAnd pour la navigation. " +
                    "OsmAnd doit être installé sur votre appareil pour profiter de cette fonctionnalité.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=net.osmand"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try {
                    context.startActivity(intent)
                } catch (e: Exception) {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://play.google.com/store/apps/details?id=net.osmand"))
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Télécharger OsmAnd sur le Play Store")
        }
        Spacer(Modifier.height(16.dp))
        TextButton(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Suivant")
        }
    }
}

@Composable
private fun TtsOnboardingPage(onNext: () -> Unit) {
    val context = LocalContext.current
    var ttsOpened by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Configurer la synthèse vocale",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Ballad utilise la synthèse vocale de votre appareil pour vous guider " +
                    "pendant vos sorties. Pour un fonctionnement optimal, vous devez configurer " +
                    "la synthèse vocale de Ballad dans les paramètres système.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Une fois dans les paramètres de synthèse vocale, sélectionnez 'Moteur préféré', puis 'Ballad' comme moteur de synthèse vocale par défaut. ",
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = {
                ttsOpened = true
                try {
                    context.startActivity(Intent("com.android.settings.TTS_SETTINGS"))
                } catch (e: Exception) {
                    // Paramètres TTS non disponibles sur cet appareil
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Ouvrir les paramètres de synthèse vocale")
        }
        Spacer(Modifier.height(16.dp))
        TextButton(
            onClick = onNext,
            enabled = ttsOpened,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Suivant")
        }
    }
}

@Composable
private fun ApiKeysOnboardingPage(
    viewModel: ApiKeysViewModel,
    onNext: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    fun launchQrScan(onResult: (String) -> Unit) {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        GmsBarcodeScanning.getClient(context, options)
            .startScan()
            .addOnSuccessListener { barcode ->
                barcode.rawValue?.let { onResult(it) }
            }
            .addOnFailureListener { /* scanner annulé ou module indisponible */ }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Clés API",
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = "Ces clés sont nécessaires pour le fonctionnement de l'application. " +
                    "Vous pouvez les configurer maintenant ou plus tard depuis l'écran principal.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = uiState.openAiKey,
            onValueChange = viewModel::onOpenAiKeyChanged,
            label = { Text("Clé OpenAI") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { launchQrScan(viewModel::onOpenAiKeyChanged) }) {
                    Icon(
                        imageVector = Icons.Default.QrCodeScanner,
                        contentDescription = "Scanner QR Code OpenAI",
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = uiState.mistralKey,
            onValueChange = viewModel::onMistralKeyChanged,
            label = { Text("Clé Mistral") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { launchQrScan(viewModel::onMistralKeyChanged) }) {
                    Icon(
                        imageVector = Icons.Default.QrCodeScanner,
                        contentDescription = "Scanner QR Code Mistral",
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.weight(1f))
        OutlinedButton(
            onClick = viewModel::clearKeys,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(
                imageVector = Icons.Default.Clear,
                contentDescription = null,
                modifier = Modifier.padding(end = 8.dp),
            )
            Text("Vider les champs")
        }
        Button(
            onClick = {
                viewModel.saveKeys()
                onNext()
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Suivant")
        }
    }
}

@Composable
private fun PreferencesOnboardingPage(
    viewModel: SettingsViewModel,
    onFinished: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = "Préférences",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
        )
        SettingsBody(
            uiState = uiState,
            onDetailLevelChanged = viewModel::onDetailLevelChanged,
            onUserAgeRangeChanged = viewModel::onUserAgeRangeChanged,
            onPoiSelectionModeChanged = viewModel::onPoiSelectionModeChanged,
            onPoiCategoryToggled = viewModel::onPoiCategoryToggled,
            onAudioGuidanceEnabledChanged = viewModel::onAudioGuidanceEnabledChanged,
            modifier = Modifier.weight(1f),
        )
        Button(
            onClick = onFinished,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp),
        ) {
            Text("Terminer")
        }
    }
}
