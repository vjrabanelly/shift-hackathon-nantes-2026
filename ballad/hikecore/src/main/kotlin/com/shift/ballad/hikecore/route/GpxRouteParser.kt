package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.GeoPoint
import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.helpers.DefaultHandler
import java.io.StringReader
import javax.xml.parsers.SAXParserFactory

internal data class ParsedGpxRoute(
    val routePoints: List<RoutePoint>,
    val routeBounds: RouteBounds,
    val routeLengthMeters: Double,
    val gpxWaypoints: List<GpxWaypoint>,
)

internal class GpxRouteParser {
    fun parse(gpxXml: String): ParsedGpxRoute {
        val handler = GpxHandler()
        SAXParserFactory.newInstance().apply { isNamespaceAware = true }
            .newSAXParser()
            .parse(InputSource(StringReader(gpxXml)), handler)
        return handler.buildResult()
    }
}

private class GpxHandler : DefaultHandler() {
    private val routeTrackNodes = mutableListOf<RouteNode>()
    private val routeFallbackNodes = mutableListOf<RouteNode>()
    private val explicitWaypoints = mutableListOf<WaypointBuilder>()

    private var currentTrackPoint: PointBuilder? = null
    private var currentRoutePoint: PointBuilder? = null
    private var currentWaypoint: WaypointBuilder? = null
    private var currentWaypointLink: WaypointLinkBuilder? = null
    private val textBuffer = StringBuilder()

    override fun startElement(uri: String?, localName: String?, qName: String?, attributes: Attributes?) {
        textBuffer.clear()
        val name = localName ?: return
        when (name) {
            "trkpt" -> currentTrackPoint = PointBuilder(
                lat = attributes?.getValue("lat")?.toDoubleOrNull(),
                lon = attributes?.getValue("lon")?.toDoubleOrNull(),
            )
            "rtept" -> currentRoutePoint = PointBuilder(
                lat = attributes?.getValue("lat")?.toDoubleOrNull(),
                lon = attributes?.getValue("lon")?.toDoubleOrNull(),
            )
            "wpt" -> currentWaypoint = WaypointBuilder(
                lat = attributes?.getValue("lat")?.toDoubleOrNull(),
                lon = attributes?.getValue("lon")?.toDoubleOrNull(),
            )
            "link" -> {
                if (currentWaypoint != null) {
                    currentWaypointLink = WaypointLinkBuilder(href = attributes?.getValue("href"))
                }
            }
        }
    }

    override fun characters(ch: CharArray?, start: Int, length: Int) {
        if (ch != null) textBuffer.append(ch, start, length)
    }

    override fun endElement(uri: String?, localName: String?, qName: String?) {
        val text = textBuffer.toString().trim()
        textBuffer.clear()
        val name = localName ?: return
        when (name) {
            "trkpt" -> {
                currentTrackPoint?.toNode()?.let(routeTrackNodes::add)
                currentTrackPoint = null
            }
            "rtept" -> {
                currentRoutePoint?.toNode()?.let(routeFallbackNodes::add)
                currentRoutePoint = null
            }
            "link" -> {
                if (currentWaypoint != null && currentWaypointLink != null) {
                    currentWaypoint!!.link = currentWaypointLink!!.build()
                }
                currentWaypointLink = null
            }
            "wpt" -> {
                currentWaypoint?.takeIf { it.lat != null && it.lon != null }?.let(explicitWaypoints::add)
                currentWaypoint = null
                currentWaypointLink = null
            }
            "ele" -> {
                val value = text.toDoubleOrNull()
                currentTrackPoint?.elevationMeters = value
                currentRoutePoint?.elevationMeters = value
                currentWaypoint?.elevationMeters = value
            }
            "name" -> currentWaypoint?.name = text.ifBlank { null }
            "desc" -> currentWaypoint?.description = text.ifBlank { null }
            "cmt" -> currentWaypoint?.comment = text.ifBlank { null }
            "sym" -> currentWaypoint?.symbol = text.ifBlank { null }
            "text" -> currentWaypointLink?.text = text.ifBlank { null }
            "type" -> currentWaypointLink?.type = text.ifBlank { null }
        }
    }

    fun buildResult(): ParsedGpxRoute {
        val chosenNodes = routeTrackNodes.ifEmpty { routeFallbackNodes }
        require(chosenNodes.isNotEmpty()) { "GPX did not contain any track or route points" }

        val simplifiedNodes = RouteGeometry.simplify(chosenNodes)
        val routePoints = RouteGeometry.withChainage(simplifiedNodes)
        val routeBounds = RouteGeometry.bounds(routePoints.map { it.point })
        val routeLengthMeters = routePoints.lastOrNull()?.distanceAlongRouteMeters ?: 0.0
        val gpxWaypoints = explicitWaypoints.map { builder ->
            val point = builder.toPoint()
            val projection = RouteGeometry.project(point, routePoints)
            GpxWaypoint(
                lat = point.lat,
                lon = point.lon,
                elevationMeters = builder.elevationMeters,
                name = builder.name,
                description = builder.description,
                comment = builder.comment,
                symbol = builder.symbol,
                linkUrl = builder.link?.href,
                linkText = builder.link?.text,
                linkType = builder.link?.type,
                distanceAlongRouteMeters = projection?.distanceAlongRouteMeters?.roundToIntMeters(),
                distanceToRouteMeters = projection?.distanceToRouteMeters?.roundToIntMeters(),
            )
        }

        return ParsedGpxRoute(
            routePoints = routePoints,
            routeBounds = routeBounds,
            routeLengthMeters = routeLengthMeters,
            gpxWaypoints = gpxWaypoints,
        )
    }
}

private data class PointBuilder(
    val lat: Double?,
    val lon: Double?,
    var elevationMeters: Double? = null,
) {
    fun toNode(): RouteNode? {
        val latitude = lat ?: return null
        val longitude = lon ?: return null
        return RouteNode(
            point = GeoPoint(lat = latitude, lon = longitude),
            elevationMeters = elevationMeters,
        )
    }
}

private data class WaypointLink(
    val href: String?,
    val text: String?,
    val type: String?,
)

private data class WaypointLinkBuilder(
    val href: String?,
    var text: String? = null,
    var type: String? = null,
) {
    fun build(): WaypointLink =
        WaypointLink(
            href = href,
            text = text,
            type = type,
        )
}

private data class WaypointBuilder(
    val lat: Double?,
    val lon: Double?,
    var elevationMeters: Double? = null,
    var name: String? = null,
    var description: String? = null,
    var comment: String? = null,
    var symbol: String? = null,
    var link: WaypointLink? = null,
) {
    fun toPoint(): GeoPoint =
        GeoPoint(
            lat = requireNotNull(lat) { "Waypoint latitude is required" },
            lon = requireNotNull(lon) { "Waypoint longitude is required" },
        )
}
