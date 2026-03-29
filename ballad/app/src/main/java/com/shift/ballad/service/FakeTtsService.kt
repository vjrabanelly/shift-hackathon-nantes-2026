package com.shift.ballad.service

import android.content.Intent
import android.speech.tts.SynthesisCallback
import android.speech.tts.SynthesisRequest
import android.speech.tts.TextToSpeech
import android.speech.tts.TextToSpeechService
import com.shift.ballad.util.AppLogger
import com.shift.ballad.util.TtsRequestLogger
import dagger.hilt.android.AndroidEntryPoint
import java.util.Locale
import javax.inject.Inject

/**
 * Moteur TTS factice utilisé pour les expérimentations Android.
 *
 * Au lieu de synthétiser réellement l'audio demandé par le système, ce service :
 *
 * - journalise le texte reçu
 * - cherche des identifiants d'assets au format `hb_at_<uuid>_<lat>_<lon>`
 * - délègue ensuite à [BalladService] la surveillance GPS et la lecture du fichier audio local
 *
 * Ce comportement est volontairement atypique : il sert à tester le contrat actuel entre
 * GPX enrichi, noms d'assets et lecture audio locale sans intégrer encore un moteur TTS complet.
 */
@AndroidEntryPoint
class FakeTtsService : TextToSpeechService() {

    @Inject lateinit var appLogger: AppLogger
    @Inject lateinit var ttsRequestLogger: TtsRequestLogger

    private var fallbackTts: TextToSpeech? = null
    private var fallbackTtsReady = false

    override fun onCreate() {
        super.onCreate()
        // Pointe explicitement vers Google TTS pour éviter la récursion vers FakeTtsService.
        fallbackTts = TextToSpeech(this, { status ->
            fallbackTtsReady = status == TextToSpeech.SUCCESS
        }, "com.google.android.tts")
    }

    override fun onDestroy() {
        fallbackTts?.shutdown()
        fallbackTts = null
        super.onDestroy()
    }

    override fun onIsLanguageAvailable(lang: String?, country: String?, variant: String?): Int {
        // Leurre : On fait croire que toutes les langues (incluant le français du GPS) sont disponibles
        return TextToSpeech.LANG_COUNTRY_AVAILABLE
    }

    override fun onGetLanguage(): Array<String> {
        // On retourne que l'on est paramétré par défaut en Français ("fra")
        return arrayOf("fra", "FRA", "")
    }

    override fun onLoadLanguage(lang: String?, country: String?, variant: String?): Int {
        // Toujours valider le chargement de la langue
        return TextToSpeech.LANG_COUNTRY_AVAILABLE
    }

    override fun onStop() {
        // Arrêter la lecture en cours s'il y en a une.
        appLogger.log("FakeTtsService", "Arrêt demandé par le système.")
    }

    override fun onSynthesizeText(request: SynthesisRequest?, callback: SynthesisCallback?) {
        if (request == null || callback == null) return

        val textToSpeak = request.charSequenceText?.toString() ?: ""
        ttsRequestLogger.log(textToSpeak)
        appLogger.log("FakeTtsService", "Reçu du GPS : '$textToSpeak'. Interception en cours...")

        // Le moteur factice ne produit pas de PCM ; il doit néanmoins acquitter la requête
        // pour que l'OS considère la synthèse comme démarrée puis terminée proprement.
        // On écrit un court buffer de silence pour éviter les artefacts audio (bips).
        callback.start(16000, android.media.AudioFormat.ENCODING_PCM_16BIT, 1)
        val silence = ByteArray(3200) // 100 ms de silence à 16 kHz, 16-bit mono
        callback.audioAvailable(silence, 0, silence.size)

        // Les noms d'assets viennent directement du pipeline route-enrich de hikecore.
        val hikeBuddyRegex = Regex(
            """(hb_at_[0-9a-fA-F-]+_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?))""",
            RegexOption.IGNORE_CASE,
        )
        val matches = hikeBuddyRegex.findAll(textToSpeak).toList()

        if (matches.isEmpty()) {
            appLogger.log("FakeTtsService", "Aucun déclencheur hike_buddy trouvé — délégation à Google TTS.")
            if (fallbackTtsReady) {
                val locale = Locale(
                    request.language ?: "fra",
                    request.country ?: "FRA",
                    request.variant ?: ""
                )
                fallbackTts?.language = locale
                fallbackTts?.speak(textToSpeak, TextToSpeech.QUEUE_ADD, null, null)
            }
            callback.done()
            return
        }

        val triggers = ArrayList<String>(matches.size)
        for (match in matches) {
            val assetId = match.groupValues[1]
            val lat = match.groupValues[2]
            val lon = match.groupValues[3]
            triggers.add("$assetId|$lat|$lon")
            appLogger.log("FakeTtsService", "Déclencheur trouvé : assetId=$assetId lat=$lat lon=$lon")
        }

        appLogger.log("FakeTtsService", "${triggers.size} déclencheur(s) envoyé(s) à BalladService.")

        // Le payload sérialise l'asset id et les coordonnées pour que le service de foreground
        // puisse attendre la proximité GPS avant de lancer la lecture locale.
        startService(Intent(this, BalladService::class.java).apply {
            action = BalladService.ACTION_PLAY_POI
            putStringArrayListExtra(BalladService.EXTRA_TRIGGERS, triggers)
        })

        callback.done()
    }
}
