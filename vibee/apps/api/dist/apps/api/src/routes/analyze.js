"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRoutes = analyzeRoutes;
const tunebat_1 = require("../services/tunebat");
async function analyzeRoutes(app) {
    app.post('/analyze', async (req, reply) => {
        const { title, artist } = req.body ?? {};
        if (!title && !artist) {
            return reply.status(400).send({ error: 'title and/or artist are required' });
        }
        try {
            const metrics = await (0, tunebat_1.analyzeTrack)(title ?? '', artist ?? '');
            return reply.send(metrics);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('required') || message.includes('No Tunebat result')) {
                return reply.status(400).send({ error: message });
            }
            app.log.error(err);
            return reply.status(500).send({ error: 'Analysis failed' });
        }
    });
}
//# sourceMappingURL=analyze.js.map