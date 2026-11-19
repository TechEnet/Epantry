// M4 offline integration-contract regression checks. Node built-ins only.
// These checks DO NOT replace database-backed E2E, legal review or production audit.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const frontend = name => readFileSync(new URL(`../../frontend/src/${name}`, import.meta.url), 'utf8')

test('Mongoose DSA models cannot crash startup on boolean versionKey', () => {
  const text = source('modules/dsa/dsa.models.js')
  assert.match(text, /versionKey:\s*['"]__v['"]/) 
  assert.doesNotMatch(text, /versionKey:\s*true\b/)
})

test('enforcement URL matcher rejects foreign hosts and lookalike URLs', () => {
  const text = source('modules/dsa/dsa.enforcement.service.js')
  const body = text.split('function matchListingUrl(')[1]?.split('\nexport { matchListingUrl }')[0]
  assert.ok(body, 'The URL-matching function must be present')
  // Isolate the pure function to test URL behavior without MongoDB/network access.
  const match = new Function('env', 'publicHostSlug', `return function matchListingUrl(${body}`)(
    { frontendUrl: 'http://localhost:5173' }, listing => listing.publicSlug,
  )
  const listing = { _id: '507f1f77bcf86cd799439011', publicSlug: 'my-meal-39439011' }
  assert.equal(match('http://localhost:5173/recipes/my-meal-39439011', listing), true)
  assert.equal(match('/grocery/product/my-meal-39439011', listing), true)
  assert.equal(match('https://epantry.in/recipes/my-meal-39439011', listing), true)
  assert.equal(match('https://evil-epantry.in/recipes/my-meal-39439011', listing), false)
  assert.equal(match('https://epantry.in.evil.example/recipes/my-meal-39439011', listing), false)
  assert.equal(match('http://epantry.in/recipes/my-meal-39439011', listing), false)
  assert.equal(match('http://localhost:5173/recipes/not-the-reported-listing', listing), false)
})

test('DSA enforcement is governed and scopes active offers to the affected seller', () => {
  const text = source('modules/dsa/dsa.enforcement.service.js')
  assert.match(text, /session\.withTransaction/)
  assert.match(text, /matchListingUrl\(notice\.listingUrl, listing\)/)
  assert.match(text, /organizationId:\s*owningOrg\._id,\s*merchantSku:/)
  assert.match(text, /moderationStatus\s*=\s*'restricted'/)
  assert.match(text, /status:\s*'paused'/)
  assert.doesNotMatch(text, /lift[^]*?offer\.status\s*=\s*'active'/)
})

test('public Host listing filtering and manual offer activation both enforce restrictions', () => {
  const browse = source('modules/hostOperations/hostUnifiedListing.public.js')
  const offer = source('modules/marketplace/marketplace.offer-readiness.service.js')
  assert.match(browse, /moderationStatus:\s*\{\s*\$ne:\s*'restricted'\s*\}/)
  assert.match(offer, /moderationStatus === 'restricted'/)
  assert.match(browse, /EPANTRY_EU_MARKET_ENABLED/)
  assert.match(browse, /type: \{ \$nin: \['grocery', 'prepared_food'\] \}/)
  assert.match(browse, /'publishedPacket.sellReadyMade': \{ \$ne: true \}/)
  assert.match(offer, /EPANTRY_EU_MARKET_ENABLED/)
})

test('Host trader verification is owner-scoped and reuses accepted KYB documents', () => {
  const text = source('modules/dsa/dsa.trader.service.js')
  assert.match(text, /MarketplaceOrganization\.findOne\(\{ ownerUserId/)
  assert.match(text, /HostKybCase\.findOne\(\{ organizationId:/)
  assert.match(text, /HostOrganizationDocument\.find\(/)
  assert.match(text, /organizationId, status:\s*'accepted'/)
  assert.match(text, /status:\s*'verified'/)
})

test('Host appeal requires ownership and public status omits reporter PII', () => {
  const routes = source('modules/dsa/dsa.routes.js')
  const models = source('modules/dsa/dsa.models.js')
  assert.match(routes, /HostUnifiedListingPacket\.exists\(\{ _id: notice\.enforcementListingId, ownerUserId: actorId\(req\) \}\)/)
  assert.match(routes, /requireRecentMfaAuthentication/)
  const pub = models.split('export function publicReportView(')[1]?.split('\nexport function validateDecisionTransition')[0]
  assert.ok(pub)
  assert.doesNotMatch(pub, /reporterContact:\s*item/)
  assert.doesNotMatch(pub, /accessTokenDigest:\s*item/)
})

test('GDPR scoped deletion requires verified request and tracks evidence', () => {
  const text = source('modules/hardening/privacyFulfilment.service.js')
  assert.match(text, /session\.withTransaction/)
  assert.match(text, /request\.identityVerificationStatus !== 'verified'/)
  assert.match(text, /request\.retentionDecision === 'not_reviewed'/)
  assert.match(text, /userId:\s*owner/g)
  assert.match(text, /scopedErasureRunRef = ref/)
  assert.doesNotMatch(text, /ParentOrder\.delete|HostKybCase\.delete|UserConsent\.delete/)
})

test('GDPR completion demands nine evidenced data classes and own-only export', () => {
  const ops = source('modules/hardening/privacyOps.service.js')
  const exportSvc = source('modules/hardening/privacyExport.service.js')
  assert.match(ops, /PRIVACY_COMPLETION_CLASSES\.length/)
  assert.match(ops, /disposition === 'retained_lawfully'/)
  assert.match(exportSvc, /userId:\s*ownerId/)
  assert.match(exportSvc, /postalCode/)
  assert.match(exportSvc, /exportMayBeTruncated/)
  assert.match(exportSvc, /otherDataReviewRequired:\s*true/)
})

test('public legal pages and protected operational routes remain connected', () => {
  const routes = frontend('routes/AppRoutes.jsx')
  for (const path of ['/privacy-policy', '/terms', '/report-listing', '/host/listing-notices', '/admin/trust-safety']) {
    assert.ok(routes.includes(`path="${path}"`), `Missing route ${path}`)
  }
  const shell = frontend('features/host/components/HostShell.jsx')
  assert.match(shell, /\/host\/listing-notices/)
})

test('reporter notification separates provider acceptance from delivery and never emails access keys', () => {
  const delivery = source('modules/dsa/dsa.noticeDelivery.service.js')
  const routes = source('modules/dsa/dsa.routes.js')
  const model = source('modules/dsa/dsa.models.js')
  assert.match(delivery, /status = response\.ok \? 'provider_accepted' : 'failed'/)
  assert.match(delivery, /private report key by email/)
  assert.doesNotMatch(delivery, /accessTokenDigest|record\.accessToken/)
  assert.match(model, /reporterDecisionNotice/)
  assert.match(model, /reporterAppealNotice/)
  assert.match(routes, /retry-notice', write, requireCsrfToken, requireRecentMfaAuthentication/)
})

test('Host trader form submits only whitelisted fields for strict validation', () => {
  const hostPage = frontend('features/dsa/pages/HostDsaNoticesPage.jsx')
  assert.match(hostPage, /Object\.keys\(state\)\.filter\(key => key in current\)/)
  assert.match(hostPage, /apiClient\.post\('\/dsa\/host\/trader-profile', traderForm/)
})
