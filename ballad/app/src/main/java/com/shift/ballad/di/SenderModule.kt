package com.shift.ballad.di

import com.shift.ballad.domain.FakeLocationSender
import com.shift.ballad.domain.LocationSender
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class SenderModule {

    @Binds
    @Singleton
    abstract fun bindLocationSender(
        fakeLocationSender: FakeLocationSender
    ): LocationSender
}
