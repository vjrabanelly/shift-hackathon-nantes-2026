package com.shift.ballad.di

import android.content.Context.MODE_PRIVATE
import android.content.SharedPreferences
import android.content.Context
import com.shift.ballad.hikeapikeys.FallbackApiKeys
import com.shift.ballad.hikecore.FakeHikeRepository
import com.shift.ballad.hikecore.HikeRepository
import com.shift.ballad.intervention.AndroidInterventionConfigProvider
import com.shift.ballad.intervention.AndroidInterventionSettingsStorage
import com.shift.ballad.intervention.SharedPreferencesInterventionSettingsRepository
import com.shift.ballad.settings.InterventionConfigProvider
import com.shift.ballad.settings.InterventionSettingsRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object HikeModule {

    @Provides
    @Singleton
    fun provideHikeRepository(): HikeRepository {
        return FakeHikeRepository()
    }

    @Provides
    @Singleton
    fun provideInterventionSharedPreferences(
        @ApplicationContext context: Context,
    ): SharedPreferences = context.getSharedPreferences(
        AndroidInterventionSettingsStorage.PREFS_NAME,
        MODE_PRIVATE,
    )

    @Provides
    @Singleton
    fun provideInterventionSettingsRepository(
        sharedPreferences: SharedPreferences,
    ): InterventionSettingsRepository = SharedPreferencesInterventionSettingsRepository(sharedPreferences)

    @Provides
    @Singleton
    fun provideAndroidInterventionConfigProvider(
        settingsRepository: InterventionSettingsRepository,
    ): AndroidInterventionConfigProvider = AndroidInterventionConfigProvider(settingsRepository)

    @Provides
    @Singleton
    fun provideInterventionConfigProvider(
        androidInterventionConfigProvider: AndroidInterventionConfigProvider,
    ): InterventionConfigProvider = androidInterventionConfigProvider

    @Provides
    @Singleton
    fun provideFallbackApiKeys(): FallbackApiKeys = FallbackApiKeys(
        openAiKey = com.shift.ballad.BuildConfig.OPENAI_API_KEY.ifBlank { null },
        mistralKey = com.shift.ballad.BuildConfig.MISTRAL_API_KEY.ifBlank { null },
    )
}
