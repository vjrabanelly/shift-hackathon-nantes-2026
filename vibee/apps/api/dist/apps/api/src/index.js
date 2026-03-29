"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const static_1 = __importDefault(require("@fastify/static"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const events_1 = require("./routes/events");
const guests_1 = require("./routes/guests");
const requests_1 = require("./routes/requests");
const joystick_1 = require("./routes/joystick");
const agent_1 = require("./routes/agent");
const analyze_1 = require("./routes/analyze");
const media_paths_1 = require("./lib/media-paths");
const stream_manager_1 = require("./services/stream-manager");
const queue_engine_1 = require("./services/queue-engine");
const app = (0, fastify_1.default)({ logger: true });
async function main() {
    await app.register(cors_1.default, {
        origin: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-admin-token', 'Range'],
        exposedHeaders: ['Accept-Ranges', 'Content-Length', 'Content-Range'],
        maxAge: 86400,
    });
    await app.register(static_1.default, {
        root: media_paths_1.HLS_ROOT_DIR,
        prefix: '/stream/',
    });
    const streamManager = stream_manager_1.StreamManager.getInstance();
    streamManager.init();
    const queueEngine = queue_engine_1.QueueEngine.getInstance();
    queueEngine.start();
    await app.register(events_1.eventsRoutes, { prefix: '/events' });
    await app.register(guests_1.guestsRoutes, { prefix: '/events' });
    await app.register(requests_1.requestsRoutes, { prefix: '/events' });
    await app.register(joystick_1.joystickRoutes, { prefix: '/events' });
    await app.register(agent_1.agentRoutes, { prefix: '/events' });
    await app.register(analyze_1.analyzeRoutes);
    app.get('/health', async () => ({ status: 'ok' }));
    // Serve web app as static files (built in Docker, optional in dev)
    const webDistPath = path_1.default.join(__dirname, '../public/web');
    if (fs_1.default.existsSync(webDistPath)) {
        await app.register(static_1.default, {
            root: webDistPath,
            prefix: '/',
            decorateReply: false,
        });
        // SPA fallback: return index.html for client-side routes
        const spaRoutes = ['/join/*', '/admin/*', '/guest/*', '/'];
        for (const route of spaRoutes) {
            app.get(route, async (_req, reply) => {
                return reply.sendFile('index.html', webDistPath);
            });
        }
    }
    const port = parseInt(process.env.PORT ?? '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map