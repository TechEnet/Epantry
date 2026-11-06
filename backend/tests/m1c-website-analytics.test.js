import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = path.resolve(base, '..')
const source = fs.readFileSync(path.join(base, 'src/modules/websiteAnalytics/websiteAnalytics.report.service.js'), 'utf8')
const stripped = source.replace(/^import .*$/gm, '').replace(/^export /gm, '')

function harness(analyticsRows = [], oldRows = null, paymentRows = [], consentRows = []) {
  let calls = 0
  const WebsiteAnalyticsEvent = {
    aggregate() {
      const result = calls++ === 0 ? analyticsRows : oldRows
      return { allowDiskUse() { return this }, option() { return Promise.resolve(result ?? []) } }
    },
  }
  const CommercePaymentIntent = { aggregate(pipeline) {
    assert.equal(pipeline.some((p) => p.$lookup?.from === 'parentOrders'), true, 'Payments must reconcile to parent orders')
    return { option() { return Promise.resolve(paymentRows) } }
  } }
  const CookieConsent = { aggregate() { return { option() { return Promise.resolve(consentRows) } } } }
  const script = `${stripped}\nreturn { resolveWebsiteReportWindow, normalizeWebsiteFacets, getWebsiteAnalyticsReport }`
  return new Function('WebsiteAnalyticsEvent', 'CommercePaymentIntent', 'CookieConsent', 'COOKIE_POLICY_VERSION', script)(
    WebsiteAnalyticsEvent, CommercePaymentIntent, CookieConsent, 'm1a-2026-11-05',
  )
}

const now = new Date('2026-11-06T15:30:00.000Z')

test('M1-C date filters are UTC, strictly bounded and reject unknown query fields', () => {
  const { resolveWebsiteReportWindow: resolve } = harness()
  assert.deepEqual({ from: resolve({ days: '7' }, now).from, to: resolve({ days: '7' }, now).to }, { from: '2026-10-31', to: '2026-11-06' })
  assert.equal(resolve({ from: '2026-11-01', to: '2026-11-03' }, now).days, 3)
  for (const query of [{ days: '5' }, { from: '2026-02-30', to: '2026-11-04' }, { from: '2026-11-01' }, { days: 7, from: '2026-11-01', to: '2026-11-03' }, { days: '7', uid: 'victim' }, { from: '2026-07-01', to: '2026-11-03' }, { from: '2026-11-07', to: '2026-11-08' }]) {
    assert.throws(() => resolve(query, now), RangeError)
  }
  assert.equal(resolve({ days: 90 }, now).comparison, null, 'no false previous-period comparison outside retention')
})

test('M1-C report maps event counts and UTC daily gaps without fabricated visitors', () => {
  const { resolveWebsiteReportWindow, normalizeWebsiteFacets } = harness()
  const window = resolveWebsiteReportWindow({ from: '2026-11-04', to: '2026-11-06' }, now)
  const result = normalizeWebsiteFacets({
    visitors: [{ count: 2 }], sessions: [{ count: 3 }],
    events: [{ _id: 'page_view', count: 6 }, { _id: 'product_view', count: 2 }],
    daily: [{ day: '2026-11-05', event: 'page_view', count: 6 }],
    funnel: [{ _id: 'product_view', sessions: 2 }, { _id: 'add_to_cart', sessions: 1 }],
    pages: [{ _id: '/recipes/:slug', views: 5 }],
  }, window)
  assert.equal(result.overview.visitors, 2)
  assert.equal(result.overview.pageViews, 6)
  assert.deepEqual(result.daily.map((row) => row.pageViews), [0, 6, 0])
  assert.deepEqual(result.funnel.map((row) => row.sessions), [2, 1, 0])
  assert.deepEqual(result.topPages, [{ page: '/recipes/:slug', views: 5 }])
})

test('M1-C report keeps consented visits and confirmed order totals separate', async () => {
  const aggregate = [{ visitors: [{ count: 3 }], sessions: [{ count: 4 }],
    events: [{ _id: 'page_view', count: 14 }], daily: [], devices: [], acquisition: [], pages: [], content: [], funnel: [] }]
  const h = harness(aggregate, null, [{ _id: 'INR', orders: 2, amountMinor: 24500 }], [{ _id: true, count: 2 }, { _id: false, count: 3 }])
  const result = await h.getWebsiteAnalyticsReport({ days: 90 }, now)
  assert.equal(result.overview.visitors, 3)
  assert.equal(result.commerce.paidOrders, 2)
  assert.equal(result.commerce.byCurrency[0].amountMinor, 24500)
  assert.equal(result.coverage.purchaseAttributionAvailable, false)
  assert.equal(result.consent.enabledShare, 40)
  assert.equal(result.previous, null)
  assert.equal(result.daily.length, 90)
})

test('M1-C backend route requires MFA, admin authorization and root Super Admin access', () => {
  const adminRoute = fs.readFileSync(path.join(base, 'src/modules/websiteAnalytics/websiteAnalytics.admin.routes.js'), 'utf8')
  const app = fs.readFileSync(path.join(base, 'src/app.js'), 'utf8')
  assert.match(adminRoute, /authenticateSession/)
  assert.match(adminRoute, /requireMfaAssurance/)
  assert.match(adminRoute, /loadAdminAuthorization/)
  assert.match(adminRoute, /isRootSuperAdmin === true/)
  assert.match(adminRoute, /rateLimit/)
  assert.match(app, /app\.use\('\/api\/v1\/admin\/website-analytics', websiteAnalyticsAdminRoutes\)/)
})

test('M1-C frontend has root-only route and no modification to M19 analytics route', () => {
  const routes = fs.readFileSync(path.join(project, 'frontend/src/routes/AppRoutes.jsx'), 'utf8')
  const shell = fs.readFileSync(path.join(project, 'frontend/src/features/admin/components/AdminShell.jsx'), 'utf8')
  const page = fs.readFileSync(path.join(project, 'frontend/src/features/websiteAnalytics/pages/AdminWebsiteAnalyticsPage.jsx'), 'utf8')
  assert.match(routes, /path="\/admin\/website-analytics"[\s\S]*?<AdminPermissionRoute rootOnly>/)
  assert.match(routes, /path="\/admin\/analytics"/)
  assert.match(shell, /label: "Website Analytics"[\s\S]*?visible: isRootSuperAdmin/)
  assert.match(page, /verified payment/i)
  assert.match(page, /No consented website events yet/)
  assert.match(page, /Export CSV/)
})
