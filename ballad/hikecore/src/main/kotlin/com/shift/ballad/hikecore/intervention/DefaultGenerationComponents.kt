package com.shift.ballad.hikecore.intervention

import com.shift.ballad.hikecore.api.MistralTtsClient
import com.shift.ballad.hikecore.api.Voice
import io.ktor.client.HttpClient
import java.nio.file.Path

internal fun createDefaultLlmClient(
    apiKey: String,
    model: String,
    httpClient: HttpClient,
    cacheFile: Path = projectRoot().resolve("cache/openai.json"),
): LlmClient =
    CachedLlmClient(
        OpenAiResponsesLlmClient(
            apiKey = apiKey,
            model = model,
            httpClient = httpClient,
        ),
        cacheFile = cacheFile,
    )

internal fun createDefaultAudioSynthesizer(
    mistralApiKey: String?,
    voice: Voice = Voice.DEFAULT,
    httpClient: HttpClient,
): AudioSynthesizer? {
    val mistral = mistralApiKey?.takeIf(String::isNotBlank)?.let {
        MistralTtsClient(apiKey = it, httpClient = httpClient)
    } ?: return null
    return MistralAudioSynthesizer(mistral, voice = voice)
}
