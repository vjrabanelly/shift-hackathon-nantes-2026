package com.shift.ballad.hikecore.intervention

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.nio.file.Path

internal class CachedPoiProvider(
    private val delegate: PoiProvider,
    cacheFile: Path = projectRoot().resolve("cache/overpass.json"),
) : PoiProvider {

    private val log = LoggerFactory.getLogger(CachedPoiProvider::class.java)
    private val cache = FileCache(cacheFile)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findNearbyPois(point: GeoPoint, radiusMeters: Int, allowedCategories: Set<PoiCategory>): List<PoiContext> {
        // Arrondi à 3 décimales ≈ grille 100m — même zone = même clé
        val snapLat = "%.3f".format(point.lat)
        val snapLon = "%.3f".format(point.lon)
        val key = cacheKey(snapLat, snapLon, radiusMeters)

        val cached = cache.get(key)
        if (cached != null) {
            log.info("[cache] overpass HIT key=$key (snap=$snapLat,$snapLon r=${radiusMeters}m)")
            return json.decodeFromJsonElement(ListSerializer(PoiContext.serializer()), cached)
        }

        log.info("[cache] overpass MISS key=$key (snap=$snapLat,$snapLon r=${radiusMeters}m) — calling Overpass")
        val result = delegate.findNearbyPois(point, radiusMeters, allowedCategories)
        log.info("[cache] overpass cached ${result.size} POIs for key=$key")
        cache.put(key, json.encodeToJsonElement(ListSerializer(PoiContext.serializer()), result))
        return result
    }
}
