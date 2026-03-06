import { Forecast } from './models/forecast.js'
import { Warning } from './models/warning.js'

export async function metaRoutes(app) {
  app.get('/ipma/meta', {
    schema: {
      description: 'Metadata and stats for the IPMA connector',
      tags: ['Weather']
    }
  }, async () => {
    const [forecastCount, warningCount, lastForecast] = await Promise.all([
      Forecast.countDocuments(),
      Warning.countDocuments(),
      Forecast.findOne().sort({ synced_at: -1 }).select('synced_at').lean()
    ])
    return {
      connector:   'connector-ipma',
      version:     '1.0.0',
      description: 'Weather forecasts and warnings from IPMA (Instituto Portugues do Mar e da Atmosfera)',
      source:      'https://api.ipma.pt',
      update_freq: 'Every 6 hours',
      endpoints: [
        { path: '/v1/ipma/forecasts/:cityId', description: '5-day forecast for a city' },
        { path: '/v1/ipma/cities',            description: 'List of available cities' },
        { path: '/v1/ipma/warnings',          description: 'Active weather warnings' }
      ],
      stats: {
        forecasts: forecastCount,
        warnings:  warningCount,
        last_sync: lastForecast?.synced_at ?? null
      }
    }
  })
}
