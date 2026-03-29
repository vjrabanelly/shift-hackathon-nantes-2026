"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const events_1 = require("../events");
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../../lib/compute-collective', () => ({
    computeCollective: vitest_1.vi.fn().mockResolvedValue({ valence: 0.5, energy: 0.5 }),
}));
vitest_1.vi.mock('../../services/stream-manager', () => ({
    StreamManager: {
        getInstance: vitest_1.vi.fn().mockReturnValue({
            advanceToNextTrack: vitest_1.vi.fn().mockResolvedValue(undefined),
        }),
    },
}));
vitest_1.vi.mock('../../services/queue-engine', () => ({
    QueueEngine: {
        getInstance: vitest_1.vi.fn().mockReturnValue({
            reorder: vitest_1.vi.fn().mockResolvedValue(undefined),
        }),
    },
}));
const supabase_1 = require("../../lib/supabase");
const mockFrom = supabase_1.supabase.from;
function buildApp() {
    const app = (0, fastify_1.default)();
    app.register(events_1.eventsRoutes, { prefix: '/events' });
    return app;
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
});
(0, vitest_1.describe)('POST /events/:id/skip', () => {
    (0, vitest_1.it)('returns 404 when event not found', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-404/skip',
            headers: { 'x-admin-token': 'tok_abc' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'Event not found' });
    });
    (0, vitest_1.it)('returns 403 when admin token is wrong', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({
                data: { id: 'evt-1', admin_token: 'tok_correct' },
                error: null,
            }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-1/skip',
            headers: { 'x-admin-token': 'tok_wrong' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(403);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'Invalid admin token' });
    });
    (0, vitest_1.it)('returns 200 with now_playing null when no next track', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event lookup
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: 'evt-1', admin_token: 'tok_abc' },
                        error: null,
                    }),
                };
            }
            if (callCount === 2) {
                // playing track lookup
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
                };
            }
            // now_playing lookup after advance
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-1/skip',
            headers: { 'x-admin-token': 'tok_abc' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json()).toEqual({ now_playing: null });
    });
    (0, vitest_1.it)('returns 200 with now_playing track when next track exists', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event lookup
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: 'evt-1', admin_token: 'tok_abc' },
                        error: null,
                    }),
                };
            }
            if (callCount === 2) {
                // playing track lookup
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: 'track-old' },
                        error: null,
                    }),
                };
            }
            if (callCount === 3) {
                // update old track to 'played'
                return {
                    update: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                };
            }
            // now_playing lookup after advance
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({
                    data: {
                        id: 'track-new',
                        title: 'Get Lucky',
                        artist: 'Daft Punk',
                        cover_url: 'https://example.com/cover.jpg',
                        youtube_id: 'abc123',
                    },
                    error: null,
                }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-1/skip',
            headers: { 'x-admin-token': 'tok_abc' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json()).toEqual({
            now_playing: {
                id: 'track-new',
                title: 'Get Lucky',
                artist: 'Daft Punk',
                cover_url: 'https://example.com/cover.jpg',
                youtube_id: 'abc123',
            },
        });
    });
});
//# sourceMappingURL=events-skip.test.js.map