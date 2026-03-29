"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joystickRoutes = joystickRoutes;
const supabase_1 = require("../lib/supabase");
const queue_engine_1 = require("../services/queue-engine");
const stream_manager_1 = require("../services/stream-manager");
const compute_collective_1 = require("../lib/compute-collective");
// Simple debounce map per event (one global timer per event)
const reorderTimers = new Map();
function debouncedReorder(eventId) {
    const existing = reorderTimers.get(eventId);
    if (existing)
        clearTimeout(existing);
    const timer = setTimeout(async () => {
        reorderTimers.delete(eventId);
        try {
            await queue_engine_1.QueueEngine.getInstance().reorder(eventId);
            await stream_manager_1.StreamManager.getInstance().syncEventStream(eventId);
        }
        catch (err) {
            console.error('[joystick] reorder error:', err);
        }
    }, 5000);
    reorderTimers.set(eventId, timer);
}
async function joystickRoutes(app) {
    app.patch('/:id/joystick', async (req, reply) => {
        const { id: eventId } = req.params;
        const { guest_id, valence, energy } = req.body;
        if (typeof valence !== 'number' || typeof energy !== 'number') {
            return reply.status(400).send({ error: 'valence and energy must be numbers' });
        }
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        const { error } = await supabase_1.supabase
            .from('joystick_positions')
            .upsert({
            event_id: eventId,
            guest_id,
            valence: clamp(valence),
            energy: clamp(energy),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'event_id,guest_id' });
        if (error) {
            return reply.status(500).send({ error: 'Failed to update joystick' });
        }
        const { data: positions } = await supabase_1.supabase
            .from('joystick_positions')
            .select('valence, energy')
            .eq('event_id', eventId);
        const collective = (0, compute_collective_1.computeCollective)(positions ?? []);
        // Broadcast collective to all subscribers on this event channel
        await supabase_1.supabase.channel(`event:${eventId}:joystick`).send({
            type: 'broadcast',
            event: 'collective',
            payload: { collective },
        });
        debouncedReorder(eventId);
        return reply.status(200).send({ collective });
    });
}
//# sourceMappingURL=joystick.js.map