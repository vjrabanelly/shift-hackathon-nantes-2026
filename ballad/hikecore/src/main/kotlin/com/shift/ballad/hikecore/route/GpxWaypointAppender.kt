package com.shift.ballad.hikecore.route

import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.SAXException
import org.xml.sax.helpers.DefaultHandler
import java.io.StringReader
import javax.xml.parsers.SAXParserFactory

internal class GpxWaypointAppender {

    fun appendWaypoints(gpxXml: String, waypoints: List<GpxWaypoint>): String {
        if (waypoints.isEmpty()) return gpxXml

        val (prefix, _) = detectGpxPrefix(gpxXml)
        val waypointBlock = buildString {
            for (wp in waypoints) {
                appendWaypointXml(wp, prefix)
            }
        }

        val closingTag = if (prefix.isNotEmpty()) "</$prefix:gpx>" else "</gpx>"
        val insertAt = gpxXml.lastIndexOf(closingTag)
        return if (insertAt >= 0) {
            gpxXml.substring(0, insertAt) + waypointBlock + gpxXml.substring(insertAt)
        } else {
            gpxXml + waypointBlock
        }
    }

    /** Returns (prefix, namespaceURI) of the root <gpx> element. */
    private fun detectGpxPrefix(gpxXml: String): Pair<String, String> {
        var prefix = ""
        var namespace = ""
        try {
            val factory = SAXParserFactory.newInstance().apply { isNamespaceAware = true }
            val handler = object : DefaultHandler() {
                override fun startElement(uri: String?, localName: String?, qName: String?, attributes: Attributes?) {
                    if (localName == "gpx") {
                        namespace = uri.orEmpty()
                        prefix = qName
                            ?.takeIf { it.contains(':') }
                            ?.substringBefore(':')
                            .orEmpty()
                        throw StopParsingException()
                    }
                }
            }
            try {
                factory.newSAXParser().parse(InputSource(StringReader(gpxXml)), handler)
            } catch (_: StopParsingException) { /* expected early exit */ }
        } catch (_: Exception) { /* fallback: no prefix */ }
        return prefix to namespace
    }

    private fun StringBuilder.appendWaypointXml(wp: GpxWaypoint, prefix: String) {
        val tag = if (prefix.isNotEmpty()) "$prefix:wpt" else "wpt"
        append("\n  <$tag lat=\"${wp.lat}\" lon=\"${wp.lon}\">")
        wp.elevationMeters?.let { appendTextElement("ele", it.toString(), prefix) }
        wp.name?.let { appendTextElement("name", it, prefix) }
        wp.description?.let { appendTextElement("desc", it, prefix) }
        wp.comment?.let { appendTextElement("cmt", it, prefix) }
        wp.symbol?.let { appendTextElement("sym", it, prefix) }
        if (wp.linkUrl != null) {
            val linkTag = if (prefix.isNotEmpty()) "$prefix:link" else "link"
            append("<$linkTag href=\"${escapeXml(wp.linkUrl)}\">")
            wp.linkText?.let { appendTextElement("text", it, prefix) }
            wp.linkType?.let { appendTextElement("type", it, prefix) }
            append("</$linkTag>")
        }
        append("</$tag>")
    }

    private fun StringBuilder.appendTextElement(localName: String, value: String, prefix: String) {
        val tag = if (prefix.isNotEmpty()) "$prefix:$localName" else localName
        append("<$tag>${escapeXml(value)}</$tag>")
    }

    private fun escapeXml(value: String): String =
        value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;")
}

private class StopParsingException : SAXException("stop")
