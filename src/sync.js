/**
 * sync.js — IPMA data synchronisation
 * Forecasts: every 6h | Warnings: every 30min | Seismic: every 10min
 *
 * Locations: all 35 Portugal districts/islands (27 continental + 8 islands)
 * Forecasts: HP daily forecast endpoints (3-day, all 27 locations per call)
 * Seismic: observation/seismic/{3,7}.json — Açores and Continente+Madeira
 */

import { Forecast } from './models/forecast.js'
import { Warning } from './models/warning.js'
import { Earthquake } from './models/earthquake.js'
import { mapSeismicEvent } from './seismic.js'

const BASE_URL = 'https://api.ipma.pt/open-data'
const HEADERS  = { 'User-Agent': 'apiaberta.pt/1.0 (open-data connector)' }
const FETCH_TIMEOUT_MS = 15_000

const SEISMIC_AREAS = [
  { id: 3, key: 'acores' },
  { id: 7, key: 'continente' }
]

// Weather description from IPMA idWeatherType
const WEATHER_TYPES = {
  1: 'Céu limpo', 2: 'Pouco nublado', 3: 'Parcialmente nublado',
  4: 'Nublado', 5: 'Nublado por vezes', 6: 'Aguaceiros', 7: 'Aguaceiros e trovoada',
  8: 'Chuva', 9: 'Chuva e trovoada', 10: 'Chuva forte', 11: 'Granizo',
  12: 'Neve', 13: 'Nevoeiro', 14: 'Geada', 15: 'Vento forte', 16: 'Tempestade',
  17: 'Aguaceiros fracos', 18: 'Aguaceiros fortes', 19: 'Neve fraca',
  20: 'Neve forte', 21: 'Trovoada', 22: 'Chuva fraca', 23: 'Chuva e neve',
  24: 'Aguaceiros de neve', 25: 'Chuva de neve', 26: 'Nublado com chuva fraca',
  27: 'Nublado, intervalos de chuva fraca', 28: 'Aguaceiros e chuva fraca',
  '-99': 'Sem informação'
}

async function fetchJson(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json()
}

/**
 * Fetch all 35 Portugal locations (distrits + islands) from IPMA.
 * Returns a Map: globalIdLocal → { id, local, globalIdLocal, latitude, longitude }
 */
export async function fetchAllLocations() {
  const url = `${BASE_URL}/distrits-islands.json`
  const data = await fetchJson(url)
  const locations = data.data || []

  const map = new Map()
  for (const loc of locations) {
    map.set(loc.globalIdLocal, {
      id:            loc.id,
      local:         loc.local,
      globalIdLocal: loc.globalIdLocal,
      latitude:      loc.latitude,
      longitude:      loc.longitude
    })
  }
  return map
}

// Legacy CITIES export — routes now use /locations instead
export const CITIES = []

/**
 * Sync 3-day forecasts for all 27 continental locations using HP endpoints.
 * Each HP endpoint returns ALL locations in one call (27 records).
 * forecastDate is at the top level of each HP response.
 */
export async function syncForecasts(logger) {
  const locationMap = await fetchAllLocations()
  logger?.info({ count: locationMap.size }, 'Fetched location metadata')

  // HP endpoints: all 27 continental locations per day, forecastDate at top level
  const [day0, day1, day2] = await Promise.all([
    fetchJson(`${BASE_URL}/forecast/meteorology/cities/daily/hp-daily-forecast-day0.json`),
    fetchJson(`${BASE_URL}/forecast/meteorology/cities/daily/hp-daily-forecast-day1.json`),
    fetchJson(`${BASE_URL}/forecast/meteorology/cities/daily/hp-daily-forecast-day2.json`)
  ])

  const dayGroups = [
    { data: day0.data || [], forecastDate: day0.forecastDate },
    { data: day1.data || [], forecastDate: day1.forecastDate },
    { data: day2.data || [], forecastDate: day2.forecastDate }
  ]

  let total = 0
  let skipped = 0

  for (const { data: records, forecastDate } of dayGroups) {
    for (const rec of records) {
      const location = locationMap.get(rec.globalIdLocal)
      if (!location) {
        logger?.warn({ globalIdLocal: rec.globalIdLocal }, 'Location not found in distrits-islands, skipping')
        skipped++
        continue
      }

      try {
        await Forecast.findOneAndUpdate(
          { cityId: rec.globalIdLocal, date: forecastDate },
          {
            cityId:      rec.globalIdLocal,
            cityName:    location.local,
            district:    location.local,
            date:        forecastDate,
            tMin:        rec.tMin != null ? parseFloat(rec.tMin) : null,
            tMax:        rec.tMax != null ? parseFloat(rec.tMax) : null,
            description: WEATHER_TYPES[rec.idWeatherType] || `Tipo ${rec.idWeatherType}`,
            precipProb:  rec.precipitaProb != null ? parseFloat(rec.precipitaProb) : null,
            windDir:     rec.predWindDir || null,  // HP returns string like SE, SW
            windSpeed:   rec.classWindSpeed != null ? String(rec.classWindSpeed) : null,
            latitude:    rec.latitude != null ? parseFloat(rec.latitude) : null,
            longitude:   rec.longitude != null ? parseFloat(rec.longitude) : null,
            synced_at:   new Date()
          },
          { upsert: true, new: true }
        )
        total++
      } catch (err) {
        logger?.error({ err, globalIdLocal: rec.globalIdLocal }, 'Failed to upsert forecast record')
      }
    }
  }

  logger?.info({ total, skipped }, 'Forecast sync complete')
  return { synced: total, skipped, locations: locationMap.size }
}

export async function syncWarnings(logger) {
  try {
    const url = `${BASE_URL}/forecast/warnings/warnings_www.json`
    const data = await fetchJson(url)
    const warnings = Array.isArray(data) ? data : (data.data || [])

    let upserted = 0
    for (const w of warnings) {
      const docId = w.id || w.idCif || `${w.awarenessTypeName}-${w.startTime}-${w.endTime}`
      await Warning.findOneAndUpdate(
        { id: docId },
        {
          id:        docId,
          aware_id:  w.awarenessTypeName || w.type,
          level:     w.awarenessLevel || w.level,
          type:      w.awarenessTypeName || w.type,
          text:      w.text || w.descricaoAviso || '',
          startTime: w.startTime ? new Date(w.startTime) : null,
          endTime:   w.endTime ? new Date(w.endTime) : null,
          region:    w.idAreaAviso || w.region || '',
          synced_at: new Date()
        },
        { upsert: true, new: true }
      )
      upserted++
    }
    logger?.info(`Synced ${upserted} warnings`)
    return { synced: upserted }
  } catch (err) {
    logger?.error({ err }, 'Failed to sync warnings')
    return { error: err.message }
  }
}

async function syncSeismicArea(area, logger) {
  const url = `${BASE_URL}/observation/seismic/${area.id}.json`
  const payload = await fetchJson(url)
  const events = payload.data || []
  const now = new Date()
  const ops = []

  for (const raw of events) {
    const mapped = mapSeismicEvent(raw, area.id)
    if (!mapped) continue
    ops.push({
      updateOne: {
        filter: { event_key: mapped.event_key },
        update: {
          $setOnInsert: { first_seen: now },
          $set: { ...mapped, last_seen: now }
        },
        upsert: true
      }
    })
  }

  if (ops.length === 0) return { n: 0, upserted: 0, modified: 0 }

  const result = await Earthquake.bulkWrite(ops, { ordered: false })
  logger?.info({ area: area.key, n: ops.length }, 'Seismic area sync complete')
  return {
    n: ops.length,
    upserted: result.upsertedCount ?? 0,
    modified: result.modifiedCount ?? 0
  }
}

/**
 * Fetch both seismic areas independently (one failure must not block the other)
 * and upsert into the earthquakes collection.
 */
export async function syncSeismic(logger) {
  const totals = { acores: 0, continente: 0, upserted: 0, modified: 0 }

  await Promise.all(SEISMIC_AREAS.map(async (area) => {
    try {
      const r = await syncSeismicArea(area, logger)
      totals[area.key] = r.n
      totals.upserted += r.upserted
      totals.modified += r.modified
    } catch (err) {
      logger?.error({ err, area: area.key }, 'Seismic area sync failed')
    }
  }))

  logger?.info(totals, 'Seismic sync complete')
  return totals
}
