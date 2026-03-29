"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const requests_1 = require("../requests");
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../../services/track-resolver', () => ({
    TrackResolver: {
        resolve: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
const supabase_1 = require("../../lib/supabase");
const track_resolver_1 = require("../../services/track-resolver");
const mockFrom = supabase_1.supabase.from;
function buildApp() {
    const app = (0, fastify_1.default)();
    app.register(requests_1.requestsRoutes, { prefix: '/events' });
    return app;
}
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
});
(0, vitest_1.describe)('POST /events/:id/requests', () => {
    (0, vitest_1.it)('returns 400 when raw_text is empty', async () => {
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-1/requests',
            payload: { guest_id: 'g-1', raw_text: '   ' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(400);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'raw_text is required' });
    });
    (0, vitest_1.it)('returns 404 when event not found', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-404/requests',
            payload: { guest_id: 'g-1', raw_text: 'Daft Punk' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(404);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'Event not found' });
    });
    (0, vitest_1.it)('returns 202 and fires TrackResolver async', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event lookup
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
                };
            }
            // request insert
            return {
                insert: vitest_1.vi.fn().mockReturnThis(),
                select: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({
                    data: { id: 'req-1' },
                    error: null,
                }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-1/requests',
            payload: { guest_id: 'g-1', raw_text: 'Daft Punk Around the World' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(202);
        (0, vitest_1.expect)(res.json()).toEqual({ request_id: 'req-1', status: 'pending' });
        // Give fire-and-forget a tick
        await new Promise((r) => setTimeout(r, 10));
        (0, vitest_1.expect)(track_resolver_1.TrackResolver.resolve).toHaveBeenCalledWith('Daft Punk Around the World', 'evt-1', 'g-1', 'req-1');
    });
    (0, vitest_1.it)('returns 500 when insert fails', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
                };
            }
            return {
                insert: vitest_1.vi.fn().mockReturnThis(),
                select: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events/evt-1/requests',
            payload: { guest_id: 'g-1', raw_text: 'Daft Punk' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(500);
    });
});
//# sourceMappingURL=requests.test.js.map