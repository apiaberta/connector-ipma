import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mapSeismicEvent,
  buildSeismicQuery,
  QueryError
} from '../src/seismic.js'

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/seismic-events.json'), 'utf8')
)

const [withSismoId, emptySismoId, unknownMag, sensedNull] = fixtures

describe('mapSeismicEvent', () => {
  it('parses IPMA time as UTC by appending Z', () => {
    const mapped = mapSeismicEvent(emptySismoId, 7)
    assert.equal(mapped.time.toISOString(), '2026-10-15T20:34:46.000Z')
    assert.equal(mapped.time.getUTCHours(), 20)
    assert.equal(mapped.time.getUTCMinutes(), 34)
    assert.equal(mapped.time.getUTCSeconds(), 46)
  })

  it('parses lat/lon/magnitude/depth as floats', () => {
    const mapped = mapSeismicEvent(emptySismoId, 7)
    assert.equal(mapped.lat, 38.9)
    assert.equal(mapped.lon, -9.2)
    assert.equal(mapped.magnitude, 2.1)
    assert.equal(mapped.depth_km, 12)
  })

  it('stores magnitud -99.0 as null', () => {
    const mapped = mapSeismicEvent(unknownMag, 3)
    assert.equal(mapped.magnitude, null)
  })

  it('keeps degree and sensed null when IPMA sends null', () => {
    const mapped = mapSeismicEvent(sensedNull, 3)
    assert.equal(mapped.intensity, null)
    assert.equal(mapped.sensed, null)
  })

  it('uses sismoId as event_key when present', () => {
    const mapped = mapSeismicEvent(withSismoId, 3)
    assert.equal(mapped.event_key, '20261022161413A')
    assert.equal(mapped.sismo_id, '20261022161413A')
    assert.equal(mapped.intensity, 'III')
    assert.equal(mapped.sensed, true)
  })

  it('hashes a stable event_key when sismoId is empty', () => {
    const a = mapSeismicEvent(emptySismoId, 7)
    const b = mapSeismicEvent(emptySismoId, 7)
    assert.equal(a.event_key, b.event_key)
    assert.match(a.event_key, /^[a-f0-9]{40}$/)
    assert.equal(a.sismo_id, null)
  })

  it('produces different event_keys for different events', () => {
    const keys = fixtures.map((raw, i) => mapSeismicEvent(raw, i === 1 ? 7 : 3).event_key)
    assert.equal(new Set(keys).size, 4)
  })

  it('stores GeoJSON Point coordinates as [lon, lat]', () => {
    const mapped = mapSeismicEvent(emptySismoId, 7)
    assert.deepEqual(mapped.location, {
      type: 'Point',
      coordinates: [-9.2, 38.9]
    })
    assert.equal(mapped.location.coordinates[0], mapped.lon)
    assert.equal(mapped.location.coordinates[1], mapped.lat)
  })

  it('maps area 3 to acores and area 7 to continente-madeira', () => {
    assert.equal(mapSeismicEvent(withSismoId, 3).region, 'acores')
    assert.equal(mapSeismicEvent(emptySismoId, 7).region, 'continente-madeira')
    assert.equal(mapSeismicEvent(withSismoId, 3).area_id, 3)
    assert.equal(mapSeismicEvent(emptySismoId, 7).area_id, 7)
  })
})

describe('buildSeismicQuery', () => {
  it('maps region to area_id', () => {
    assert.equal(buildSeismicQuery({ region: 'acores' }).area_id, 3)
    assert.equal(buildSeismicQuery({ region: 'continente-madeira' }).area_id, 7)
  })

  it('filters by min_magnitude', () => {
    assert.deepEqual(buildSeismicQuery({ min_magnitude: '3.5' }).magnitude, { $gte: 3.5 })
  })

  it('applies desde/ate as a date range', () => {
    const filter = buildSeismicQuery({
      desde: '2026-10-01T00:00:00Z',
      ate: '2026-10-20T00:00:00Z'
    })
    assert.equal(filter.time.$gte.toISOString(), '2026-10-01T00:00:00.000Z')
    assert.equal(filter.time.$lte.toISOString(), '2026-10-20T00:00:00.000Z')
  })

  it('defaults to the last 30 days when no date range is given', () => {
    const before = Date.now()
    const filter = buildSeismicQuery({})
    const after = Date.now()
    const expectedLow = before - 30 * 24 * 60 * 60 * 1000
    const expectedHigh = after - 30 * 24 * 60 * 60 * 1000
    assert.ok(filter.time.$gte instanceof Date)
    assert.ok(filter.time.$gte.getTime() >= expectedLow - 5)
    assert.ok(filter.time.$gte.getTime() <= expectedHigh + 5)
    assert.equal(filter.time.$lte, undefined)
  })

  it('filters sensed=true', () => {
    assert.equal(buildSeismicQuery({ sensed: 'true' }).sensed, true)
    assert.equal(buildSeismicQuery({ sensed: true }).sensed, true)
  })

  it('builds a geo filter from near=lat,lon', () => {
    const filter = buildSeismicQuery({ near: '38.72,-9.14', radius_km: 25 })
    assert.deepEqual(filter.location.$geoWithin.$centerSphere[0], [-9.14, 38.72])
    assert.ok(Math.abs(filter.location.$geoWithin.$centerSphere[1] - (25 / 6371)) < 1e-12)
  })

  it('returns 400 on a bad near parameter', () => {
    for (const near of ['not-a-point', '38.7', '91,0', '38.7,-9.1,extra', 'lat,lon']) {
      assert.throws(
        () => buildSeismicQuery({ near }),
        (err) => err instanceof QueryError && err.statusCode === 400
      )
    }
  })

  it('returns 400 on an unknown region', () => {
    assert.throws(
      () => buildSeismicQuery({ region: 'madeira' }),
      (err) => err instanceof QueryError && err.statusCode === 400
    )
  })
})
