package com.shift.ballad.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import android.os.IBinder
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media.app.NotificationCompat.MediaStyle
import com.shift.ballad.R
import com.shift.ballad.data.LocationProvider
import com.shift.ballad.settings.InterventionSettingsRepository
import com.shift.ballad.settings.triggerRadiusMeters
import com.shift.ballad.ui.main.MainActivity
import com.shift.ballad.util.AppLogger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject

/**
 * Service de foreground responsable de la surveillance de proximité et de la lecture audio locale.
 *
 * Le service ne découvre pas lui-même les POI. Il reçoit des déclencheurs sérialisés par
 * [FakeTtsService] au format `assetId|lat|lon`, attend que l'utilisateur soit suffisamment
 * proche du point de déclenchement porté par le GPX enrichi, puis cherche un fichier local
 * portant le même `assetId` dans `files/route-audio`.
 *
 * Le rayon de proximité n'est plus fixe : il est figé à la réception du trigger à partir du
 * niveau de détail courant (`SHORT`, `BALANCED`, `DETAILED`).
 */
@AndroidEntryPoint
class BalladService : Service() {

    @Inject lateinit var locationProvider: LocationProvider
    @Inject lateinit var interventionSettingsRepository: InterventionSettingsRepository
    @Inject lateinit var appLogger: AppLogger

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    // Map assetId → Job actif. Empêche la lecture en double quand le GPS envoie plusieurs
    // annonces TTS pour le même POI tout en permettant le replay : un nouveau trigger annule
    // l'ancienne coroutine avant d'en lancer une nouvelle.
    private val activeJobs: ConcurrentHashMap<String, Job> = ConcurrentHashMap()
    private var currentPlayer: MediaPlayer? = null

    enum class PlaybackState { IDLE, PLAYING, PAUSED }
    private var playbackState = PlaybackState.IDLE
    private var currentAssetId: String? = null
    private var mediaSession: MediaSessionCompat? = null

    companion object {
        const val ACTION_STOP     = "com.shift.ballad.action.STOP"
        const val ACTION_PLAY_POI = "com.shift.ballad.action.PLAY_POI"
        const val ACTION_PAUSE    = "com.shift.ballad.action.PAUSE"
        const val ACTION_RESUME   = "com.shift.ballad.action.RESUME"
        const val ACTION_SKIP     = "com.shift.ballad.action.SKIP"
        const val EXTRA_TRIGGERS  = "com.shift.ballad.extra.TRIGGERS"

        private const val CHANNEL_ID      = "hikebuddy_channel"
        private const val NOTIFICATION_ID = 1

    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        mediaSession = MediaSessionCompat(this, "BalladService")
        mediaSession?.isActive = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PAUSE -> {
                currentPlayer?.pause()
                playbackState = PlaybackState.PAUSED
                updateNotification()
                updateMediaSessionState(PlaybackStateCompat.STATE_PAUSED)
                return START_STICKY
            }
            ACTION_RESUME -> {
                currentPlayer?.start()
                playbackState = PlaybackState.PLAYING
                updateNotification()
                updateMediaSessionState(PlaybackStateCompat.STATE_PLAYING)
                return START_STICKY
            }
            ACTION_SKIP -> {
                currentPlayer?.stop()
                currentPlayer?.release()
                currentPlayer = null
                playbackState = PlaybackState.IDLE
                currentAssetId = null
                updateNotification()
                updateMediaSessionState(PlaybackStateCompat.STATE_STOPPED)
                return START_STICKY
            }
            ACTION_PLAY_POI -> {
                val triggers = intent.getStringArrayListExtra(EXTRA_TRIGGERS)
                if (!triggers.isNullOrEmpty()) {
                    appLogger.log("BalladService", "ACTION_PLAY_POI reçu — ${triggers.size} déclencheur(s).")
                    for (trigger in triggers) {
                        // Chaque entrée doit provenir de FakeTtsService avec le contrat
                        // `assetId|lat|lon`, où assetId correspond aussi au nom du fichier audio.
                        val parts = trigger.split("|")
                        if (parts.size == 3) {
                            val assetId = parts[0]
                            val lat = parts[1].toDoubleOrNull()
                            val lon = parts[2].toDoubleOrNull()
                            if (lat != null && lon != null) {
                                val triggerRadiusMeters = interventionSettingsRepository.currentSnapshot()
                                    .experiencePreferences
                                    .detailLevel
                                    .triggerRadiusMeters()
                                    .toFloat()
                                launchProximityCoroutine(assetId, lat, lon, triggerRadiusMeters)
                            } else {
                                appLogger.log("BalladService", "Coordonnées invalides : $trigger")
                            }
                        } else {
                            appLogger.log("BalladService", "Format de déclencheur invalide : $trigger")
                        }
                    }
                }
                return START_STICKY
            }
        }

        val hasFine   = ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)   == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = createNotification()

        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                } else {
                    0
                }
            )
        } catch (e: Exception) {
            stopSelf()
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        currentPlayer?.let { if (it.isPlaying) it.stop(); it.release() }
        currentPlayer = null
        mediaSession?.isActive = false
        mediaSession?.release()
        appLogger.log("BalladService", "Service détruit — serviceScope annulé.")
    }

    // Une coroutine par trigger permet de garder un comportement simple : chaque waypoint
    // audio surveille indépendamment la position jusqu'à timeout ou lecture effective.
    private fun launchProximityCoroutine(
        assetId: String,
        targetLat: Double,
        targetLon: Double,
        triggerRadiusMeters: Float,
    ) {
        // Si une surveillance est déjà en cours pour cet assetId (ex: doublon d'annonce GPS),
        // on vérifie si c'est une véritable ré-annonce en annulant l'ancienne et en relançant.
        activeJobs[assetId]?.let { existing ->
            if (existing.isActive) {
                appLogger.log("BalladService", "assetId=$assetId déjà surveillé — remplacement pour replay.")
                existing.cancel()
            }
        }
        appLogger.log(
            "BalladService",
            "Surveillance démarrée pour assetId=$assetId ($targetLat, $targetLon) avec rayon=${triggerRadiusMeters.toInt()}m",
        )
        val job = serviceScope.launch {
            try {
                withTimeout(10 * 60 * 1000L) {
                    while (true) {
                        delay(3000L)
                        val result = locationProvider.getLastLocation()
                        var proximityReached = false
                        result.onSuccess { location ->
                            val distance = FloatArray(1)
                            Location.distanceBetween(
                                location.latitude, location.longitude,
                                targetLat, targetLon,
                                distance
                            )
                            appLogger.log("BalladService", "assetId=$assetId distance=${distance[0].toInt()}m")
                            if (distance[0] <= triggerRadiusMeters) proximityReached = true
                        }.onFailure { e ->
                            appLogger.log("BalladService", "Erreur GPS pour assetId=$assetId : ${e.message}")
                        }
                        if (proximityReached) {
                            appLogger.log("BalladService", "POI assetId=$assetId atteint ! Lecture audio.")
                            withContext(Dispatchers.Main) { playSound(assetId) }
                            break
                        }
                    }
                }
            } catch (e: TimeoutCancellationException) {
                appLogger.log("BalladService", "Timeout 10min dépassé pour assetId=$assetId — abandon.")
            } finally {
                activeJobs.remove(assetId)
            }
        }
        activeJobs[assetId] = job
    }

    private fun playSound(assetId: String) {
        if (!interventionSettingsRepository.currentSnapshot().audioGuidanceEnabled) {
            appLogger.log("BalladService", "Guidage audio désactivé — lecture ignorée pour $assetId.")
            return
        }
        // Chercher le fichier audio dans tous les sous-dossiers de routes/
        val routesDir = filesDir.resolve("routes")
        val audioFile = routesDir.listFiles()
            ?.filter { it.isDirectory }
            ?.map { it.resolve(assetId) }
            ?.firstOrNull { it.exists() }
        if (audioFile == null) {
            appLogger.log("BalladService", "Fichier audio introuvable pour assetId=$assetId — ignoré.")
            return
        }
        // Arrêter et libérer le lecteur précédent avant d'en démarrer un nouveau.
        currentPlayer?.let {
            if (it.isPlaying) it.stop()
            it.release()
            appLogger.log("BalladService", "Lecteur précédent arrêté.")
        }
        currentPlayer = null
        currentAssetId = assetId
        try {
            val navAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            // Jingle de notification avant le son principal
            val jingle = MediaPlayer.create(this, R.raw.marimba).apply {
                setAudioAttributes(navAttributes)
            }
            currentPlayer = jingle
            playbackState = PlaybackState.PLAYING
            updateNotification()
            updateMediaSessionState(PlaybackStateCompat.STATE_PLAYING)

            jingle.setOnCompletionListener {
                it.release()
                // Enchaîner sur le son principal
                try {
                    val mp = MediaPlayer()
                    mp.setAudioAttributes(navAttributes)
                    // setDataSource(path) délègue au mediaserver qui n'a pas accès à filesDir.
                    // On ouvre le fichier dans le process de l'app et on passe le FileDescriptor.
                    java.io.FileInputStream(audioFile).use { fis ->
                        mp.setDataSource(fis.fd)
                    }
                    mp.prepare()
                    LoudnessEnhancer(mp.audioSessionId).apply {
                        setTargetGain(600) // +6 dB
                        enabled = true
                    }
                    mp.setOnCompletionListener { player ->
                        player.release()
                        if (currentPlayer == player) {
                            currentPlayer = null
                            playbackState = PlaybackState.IDLE
                            currentAssetId = null
                            updateNotification()
                            updateMediaSessionState(PlaybackStateCompat.STATE_STOPPED)
                        }
                    }
                    mp.start()
                    currentPlayer = mp
                    appLogger.log("BalladService", "Lecture de $assetId démarrée.")
                } catch (e: Exception) {
                    currentPlayer = null
                    playbackState = PlaybackState.IDLE
                    currentAssetId = null
                    updateNotification()
                    appLogger.log("BalladService", "Erreur lecture audio assetId=$assetId : ${e.message}")
                }
            }
            jingle.start()
            appLogger.log("BalladService", "Jingle marimba démarré avant $assetId.")
        } catch (e: Exception) {
            playbackState = PlaybackState.IDLE
            currentAssetId = null
            updateNotification()
            appLogger.log("BalladService", "Erreur lecture audio assetId=$assetId : ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = getString(R.string.notification_channel_name)
            val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun updateMediaSessionState(state: Int) {
        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build()
        )
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, createNotification())
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val stopPendingIntent = PendingIntent.getService(
            this, 1,
            Intent(this, BalladService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)

        if (playbackState == PlaybackState.IDLE) {
            builder.setContentTitle(getString(R.string.notification_title))
            builder.setContentText(getString(R.string.notification_text))
            builder.addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                getString(R.string.notification_action_stop),
                stopPendingIntent
            )
        } else {
            val title = if (currentAssetId != null) "Explication en cours" else getString(R.string.notification_title)
            val text = currentAssetId ?: ""
            builder.setContentTitle(title)
            builder.setContentText(text)

            // Boutons de contrôle média
            if (playbackState == PlaybackState.PLAYING) {
                val pauseIntent = PendingIntent.getService(this, 2, Intent(this, BalladService::class.java).apply { action = ACTION_PAUSE }, PendingIntent.FLAG_IMMUTABLE)
                builder.addAction(android.R.drawable.ic_media_pause, "Pause", pauseIntent)
            } else {
                val resumeIntent = PendingIntent.getService(this, 3, Intent(this, BalladService::class.java).apply { action = ACTION_RESUME }, PendingIntent.FLAG_IMMUTABLE)
                builder.addAction(android.R.drawable.ic_media_play, "Reprendre", resumeIntent)
            }

            val skipIntent = PendingIntent.getService(this, 4, Intent(this, BalladService::class.java).apply { action = ACTION_SKIP }, PendingIntent.FLAG_IMMUTABLE)
            builder.addAction(android.R.drawable.ic_media_next, "Passer", skipIntent)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, getString(R.string.notification_action_stop), stopPendingIntent)

            val mediaStyle = MediaStyle()
                .setShowActionsInCompactView(0, 1) // Afficher Pause/Play et Skip en compact
            mediaSession?.let { mediaStyle.setMediaSession(it.sessionToken) }
            builder.setStyle(mediaStyle)
        }

        return builder.build()
    }
}
