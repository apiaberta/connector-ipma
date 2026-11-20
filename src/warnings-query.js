// active=true: only warnings in force now (startTime <= now <= endTime).
// Default: every warning not yet ended, including ones that start later.
export function buildWarningQuery({ level, region, active } = {}, now = new Date()) {
  const query = { endTime: { $gte: now } }
  if (active === true) query.startTime = { $lte: now }
  if (level)  query.level  = new RegExp(level, 'i')
  if (region) query.region = new RegExp(region, 'i')
  return query
}
