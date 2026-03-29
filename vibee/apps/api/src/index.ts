import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import path from 'path'
import fs from 'fs'
import { eventsRoutes } from './routes/events'
import { guestsRoutes } from './routes/guests'
import { requestsRoutes } from './routes/requests'
import { joystickRoutes } from './routes/joystick'
import { agentRoutes } from './routes/agent'
import { HLS_ROOT_DIR } from './lib/media-paths'
import { StreamManager } from './services/stream-manager'
import { QueueEngine } from './services/queue-engine'

const app = Fastify({ logger: true })

function findUp(startDir: string, relativePath: string): string | null {
  let current = startDir

  for (;;) {
    const candidate = path.join(current, relativePath)
    if (fs.existsSync(candidate)) {
      return candidate
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}

async function main() {
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-token', 'Range'],
    exposedHeaders: ['Accept-Ranges', 'Content-Length', 'Content-Range'],
    maxAge: 86400,
  })

  await app.register(staticFiles, {
    root: HLS_ROOT_DIR,
    prefix: '/stream/',
  })

  const streamManager = StreamManager.getInstance()
  streamManager.init()

  const queueEngine = QueueEngine.getInstance()
  queueEngine.start()

  await app.register(eventsRoutes, { prefix: '/events' })
  await app.register(guestsRoutes, { prefix: '/events' })
  await app.register(requestsRoutes, { prefix: '/events' })
  await app.register(joystickRoutes, { prefix: '/events' })
  await app.register(agentRoutes, { prefix: '/events' })

  app.get('/health', async () => ({ status: 'ok' }))

  // Serve web app as static files (built in Docker, optional in dev)
  const webDistPath = findUp(__dirname, 'public/web')
  if (webDistPath && fs.existsSync(webDistPath)) {
    await app.register(staticFiles, {
      root: webDistPath,
      prefix: '/',
      decorateReply: false,
    })

    // SPA fallback: return index.html for client-side routes
    const spaRoutes = ['/join/*', '/admin/*', '/guest/*', '/']
    for (const route of spaRoutes) {
      app.get(route, async (_req, reply) => {
        return reply.sendFile('index.html', webDistPath)
      })
    }
  }

  const port = parseInt(process.env.PORT ?? '3000', 10)
  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
