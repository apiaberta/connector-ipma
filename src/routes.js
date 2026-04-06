import { Forecast } from './models/forecast.js'
import { Warning } from './models/warning.js'
import { fetchAllLocations } from './sync.js'

// In-memory cache for locations (refreshed on first request)
let _locationsCache = null

async function getLocations() {
  if (!_locationsCache) {
    _locationsCache = await fetchAllLocations()
  }
  return _locationsCache
}

export async function ipmaRoutes(app) {

  // GET /ipma/locations — all 35 Portugal locations
  app.get('/locations', {
    schema: {
      description: 'All available IPMA locations (35 districts + islands)',
      tags: ['Weather'],
      querystring: {
        type: 'object',
        properties: {
          island: { type: 'boolean', description: 'Filter to islands only' }
        }
      }
    }
  }, async (req) => {
    const locationMap = await getLocations()
    const locations = Array.from(locationMap.values())

    // Islands are identified by having an id > 300 (approximate heuristic based on IPMA data)
    // Actually: islands don't appear in hp-daily-forecast endpoints (those are continental only)
    // We return all 35 locations so consumers know what's available
    let data = locations.map(loc => ({
      globalIdLocal: loc.globalIdLocal,
      name:          loc.local,
      latitude:      loc.latitude,
      longitude:     loc.longitude
    }))

    // Simple island filter: Azores/Madeira ids are typically > 900000 range in IPMA
    if (req.query.island === true) {
      data = data.filter(loc => loc.globalIdLocal > 900000)
    } else if (req.query.island === false) {
      data = data.filter(loc => loc.globalIdLocal <= 900000)
    }

    return {
      count: data.length,
      data
    }
  })

  // GET /ipma/forecasts — all locations, upcoming days
  app.get('/forecasts', {
    schema: {
      description: 'Weather forecasts for all Portuguese locations (up to 3 days)',
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

    // Group by cityId
    const byCityId = {}
    for (const f of forecasts) {
      if (!byCityId[f.cityId]) {
        byCityId[f.cityId] = {
          cityId:    f.cityId,
          cityName:  f.cityName,
          district:  f.district,
          latitude:  f.latitude,
          longitude: f.longitude,
          forecasts: []
        }
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
      cities: Object.values(byCityId).length,
      data:   Object.values(byCityId),
      synced_at: forecasts[0]?.synced_at || null
    }
  })

  // GET /ipma/forecasts/:cityId — forecast for one location
  app.get('/forecasts/:cityId', {
    schema: {
      description: '3-day weather forecast for a specific location',
      tags: ['Weather'],
      params: {
        type: 'object',
        properties: {
          cityId: { type: 'integer', description: 'IPMA globalIdLocal ID (e.g. 1110600 for Lisboa)' }
        },
        required: ['cityId']
      }
    }
  }, async (req, reply) => {
    const cityId = parseInt(req.params.cityId)
    const locationMap = await getLocations()
    const location = locationMap.get(cityId)

    if (!location) {
      // Check if it's a valid id in our cache
      return reply.code(404).send({ error: `Location ${cityId} not found` })
    }

    const today = new Date().toISOString().split('T')[0]
    const forecasts = await Forecast.find({ cityId, date: { $gte: today } })
      .sort({ date: 1 })
      .lean()

    return {
      cityId:    location.globalIdLocal,
      cityName:  location.local,
      latitude:  location.latitude,
      longitude: location.longitude,
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

  // GET /ipma/warnings — active warnings (endTime >= now)
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
