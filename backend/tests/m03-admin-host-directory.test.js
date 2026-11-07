import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Dependency-free checks of the production query/filter code, using an
// in-memory User model rather than a live MongoDB or real account data.
const serviceSource = readFileSync(new URL('../src/modules/admin/adminManagement.service.js', import.meta.url), 'utf8')
const routesSource = readFileSync(new URL('../src/modules/admin/admin.routes.js', import.meta.url), 'utf8')
const controllerSource = readFileSync(new URL('../src/modules/admin/adminManagement.controller.js', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../../frontend/src/features/admin/pages/AdminRolesPage.jsx', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../../frontend/src/features/admin/services/admin.service.js', import.meta.url), 'utf8')

const start = serviceSource.indexOf('export function buildAdminAssignableHostFilter(')
assert.ok(start > 0, 'new filter export must exist')
const code = serviceSource.slice(start).replaceAll('export function ', 'function ').replaceAll('export async function ', 'async function ')

const users = Array.from({ length: 51 }, (_, i) => ({
  _id: `64b00000000000000000${String(i + 1).padStart(4, '0')}`,
  name: `Host ${String(i + 1).padStart(3, '0')}`,
  email: `host${i + 1}@example.com`,
  hostAccessStatus: i === 0 ? 'pending' : 'active',
  accountStatus: i === 1 ? 'suspended' : 'active',
  superAdminEnabled: false,
}))
users.push({ _id: '64b000000000000000009999', name: 'Only Customer', email: 'customer@example.com', hostAccessStatus: 'not_requested' })
users.push({ _id: '64b000000000000000008888', name: 'Root Admin', email: 'root@example.com', hostAccessStatus: 'active', superAdminEnabled: true })

const matches = (query, user) => {
  if (!query.hostAccessStatus.$in.includes(user.hostAccessStatus) || user.superAdminEnabled === true) return false
  if (!query.$or) return true
  return query.$or.some((entry) => Object.entries(entry).every(([field, pattern]) => pattern.test(user[field] || '')))
}
const User = {
  find(query) {
    let rows = users.filter((u) => matches(query, u))
    const chain = {
      sort() { rows.sort((a, b) => a.name.localeCompare(b.name) || a._id.localeCompare(b._id)); return chain },
      skip(n) { rows = rows.slice(n); return chain },
      limit(n) { rows = rows.slice(0, n); return chain },
      lean() { return Promise.resolve(rows) },
    }
    return chain
  },
  countDocuments(query) { return Promise.resolve(users.filter((u) => matches(query, u)).length) },
}
const context = vm.createContext({ User, RegExp, String, Number, Math, Promise })
vm.runInContext(code + '\nthis.__filter=buildAdminAssignableHostFilter;this.__list=listAdminAssignableHosts;', context)

test('Host directory includes Host lifecycle but excludes Customer-only and Super Admin', async () => {
  const result = await context.__list({ page: 1, limit: 25 })
  assert.equal(result.pagination.total, 51)
  assert.equal(result.hosts.length, 25)
  assert.equal(result.pagination.hasMore, true)
  assert.equal(result.hosts[0].name, 'Host 001')
  assert.equal(result.hosts[1].canAssign, false)
})

test('Host directory pages without silently truncating at first page', async () => {
  const result = await context.__list({ page: 3, limit: 25 })
  assert.equal(result.hosts.length, 1)
  assert.equal(result.pagination.hasMore, false)
})

test('Name/email search escapes regex metacharacters', async () => {
  const result = await context.__list({ search: 'host1@example.com' })
  assert.equal(result.hosts.length, 1)
  const injected = await context.__list({ search: '.*' })
  assert.equal(injected.hosts.length, 0)
})

test('Backend route is restricted to real Super Admin', () => {
  const pos = routesSource.indexOf("'/role-assignment/hosts'")
  assert.ok(pos > -1)
  const segment = routesSource.slice(pos, pos + 240)
  assert.match(segment, /requirePrivilegedAccess\('super_admin'\)/)
  assert.match(segment, /loadAdminAuthorization/)
  assert.match(controllerSource, /hostDirectoryQuerySchema/)
  assert.match(controllerSource, /\.max\(80\)/)
})

test('UI uses live directory and existing audited assignment handlers', () => {
  assert.match(clientSource, /\/admin\/role-assignment\/hosts/)
  for (const handler of ['useAdminUserRoleAssignment', 'grantUserRoles', 'updateUserRoles', 'revokeUserRoles', 'saveAssignment', 'revokeAssignment']) {
    assert.ok(pageSource.includes(handler), `${handler} was removed`)
  }
  assert.ok(!pageSource.includes('Paste user ID'))
  assert.ok(pageSource.includes('role="combobox"'))
  assert.ok(pageSource.includes('Show more Hosts'))
})
