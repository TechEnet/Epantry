import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('R3 customer dashboard and workspace are routed behind Customer access', () => {
  const routes = read('frontend/src/routes/AppRoutes.jsx')

  assert.match(routes, /path="\/dashboard"/)
  assert.match(routes, /<CustomerShell>/)
  assert.match(routes, /<CustomerDashboardPage \/>/)
  assert.match(routes, /APPLICATION_ACCESS_TYPES\.CUSTOMER/)
})

test('R3 navbar exposes Customer-Host mode switching and notification bell', () => {
  const navbar = read('frontend/src/components/layout/Navbar.jsx')
  const switcher = read('frontend/src/features/auth/components/ModeSwitcher.jsx')

  assert.match(navbar, /<ModeSwitcher compact \/>/)
  assert.match(navbar, /<NotificationBell compact \/>/)
  assert.match(navbar, /customerEnabled/)
  assert.match(navbar, /activeMode === 'host'/)
  assert.match(switcher, /await switchMode\(targetMode\)/)
  assert.match(switcher, /'\/host\/operations'/)
  assert.match(switcher, /'\/dashboard'/)
})

test('R3 notification center is available to every authenticated active identity', () => {
  const routes = read('frontend/src/routes/AppRoutes.jsx')
  const backendRoutes = read('backend/src/modules/notifications/notification.routes.js')

  assert.match(routes, /path="\/notifications"[\s\S]*?<AuthenticatedRoute>/)
  assert.match(backendRoutes, /customerEnabled ===/)
  assert.match(backendRoutes, /superAdminEnabled ===/)
})

test('R3 Host business profile is a Host sidebar route', () => {
  const shell = read('frontend/src/features/host/components/HostShell.jsx')
  const routes = read('frontend/src/routes/AppRoutes.jsx')

  assert.match(shell, /Business Profile/)
  assert.match(shell, /\/host\/business-profile/)
  assert.match(routes, /path="\/host\/business-profile"/)
  assert.match(routes, /<HostBusinessProfilePage \/>/)
})

test('R3 Host self-declaration notifies active Super Admin identities', () => {
  const service = read('backend/src/modules/hostOperations/hostOperations.service.js')
  const notificationModels = read('backend/src/modules/notifications/notification.models.js')

  assert.match(service, /superAdminEnabled:\s*true/)
  assert.match(service, /accountStatus:\s*'active'/)
  assert.match(service, /createNotificationIntentBestEffort/)
  assert.match(service, /host_commercial_profile_request/)
  assert.match(service, /organization\.organizationType =/)
  assert.match(notificationModels, /'operations'/)
  assert.match(notificationModels, /'host_commercial_profile_request'/)
})
