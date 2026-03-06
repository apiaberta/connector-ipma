import Fastify from 'fastify'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { ipmaRoutes } from './routes.js'
import { metaRoutes } from './meta.js'
import { syncForecasts, syncWarnings } from './sync.js'

const SERVICE_NAME = 'connector-ipma'
const PORT      = parseInt(process.env.PORT || '3002')
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apiaberta-ipma'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined
  }
})

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', async () => ({
  status:    'ok',
  service:   SERVICE_NAME,
  version:   '1.0.0',
  timestamp: new Date().toISOString()
}))

// ─── Data routes ─────────────────────────────────────────────────────────────

await app.register(metaRoutes)
await app.register(ipmaRoutes, { prefix: '/ipma' })

// ─── Cron: forecasts every 6h, warnings every 30min ─────────────────────────

cron.schedule('0 */6 * * *', async () => {
  app.log.info('Cron: syncing IPMA forecasts...')
  try {
    const r = await syncForecasts(app.log)
    app.log.info({ r }, 'Forecasts sync complete')
  } catch (err) {
    app.log.error({ err }, 'Forecasts sync failed')
  }
})

cron.schedule('*/30 * * * *', async () => {
  app.log.info('Cron: syncing IPMA warnings...')
  try {
    const r = await syncWarnings(app.log)
    app.log.info({ r }, 'Warnings sync complete')
  } catch (err) {
    app.log.error({ err }, 'Warnings sync failed')
  }
})

// ─── Startup ─────────────────────────────────────────────────────────────────

await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

// Initial sync on startup
app.log.info('Running initial IPMA sync...')
syncForecasts(app.log)
  .then(r => app.log.info({ r }, 'Initial forecasts sync done'))
  .catch(err => app.log.error({ err }, 'Initial forecasts sync failed'))

syncWarnings(app.log)
  .then(r => app.log.info({ r }, 'Initial warnings sync done'))
  .catch(err => app.log.error({ err }, 'Initial warnings sync failed'))

await app.listen({ port: PORT, host: '0.0.0.0' })
app.log.info(`${SERVICE_NAME} listening on port ${PORT}`)
