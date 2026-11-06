import { WebsiteAnalyticsEvent } from './websiteAnalytics.model.js'
import { CookieConsent } from '../cookieConsent/cookieConsent.model.js'
import { COOKIE_POLICY_VERSION } from '../cookieConsent/cookieConsent.service.js'
import { CommercePaymentIntent } from '../commerce/commerce.final.models.js'

const DAY_MS = 86400000
const RAW_DAYS = 90
const VALID_DAYS = new Set([7, 30, 90])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function atUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function parseDay(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null
}

export function resolveWebsiteReportWindow(query = {}, now = new Date()) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new RangeError('Invalid report filters.')
  const keys = Object.keys(query)
  if (keys.some((key) => !['days', 'from', 'to'].includes(key))) throw new RangeError('Unknown report filter.')
  const today = atUtcDay(now)
  const end = new Date(+today + DAY_MS)
  let start
  let periodEnd = end
  let label

  if ('from' in query || 'to' in query) {
    if ('days' in query || keys.length !== 2) throw new RangeError('Provide both from and to, or days.')
    start = parseDay(query.from)
    const lastDay = parseDay(query.to)
    if (!start || !lastDay) throw new RangeError('Use valid YYYY-MM-DD dates.')
    periodEnd = new Date(+lastDay + DAY_MS)
    label = 'Custom range'
  } else {
    if (keys.length && keys[0] !== 'days') throw new RangeError('Invalid report filter.')
    const days = keys.length ? Number(query.days) : 7
    if (!VALID_DAYS.has(days) || String(days) !== String(query.days ?? days)) {
      throw new RangeError('Choose 7, 30 or 90 days.')
    }
    start = new Date(+end - days * DAY_MS)
    label = `Last ${days} days`
  }

  const days = Math.round((+periodEnd - +start) / DAY_MS)
  if (days < 1 || days > RAW_DAYS || +periodEnd > +end || +start > +today ||
      +start < +atUtcDay(new Date(+today - (RAW_DAYS - 1) * DAY_MS))) {
    throw new RangeError('Choose up to 90 days within the available raw-event period.')
  }

  const previousStart = new Date(+start - days * DAY_MS)
  const canCompare = +previousStart >= +atUtcDay(new Date(+today - (RAW_DAYS - 1) * DAY_MS))
  return {
    start, end: periodEnd, days, label,
    from: start.toISOString().slice(0, 10),
    to: new Date(+periodEnd - DAY_MS).toISOString().slice(0, 10),
    comparison: canCompare ? { start: previousStart, end: start } : null,
    timezone: 'UTC', retentionDays: RAW_DAYS,
  }
}

function activeRange(start, end) {
  return { occurredAt: { $gte: start, $lt: end } }
}

function facetPipeline() {
  return {
    $facet: {
      events: [{ $group: { _id: '$eventName', count: { $sum: 1 } } }],
      visitors: [{ $group: { _id: '$visitorId' } }, { $count: 'count' }],
      sessions: [{ $group: { _id: '$sessionId' } }, { $count: 'count' }],
      daily: [
        { $group: { _id: { day: { $dateToString: { date: '$occurredAt', format: '%Y-%m-%d', timezone: 'UTC' } }, event: '$eventName' }, count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id.day', event: '$_id.event', count: 1 } },
        { $sort: { day: 1 } },
      ],
      acquisition: [
        { $match: { eventName: 'session_start' } },
        { $group: { _id: { source: '$source', medium: '$medium' }, sessions: { $sum: 1 } } },
        { $sort: { sessions: -1 } }, { $limit: 10 },
      ],
      campaigns: [
        { $match: { eventName: 'session_start', campaign: { $ne: '' } } },
        { $group: { _id: '$campaign', sessions: { $sum: 1 } } },
        { $sort: { sessions: -1 } }, { $limit: 8 },
      ],
      pages: [
        { $match: { eventName: 'page_view' } },
        { $group: { _id: '$pageKey', views: { $sum: 1 } } },
        { $sort: { views: -1 } }, { $limit: 10 },
      ],
      content: [
        { $match: { eventName: { $in: ['product_view', 'recipe_view'] }, entityId: { $ne: '' } } },
        { $group: { _id: { type: '$entityType', id: '$entityId' }, views: { $sum: 1 } } },
        { $sort: { views: -1 } }, { $limit: 10 },
      ],
      devices: [
        { $match: { eventName: 'session_start' } },
        { $group: { _id: '$deviceClass', sessions: { $sum: 1 } } },
        { $sort: { sessions: -1 } },
      ],
      funnel: [
        { $match: { eventName: { $in: ['product_view', 'add_to_cart', 'begin_checkout'] } } },
        { $group: { _id: { event: '$eventName', session: '$sessionId' } } },
        { $group: { _id: '$_id.event', sessions: { $sum: 1 } } },
      ],
    },
  }
}

function count(rows) { return Number(rows?.[0]?.count || 0) }
function eventCount(rows, name) { return Number(rows.find((row) => row._id === name)?.count || 0) }

export function normalizeWebsiteFacets(raw = {}, window) {
  const events = raw.events || []
  const dailyByDate = new Map()
  for (const row of raw.daily || []) {
    if (!dailyByDate.has(row.day)) dailyByDate.set(row.day, { day: row.day, pageViews: 0, sessions: 0, productViews: 0, recipeViews: 0 })
    const item = dailyByDate.get(row.day)
    if (row.event === 'page_view') item.pageViews += row.count
    if (row.event === 'session_start') item.sessions += row.count
    if (row.event === 'product_view') item.productViews += row.count
    if (row.event === 'recipe_view') item.recipeViews += row.count
  }
  const daily = []
  for (let i = 0; i < window.days; i += 1) {
    const day = new Date(+window.start + i * DAY_MS).toISOString().slice(0, 10)
    daily.push(dailyByDate.get(day) || { day, pageViews: 0, sessions: 0, productViews: 0, recipeViews: 0 })
  }
  const funnelCounts = Object.fromEntries((raw.funnel || []).map((row) => [row._id, row.sessions]))
  return {
    overview: {
      visitors: count(raw.visitors), sessions: count(raw.sessions),
      pageViews: eventCount(events, 'page_view'),
      productViews: eventCount(events, 'product_view'),
      recipeViews: eventCount(events, 'recipe_view'),
      searches: eventCount(events, 'search_submit'),
      bookmarks: eventCount(events, 'bookmark_add'),
      cartActions: eventCount(events, 'add_to_cart'),
      recordedEvents: events.reduce((sum, row) => sum + row.count, 0),
    },
    daily,
    acquisition: (raw.acquisition || []).map((row) => ({
      source: row._id?.source || 'unknown', medium: row._id?.medium || 'unknown', sessions: row.sessions,
    })),
    campaigns: (raw.campaigns || []).map((row) => ({ name: row._id, sessions: row.sessions })),
    devices: (raw.devices || []).map((row) => ({ device: row._id || 'unknown', sessions: row.sessions })),
    topPages: (raw.pages || []).map((row) => ({ page: row._id, views: row.views })),
    topContent: (raw.content || []).map((row) => ({ type: row._id?.type, id: row._id?.id, views: row.views })),
    funnel: ['product_view', 'add_to_cart', 'begin_checkout'].map((event) => ({
      event, sessions: Number(funnelCounts[event] || 0),
    })),
  }
}

export async function getWebsiteAnalyticsReport(query, now = new Date()) {
  const window = resolveWebsiteReportWindow(query, now)
  const base = [{ $match: activeRange(window.start, window.end) }, facetPipeline()]
  const previousBase = window.comparison
    ? [{ $match: activeRange(window.comparison.start, window.comparison.end) }, {
        $facet: {
          views: [{ $match: { eventName: 'page_view' } }, { $count: 'count' }],
          visitors: [{ $group: { _id: '$visitorId' } }, { $count: 'count' }],
          sessions: [{ $group: { _id: '$sessionId' } }, { $count: 'count' }],
        },
      }]
    : null

  const [results, previousResults, paymentRows, consentRows] = await Promise.all([
    WebsiteAnalyticsEvent.aggregate(base).allowDiskUse(true).option({ maxTimeMS: 12000 }),
    previousBase ? WebsiteAnalyticsEvent.aggregate(previousBase).allowDiskUse(true).option({ maxTimeMS: 12000 }) : Promise.resolve(null),
    // A browser cannot attest to a sale. Payments are counted by the provider-
    // verified payment record and checked against the current parent order.
    CommercePaymentIntent.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: window.start, $lt: window.end } } },
      { $sort: { paidAt: 1 } },
      { $group: { _id: '$parentOrderId', amountMinor: { $first: '$amountMinor' }, currency: { $first: '$currency' } } },
      { $lookup: { from: 'parentOrders', localField: '_id', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $match: { 'order.paymentStatus': 'paid', 'order.status': { $nin: ['customer_cancelled', 'seller_cancelled', 'refunded', 'returned'] } } },
      { $group: { _id: '$currency', orders: { $sum: 1 }, amountMinor: { $sum: '$amountMinor' } } },
      { $sort: { orders: -1 } },
    ]).option({ maxTimeMS: 12000 }),
    CookieConsent.aggregate([
      { $match: { policyVersion: COOKIE_POLICY_VERSION, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] } },
      { $group: { _id: '$analytics', count: { $sum: 1 } } },
    ]).option({ maxTimeMS: 12000 }),
  ])

  const report = normalizeWebsiteFacets(results?.[0], window)
  const prior = previousResults?.[0]
  const decisions = consentRows.reduce((total, row) => total + row.count, 0)
  const optedIn = consentRows.find((row) => row._id === true)?.count || 0
  return {
    window: {
      from: window.from, to: window.to, days: window.days, timezone: 'UTC',
      label: window.label, retentionDays: RAW_DAYS,
      comparisonAvailable: Boolean(window.comparison),
    },
    generatedAt: now.toISOString(),
    ...report,
    previous: prior ? {
      visitors: count(prior.visitors), sessions: count(prior.sessions), pageViews: count(prior.views),
    } : null,
    commerce: {
      paidOrders: paymentRows.reduce((sum, row) => sum + row.orders, 0),
      byCurrency: paymentRows.map((row) => ({ currency: row._id, paidOrders: row.orders, amountMinor: row.amountMinor })),
      source: 'verified_paid_payment_intents',
      note: 'Paid orders are verified backend payments, not joined to consented visitor sessions. Gross values do not subtract later refunds.',
    },
    consent: {
      currentSavedChoices: decisions, analyticsEnabled: optedIn, analyticsRejected: decisions - optedIn,
      enabledShare: decisions ? Math.round((optedIn / decisions) * 1000) / 10 : null,
      note: 'Share of stored current-policy decisions, not a percentage of all site visitors.',
    },
    coverage: {
      source: 'M1-B consented browser events',
      note: 'Visitors and sessions are approximate, consented browser counts. They exclude rejected visitors and are not total site traffic.',
      hasTrackedData: report.overview.recordedEvents > 0,
      purchaseAttributionAvailable: false,
    },
  }
}
