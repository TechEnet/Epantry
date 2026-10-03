import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  fileURLToPath,
} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(backendRoot, '..')

function readBackend(relativePath) {
  return fs.readFileSync(
    path.join(backendRoot, relativePath),
    'utf8',
  )
}

function readFrontend(relativePath) {
  return fs.readFileSync(
    path.join(projectRoot, 'frontend', relativePath),
    'utf8',
  )
}

test('M3-C exposes Pro plan, membership and payment administration only through the Super Admin control plane', () => {
  const routes = readBackend('src/modules/admin/admin.routes.js')

  assert.match(routes, /['"]\/pro['"]/)
  assert.match(routes, /['"]\/pro\/memberships['"]/)
  assert.match(routes, /['"]\/pro\/payments['"]/)
  assert.match(routes, /['"]\/pro\/plans\/:planCode['"]/)
  assert.match(routes, /requirePrivilegedAccess\([\s\S]*?['"]super_admin['"][\s\S]*?\)/)
  assert.match(routes, /requireRecentPrivilegedAccess\([\s\S]*?['"]super_admin['"][\s\S]*?\)/)
  assert.match(routes, /requireCsrfToken/)
})

test('M3-C lets the EPANTRY owner edit future plan price, availability, description and benefit copy without rewriting paid membership dates', () => {
  const service = readBackend('src/modules/learning/learning.service.js')

  assert.match(service, /export async function updateAdminProPlan/)
  assert.match(service, /priceMinor/)
  assert.match(service, /shortDescription/)
  assert.match(service, /benefits/)
  assert.match(service, /isEnabled/)
  assert.match(service, /planChangesAffectFutureCheckoutsOnly/)
  assert.match(service, /existingPaidValidityIsPreserved/)
  assert.doesNotMatch(service, /updateAdminProPlan[\s\S]*?validUntil\s*=/)
})

test('M3-C disabling a plan blocks new checkout but does not invalidate an already-created Razorpay order during verification', () => {
  const service = readBackend('src/modules/learning/learning.service.js')

  assert.match(service, /createProMembershipCheckout[\s\S]*?isEnabled:\s*true/)
  assert.match(service, /verifyProMembershipPayment[\s\S]*?ProPlan\.findOne\(\{[\s\S]*?_id:\s*payment\.planId,[\s\S]*?code:\s*payment\.planCode,[\s\S]*?\}\)\.lean\(\)/)
})

test('M3-C Super Admin UI shows plan controls, membership states, payment history and test revenue', () => {
  const page = readFrontend('src/features/admin/pages/AdminProMembershipPage.jsx')
  const shell = readFrontend('src/features/admin/components/AdminShell.jsx')
  const routes = readFrontend('src/routes/AppRoutes.jsx')

  assert.match(page, /Plan configuration/)
  assert.match(page, /Customer Pro memberships/)
  assert.match(page, /Razorpay Pro transactions/)
  assert.match(page, /Verified test revenue/)
  assert.match(page, /Save plan/)
  assert.match(shell, /EPANTRY Pro/)
  assert.match(shell, /\/admin\/pro/)
  assert.match(routes, /path="\/admin\/pro"/)
  assert.match(routes, /AdminPermissionRoute rootOnly/)
})

test('M3-C Customer Learn page reflects Super Admin benefit copy while preserving existing Pro purchase flow', () => {
  const page = readFrontend('src/features/community/pages/LearnProPage.jsx')

  assert.match(page, /plan\.benefits/)
  assert.match(page, /Buy \$\{plan\.name\}/)
  assert.match(page, /verifyProMembershipPayment/)
  assert.match(page, /Already purchased/)
})
