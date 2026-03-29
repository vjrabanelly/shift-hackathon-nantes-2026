"use strict";
/**
 * Story 9.1 — End-to-End Integration Test (Happy Path)
 *
 * Covers: create event → join as guest → request track → joystick → admin skip
 *
 * Uses Fastify inject so no live server or Supabase is required.
 * External dependencies (supabase, TrackResolver, StreamManager, QueueEngine)
 * are mocked so the test is deterministic and fast.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const events_1 = require("../events");
const guests_1 = require("../guests");
const requests_1 = require("../requests");
const joystick_1 = require("../joystick");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(),
        channel: vitest_1.vi.fn().mockReturnValue({
            send: vitest_1.vi.fn().mockResolvedValue(undefined),
        }),
    },
}));
vitest_1.vi.mock('../../lib/compute-collective', () => ({
    computeCollective: vitest_1.vi.fn().mockReturnValue({ valence: 0.7, energy: 0.8 }),
}));
vitest_1.vi.mock('../../services/stream-manager', () => ({
    StreamManager: {
        getInstance: vitest_1.vi.fn().mockReturnValue({
            init: vitest_1.vi.fn(),
            advanceToNextTrack: vitest_1.vi.fn().mockResolvedValue(undefined),
        }),
    },
}));
vitest_1.vi.mock('../../services/queue-engine', () => ({
    QueueEngine: {
        getInstance: vitest_1.vi.fn().mockReturnValue({
            start: vitest_1.vi.fn(),
            reorder: vitest_1.vi.fn().mockResolvedValue(undefined),
        }),
    },
}));
vitest_1.vi.mock('../../services/track-resolver', () => ({
    TrackResolver: {
        resolve: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
const supabase_1 = require("../../lib/supabase");
const mockFrom = supabase_1.supabase.from;
// ── Test State ────────────────────────────────────────────────────────────────
const EVENT_ID = 'evt-e2e-001';
const ADMIN_TOKEN = 'tok_abc123def456';
const GUEST_ID = 'guest-001';
const REQUEST_ID = 'req-001';
// ── App Factory ───────────────────────────────────────────────────────────────
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(events_1.eventsRoutes, { prefix: '/events' });
    app.register(guests_1.guestsRoutes, { prefix: '/events' });
    app.register(requests_1.requestsRoutes, { prefix: '/events' });
    app.register(joystick_1.joystickRoutes, { prefix: '/events' });
    app.get('/health', async () => ({ status: 'ok' }));
    return app;
}
// ── Tests ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Story 9.1 — E2E Happy Path', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('Step 1: POST /events — creates event and returns event_id + admin_token', async () => {
        mockFrom.mockReturnValue({
            insert: vitest_1.vi.fn().mockReturnThis(),
            select: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({
                data: { id: EVENT_ID, name: 'E2E Party', admin_token: ADMIN_TOKEN },
                error: null,
            }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/events',
            payload: { name: 'E2E Party', seed_playlist: [] },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(201);
        const body = res.json();
        (0, vitest_1.expect)(body.event_id).toBe(EVENT_ID);
        (0, vitest_1.expect)(body.admin_token).toMatch(/^tok_/);
        (0, vitest_1.expect)(body.join_url).toContain(EVENT_ID);
        (0, vitest_1.expect)(body.qr_url).toBeTruthy();
    });
    (0, vitest_1.it)('Step 2: GET /events/:id — returns event state', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event select
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: EVENT_ID, name: 'E2E Party', admin_token: ADMIN_TOKEN },
                        error: null,
                    }),
                };
            }
            if (callCount === 2) {
                // playing track
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
                };
            }
            if (callCount === 3) {
                // queued tracks
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    order: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (callCount === 4) {
                // guests
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (callCount === 5) {
                // guest count
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockResolvedValue({ count: 0, error: null }),
                };
            }
            // joystick positions
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockResolvedValue({ data: [], error: null }),
            };
        });
        const app = buildApp();
        const res = await app.inject({ method: 'GET', url: `/events/${EVENT_ID}` });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const body = res.json();
        (0, vitest_1.expect)(body.event.id).toBe(EVENT_ID);
        (0, vitest_1.expect)(body.queue).toEqual([]);
        (0, vitest_1.expect)(body.now_playing).toBeNull();
        (0, vitest_1.expect)(body).toHaveProperty('collective_joystick');
    });
    (0, vitest_1.it)('Step 3: POST /events/:id/join — guest joins and receives guest_id + emoji', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event exists check
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: EVENT_ID },
                        error: null,
                    }),
                };
            }
            // guest insert
            return {
                insert: vitest_1.vi.fn().mockReturnThis(),
                select: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({
                    data: {
                        id: GUEST_ID,
                        event_id: EVENT_ID,
                        display_name: 'TestGuest',
                        emoji: '🎵',
                    },
                    error: null,
                }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: `/events/${EVENT_ID}/join`,
            payload: { display_name: 'TestGuest' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(201);
        const body = res.json();
        (0, vitest_1.expect)(body.guest_id).toBe(GUEST_ID);
        (0, vitest_1.expect)(body.emoji).toBeTruthy();
        (0, vitest_1.expect)(body.display_name).toBe('TestGuest');
    });
    (0, vitest_1.it)('Step 4: POST /events/:id/requests — guest submits a music request', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event exists check
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({ data: { id: EVENT_ID }, error: null }),
                };
            }
            // request insert
            return {
                insert: vitest_1.vi.fn().mockReturnThis(),
                select: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({
                    data: { id: REQUEST_ID, event_id: EVENT_ID, status: 'pending' },
                    error: null,
                }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: `/events/${EVENT_ID}/requests`,
            payload: { guest_id: GUEST_ID, raw_text: 'Daft Punk Around the World' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(202);
        const body = res.json();
        (0, vitest_1.expect)(body.request_id).toBe(REQUEST_ID);
        (0, vitest_1.expect)(body.status).toBe('pending');
    });
    (0, vitest_1.it)('Step 5: PATCH /events/:id/joystick — updates position and returns collective', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // upsert joystick position
                return { upsert: vitest_1.vi.fn().mockResolvedValue({ error: null }) };
            }
            // select positions for collective computation
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockResolvedValue({ data: [{ valence: 0.7, energy: 0.8 }], error: null }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: `/events/${EVENT_ID}/joystick`,
            payload: { guest_id: GUEST_ID, valence: 0.7, energy: 0.8 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const body = res.json();
        (0, vitest_1.expect)(body.collective).toBeDefined();
        (0, vitest_1.expect)(typeof body.collective.valence).toBe('number');
        (0, vitest_1.expect)(typeof body.collective.energy).toBe('number');
    });
    (0, vitest_1.it)('Step 6: POST /events/:id/skip (admin) — skips current track', async () => {
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // event + admin_token check
                return {
                    select: vitest_1.vi.fn().mockReturnThis(),
                    eq: vitest_1.vi.fn().mockReturnThis(),
                    single: vitest_1.vi.fn().mockResolvedValue({
                        data: { id: EVENT_ID, admin_token: ADMIN_TOKEN },
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
            // now_playing after advance
            return {
                select: vitest_1.vi.fn().mockReturnThis(),
                eq: vitest_1.vi.fn().mockReturnThis(),
                single: vitest_1.vi.fn().mockResolvedValue({ data: null, error: null }),
            };
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: `/events/${EVENT_ID}/skip`,
            headers: { 'x-admin-token': ADMIN_TOKEN },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
    });
    (0, vitest_1.it)('Step 6b: POST /events/:id/skip — rejects wrong admin token', async () => {
        mockFrom.mockReturnValue({
            select: vitest_1.vi.fn().mockReturnThis(),
            eq: vitest_1.vi.fn().mockReturnThis(),
            single: vitest_1.vi.fn().mockResolvedValue({
                data: { id: EVENT_ID, admin_token: ADMIN_TOKEN },
                error: null,
            }),
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: `/events/${EVENT_ID}/skip`,
            headers: { 'x-admin-token': 'wrong_token' },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(403);
        (0, vitest_1.expect)(res.json()).toEqual({ error: 'Invalid admin token' });
    });
    (0, vitest_1.it)('Health check — GET /health returns ok', async () => {
        const app = buildApp();
        const res = await app.inject({ method: 'GET', url: '/health' });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        (0, vitest_1.expect)(res.json()).toEqual({ status: 'ok' });
    });
});
//# sourceMappingURL=e2e-happy-path.test.js.map