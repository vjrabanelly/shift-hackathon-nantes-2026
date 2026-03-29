"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackResolver = void 0;
exports.resolveCoverArt = resolveCoverArt;
const supabase_1 = require("../lib/supabase");
const ytdlp_1 = require("../lib/ytdlp");
const essentia_client_1 = require("./essentia-client");
const queue_engine_1 = require("./queue-engine");
const stream_manager_1 = require("./stream-manager");
const connectors_1 = require("@partyjam/connectors");
const connectors_2 = require("@partyjam/connectors");
const connectors_3 = require("@partyjam/connectors");
const connectors_4 = require("@partyjam/connectors");
// Music resolution waterfall: YouTube is always tried first (fastest, most reliable)
const musicConnectors = [
    new connectors_1.YouTubeConnector(),
    new connectors_2.MusicBrainzMetadataConnector(),
    new connectors_3.LastFmConnector(),
];
// Cover art waterfall: MusicBrainz (best quality) → iTunes → YouTube thumbnail (always works)
const coverArtConnectors = [
    new connectors_4.MusicBrainzCoverArtConnector(),
    new connectors_4.ItunesCoverArtConnector(),
    new connectors_4.YouTubeThumbnailConnector(),
];
async function resolveCoverArt(track) {
    for (const connector of coverArtConnectors) {
        try {
            const url = await connector.resolve(track);
            if (url)
                return url;
        }
        catch {
            // Try next connector
        }
    }
    return null;
}
class TrackResolver {
    static async hydrateQueuedTrack(input) {
        const { eventId, trackId, title, artist, youtubeId, connectorTrack } = input;
        let filePath = null;
        let isPlayable = false;
        if (youtubeId) {
            try {
                filePath = await (0, ytdlp_1.downloadYouTube)(youtubeId);
                await supabase_1.supabase
                    .from('tracks')
                    .update({ file_path: filePath })
                    .eq('id', trackId);
                isPlayable = true;
            }
            catch (err) {
                console.error('[TrackResolver] Download failed:', err);
            }
        }
        if (filePath) {
            try {
                const features = await essentia_client_1.essentiaClient.analyze({ filePath, title, artist, youtubeId: youtubeId ?? undefined });
                const analyzedDuration = features.duration ?? features.duration_seconds;
                await supabase_1.supabase
                    .from('tracks')
                    .update({
                    essentia_features: features,
                    duration: analyzedDuration ? Math.round(analyzedDuration) : null,
                })
                    .eq('id', trackId);
            }
            catch (err) {
                console.error('[TrackResolver] Essentia analysis failed:', err);
                isPlayable = false;
                await supabase_1.supabase
                    .from('tracks')
                    .update({ file_path: null, essentia_features: null, duration: null })
                    .eq('id', trackId);
            }
        }
        try {
            const coverTrack = connectorTrack ?? {
                title,
                artist,
                youtube_id: youtubeId ?? undefined,
            };
            const coverUrl = await resolveCoverArt(coverTrack);
            if (coverUrl) {
                await supabase_1.supabase
                    .from('tracks')
                    .update({ cover_url: coverUrl })
                    .eq('id', trackId);
            }
        }
        catch (err) {
            console.error('[TrackResolver] Cover art failed:', err);
        }
        try {
            await queue_engine_1.QueueEngine.getInstance().reorder(eventId);
        }
        catch (err) {
            console.error('[TrackResolver] Queue reorder failed:', err);
        }
        try {
            await stream_manager_1.StreamManager.getInstance().syncEventStream(eventId);
        }
        catch (err) {
            console.error('[TrackResolver] Stream refresh failed:', err);
        }
        return isPlayable;
    }
    static async resolve(rawText, eventId, guestId, requestId) {
        let resolved = null;
        // Step 1: Resolve music via connector waterfall
        for (const connector of musicConnectors) {
            try {
                resolved = await connector.resolve(rawText);
                if (resolved)
                    break;
            }
            catch {
                // Try next connector
            }
        }
        if (!resolved) {
            // No connector could find the track — mark request failed
            await supabase_1.supabase
                .from('requests')
                .update({ status: 'failed' })
                .eq('id', requestId);
            console.warn(`[TrackResolver] Could not resolve: "${rawText}"`);
            return;
        }
        // Step 2: Insert track immediately (optimistic — guest sees it in queue right away)
        // Supabase real-time will push INSERT event to all subscribers
        const { data: trackRow, error: insertError } = await supabase_1.supabase
            .from('tracks')
            .insert({
            event_id: eventId,
            title: resolved.title,
            artist: resolved.artist,
            youtube_id: resolved.youtube_id ?? null,
            added_by: guestId,
            status: 'queued',
            position: 999, // QueueEngine.reorder() will assign correct position
        })
            .select()
            .single();
        if (insertError || !trackRow) {
            console.error('[TrackResolver] Insert failed:', insertError);
            await supabase_1.supabase.from('requests').update({ status: 'failed' }).eq('id', requestId);
            return;
        }
        const hydrated = await this.hydrateQueuedTrack({
            eventId,
            trackId: trackRow.id,
            title: resolved.title,
            artist: resolved.artist,
            youtubeId: resolved.youtube_id ?? null,
            connectorTrack: resolved,
        });
        // Step 3: Download audio
        let filePath = null;
        if (resolved.youtube_id) {
            try {
                filePath = await (0, ytdlp_1.downloadYouTube)(resolved.youtube_id);
                await supabase_1.supabase
                    .from('tracks')
                    .update({ file_path: filePath })
                    .eq('id', trackRow.id);
            }
            catch (err) {
                console.error('[TrackResolver] Download failed — removing track:', err);
                await supabase_1.supabase.from('tracks').delete().eq('id', trackRow.id);
                await supabase_1.supabase.from('requests').update({ status: 'failed' }).eq('id', requestId);
                throw err;
            }
        }
        else {
            console.error('[TrackResolver] No youtube_id — cannot download audio');
            await supabase_1.supabase.from('tracks').delete().eq('id', trackRow.id);
            await supabase_1.supabase.from('requests').update({ status: 'failed' }).eq('id', requestId);
            return;
        }
        if (!hydrated) {
            await supabase_1.supabase
                .from('tracks')
                .update({ status: 'played', file_path: null, essentia_features: null, duration: null })
                .eq('id', trackRow.id);
            await supabase_1.supabase
                .from('requests')
                .update({ status: 'failed' })
                .eq('id', requestId);
            return;
        }
        // Step 6: Mark request as resolved
        await supabase_1.supabase
            .from('requests')
            .update({ status: 'resolved', resolved_track_id: trackRow.id })
            .eq('id', requestId);
    }
}
exports.TrackResolver = TrackResolver;
//# sourceMappingURL=track-resolver.js.map