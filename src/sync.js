/**
 * sync.js — IPMA data synchronisation
 * Forecasts: every 6h | Warnings: every 30min
 */

import { Forecast } from './models/forecast.js'
import { Warning } from './models/warning.js'

const BASE_URL = 'https://api.ipma.pt/open-data'
const HEADERS  = { 'User-Agent': 'apiaberta.pt/1.0 (open-data connector)' }

export const CITIES = [
  { id: 1110600, name: 'Lisboa' },
  { id: 1131200, name: 'Porto' },
  { id: 1060600, name: 'Faro' },
  { id: 1030300, name: 'Braga' },
  { id: 1060200, name: 'Coimbra' }
]

// Wind direction mapping from IPMA codes
const WIND_DIR = {
  0: 'N', 1: 'NE', 2: 'E', 3: 'SE',
  4: 'S', 5: 'SW', 6: 'W', 7: 'NW', 9: 'Variable'
}

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

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json()
}

export async function syncForecasts(logger) {
  let total = 0
  for (const city of CITIES) {
    try {
      const url = `${BASE_URL}/forecast/meteorology/cities/daily/${city.id}.json`
      const data = await fetchJson(url)
      const days = data.data || []

      for (const day of days) {
        await Forecast.findOneAndUpdate(
          { cityId: city.id, date: day.forecastDate },
          {
            cityId:      city.id,
            cityName:    city.name,
            date:        day.forecastDate,
            tMin:        day.tMin != null ? parseFloat(day.tMin) : null,
            tMax:        day.tMax != null ? parseFloat(day.tMax) : null,
            description: WEATHER_TYPES[day.idWeatherType] || `Tipo ${day.idWeatherType}`,
            precipProb:  day.precipitaProb != null ? parseFloat(day.precipitaProb) : null,
            windDir:     WIND_DIR[day.predWindDir] || day.predWindDir,
            windSpeed:   day.classWindSpeed != null ? String(day.classWindSpeed) : null,
            synced_at:   new Date()
          },
          { upsert: true, new: true }
        )
        total++
      }
      logger?.info(`Synced ${days.length} forecast days for ${city.name}`)
    } catch (err) {
      logger?.error({ err, city: city.name }, 'Failed to sync forecasts for city')
    }
  }
  return { synced: total }
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
