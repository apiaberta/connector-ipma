import { createHash } from 'node:crypto'

export const REGION_BY_AREA = {
  3: 'acores',
  7: 'continente-madeira'
}

export const AREA_BY_REGION = {
  acores: 3,
  'continente-madeira': 7
}

export class QueryError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'QueryError'
    this.statusCode = statusCode
  }
}

function emptyToNull(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/** IPMA timestamps are UTC without a timezone; append Z when missing. */
export function parseIpmaUtc(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const s = String(value).trim()
  if (!s) return null
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function canonicalUtc(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function eventKey({ sismoId, areaId, time, lat, lon }) {
  if (sismoId) return sismoId
  return createHash('sha1')
    .update(`${areaId}${canonicalUtc(time)}${lat.toFixed(2)}${lon.toFixed(2)}`)
    .digest('hex')
}

/**
 * Map one IPMA seismic record to our document shape (no first_seen/last_seen).
 * Returns null when time or coordinates are unusable.
 */
export function mapSeismicEvent(raw, areaId) {
  if (!raw) return null

  const lat = parseNumber(raw.lat)
  const lon = parseNumber(raw.lon)
  const time = parseIpmaUtc(raw.time)
  if (lat == null || lon == null || !time) return null

  let magnitude = parseNumber(raw.magnitud)
  if (magnitude === -99) magnitude = null

  const sismoId = emptyToNull(raw.sismoId)
  const depth = parseNumber(raw.depth)

  return {
    event_key:    eventKey({ sismoId, areaId, time, lat, lon }),
    sismo_id:     sismoId,
    area_id:      areaId,
    region:       REGION_BY_AREA[areaId],
    time,
    lat,
    lon,
    location:     { type: 'Point', coordinates: [lon, lat] },
    depth_km:     depth,
    magnitude,
    mag_type:     emptyToNull(raw.magType),
    intensity:    emptyToNull(raw.degree),
    sensed:       raw.sensed == null ? null : Boolean(raw.sensed),
    obs_region:   emptyToNull(raw.obsRegion),
    source:       emptyToNull(raw.source) || 'IPMA',
    shakemap_url: emptyToNull(raw.shakemapref),
    map_url:      emptyToNull(raw.googlemapref),
    data_update:  parseIpmaUtc(raw.dataUpdate)
  }
}

function parseBool(value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function parseNear(value) {
  const parts = String(value).split(',')
  if (parts.length !== 2) {
    throw new QueryError('Invalid near, expected lat,lon')
  }
  const lat = parseNumber(parts[0]?.trim())
  const lon = parseNumber(parts[1]?.trim())
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new QueryError('Invalid near, expected lat,lon')
  }
  return { lat, lon }
}

/**
 * Build the Mongo filter for GET /ipma/seismic.
 * Throws QueryError (statusCode 400) on bad input.
 */
export function buildSeismicQuery(query = {}) {
  const filter = {}

  if (query.region) {
    const areaId = AREA_BY_REGION[query.region]
    if (!areaId) {
      throw new QueryError('Invalid region, expected acores or continente-madeira')
    }
    filter.area_id = areaId
  }

  if (query.min_magnitude != null && query.min_magnitude !== '') {
    const mag = parseNumber(query.min_magnitude)
    if (mag == null) throw new QueryError('Invalid min_magnitude')
    filter.magnitude = { $gte: mag }
  }

  const time = {}
  if (query.desde) {
    const d = parseIpmaUtc(query.desde) ?? new Date(query.desde)
    if (Number.isNaN(d.getTime())) throw new QueryError('Invalid desde')
    time.$gte = d
  }
  if (query.ate) {
    const d = parseIpmaUtc(query.ate) ?? new Date(query.ate)
    if (Number.isNaN(d.getTime())) throw new QueryError('Invalid ate')
    time.$lte = d
  }
  if (!time.$gte && !time.$lte) {
    time.$gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
  filter.time = time

  const sensed = parseBool(query.sensed)
  if (sensed != null) filter.sensed = sensed

  if (query.near) {
    const { lat, lon } = parseNear(query.near)
    let radiusKm = query.radius_km == null || query.radius_km === ''
      ? 50
      : parseNumber(query.radius_km)
    if (radiusKm == null || radiusKm <= 0) throw new QueryError('Invalid radius_km')
    if (radiusKm > 500) radiusKm = 500
    // $geoWithin keeps sort=time and works with countDocuments (unlike $near)
    filter.location = {
      $geoWithin: {
        $centerSphere: [[lon, lat], radiusKm / 6371]
      }
    }
  }

  return filter
}

export function parseSeismicPagination(query = {}) {
  const limitRaw = parseNumber(query.limit)
  const offsetRaw = parseNumber(query.offset)
  const limit = Math.min(Math.max(limitRaw == null ? 100 : Math.trunc(limitRaw), 1), 1000)
  const offset = Math.max(offsetRaw == null ? 0 : Math.trunc(offsetRaw), 0)
  return { limit, offset }
}

export function formatSeismicEvent(doc) {
  if (!doc) return null
  return {
    id:           doc.event_key,
    time:         doc.time,
    lat:          doc.lat,
    lon:          doc.lon,
    depth_km:     doc.depth_km,
    magnitude:    doc.magnitude,
    mag_type:     doc.mag_type,
    intensity:    doc.intensity,
    sensed:       doc.sensed,
    region:       doc.region,
    obs_region:   doc.obs_region,
    map_url:      doc.map_url,
    shakemap_url: doc.shakemap_url
  }
}
