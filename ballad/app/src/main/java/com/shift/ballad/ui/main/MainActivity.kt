package com.shift.ballad.ui.main

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.shift.ballad.ui.theme.HikeBuddyTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.shift.ballad.R
import com.shift.ballad.service.BalladService
import com.shift.ballad.ui.onboarding.OnboardingScreen
import com.shift.ballad.ui.onboarding.OnboardingViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()
    private val rideViewModel: com.shift.ballad.hikeride.RideViewModel by viewModels()
    private val apiKeysViewModel: com.shift.ballad.hikeapikeys.ApiKeysViewModel by viewModels()
    private val settingsViewModel: com.shift.ballad.ui.settings.SettingsViewModel by viewModels()
    private val onboardingViewModel: OnboardingViewModel by viewModels()

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startForegroundLocationService()
        } else {
            Toast.makeText(this, "Notification permission denied", Toast.LENGTH_SHORT).show()
            startForegroundLocationService()
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (fineGranted || coarseGranted) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                startForegroundLocationService()
            }
        } else {
            Toast.makeText(this, R.string.permission_denied, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            HikeBuddyTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val isOnboardingCompleted by onboardingViewModel.isOnboardingCompleted
                        .collectAsState()

                    when (isOnboardingCompleted) {
                        null -> {
                            // Lecture DataStore en cours — fenêtre de quelques ms
                            Box(modifier = Modifier.fillMaxSize()) {
                                CircularProgressIndicator(
                                    modifier = Modifier.align(Alignment.Center)
                                )
                            }
                        }
                        false -> {
                            OnboardingScreen(
                                apiKeysViewModel = apiKeysViewModel,
                                settingsViewModel = settingsViewModel,
                                onFinished = { onboardingViewModel.markCompleted() },
                            )
                        }
                        true -> {
                            var showApiKeys by remember { mutableStateOf(false) }
                            var showSettings by remember { mutableStateOf(false) }
                            var showOffboarding by remember { mutableStateOf(false) }
                            val rideUiState by rideViewModel.uiState.collectAsState()

                            if (showApiKeys) {
                                BackHandler { showApiKeys = false }
                                com.shift.ballad.hikeapikeys.ApiKeysScreen(
                                    viewModel = apiKeysViewModel,
                                    onNavigateBack = { showApiKeys = false }
                                )
                            } else if (showSettings) {
                                BackHandler { showSettings = false }
                                com.shift.ballad.ui.settings.SettingsScreen(
                                    viewModel = settingsViewModel,
                                    onNavigateBack = { showSettings = false }
                                )
                            } else if (showOffboarding) {
                                BackHandler { showOffboarding = false }
                                OffboardingScreen(
                                    onNavigateBack = { showOffboarding = false },
                                    onQuit = { finish() }
                                )
                            } else if (rideUiState.selectedRoute != null) {
                                BackHandler { rideViewModel.clearSelectedRoute() }
                                com.shift.ballad.hikeride.HikeDetailScreen(
                                    viewModel = rideViewModel,
                                    routeName = rideUiState.selectedRoute!!,
                                    onNavigateBack = { rideViewModel.clearSelectedRoute() },
                                )
                            } else {
                                MainScreen(
                                    rideViewModel = rideViewModel,
                                    onOpenApiKeys = { showApiKeys = true },
                                    onOpenSettings = { showSettings = true },
                                    onOpenOffboarding = { showOffboarding = true }
                                )
                            }
                        }
                    }
                }
            }
        }

        requestPermissions()
    }

    private fun requestPermissions() {
        val rationale = shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION) ||
                shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (rationale) {
            Toast.makeText(this, R.string.permission_rationale, Toast.LENGTH_LONG).show()
        }
        
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        )
    }

    private fun startForegroundLocationService() {
        val intent = Intent(this, BalladService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }
}
