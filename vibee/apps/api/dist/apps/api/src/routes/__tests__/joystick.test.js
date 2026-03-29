"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fastify_1 = __importDefault(require("fastify"));
const joystick_1 = require("../joystick");
const { mockUpsert, mockEq, mockSelect, mockChannelSend, mockChannel } = vitest_1.vi.hoisted(() => {
    const mockUpsert = vitest_1.vi.fn();
    const mockEq = vitest_1.vi.fn();
    const mockSelect = vitest_1.vi.fn(() => ({ eq: mockEq }));
    const mockChannelSend = vitest_1.vi.fn().mockResolvedValue({ error: null });
    const mockChannel = vitest_1.vi.fn(() => ({ send: mockChannelSend }));
    return { mockUpsert, mockEq, mockSelect, mockChannelSend, mockChannel };
});
vitest_1.vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn(() => ({
            upsert: mockUpsert,
            select: mockSelect,
        })),
        channel: mockChannel,
    },
}));
// Mock QueueEngine
vitest_1.vi.mock('../../services/queue-engine', () => ({
    QueueEngine: {
        getInstance: vitest_1.vi.fn().mockReturnValue({
            reorder: vitest_1.vi.fn().mockResolvedValue(undefined),
        }),
    },
}));
function buildApp() {
    const app = (0, fastify_1.default)({ logger: false });
    app.register(joystick_1.joystickRoutes, { prefix: '/events' });
    return app;
}
(0, vitest_1.describe)('PATCH /events/:id/joystick', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockUpsert.mockResolvedValue({ error: null });
        mockSelect.mockImplementation(() => ({ eq: mockEq }));
        mockEq.mockResolvedValue({ data: [{ valence: 0.7, energy: 0.8 }] });
        mockChannel.mockImplementation(() => ({ send: mockChannelSend }));
        mockChannelSend.mockResolvedValue({ error: null });
    });
    (0, vitest_1.it)('returns collective average on success', async () => {
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/events/event-123/joystick',
            payload: { guest_id: 'guest-1', valence: 0.7, energy: 0.8 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        (0, vitest_1.expect)(body.collective).toEqual({ valence: 0.7, energy: 0.8 });
    });
    (0, vitest_1.it)('clamps valence and energy to [-1, 1]', async () => {
        mockEq.mockResolvedValue({
            data: [{ valence: 1.0, energy: -1.0 }],
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/events/event-123/joystick',
            payload: { guest_id: 'guest-1', valence: 1.5, energy: -2.0 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        // Verify upsert was called with clamped values
        (0, vitest_1.expect)(mockUpsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ valence: 1.0, energy: -1.0 }), vitest_1.expect.any(Object));
    });
    (0, vitest_1.it)('returns 400 if valence is not a number', async () => {
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/events/event-123/joystick',
            payload: { guest_id: 'guest-1', valence: 'bad', energy: 0.5 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(400);
    });
    (0, vitest_1.it)('returns 400 if energy is not a number', async () => {
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/events/event-123/joystick',
            payload: { guest_id: 'guest-1', valence: 0.5, energy: null },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(400);
    });
    (0, vitest_1.it)('returns 500 if upsert fails', async () => {
        mockUpsert.mockResolvedValue({ error: new Error('DB error') });
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/events/event-123/joystick',
            payload: { guest_id: 'guest-1', valence: 0.5, energy: 0.5 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(500);
    });
    (0, vitest_1.it)('computes collective average across multiple guests', async () => {
        mockEq.mockResolvedValue({
            data: [
                { valence: 0.6, energy: 0.4 },
                { valence: -0.2, energy: 0.8 },
            ],
        });
        const app = buildApp();
        const res = await app.inject({
            method: 'PATCH',
            url: '/events/event-123/joystick',
            payload: { guest_id: 'guest-2', valence: -0.2, energy: 0.8 },
        });
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        (0, vitest_1.expect)(body.collective.valence).toBeCloseTo(0.2);
        (0, vitest_1.expect)(body.collective.energy).toBeCloseTo(0.6);
    });
});
//# sourceMappingURL=joystick.test.js.map