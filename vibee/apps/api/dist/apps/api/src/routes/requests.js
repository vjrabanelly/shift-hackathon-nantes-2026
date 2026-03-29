"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestsRoutes = requestsRoutes;
const supabase_1 = require("../lib/supabase");
const track_resolver_1 = require("../services/track-resolver");
async function requestsRoutes(app) {
    // POST /events/:id/requests — guest submits a music request
    app.post('/:id/requests', async (req, reply) => {
        const { id: eventId } = req.params;
        const { guest_id, raw_text } = req.body;
        if (!guest_id?.trim()) {
            return reply.status(400).send({ error: 'guest_id is required' });
        }
        if (!raw_text?.trim()) {
            return reply.status(400).send({ error: 'raw_text is required' });
        }
        // Verify event and guest exist
        const [{ data: event }, { data: guest }] = await Promise.all([
            supabase_1.supabase
                .from('events')
                .select('id')
                .eq('id', eventId)
                .single(),
            supabase_1.supabase
                .from('guests')
                .select('id')
                .eq('id', guest_id)
                .eq('event_id', eventId)
                .maybeSingle(),
        ]);
        if (!event) {
            return reply.status(404).send({ error: 'Event not found' });
        }
        if (!guest) {
            return reply.status(404).send({ error: 'Guest not found for this event' });
        }
        // Insert request row immediately
        const { data: request, error } = await supabase_1.supabase
            .from('requests')
            .insert({
            event_id: eventId,
            guest_id,
            raw_text: raw_text.trim(),
            status: 'pending',
        })
            .select()
            .single();
        if (error || !request) {
            app.log.error(error, 'Failed to insert request');
            return reply.status(500).send({ error: 'Failed to create request' });
        }
        // Respond immediately — resolution is async
        reply.status(202).send({ request_id: request.id, status: 'pending' });
        // Fire-and-forget: resolve track in background
        track_resolver_1.TrackResolver.resolve(raw_text.trim(), eventId, guest_id, request.id)
            .catch((err) => console.error('[requests] TrackResolver error:', err));
    });
}
//# sourceMappingURL=requests.js.map