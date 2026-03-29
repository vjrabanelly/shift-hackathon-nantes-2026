package com.shift.ballad.data

import android.annotation.SuppressLint
import android.location.Location
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocationProvider @Inject constructor(
    private val fusedClient: FusedLocationProviderClient
) {
    @SuppressLint("MissingPermission")
    suspend fun getLastLocation(): Result<Location> {
        return try {
            val cancellationTokenSource = CancellationTokenSource()
            val location = fusedClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                cancellationTokenSource.token
            ).await()
            if (location != null) {
                Result.success(location)
            } else {
                Result.failure(Exception("Location unavailable (returned null)."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
