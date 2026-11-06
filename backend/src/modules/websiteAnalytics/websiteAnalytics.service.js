import { COOKIE_POLICY_VERSION } from '../cookieConsent/cookieConsent.service.js'
import { WebsiteAnalyticsEvent } from './websiteAnalytics.model.js'

const RAW_EVENT_RETENTION_DAYS = 90
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000

export async function ingestWebsiteEvent(input, now = new Date()) {
  const occurredAt = new Date(input.occurredAt)
  const difference = occurredAt.getTime() - now.getTime()
  if (!Number.isFinite(difference) || difference > MAX_CLOCK_SKEW_MS ||
      difference < -MAX_EVENT_AGE_MS) {
    return { accepted: false, reason: 'event_time_outside_window' }
  }
  const expiresAt = new Date(now.getTime() + RAW_EVENT_RETENTION_DAYS * 86400000)
  const event = {
    ...input,
    occurredAt,
    receivedAt: now,
    expiresAt,
    consentPolicyVersion: COOKIE_POLICY_VERSION,
  }
  try {
    const result = await WebsiteAnalyticsEvent.updateOne(
      { eventId: input.eventId },
      { $setOnInsert: event },
      { upsert: true, runValidators: true },
    )
    return { accepted: true, deduplicated: result.upsertedCount === 0 }
  } catch (error) {
    if (error?.code === 11000) return { accepted: true, deduplicated: true }
    throw error
  }
}

// Precise daily rollups are derived from deduplicated raw events instead of
// incrementing a counter that could double count on an interrupted retry.
// M1-C can call this bounded aggregation and later materialize snapshots.
export async function aggregateWebsiteDays({ start, end }) {
  const from = new Date(start)
  const to = new Date(end)
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || to <= from ||
      to - from > 31 * 86400000) throw new RangeError('Invalid analytics report window.')
  return WebsiteAnalyticsEvent.aggregate([
    { $match: { occurredAt: { $gte: from, $lt: to } } },
    { $group: {
      _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: 'UTC' } }, eventName: '$eventName' },
      events: { $sum: 1 },
      visitors: { $addToSet: '$visitorId' },
      sessions: { $addToSet: '$sessionId' },
    } },
    { $project: { _id: 0, day: '$_id.day', eventName: '$_id.eventName', events: 1,
      visitors: { $size: '$visitors' }, sessions: { $size: '$sessions' } } },
    { $sort: { day: 1, eventName: 1 } },
  ]).option({ maxTimeMS: 10000 })
}
