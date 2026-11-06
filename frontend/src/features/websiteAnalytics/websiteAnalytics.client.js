import { apiClient } from '../../api/apiClient'
import {
  COOKIE_CONSENT_UPDATED_EVENT,
  isWebsiteAnalyticsAllowed,
} from '../cookieConsent/cookieConsent.service'

// M1-B: Public/Customer website measurement only. Unlike M19 this layer is
// not an admin audit log or a source of truth for completed purchases.
const VISITOR_KEY = 'epantry:website-visitor-v1'
const SESSION_KEY = 'epantry:website-session-v1'
const SOURCE_KEY = 'epantry:website-source-v1'
const SESSION_IDLE_MS = 30 * 60 * 1000
const VALID_SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/i
const VALID_FILTERS = new Set(['cuisine', 'meal_type', 'category', 'brand', 'sort', 'availability', 'price_range', 'dietary'])
const VALID_CAMPAIGN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const ALLOWED_EVENTS = new Set([
  'session_start', 'page_view', 'recipe_view', 'product_view',
  'search_submit', 'filter_apply', 'bookmark_add', 'bookmark_remove',
  'add_to_cart', 'begin_checkout', 'external_retailer_handoff',
])

let lastPageSignature = ''
let lastSession = ''
let currentPath = ''
const inFlightRequests = new Set()

function safeStorage(storage, operation, key, value) {
  try {
    if (operation === 'get') return storage.getItem(key)
    if (operation === 'set') storage.setItem(key, value)
    if (operation === 'remove') storage.removeItem(key)
  } catch { /* Storage denied: tracking must not affect navigation. */ }
  return null
}

function randomId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : null
}

export function safeWebsitePage(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  if (['/', '/grocery', '/grocery/search-results', '/recipes', '/brands',
    '/community', '/learn', '/about', '/saved-items'].includes(path)) {
    return { pageKey: path, entityType: '', entityId: '' }
  }
  // Recipe discovery and editorial pages are not individual recipes.
  if (['/recipes/what-should-we-cook', '/recipes/cook-today'].includes(path)) return null
  const direct = [
    [/^\/recipes\/([a-z0-9_-]+)$/i, '/recipes/:slug', 'recipe'],
    [/^\/grocery\/product\/([a-z0-9_-]+)$/i, '/grocery/product/:slug', 'product'],
    [/^\/grocery\/category\/([a-z0-9_-]+)$/i, '/grocery/category/:slug', ''],
    [/^\/brands\/([a-z0-9_-]+)$/i, '/brands/:brandKey', ''],
    [/^\/cart\/([a-f0-9]{24})$/i, '/cart/:cartId', ''],
    [/^\/checkout\/([a-f0-9]{24})$/i, '/checkout/:cartId', ''],
  ]
  for (const [pattern, pageKey, entityType] of direct) {
    const match = path.match(pattern)
    if (!match) continue
    if (entityType && VALID_SLUG.test(match[1])) return { pageKey, entityType, entityId: match[1].toLowerCase() }
    return { pageKey, entityType: '', entityId: '' }
  }
  // Host/Admin, account, orders, pantry, identity and private detail URLs
  // are intentionally not part of visitor/session page tracking.
  return null
}

function getAttribution() {
  const existing = safeStorage(window.sessionStorage, 'get', SOURCE_KEY)
  if (existing) {
    try { return JSON.parse(existing) } catch { /* recompute */ }
  }
  const params = new URLSearchParams(window.location.search)
  const utmSource = (params.get('utm_source') || '').toLowerCase()
  const utmMedium = (params.get('utm_medium') || '').toLowerCase()
  const utmCampaign = (params.get('utm_campaign') || '').toLowerCase()
  let referrerHost = ''
  try {
    const host = new URL(document.referrer).hostname.toLowerCase()
    if (host !== window.location.hostname && /^[a-z0-9.-]{1,100}$/.test(host)) referrerHost = host
  } catch { /* direct navigation */ }
  const safeCampaign = VALID_CAMPAIGN.test(utmCampaign) ? utmCampaign : ''
  let source = 'direct'
  let medium = 'none'
  if (VALID_CAMPAIGN.test(utmSource) || VALID_CAMPAIGN.test(utmMedium)) {
    source = 'campaign'; medium = 'campaign'
  } else if (referrerHost) {
    if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com)$/.test(referrerHost)) {
      source = 'search'; medium = 'organic'
    } else { source = 'referral'; medium = 'referral' }
  }
  const attributed = { source, medium, campaign: safeCampaign, referrerHost }
  safeStorage(window.sessionStorage, 'set', SOURCE_KEY, JSON.stringify(attributed))
  return attributed
}

function sessionContext() {
  if (!isWebsiteAnalyticsAllowed() || typeof window === 'undefined') return null
  const now = Date.now()
  let visitorId = safeStorage(window.localStorage, 'get', VISITOR_KEY)
  if (!visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
    visitorId = randomId()
    if (!visitorId) return null
    safeStorage(window.localStorage, 'set', VISITOR_KEY, visitorId)
  }
  let state = null
  try { state = JSON.parse(safeStorage(window.sessionStorage, 'get', SESSION_KEY) || 'null') } catch { /* reset */ }
  const isNew = !state?.id || !/^[a-f0-9-]{36}$/i.test(state.id) ||
    !Number.isFinite(state.updated) || now - state.updated > SESSION_IDLE_MS || state.updated > now
  const sessionId = isNew ? randomId() : state.id
  if (isNew) safeStorage(window.sessionStorage, 'remove', SOURCE_KEY)
  if (!sessionId) return null
  safeStorage(window.sessionStorage, 'set', SESSION_KEY, JSON.stringify({ id: sessionId, updated: now }))
  return { visitorId, sessionId, isNew }
}

function sendEvent(name, details, context) {
  if (!isWebsiteAnalyticsAllowed()) return
  const eventId = randomId()
  if (!eventId) return
  const { pageKey, entityType = '', entityId = '', filterKey = '' } = details
  const attribution = getAttribution()
  const width = window.innerWidth
  const deviceClass = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
  // Best effort, never block carts/search/navigation on analytics errors.
  const controller = new AbortController()
  inFlightRequests.add(controller)
  const timeoutId = window.setTimeout(() => controller.abort(), 5000)
  const apiBase = String(apiClient.defaults.baseURL || '/api/v1').replace(/\/$/, '')
  void fetch(`${apiBase}/website-analytics/events`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-epantry-analytics': '1' },
    signal: controller.signal,
    keepalive: true,
    body: JSON.stringify({
    eventId, visitorId: context.visitorId, sessionId: context.sessionId,
    eventName: name, occurredAt: new Date().toISOString(),
    pageKey, entityType, entityId, filterKey,
    ...attribution, deviceClass,
    }),
  })
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(timeoutId)
      inFlightRequests.delete(controller)
    })
}

function emit(name, details) {
  if (typeof window === 'undefined' || !isWebsiteAnalyticsAllowed() || !ALLOWED_EVENTS.has(name)) return false
  if (!details?.pageKey) return false
  const context = sessionContext()
  if (!context) return false
  if (context.isNew && lastSession !== context.sessionId) {
    lastSession = context.sessionId
    lastPageSignature = ''
    sendEvent('session_start', { pageKey: details.pageKey }, context)
  }
  sendEvent(name, details, context)
  return true
}

export function recordWebsitePage(pathname = window.location.pathname) {
  currentPath = pathname
  const page = safeWebsitePage(pathname)
  if (!page || !isWebsiteAnalyticsAllowed()) return false
  let previousSessionId = ''
  try { previousSessionId = JSON.parse(safeStorage(window.sessionStorage, 'get', SESSION_KEY) || 'null')?.id || '' } catch { /* no session */ }
  const signature = `${pathname}|${previousSessionId}`
  if (lastPageSignature === signature) return false
  const result = emit('page_view', { pageKey: page.pageKey })
  if (result) {
    let sessionId = ''
    try { sessionId = JSON.parse(safeStorage(window.sessionStorage, 'get', SESSION_KEY) || 'null')?.id || '' } catch { /* no session */ }
    lastPageSignature = `${pathname}|${sessionId}`
    if (page.entityType === 'recipe') emit('recipe_view', page)
    if (page.entityType === 'product') emit('product_view', page)
  }
  return result
}

// Explicitly call after a successful customer action; never use an all-click
// DOM listener (that would capture private forms and admin activity).
export function recordWebsiteAction(eventName, { entityType = '', entityId = '', filterKey = '' } = {}) {
  if (!isWebsiteAnalyticsAllowed()) return false
  const page = safeWebsitePage(typeof window !== 'undefined' ? window.location.pathname : '')
  if (!page || !ALLOWED_EVENTS.has(eventName) || ['page_view', 'session_start', 'recipe_view', 'product_view'].includes(eventName)) return false
  const normalizedId = VALID_SLUG.test(entityId) ? entityId.toLowerCase() : ''
  const normalizedFilter = VALID_FILTERS.has(String(filterKey).toLowerCase()) ? String(filterKey).toLowerCase() : ''
  const normalizedType = ['product', 'recipe'].includes(entityType) && normalizedId ? entityType : ''
  return emit(eventName, {
    pageKey: page.pageKey, entityType: normalizedType,
    entityId: normalizedType ? normalizedId : '',
    filterKey: normalizedFilter,
  })
}

export function clearWebsiteAnalyticsIdentity() {
  for (const controller of inFlightRequests) controller.abort()
  inFlightRequests.clear()
  lastPageSignature = ''
  lastSession = ''
  safeStorage(window.localStorage, 'remove', VISITOR_KEY)
  safeStorage(window.sessionStorage, 'remove', SESSION_KEY)
  safeStorage(window.sessionStorage, 'remove', SOURCE_KEY)
}

if (typeof window !== 'undefined') {
  window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, (event) => {
    if (event.detail?.analytics !== true && event.detail?.hasDecision === true) clearWebsiteAnalyticsIdentity()
    else if (event.detail?.analytics === true) recordWebsitePage(currentPath || window.location.pathname)
  })
  window.addEventListener('epantry:auth-session-cleared', clearWebsiteAnalyticsIdentity)
  window.addEventListener('epantry:website-identity-changed', clearWebsiteAnalyticsIdentity)
}
