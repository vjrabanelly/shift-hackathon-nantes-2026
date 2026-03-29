"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock dependencies
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../../lib/ytdlp', () => ({
    downloadYouTube: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../essentia-client', () => ({
    essentiaClient: {
        analyze: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../queue-engine', () => ({
    QueueEngine: {
        getInstance: vitest_1.vi.fn(() => ({
            reorder: vitest_1.vi.fn(),
        })),
    },
}));
vitest_1.vi.mock('@partyjam/connectors', () => {
    const mockResolve = vitest_1.vi.fn();
    return {
        YouTubeConnector: vitest_1.vi.fn(() => ({ resolve: mockResolve })),
        MusicBrainzMetadataConnector: vitest_1.vi.fn(() => ({ resolve: vitest_1.vi.fn() })),
        LastFmConnector: vitest_1.vi.fn(() => ({ resolve: vitest_1.vi.fn() })),
        MusicBrainzCoverArtConnector: vitest_1.vi.fn(() => ({ resolve: vitest_1.vi.fn() })),
        ItunesCoverArtConnector: vitest_1.vi.fn(() => ({ resolve: vitest_1.vi.fn() })),
        YouTubeThumbnailConnector: vitest_1.vi.fn(() => ({ resolve: vitest_1.vi.fn() })),
    };
});
const supabase_1 = require("../../lib/supabase");
const ytdlp_1 = require("../../lib/ytdlp");
const essentia_client_1 = require("../essentia-client");
const queue_engine_1 = require("../queue-engine");
const track_resolver_1 = require("../track-resolver");
const connectors_1 = require("@partyjam/connectors");
function makeSupabaseMock(overrides = {}) {
    const chain = {
        update: vitest_1.vi.fn().mockReturnThis(),
        insert: vitest_1.vi.fn().mockReturnThis(),
        select: vitest_1.vi.fn().mockReturnThis(),
        single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'track-123' }, error: null }),
        eq: vitest_1.vi.fn().mockReturnThis(),
        ...overrides,
    };
    return chain;
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
});
(0, vitest_1.describe)('TrackResolver.resolve', () => {
    (0, vitest_1.it)('marks request as failed when no connector resolves', async () => {
        // All connectors return null
        const ytConnector = new connectors_1.YouTubeConnector();
        const mbConnector = new connectors_1.MusicBrainzMetadataConnector();
        const lfConnector = new connectors_1.LastFmConnector();
        ytConnector.resolve.mockResolvedValue(null);
        mbConnector.resolve.mockResolvedValue(null);
        lfConnector.resolve.mockResolvedValue(null);
        const mockChain = makeSupabaseMock();
        vitest_1.vi.mocked(supabase_1.supabase.from).mockReturnValue(mockChain);
        await track_resolver_1.TrackResolver.resolve('unknown track', 'event-1', 'guest-1', 'req-1');
        (0, vitest_1.expect)(supabase_1.supabase.from).toHaveBeenCalledWith('requests');
        (0, vitest_1.expect)(mockChain.update).toHaveBeenCalledWith({ status: 'failed' });
        (0, vitest_1.expect)(mockChain.eq).toHaveBeenCalledWith('id', 'req-1');
    });
    (0, vitest_1.it)('inserts track optimistically and updates request to resolved', async () => {
        const ytConnector = new connectors_1.YouTubeConnector();
        ytConnector.resolve.mockResolvedValue({
            title: 'Test Song',
            artist: 'Test Artist',
            youtube_id: 'abc123',
        });
        vitest_1.vi.mocked(ytdlp_1.downloadYouTube).mockResolvedValue('/tmp/abc123.mp3');
        vitest_1.vi.mocked(essentia_client_1.essentiaClient.analyze).mockResolvedValue({ duration: 180, bpm: 120 });
        vitest_1.vi.mocked(queue_engine_1.QueueEngine.getInstance().reorder).mockResolvedValue(undefined);
        const insertChain = {
            insert: vitest_1.vi.fn().mockReturnThis(),
            select: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'track-123' }, error: null }),
        };
        const updateChain = {
            update: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        vitest_1.vi.mocked(supabase_1.supabase.from).mockImplementation((table) => {
            if (table === 'tracks')
                return { ...insertChain, ...updateChain };
            return updateChain;
        });
        await track_resolver_1.TrackResolver.resolve('Test Song Test Artist', 'event-1', 'guest-1', 'req-1');
        // Should insert track
        (0, vitest_1.expect)(insertChain.insert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            title: 'Test Song',
            artist: 'Test Artist',
            youtube_id: 'abc123',
            status: 'queued',
        }));
        // Should update request to resolved
        (0, vitest_1.expect)(updateChain.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'resolved', resolved_track_id: 'track-123' }));
    });
    (0, vitest_1.it)('handles download failure gracefully (track still inserted)', async () => {
        const ytConnector = new connectors_1.YouTubeConnector();
        ytConnector.resolve.mockResolvedValue({
            title: 'Song',
            artist: 'Artist',
            youtube_id: 'yt999',
        });
        vitest_1.vi.mocked(ytdlp_1.downloadYouTube).mockRejectedValue(new Error('network error'));
        vitest_1.vi.mocked(queue_engine_1.QueueEngine.getInstance().reorder).mockResolvedValue(undefined);
        const insertChain = {
            insert: vitest_1.vi.fn().mockReturnThis(),
            select: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'track-456' }, error: null }),
        };
        const updateChain = {
            update: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        vitest_1.vi.mocked(supabase_1.supabase.from).mockImplementation(() => ({ ...insertChain, ...updateChain }));
        await track_resolver_1.TrackResolver.resolve('Song Artist', 'event-1', 'guest-1', 'req-2');
        // Track should still be inserted
        (0, vitest_1.expect)(insertChain.insert).toHaveBeenCalled();
        // Request should be resolved (not failed), despite download error
        (0, vitest_1.expect)(updateChain.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'resolved' }));
    });
});
(0, vitest_1.describe)('resolveCoverArt', () => {
    (0, vitest_1.it)('returns first successful URL from waterfall', async () => {
        const mbConnector = new connectors_1.MusicBrainzCoverArtConnector();
        const itunesConnector = new connectors_1.ItunesCoverArtConnector();
        const ytConnector = new connectors_1.YouTubeThumbnailConnector();
        mbConnector.resolve.mockRejectedValue(new Error('not found'));
        itunesConnector.resolve.mockResolvedValue('https://itunes.apple.com/cover.jpg');
        ytConnector.resolve.mockResolvedValue('https://img.youtube.com/thumbnail.jpg');
        const track = { title: 'Song', artist: 'Artist', youtube_id: 'yt123' };
        const result = await (0, track_resolver_1.resolveCoverArt)(track);
        (0, vitest_1.expect)(result).toBe('https://itunes.apple.com/cover.jpg');
        // Should not call YouTube connector since iTunes succeeded
        (0, vitest_1.expect)(ytConnector.resolve).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns null when all cover art connectors fail', async () => {
        const mbConnector = new connectors_1.MusicBrainzCoverArtConnector();
        const itunesConnector = new connectors_1.ItunesCoverArtConnector();
        const ytConnector = new connectors_1.YouTubeThumbnailConnector();
        mbConnector.resolve.mockResolvedValue(null);
        itunesConnector.resolve.mockResolvedValue(null);
        ytConnector.resolve.mockResolvedValue(null);
        const track = { title: 'Song', artist: 'Artist', youtube_id: null };
        const result = await (0, track_resolver_1.resolveCoverArt)(track);
        (0, vitest_1.expect)(result).toBeNull();
    });
});
//# sourceMappingURL=track-resolver.test.js.map