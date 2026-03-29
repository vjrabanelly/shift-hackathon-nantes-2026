package com.shift.ballad.domain

interface LocationSender {
    suspend fun send(latitude: Double, longitude: Double): Result<String>
}
