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

test('M3-A adds an additive Pro plan catalog and Customer membership without creating a new application role', () => {
  const models = readBackend('src/modules/learning/learning.models.js')

  assert.match(models, /collection:\s*['"]proPlans['"]/) 
  assert.match(models, /collection:\s*['"]proMemberships['"]/) 
  assert.match(models, /'monthly'/)
  assert.match(models, /'quarterly'/)
  assert.match(models, /'half_year'/)
  assert.match(models, /'annual'/)
  assert.doesNotMatch(models, /creatorEnabled|proEnabled|applicationRole/) 
})

test('M3-A default plan catalog matches the locked test-mode prices and validity periods', () => {
  const service = readBackend('src/modules/learning/learning.service.js')

  for (const [code, priceMinor, validityMonths] of [
    ['monthly', '19900', '1'],
    ['quarterly', '49900', '3'],
    ['half_year', '89900', '6'],
    ['annual', '149900', '12'],
  ]) {
    assert.match(service, new RegExp(`code:\\s*['"]${code}['"][\\s\\S]*?priceMinor:\\s*${priceMinor}[\\s\\S]*?validityMonths:\\s*${validityMonths}`))
  }
})

test('M3-A public pricing stays visible without sign-in while membership state stays behind Customer access', () => {
  const routes = readBackend('src/modules/learning/learning.routes.js')

  const publicCatalogIndex = routes.indexOf("'/pro/catalog'")
  const customerBoundaryIndex = routes.indexOf('router.use(...customerSecurity)')
  const membershipIndex = routes.indexOf("'/pro/overview'")

  assert.ok(publicCatalogIndex >= 0)
  assert.ok(customerBoundaryIndex > publicCatalogIndex)
  assert.ok(membershipIndex > customerBoundaryIndex)
})

test('M3-A preserves existing course entitlement authority and learning progress', () => {
  const access = readBackend('src/modules/learning/learning.access.service.js')
  const models = readBackend('src/modules/community/community.models.js')

  assert.match(access, /CourseEntitlement/)
  assert.match(access, /findActiveCourseEntitlement/)
  assert.match(models, /collection:\s*['"]courseEntitlements['"]/) 
})

test('M3-A customer Learn page shows server-driven pricing and membership status without removing existing courses', () => {
  const page = readFrontend('src/features/community/pages/LearnProPage.jsx')
  const learningService = readFrontend('src/features/learning/services/learning.service.js')

  assert.match(page, /EPANTRY Pro membership/)
  assert.match(page, /proCatalog\?\.plans/)
  assert.match(page, /proOverview\?\.membership\?\.active/)
  assert.match(page, /listCreatorCourses/)
  assert.match(page, /CreatorProTransactionsPanel/)
  assert.match(learningService, /\/learning\/pro\/catalog/)
  assert.match(learningService, /\/learning\/pro\/overview/)
})
