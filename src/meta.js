import { Forecast } from './models/forecast.js'
import { Warning } from './models/warning.js'
import { Earthquake } from './models/earthquake.js'

export async function metaRoutes(app) {
  app.get('/ipma/meta', {
    schema: {
      description: 'Metadata and stats for the IPMA connector',
      tags: ['Weather']
    }
  }, async () => {
    const [forecastCount, warningCount, earthquakeCount, lastForecast, lastSeismic] = await Promise.all([
      Forecast.countDocuments(),
      Warning.countDocuments(),
      Earthquake.countDocuments(),
      Forecast.findOne().sort({ synced_at: -1 }).select('synced_at').lean(),
      Earthquake.findOne().sort({ last_seen: -1 }).select('last_seen').lean()
    ])
    return {
      connector:   'connector-ipma',
      version:     '1.1.0',
      description: 'Weather forecasts, warnings and seismic events from IPMA (Instituto Portugues do Mar e da Atmosfera)',
      source:      'https://api.ipma.pt',
      update_freq: 'forecasts 6h, warnings 30min, seismic 10min',
      endpoints: [
        { path: '/v1/ipma/locations',          description: 'List of available locations' },
        { path: '/v1/ipma/forecasts',          description: 'Forecasts for all locations' },
        { path: '/v1/ipma/forecasts/:cityId',  description: '3-day forecast for a location' },
        { path: '/v1/ipma/warnings',           description: 'Active weather warnings' },
        { path: '/v1/ipma/seismic',            description: 'Seismic events (filterable catalogue)' },
        { path: '/v1/ipma/seismic/latest',     description: 'Latest seismic event per region' },
        { path: '/v1/ipma/seismic/:id',        description: 'Single seismic event' }
      ],
      stats: {
        forecasts:         forecastCount,
        warnings:          warningCount,
        earthquakes:       earthquakeCount,
        last_sync:         lastForecast?.synced_at ?? null,
        last_seismic_sync: lastSeismic?.last_seen ?? null
      }
    }
  })
}
