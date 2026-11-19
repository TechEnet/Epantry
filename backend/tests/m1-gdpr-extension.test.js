import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const rights = ['access_export', 'deletion', 'rectification', 'restriction', 'objection']

test('GDPR request types match schema and validation', () => {
  const model = read('src/modules/hardening/hardening.models.js')
  const validation = read('src/modules/hardening/hardening.validation.js')
  const admin = read('src/modules/reliability/reliability.routes.js')
  rights.forEach((type) => {
    assert.match(model, new RegExp(`'${type}'`))
    assert.match(validation, new RegExp(`'${type}'`))
    assert.match(admin, new RegExp(`'${type}'`))
  })
})

test('request calendar-month deadline clamps end-of-month', () => {
  const service = read('src/modules/hardening/hardening.service.js')
  const body = service.match(/export function privacyRequestDueDate\(requestedAt\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(body)
  const fn = vm.runInNewContext(`${body.replace('export ', '')}\nprivacyRequestDueDate`)
  assert.equal(fn('2026-01-31T12:00:00Z').toISOString(), '2026-02-28T12:00:00.000Z')
  assert.equal(fn('2028-01-31T00:00:00Z').toISOString(), '2028-02-29T00:00:00.000Z')
})

test('export is owner-bound, approval-gated, and allow-listed', () => {
  const source = read('src/modules/hardening/privacyExport.service.js')
  for (const phrase of ["userId: ownerId", "requestType: 'access_export'", "status: 'completed'", "identityVerificationStatus: 'verified'", 'User.findById(ownerId)', 'ParentOrder.find({ ownerUserId: ownerId })']) {
    assert.ok(source.includes(phrase), phrase)
  }
  assert.doesNotMatch(source, /select\([^)]*(password|sessionToken|firebaseUid|paymentProviderReference|cardNumber)/i)
  const routes = read('src/modules/hardening/hardening.routes.js')
  assert.match(routes, /'\/requests\/:id\/download', requireRecentAuthentication/)
  assert.match(routes, /Cache-Control', 'no-store, private'/)
})

test('admin completion requires identity and action evidence; no blind deletion', () => {
  const service = read('src/modules/hardening/privacyOps.service.js')
  assert.match(service, /Identity must be verified/)
  assert.match(service, /Completion requires evidence reference/)
  assert.match(service, /Deletion completion requires/)
  assert.doesNotMatch(service, /deleteMany|findByIdAndDelete|deleteOne/)
})

test('Host and Customer pages reuse privacy component', () => {
  const routes = read('../frontend/src/routes/AppRoutes.jsx')
  assert.match(routes, /path="\/host\/privacy"/)
  assert.match(routes, /path="\/account\/privacy"/)
  const service = read('src/modules/hardening/hardening.routes.js')
  assert.match(service, /requireCustomerOrHostPrivacyAccess/)
})
