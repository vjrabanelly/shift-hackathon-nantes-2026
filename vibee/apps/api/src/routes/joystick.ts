import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { computeCollective } from '../lib/compute-collective'

export async function joystickRoutes(app: FastifyInstance) {
  app.patch<{
    Params: { id: string }
    Body: { guest_id: string; valence: number; energy: number }
  }>('/:id/joystick', async (req, reply) => {
    const { id: eventId } = req.params
    const { guest_id, valence, energy } = req.body

    if (typeof valence !== 'number' || typeof energy !== 'number') {
      return reply.status(400).send({ error: 'valence and energy must be numbers' })
    }

    const clamp = (v: number) => Math.max(-1, Math.min(1, v))

    const { error } = await supabase
      .from('joystick_positions')
      .upsert(
        {
          event_id: eventId,
          guest_id,
          valence: clamp(valence),
          energy: clamp(energy),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,guest_id' }
      )

    if (error) {
      return reply.status(500).send({ error: 'Failed to update joystick' })
    }

    const { data: positions } = await supabase
      .from('joystick_positions')
      .select('valence, energy')
      .eq('event_id', eventId)

    const collective = computeCollective(positions ?? [])

    await supabase.channel(`event:${eventId}:joystick`).send({
      type: 'broadcast',
      event: 'collective',
      payload: { collective },
    })

    return reply.status(200).send({ collective })
  })
}
