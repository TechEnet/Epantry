import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const read = (name) => fs.readFileSync(path.join(root,name),'utf8')
test('Delete endpoint requires authentication, CSRF, and recent Super Admin access', () => {
 const s=read('src/modules/admin/admin.routes.js')
 assert.match(s,/router\.delete\([\s\S]*?'\/roles\/:roleId'[\s\S]*?requireCsrfToken[\s\S]*?requireRecentPrivilegedAccess\(\s*'super_admin'[\s\S]*?deleteAdminRoleController/)
})
test('Delete service protects system and assigned roles, preserves audit', () => {
 const s=read('src/modules/admin/adminManagement.service.js')
 const section=s.slice(s.indexOf('export async function deleteAdminRole('),s.indexOf('export async function updateAdminRole('))
 for (const x of ['ADMIN_SYSTEM_ROLE_IMMUTABLE','AdminAssignment.exists','ADMIN_ROLE_IN_USE','admin.role.delete','beforeSnapshot','recordAdminAuditEvent']) assert.ok(section.includes(x),x)
})
test('Audit registry recognizes role deletion',()=>{
 const s=read('src/modules/admin/adminAudit.registry.js')
 assert.ok(s.includes("'admin_role.deleted'"))
 assert.ok(s.includes("'admin.role.delete'"))
})

test('Host picker limits inline results, has Clay popup and scroll',()=>{
 const ui=read('../frontend/src/features/admin/pages/AdminRolesPage.jsx')
 for (const x of ['page: hostPage, limit: 10','hostTotal > 10','View all Hosts','max-height:278px','createPortal(','ep-hosts-modal-scrim','handleAllHostScroll','max-height:440px']) assert.ok(ui.includes(x),x)
})
test('New role is highlighted, scrolled to, and delete requires confirmation',()=>{
 const ui=read('../frontend/src/features/admin/pages/AdminRolesPage.jsx')
 for (const x of ['setCreatedRoleKey','scrollIntoView','setHighlightRoleKey','roles-new-highlight','setRoleToDelete(role)','confirmDeleteRole','roleToDelete ? createPortal']) assert.ok(ui.includes(x),x)
})
