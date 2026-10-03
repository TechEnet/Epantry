import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

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

test('M4-A adds a dedicated approved Chef + Restaurant Host authorization gate', () => {
  const authorization = readBackend('src/modules/auth/authorization.middleware.js')

  assert.match(authorization, /export function requireChefRestaurantHostAccess/)
  assert.match(authorization, /hostWorkspaceType/)
  assert.match(authorization, /chef_restaurant/)
  assert.match(authorization, /AUTH_CHEF_RESTAURANT_HOST_REQUIRED/)
})

test('M4-A moves Creator profile, verification and course creation away from generic Customer authorization', () => {
  const routes = readBackend('src/modules/community/community.routes.js')
  const service = readBackend('src/modules/community/community.service.js')

  assert.match(routes, /const creatorHostSecurity = \[/)
  assert.match(routes, /['"]\/me\/creator-profile['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(routes, /['"]\/creators\/profile\/courses['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(routes, /['"]\/creators\/profile['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(routes, /['"]\/creators\/profile\/request-verification['"][\s\S]*?\.\.\.creatorHostSecurity/)

  assert.match(service, /function requireChefRestaurantHostCapability/)
  assert.match(service, /createCreatorProfile[\s\S]*?requireChefRestaurantHostCapability/)
  assert.match(service, /requestCreatorVerification[\s\S]*?requireChefRestaurantHostCapability/)
  assert.match(service, /getMyCreatorProfile[\s\S]*?requireChefRestaurantHostCapability/)
  assert.match(service, /createCreatorCourse[\s\S]*?requireChefRestaurantHostCapability/)
})

test('M4-A keeps Customer learning and booking access separate from Host Creator authoring', () => {
  const learningRoutes = readBackend('src/modules/learning/learning.routes.js')
  const executionRoutes = readBackend('src/modules/expansionExecution/expansionExecution.routes.js')

  assert.match(learningRoutes, /const creatorHostSecurity = \[/)
  assert.match(learningRoutes, /['"]\/creator\/courses\/:courseId\/curriculum['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(learningRoutes, /router\.use\(\.\.\.customerSecurity\)/)

  assert.match(executionRoutes, /['"]\/creator-sessions\/mine['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(executionRoutes, /router\.post\([\s\S]*?['"]\/creator-sessions['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(executionRoutes, /['"]\/creator-sessions\/:sessionId\/publish['"][\s\S]*?\.\.\.creatorHostSecurity/)
  assert.match(executionRoutes, /['"]\/creator-sessions\/:sessionId\/book['"][\s\S]*?\.\.\.customerSecurity/)
  assert.match(executionRoutes, /['"]\/creator-bookings\/mine['"][\s\S]*?\.\.\.customerSecurity/)
})

test('M4-A exposes Creator Studio only inside the Chef + Restaurant Host workspace and preserves old links as redirects', () => {
  const config = readFrontend('src/features/host/hostWorkspace.config.js')
  const shell = readFrontend('src/features/host/components/HostShell.jsx')
  const dashboard = readFrontend('src/features/host/pages/HostDashboardPage.jsx')
  const routes = readFrontend('src/routes/AppRoutes.jsx')

  assert.match(config, /['"]\/host\/creator-studio['"]/)
  assert.match(config, /isNewCreatorWorkspace/)
  assert.match(shell, /Creator Studio/)
  assert.match(shell, /['"]\/host\/creator-studio['"]/)
  assert.match(dashboard, /['"]\/host\/creator-studio['"]/)
  assert.match(routes, /path="\/host\/creator-studio"/)
  assert.match(routes, /path="\/host\/creator-studio\/courses\/:courseId"/)
  assert.match(routes, /path="\/creator-studio"[\s\S]*?to="\/host\/creator-studio"/)
})

test('M4-A keeps Customer live-class booking on Learn while moving Creator live-session management into Host Creator Studio', () => {
  const learn = readFrontend('src/features/community/pages/LearnProPage.jsx')
  const creator = readFrontend('src/features/community/pages/CreatorProfilePage.jsx')
  const panel = readFrontend('src/features/expansionExecution/components/CreatorProTransactionsPanel.jsx')

  assert.match(learn, /CreatorProTransactionsPanel mode="customer"/)
  assert.match(creator, /CreatorProTransactionsPanel mode="creator"/)
  assert.match(creator, /Chef \+ Restaurant Host workspace/)
  assert.match(panel, /mode = ['"]customer['"]/)
  assert.match(panel, /creatorMode/)
  assert.match(panel, /Plan and manage your live classes/)
  assert.match(panel, /Browse governed classes/)
})
