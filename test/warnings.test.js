import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapWarning, warningDocId } from '../src/sync.js'

const raw = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/warnings-www.json'), 'utf8')
)

describe('warningDocId', () => {
  it('keeps the area in the key so areas with the same type and period do not collapse', () => {
    const ids = raw.map(warningDocId)
    assert.equal(new Set(ids).size, raw.length)
  })

  it('uses the source id when the feed provides one', () => {
    assert.equal(warningDocId({ id: 'abc', idAreaAviso: 'CBO' }), 'abc')
  })
})

describe('mapWarning', () => {
  it('reads the level from awarenessLevelID', () => {
    const doc = mapWarning(raw[0])
    assert.equal(doc.level, 'yellow')
    assert.equal(doc.region, 'CBO')
    assert.equal(doc.type, 'Precipitação')
  })

  it('maps the CBO yellow precipitation warning for 21/11 06:00-18:00', () => {
    const doc = mapWarning(raw[0])
    assert.equal(doc.startTime.toISOString(), new Date('2026-11-21T06:00:00').toISOString())
    assert.equal(doc.endTime.toISOString(), new Date('2026-11-21T18:00:00').toISOString())
  })

  it('keeps green warnings without text as empty strings', () => {
    const doc = mapWarning(raw[1])
    assert.equal(doc.level, 'green')
    assert.equal(doc.text, '')
  })
})
