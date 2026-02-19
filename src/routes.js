import { Forecast } from './models/forecast.js'
import { Warning } from './models/warning.js'
import { CITIES } from './sync.js'

export async function ipmaRoutes(app) {

  // GET /forecasts — all cities, upcoming days
  app.get('/forecasts', {
    schema: {
      description: 'Weather forecasts for all major Portuguese cities',
      tags: ['Weather'],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', default: 5, minimum: 1, maximum: 10,
                  description: 'Number of days ahead' }
        }
      }
    }
  }, async (req) => {
    const today = new Date().toISOString().split('T')[0]
    const forecasts = await Forecast.find({ date: { $gte: today } })
      .sort({ cityName: 1, date: 1 })
      .lean()

    // Group by city
    const byCityId = {}
    for (const f of forecasts) {
      if (!byCityId[f.cityId]) {
        byCityId[f.cityId] = { cityId: f.cityId, cityName: f.cityName, forecasts: [] }
      }
      byCityId[f.cityId].forecasts.push({
        date:        f.date,
        tMin:        f.tMin,
        tMax:        f.tMax,
        description: f.description,
        precipProb:  f.precipProb,
        windDir:     f.windDir,
        windSpeed:   f.windSpeed
      })
    }

    return {
      cities: CITIES.length,
      data:   Object.values(byCityId),
      synced_at: forecasts[0]?.synced_at || null
    }
  })

  // GET /forecasts/:cityId — forecast for one city
  app.get('/forecasts/:cityId', {
    schema: {
      description: '5-day weather forecast for a specific city',
      tags: ['Weather'],
      params: {
        type: 'object',
        properties: {
          cityId: { type: 'integer', description: 'IPMA city ID (e.g. 1110600 for Lisboa)' }
        },
        required: ['cityId']
      }
    }
  }, async (req, reply) => {
    const cityId = parseInt(req.params.cityId)
    const city = CITIES.find(c => c.id === cityId)
    if (!city) {
      return reply.code(404).send({ error: `City ${cityId} not found` })
    }

    const today = new Date().toISOString().split('T')[0]
    const forecasts = await Forecast.find({ cityId, date: { $gte: today } })
      .sort({ date: 1 })
      .lean()

    return {
      cityId:    city.id,
      cityName:  city.name,
      forecasts: forecasts.map(f => ({
        date:        f.date,
        tMin:        f.tMin,
        tMax:        f.tMax,
        description: f.description,
        precipProb:  f.precipProb,
        windDir:     f.windDir,
        windSpeed:   f.windSpeed,
        synced_at:   f.synced_at
      }))
    }
  })

  // GET /warnings — active warnings (endTime >= now)
  app.get('/warnings', {
    schema: {
      description: 'Active meteorological warnings in Portugal',
      tags: ['Weather'],
      querystring: {
        type: 'object',
        properties: {
          level:  { type: 'string', description: 'Filter by level (e.g. yellow, orange, red)' },
          region: { type: 'string', description: 'Filter by region code' }
        }
      }
    }
  }, async (req) => {
    const now = new Date()
    const query = { endTime: { $gte: now } }

    if (req.query.level)  query.level  = new RegExp(req.query.level, 'i')
    if (req.query.region) query.region = new RegExp(req.query.region, 'i')

    const warnings = await Warning.find(query)
      .sort({ level: -1, startTime: 1 })
      .lean()

    return {
      count: warnings.length,
      data:  warnings.map(w => ({
        id:        w.id,
        level:     w.level,
        type:      w.type,
        text:      w.text,
        startTime: w.startTime,
        endTime:   w.endTime,
        region:    w.region
      }))
    }
  })
}
