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

test('M3-B stores Razorpay Pro payment evidence separately from existing commerce orders', () => {
  const models = readBackend('src/modules/learning/learning.models.js')

  assert.match(models, /collection:\s*['"]proMembershipPayments['"]/) 
  assert.match(models, /providerOrderId/)
  assert.match(models, /providerPaymentId/)
  assert.match(models, /coverageStartAt/)
  assert.match(models, /coverageEndAt/)
  assert.match(models, /planLockUntil/)
  assert.match(models, /validityMonths/)
})

test('M3-B uses existing Razorpay provider, test mode, signature verification and captured payment confirmation', () => {
  const service = readBackend('src/modules/learning/learning.service.js')

  assert.match(service, /createRazorpayOrder/)
  assert.match(service, /verifyRazorpayCheckoutSignature/)
  assert.match(service, /fetchRazorpayPayment/)
  assert.match(service, /startsWith\(['"]rzp_test_['"]\)/)
  assert.match(service, /PRO_PAYMENT_TEST_MODE_ONLY/)
  assert.match(service, /providerPayment\.captured\s*!==\s*true/)
})

test('M3-B stacks a different plan after remaining membership validity and locks same-plan repurchase window', () => {
  const service = readBackend('src/modules/learning/learning.service.js')

  assert.match(service, /existingValidUntil\.getTime\(\)\s*>\s*now\.getTime\(\)/)
  assert.match(service, /coverageStartAt/)
  assert.match(service, /addCalendarMonths\([\s\S]*?coverageStartAt[\s\S]*?paymentInTransaction\.validityMonths/)
  assert.match(service, /PRO_PLAN_TEMPORARILY_LOCKED/)
  assert.match(service, /planLockUntil/)
  assert.match(service, /session\.withTransaction/)
})

test('M3-B protects checkout and verification behind Customer access and CSRF', () => {
  const routes = readBackend('src/modules/learning/learning.routes.js')

  const boundary = routes.indexOf('router.use(...customerSecurity)')
  const checkout = routes.indexOf("'/pro/plans/:planCode/checkout'")
  const verify = routes.indexOf("'/pro/payments/:paymentId/verify'")

  assert.ok(boundary >= 0)
  assert.ok(checkout > boundary)
  assert.ok(verify > boundary)
  assert.match(routes.slice(checkout, verify), /requireCsrfToken/)
  assert.match(routes.slice(verify), /requireCsrfToken/)
})

test('M3-B Pro membership unlocks protected learning while preserving CourseEntitlement compatibility', () => {
  const access = readBackend('src/modules/learning/learning.access.service.js')
  const dashboard = readBackend('src/modules/learning/learning.dashboard.service.js')
  const community = readBackend('src/modules/community/community.service.js')

  assert.match(access, /CourseEntitlement/)
  assert.match(access, /ProMembership/)
  assert.match(access, /'pro_membership'/)
  assert.match(access, /LEARNING_PRO_ACCESS_REQUIRED/)
  assert.match(dashboard, /ProMembership or CourseEntitlement/)
  assert.match(community, /PRO_OR_COURSE_ENTITLEMENT_REQUIRED/)
})

test('M3-B Learn page opens Razorpay test checkout, disables locked plan and refreshes membership after verification', () => {
  const page = readFrontend('src/features/community/pages/LearnProPage.jsx')
  const service = readFrontend('src/features/learning/services/learning.service.js')

  assert.match(page, /checkout\.razorpay\.com\/v1\/checkout\.js/)
  assert.match(page, /new window\.Razorpay/)
  assert.match(page, /planLocksByCode/)
  assert.match(page, /Already purchased/)
  assert.match(page, /verifyProMembershipPayment/)
  assert.match(page, /refreshProState/)
  assert.match(service, /\/learning\/pro\/plans\/\$\{encodePath\(planCode\)\}\/checkout/)
  assert.match(service, /\/learning\/pro\/payments\/\$\{encodePath\(paymentId\)\}\/verify/)
})
