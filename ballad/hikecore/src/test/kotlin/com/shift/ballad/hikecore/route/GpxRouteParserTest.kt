package com.shift.ballad.hikecore.route

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class GpxRouteParserTest {
    private val parser = GpxRouteParser()

    @Test
    fun `parse prioritizes track points and keeps waypoints separate`() {
        val parsed = parser.parse(
            """
            <?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
              <wpt lat="47.0010" lon="-1.0005">
                <name>Audio Point</name>
                <desc>Waypoint description</desc>
                <link href="https://example.com/audio.mp3">
                  <text>Audio</text>
                  <type>audio/mpeg</type>
                </link>
              </wpt>
              <rte>
                <rtept lat="48.0000" lon="-2.0000" />
                <rtept lat="48.0010" lon="-2.0010" />
              </rte>
              <trk>
                <trkseg>
                  <trkpt lat="47.0000" lon="-1.0000"><ele>10</ele></trkpt>
                  <trkpt lat="47.0010" lon="-1.0000"><ele>12</ele></trkpt>
                  <trkpt lat="47.0020" lon="-1.0000"><ele>14</ele></trkpt>
                </trkseg>
              </trk>
            </gpx>
            """.trimIndent(),
        )

        assertEquals(3, parsed.routePoints.size)
        assertEquals(47.0, parsed.routePoints.first().point.lat)
        assertEquals(-1.0, parsed.routePoints.first().point.lon)
        assertEquals(1, parsed.gpxWaypoints.size)
        assertEquals("Audio Point", parsed.gpxWaypoints.first().name)
        assertEquals("https://example.com/audio.mp3", parsed.gpxWaypoints.first().linkUrl)
        assertNotNull(parsed.gpxWaypoints.first().distanceAlongRouteMeters)
    }

    @Test
    fun `parse falls back to route points when track is absent`() {
        val parsed = parser.parse(
            """
            <?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
              <rte>
                <rtept lat="47.1000" lon="-1.0000" />
                <rtept lat="47.1010" lon="-1.0000" />
                <rtept lat="47.1020" lon="-1.0000" />
              </rte>
            </gpx>
            """.trimIndent(),
        )

        assertEquals(3, parsed.routePoints.size)
        assertEquals(47.1, parsed.routePoints.first().point.lat)
        assertTrue(parsed.routeLengthMeters > 200.0)
    }
}
