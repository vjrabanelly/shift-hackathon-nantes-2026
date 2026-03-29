"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const tracks_1 = require("../tracks");
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(),
    },
}));
const supabase_1 = require("../../lib/supabase");
const mockFrom = supabase_1.supabase.from;
function buildApp() {
    const app = (0, fastify_1.default)();
    app.register(tracks_1.tracksRoutes, { prefix: '/events' });
    return app;
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
});
(0, vitest_1.describe)('DELETE /events/:id/tracks/:trackId', () => {
    (0, vitest_1.it)('returns 404 when event not found', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'DELETE',
            url: '/events/evt-404/tracks/trk-1',
            headers: { 'x-admin-token': 'token' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'Event not found' });
    });
    (0, vitest_1.it)('returns 403 when admin token is wrong', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: { admin_token: 'correct' }, error: null }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'DELETE',
            url: '/events/evt-1/tracks/trk-1',
            headers: { 'x-admin-token': 'wrong' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(403);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'Invalid admin token' });
    });
    (0, vitest_1.it)('returns 204 on successful delete', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: { admin_token: 'secret' }, error: null }),
                };
            }
            return {
                delete: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockReturnThis(),
                mockResolvedValue: vitest_1.vi.fn(),
                then: (fn) => Promise.resolve({ error: null }).then(fn),
            };
        });
        // Simpler approach: mock the chain properly
        mockFrom.mockReset();
        mockFrom.mockImplementationOnce(() => ({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: { admin_token: 'secret' }, error: null }),
        }));
        mockFrom.mockImplementationOnce(() => {
            const chain = {
                delete: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockReturnThis(),
            };
            // The last .eq() call returns the promise result
            let eqCallCount = 0;
            chain.eq.mockImplementation(() => {
                eqCallCount++;
                if (eqCallCount >= 2) {
                    return Promise.resolve({ error: null });
                }
                return chain;
            });
            return chain;
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'DELETE',
            url: '/events/evt-1/tracks/trk-1',
            headers: { 'x-admin-token': 'secret' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(204);
    });
    (0, vitest_1.it)('returns 403 when no admin token provided', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: { admin_token: 'secret' }, error: null }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'DELETE',
            url: '/events/evt-1/tracks/trk-1',
        });
        (0, vitest_1.expect)(res.statusCode).toBe(403);
    });
});
//# sourceMappingURL=tracks.test.js.map