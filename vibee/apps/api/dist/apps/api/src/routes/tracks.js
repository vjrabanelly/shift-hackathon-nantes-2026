"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracksRoutes = tracksRoutes;
const supabase_1 = require("../lib/supabase");
async function tracksRoutes(app) {
    // DELETE /events/:id/tracks/:trackId — admin removes a track
    app.delete('/:id/tracks/:trackId', async (req, reply) => {
        const { id: eventId, trackId } = req.params;
        const adminToken = req.headers['x-admin-token'];
        // Verify admin token
        const { data: event } = await supabase_1.supabase
            .from('events')
            .select('admin_token')
            .eq('id', eventId)
            .single();
        if (!event) {
            return reply.status(404).send({ error: 'Event not found' });
        }
        if (event.admin_token !== adminToken) {
            return reply.status(403).send({ error: 'Invalid admin token' });
        }
        // Delete the track
        const { error } = await supabase_1.supabase
            .from('tracks')
            .delete()
            .eq('id', trackId)
            .eq('event_id', eventId); // Ensure track belongs to this event
        if (error) {
            return reply.status(500).send({ error: 'Failed to delete track' });
        }
        return reply.status(204).send();
    });
}
//# sourceMappingURL=tracks.js.map