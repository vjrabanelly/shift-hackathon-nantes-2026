package com.shift.ballad.domain

import kotlinx.coroutines.delay
import javax.inject.Inject

class FakeLocationSender @Inject constructor() : LocationSender {
    override suspend fun send(latitude: Double, longitude: Double): Result<String> {
        delay(1000)
        return Result.success("Sent: $latitude, $longitude at ${System.currentTimeMillis()}")
    }
}
