import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { QueueEngine } from '../services/queue-engine'
import { StreamManager } from '../services/stream-manager'
import { computeCollective } from '../lib/compute-collective'

// Simple debounce map per event (one global timer per event)
const reorderTimers = new Map<string, ReturnType<typeof setTimeout>>()

function debouncedReorder(eventId: string) {
  const existing = reorderTimers.get(eventId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(async () => {
    reorderTimers.delete(eventId)
    try {
      await QueueEngine.getInstance().reorder(eventId)
      await StreamManager.getInstance().syncEventStream(eventId)
    } catch (err) {
      console.error('[joystick] reorder error:', err)
    }
  }, 5000)

  reorderTimers.set(eventId, timer)
}

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

    // Broadcast collective to all subscribers on this event channel
    await supabase.channel(`event:${eventId}:joystick`).send({
      type: 'broadcast',
      event: 'collective',
      payload: { collective },
    })

    debouncedReorder(eventId)

    return reply.status(200).send({ collective })
  })
}
