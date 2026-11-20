import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildWarningQuery } from '../src/warnings-query.js'

const now = new Date('2026-11-20T10:00:00Z')

describe('buildWarningQuery', () => {
  it('default excludes ended warnings and keeps upcoming ones', () => {
    const q = buildWarningQuery({}, now)
    assert.deepEqual(q, { endTime: { $gte: now } })
  })

  it('active=true also requires the warning to have started', () => {
    const q = buildWarningQuery({ active: true }, now)
    assert.deepEqual(q, { endTime: { $gte: now }, startTime: { $lte: now } })
  })

  it('adds level and region as case-insensitive matches', () => {
    const q = buildWarningQuery({ level: 'yellow', region: 'cbo' }, now)
    assert.equal(q.level.ignoreCase, true)
    assert.equal(q.region.test('CBO'), true)
  })
})
