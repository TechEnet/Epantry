import {
  CircleAlert,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import AdminShell from '../components/AdminShell'

import {
  useAdminPermissionCatalog,
  useAdminRoleManagementActions,
  useAdminRoles,
  useAdminUserRoleAssignment,
} from '../hooks/useAdminRoleManagement'

function getErrorMessage(error) {
  return (
    error?.message ||
    'Unable to complete this administrative request.'
  )
}

function getRoleKey(role) {
  return role?.key || role?.roleKey || ''
}

function getAssignmentRoleKeys(access) {
  const directKeys = access?.assignment?.roleKeys

  if (Array.isArray(directKeys)) {
    return directKeys.map(String)
  }

  const roles = access?.roles

  if (Array.isArray(roles)) {
    return roles.map(getRoleKey).filter(Boolean)
  }

  return []
}

const PERMISSION_LABELS = {
  'admin.dashboard.read': 'View admin dashboard',
  'admin.roles.read': 'View admin roles',
  'admin.roles.manage': 'Manage admin roles',
  'admin.assignments.read': 'View admin access',
  'admin.assignments.manage': 'Change admin access',
  'admin.audit.read': 'View audit history',
  'host.review.read': 'View Host reviews',
  'host.review.approve': 'Approve Hosts',
  'host.review.reject': 'Reject Host applications',
  'host.review.suspend': 'Suspend Host access',
  'catalog.read': 'View product catalog',
  'catalog.mutate': 'Edit product catalog',
  'catalog.publish': 'Publish products',
  'recipe.read': 'View recipes',
  'recipe.mutate': 'Edit recipes',
  'recipe.publish': 'Publish recipes',
  'marketplace.read': 'View marketplace operations',
  'marketplace.mutate': 'Manage marketplace operations',
  'trust_safety.read': 'View trust & safety',
  'trust_safety.mutate': 'Manage trust & safety',
  'finance.read': 'View finance',
  'finance.mutate': 'Manage finance',
  'cms.read': 'View site content',
  'cms.mutate': 'Edit site content',
  'cms.publish': 'Publish site content',
}

const PERMISSION_GROUPS = [
  { id: 'admin', label: 'Admin access', prefixes: ['admin.'] },
  { id: 'hosts', label: 'Hosts', prefixes: ['host.'] },
  { id: 'catalog', label: 'Catalog', prefixes: ['catalog.'] },
  { id: 'recipes', label: 'Recipes', prefixes: ['recipe.'] },
  { id: 'marketplace', label: 'Marketplace', prefixes: ['marketplace.'] },
  { id: 'finance', label: 'Finance', prefixes: ['finance.'] },
  { id: 'content', label: 'Content', prefixes: ['cms.'] },
  { id: 'safety', label: 'Trust & safety', prefixes: ['trust_safety.'] },
]

function titleizePermission(permissionKey) {
  const known = PERMISSION_LABELS[permissionKey]

  if (known) {
    return known
  }

  return String(permissionKey || '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getPermissionKey(permission) {
  return (
    permission?.key ||
    permission?.permissionKey ||
    String(permission || '')
  )
}

function getPermissionGroup(permissionKey) {
  return (
    PERMISSION_GROUPS.find((group) =>
      group.prefixes.some((prefix) =>
        String(permissionKey || '').startsWith(prefix),
      ),
    ) || {
      id: 'other',
      label: 'Other access',
    }
  )
}

const STEPS = [
  {
    number: '01',
    title: 'Review existing access',
    text: 'Start with an EPANTRY role that already matches the job.',
    mobileText: 'Start with a role that already fits.',
    href: '#role-library',
  },
  {
    number: '02',
    title: 'Create only if needed',
    text: 'Build a focused role only when the ready-made access is not enough.',
    mobileText: 'Create one only when standard access falls short.',
    href: '#create-role',
  },
  {
    number: '03',
    title: 'Give access to a person',
    text: 'Find the user and choose the admin role they actually need.',
    mobileText: 'Assign only the role the person actually needs.',
    href: '#assign-access',
  },
  {
    number: '04',
    title: 'Verify the change',
    text: 'Open the audit history after an important access change.',
    mobileText: 'Check audit history after the change.',
    to: '/admin/audit',
  },
]

function SectionTitle({ eyebrow, title, text, aside }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-3 sm:pb-4">
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-700 sm:text-[10px]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[16px] font-black tracking-[-0.025em] text-stone-950 sm:text-[22px]">
          {title}
        </h2>
        {text ? (
          <p className="mt-1 max-w-3xl text-[10px] font-medium leading-4 text-stone-500 sm:text-[12px] sm:leading-5">
            {text}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  )
}

export default function AdminRolesPage() {
  const {
    permissions,
    isLoading: isLoadingPermissions,
  } = useAdminPermissionCatalog()

  const {
    roles,
    isLoading: isLoadingRoles,
    error: rolesError,
  } = useAdminRoles()

  const {
    createRole,
    disableRole,
    grantUserRoles,
    updateUserRoles,
    revokeUserRoles,
    isMutatingAdminControlPlane,
  } = useAdminRoleManagementActions()

  const [roleForm, setRoleForm] = useState({
    key: '',
    name: '',
    description: '',
    permissionKeys: [],
  })

  const [createError, setCreateError] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleKeys, setSelectedRoleKeys] = useState([])
  const [assignmentError, setAssignmentError] = useState('')

  const {
    access: userAccess,
    assignment,
    isLoading: isLoadingAssignment,
    error: assignmentLoadError,
  } = useAdminUserRoleAssignment(selectedUserId)

  useEffect(() => {
    if (!userAccess) {
      return
    }

    setSelectedRoleKeys(getAssignmentRoleKeys(userAccess))
  }, [userAccess])

  const delegablePermissions = useMemo(
    () => permissions.filter((permission) => permission?.delegable !== false),
    [permissions],
  )

  const groupedPermissions = useMemo(() => {
    const groups = new Map()

    delegablePermissions.forEach((permission) => {
      const permissionKey = getPermissionKey(permission)
      const group = getPermissionGroup(permissionKey)

      if (!groups.has(group.id)) {
        groups.set(group.id, {
          ...group,
          permissions: [],
        })
      }

      groups.get(group.id).permissions.push(permission)
    })

    return Array.from(groups.values())
  }, [delegablePermissions])

  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role?.status !== 'disabled' &&
          getRoleKey(role) !== 'root_super_admin',
      ),
    [roles],
  )

  const togglePermission = (permissionKey) => {
    setRoleForm((current) => ({
      ...current,
      permissionKeys: current.permissionKeys.includes(permissionKey)
        ? current.permissionKeys.filter((key) => key !== permissionKey)
        : [...current.permissionKeys, permissionKey],
    }))
  }

  const toggleRole = (roleKey) => {
    setSelectedRoleKeys((current) =>
      current.includes(roleKey)
        ? current.filter((key) => key !== roleKey)
        : [...current, roleKey],
    )
  }

  const submitNewRole = async (event) => {
    event.preventDefault()
    setCreateError('')

    try {
      await createRole({
        ...roleForm,
        reasonDetails: 'Created through EPANTRY Roles & Permissions interface.',
      })

      setRoleForm({
        key: '',
        name: '',
        description: '',
        permissionKeys: [],
      })
    } catch (error) {
      setCreateError(getErrorMessage(error))
    }
  }

  const lookupUser = (event) => {
    event.preventDefault()
    const normalized = userIdInput.trim()

    if (!normalized) {
      return
    }

    setAssignmentError('')
    setSelectedUserId(normalized)
  }

  const saveAssignment = async () => {
    if (!selectedUserId) {
      return
    }

    setAssignmentError('')

    try {
      if (assignment) {
        await updateUserRoles({
          userId: selectedUserId,
          roleKeys: selectedRoleKeys,
          reasonDetails: 'Updated through EPANTRY Roles & Permissions interface.',
        })
      } else {
        await grantUserRoles({
          userId: selectedUserId,
          roleKeys: selectedRoleKeys,
          reasonDetails: 'Granted through EPANTRY Roles & Permissions interface.',
        })
      }
    } catch (error) {
      setAssignmentError(getErrorMessage(error))
    }
  }

  const revokeAssignment = async () => {
    if (!selectedUserId) {
      return
    }

    setAssignmentError('')

    try {
      await revokeUserRoles({
        userId: selectedUserId,
        reasonDetails: 'Revoked through EPANTRY Roles & Permissions interface.',
      })

      setSelectedRoleKeys([])
    } catch (error) {
      setAssignmentError(getErrorMessage(error))
    }
  }

  return (
    <AdminShell
      title="Roles & Permissions"
      description="Decide which internal admin tools each team member can use without changing their Customer or Host account."
      flushTop
    >
      {rolesError ? (
        <div className="mb-5 flex items-start gap-3 border-y border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          {getErrorMessage(rolesError)}
        </div>
      ) : null}

      {/* ACCESS OVERVIEW */}
      <section className="overflow-hidden bg-[#103E36] text-white">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="px-4 py-5 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200 sm:text-[11px] sm:tracking-[0.18em]">
              Admin access control
            </p>
            <h2 className="mt-2 max-w-3xl text-[23px] font-black leading-[1.04] tracking-[-0.035em] sm:mt-3 sm:text-[40px] sm:leading-[1.02] sm:tracking-[-0.04em] lg:text-[46px]">
              Roles should make responsibility clear, not complicated.
            </h2>
            <p className="mt-2 max-w-2xl text-[12px] font-medium leading-[1.45] text-white/72 sm:hidden">
              Reuse a standard role, create only when needed, assign it, then verify the change.
            </p>
            <p className="mt-4 hidden max-w-2xl text-[15px] font-medium leading-6 text-white/72 sm:block">
              Reuse an existing role first, create a focused role only when necessary, then assign it to the right person and verify the change.
            </p>
          </div>

          <div className="border-t border-white/12 px-4 py-3.5 sm:px-8 sm:py-5 lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/50 sm:text-[10px] sm:tracking-[0.18em]">
              Active role library
            </p>
            <div className="mt-1.5 flex items-end gap-2 sm:mt-3 sm:gap-3 lg:block">
              <p className="text-[36px] font-black leading-none tracking-[-0.05em] text-emerald-200 sm:text-[58px]">
                {roles.length}
              </p>
              <p className="pb-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/55 sm:pb-1 sm:text-[11px] sm:tracking-[0.14em] lg:mt-2 lg:pb-0">
                roles available
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-white/12 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const body = (
              <div className={`group px-3 py-3 transition hover:bg-white/[0.045] sm:min-h-[126px] sm:px-5 sm:py-5 ${index % 2 === 0 ? 'border-r border-white/10' : ''} ${index < 2 ? 'border-b border-white/10 lg:border-b-0' : ''} ${index > 0 ? 'lg:border-l lg:border-white/10' : ''} lg:border-r-0`}>
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <span className="text-[9px] font-black tracking-[0.14em] text-emerald-200 sm:text-[11px] sm:tracking-[0.16em]">
                    {step.number}
                  </span>
                  <span className="text-sm text-white/30 transition group-hover:translate-x-1 group-hover:text-emerald-200 sm:text-base">→</span>
                </div>
                <h3 className="mt-1.5 text-[12px] font-black leading-4 text-white sm:mt-3 sm:text-[15px] sm:leading-5">
                  {step.title}
                </h3>
                <p className="mt-1 text-[10px] font-medium leading-4 text-white/58 sm:hidden">
                  {step.mobileText}
                </p>
                <p className="mt-1.5 hidden text-[12px] font-medium leading-5 text-white/58 sm:block">
                  {step.text}
                </p>
              </div>
            )

            return step.to ? (
              <Link key={step.number} to={step.to} className="focus-ring block">
                {body}
              </Link>
            ) : (
              <a key={step.number} href={step.href} className="focus-ring block">
                {body}
              </a>
            )
          })}
        </div>
      </section>

      {/* ROLE LIBRARY */}
      <section id="role-library" className="scroll-mt-24 bg-[#F7F6F1] px-4 py-5 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="grid gap-4 sm:gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#176B57]">01 · Role library</p>
            <h2 className="mt-1.5 text-[21px] font-black leading-[1.08] tracking-[-0.03em] text-stone-950 sm:mt-2 sm:text-[30px]">
              Start with what already exists.
            </h2>
            <p className="mt-1.5 text-[12px] font-medium leading-[1.45] text-stone-600 sm:hidden">
              Use standard roles first. They are easier to review and maintain.
            </p>
            <p className="mt-3 hidden text-[14px] font-medium leading-6 text-stone-600 sm:block">
              Standard roles are easier to understand, audit and maintain than one-off access bundles.
            </p>
          </div>

          <div className="border-t-2 border-stone-900/80">
            <div className="hidden grid-cols-[minmax(190px,0.75fr)_minmax(0,1.7fr)_auto] gap-6 border-b border-stone-300 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-stone-400 sm:grid">
              <span>Role</span>
              <span>Included access</span>
              <span>Action</span>
            </div>

            {isLoadingRoles ? (
              <div className="grid min-h-40 place-items-center border-b border-stone-300">
                <LoaderCircle size={26} className="animate-spin text-[#176B57]" />
              </div>
            ) : (
              roles.map((role, index) => {
                const roleKey = getRoleKey(role)
                const isSystem = role?.isSystem === true || role?.system === true
                const rolePermissions = role.permissionKeys || []

                return (
                  <article
                    key={role.id || roleKey}
                    className="group relative grid gap-2.5 border-b border-stone-300 py-3.5 transition hover:bg-white/70 sm:grid-cols-[minmax(190px,0.75fr)_minmax(0,1.7fr)_auto] sm:items-start sm:gap-6 sm:py-6"
                  >
                    <span className="absolute inset-y-0 left-0 w-[3px] origin-y scale-y-0 bg-[#176B57] transition duration-200 group-hover:scale-y-100" />

                    <div className="min-w-0 sm:pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-[14px] font-black text-stone-950 sm:text-[16px]">
                          {role.name || roleKey}
                        </h3>
                        {isSystem ? (
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#176B57]">
                            EPANTRY
                          </span>
                        ) : null}
                        {role.status === 'disabled' ? (
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-red-600">
                            Disabled
                          </span>
                        ) : null}
                      </div>
                      {role.description ? (
                        <p className="mt-1 text-[11px] font-medium leading-4 text-stone-600 sm:mt-2 sm:text-[13px] sm:leading-5">
                          {role.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0 sm:border-l sm:border-stone-200 sm:pl-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400 sm:hidden">
                        Included access
                      </p>
                      <div className="mt-1.5 grid grid-cols-1 gap-y-1 sm:hidden">
                        {rolePermissions.length ? (
                          rolePermissions.slice(0, 4).map((permission) => (
                            <span key={permission} className="text-[10px] font-semibold leading-4 text-stone-600 before:mr-1.5 before:text-[#176B57] before:content-['•']">
                              {titleizePermission(permission)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-medium text-stone-400">No delegated admin tools</span>
                        )}
                      </div>
                      <div className="mt-0 hidden gap-x-5 gap-y-1.5 sm:grid sm:grid-cols-2 xl:grid-cols-3">
                        {rolePermissions.length ? (
                          rolePermissions.slice(0, 9).map((permission) => (
                            <span key={permission} className="text-[12px] font-semibold leading-5 text-stone-600 before:mr-1.5 before:text-[#176B57] before:content-['•']">
                              {titleizePermission(permission)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] font-medium text-stone-400">No delegated admin tools</span>
                        )}
                      </div>
                      {rolePermissions.length > 4 ? (
                        <p className="mt-1 text-[10px] font-black text-[#176B57] sm:hidden">+{rolePermissions.length - 4} more</p>
                      ) : null}
                      {rolePermissions.length > 9 ? (
                        <p className="mt-2 hidden text-[11px] font-black text-[#176B57] sm:block">+{rolePermissions.length - 9} more</p>
                      ) : null}
                    </div>

                    {!isSystem && role.status !== 'disabled' ? (
                      <button
                        type="button"
                        disabled={isMutatingAdminControlPlane}
                        onClick={async () => {
                          try {
                            await disableRole({
                              roleId: role.id,
                              reasonDetails: 'Disabled through EPANTRY Roles & Permissions interface.',
                            })
                          } catch (error) {
                            setCreateError(getErrorMessage(error))
                          }
                        }}
                        className="focus-ring absolute right-0 top-5 text-stone-300 transition hover:text-red-700 disabled:opacity-40 sm:static"
                        aria-label={`Disable ${role.name || roleKey}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : null}
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* CUSTOM ROLE BUILDER */}
      <section id="create-role" className="scroll-mt-24 bg-[#DFF1E9]">
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="bg-[#176B57] px-4 py-5 text-white sm:px-8 sm:py-9 lg:px-9 lg:py-11">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">02 · Custom role</p>
            <h2 className="mt-1.5 text-[21px] font-black leading-[1.08] tracking-[-0.03em] sm:mt-3 sm:text-[31px]">
              Build only the access the job needs.
            </h2>
            <p className="mt-1.5 text-[12px] font-medium leading-[1.45] text-white/72 sm:hidden">
              Create a custom role only when standard roles do not fit.
            </p>
            <p className="mt-3 hidden text-[14px] font-medium leading-6 text-white/72 sm:block">
              Use this only when the ready-made roles do not match the responsibility clearly enough.
            </p>
            <div className="mt-3 border-t border-white/18 pt-2.5 text-[10px] font-semibold leading-4 text-white/65 sm:hidden">
              Keep access narrow; expand it only when the job needs more.
            </div>
            <div className="mt-7 hidden border-t border-white/18 pt-4 text-[12px] font-semibold leading-5 text-white/65 sm:block">
              Keep access narrow. Add more later only when the role truly needs it.
            </div>
          </div>

          <form onSubmit={submitNewRole} className="px-4 py-5 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-7">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.13em] text-stone-600">Internal role ID</span>
                <input
                  required
                  value={roleForm.key}
                  onChange={(event) => setRoleForm((current) => ({ ...current, key: event.target.value }))}
                  placeholder="operations_support"
                  className="focus-ring mt-1.5 w-full border-0 border-b border-emerald-900/30 bg-transparent px-0 py-2 text-[14px] font-semibold text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-[#176B57] sm:mt-2 sm:py-3 sm:text-[15px]"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.13em] text-stone-600">Role name</span>
                <input
                  required
                  value={roleForm.name}
                  onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Operations Support"
                  className="focus-ring mt-1.5 w-full border-0 border-b border-emerald-900/30 bg-transparent px-0 py-2 text-[14px] font-semibold text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-[#176B57] sm:mt-2 sm:py-3 sm:text-[15px]"
                />
              </label>
            </div>

            <label className="mt-3.5 block sm:mt-7">
              <span className="text-[11px] font-black uppercase tracking-[0.13em] text-stone-600">Purpose</span>
              <textarea
                value={roleForm.description}
                onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                placeholder="Example: Handles routine Host support without finance or publishing access."
                className="focus-ring mt-1.5 w-full resize-none border-0 border-b border-emerald-900/30 bg-transparent px-0 py-2 text-[13px] font-medium leading-5 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-[#176B57] sm:mt-2 sm:py-3 sm:text-[14px] sm:leading-6"
              />
            </label>

            <div className="mt-4 sm:mt-9">
              <div className="flex items-end justify-between gap-3 border-b border-emerald-900/20 pb-2 sm:gap-4 sm:pb-3">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.13em] text-stone-800">Access matrix</p>
                  <p className="mt-1 text-[12px] font-medium text-stone-600">Only permissions safe to delegate are listed here.</p>
                </div>
                <span className="shrink-0 text-[11px] font-black text-[#176B57]">{roleForm.permissionKeys.length} selected</span>
              </div>

              {isLoadingPermissions ? (
                <LoaderCircle size={22} className="mt-5 animate-spin text-[#176B57]" />
              ) : (
                <div className="max-h-[330px] overflow-y-auto pr-1 sm:max-h-[520px]">
                  {groupedPermissions.map((group) => (
                    <div key={group.id} className="grid gap-2 border-b border-emerald-900/10 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6 sm:py-5">
                      <div className="flex items-center justify-between sm:block">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-stone-800">{group.label}</h3>
                        <span className="text-[10px] font-semibold text-stone-500 sm:mt-1 sm:block">{group.permissions.length} options</span>
                      </div>

                      <div className="grid gap-x-7 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                        {group.permissions.map((permission) => {
                          const permissionKey = getPermissionKey(permission)
                          const selected = roleForm.permissionKeys.includes(permissionKey)

                          return (
                            <label key={permissionKey} className="group/perm flex cursor-pointer items-start gap-2 py-1 sm:gap-2.5 sm:py-1.5">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => togglePermission(permissionKey)}
                                className="mt-1 accent-[#176B57]"
                              />
                              <span className="min-w-0">
                                <span className={`block text-[12px] font-black leading-5 transition ${selected ? 'text-[#125B4A]' : 'text-stone-700 group-hover/perm:text-stone-950'}`}>
                                  {titleizePermission(permissionKey)}
                                </span>
                                {permission.description ? (
                                  <span className="mt-0.5 hidden text-[11px] leading-4 text-stone-500 xl:block">{permission.description}</span>
                                ) : null}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {createError ? (
              <p className="mt-5 border-l-2 border-red-500 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{createError}</p>
            ) : null}

            <div className="mt-4 flex justify-end border-t border-emerald-900/20 pt-3.5 sm:mt-8 sm:pt-5">
              <button
                type="submit"
                disabled={isMutatingAdminControlPlane}
                className="focus-ring inline-flex w-full items-center justify-center gap-2 bg-[#103E36] px-4 py-2.5 text-[13px] font-black text-white transition hover:bg-[#0B302A] disabled:opacity-50 sm:w-auto sm:px-5 sm:py-3 sm:text-[14px]"
              >
                {isMutatingAdminControlPlane ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}
                Create admin role
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ASSIGN ACCESS */}
      <section id="assign-access" className="scroll-mt-24 bg-[#E7F0F8] px-4 py-5 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="grid gap-4 sm:gap-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#245D87]">03 · Assign access</p>
            <h2 className="mt-1.5 text-[21px] font-black leading-[1.08] tracking-[-0.03em] text-stone-950 sm:mt-2 sm:text-[30px]">
              Match the person to the responsibility.
            </h2>
            <p className="mt-1.5 text-[12px] font-medium leading-[1.45] text-stone-600 sm:hidden">
              Admin access is added to the existing Customer or Host account.
            </p>
            <p className="mt-3 hidden text-[14px] font-medium leading-6 text-stone-600 sm:block">
              Admin access sits alongside their existing Customer or Host account; it does not replace it.
            </p>
          </div>

          <div className="border-t-2 border-[#245D87]/70 pt-3.5 sm:pt-5">
            <form onSubmit={lookupUser} className="flex items-end gap-3">
              <label className="min-w-0 flex-1">
                <span className="text-[11px] font-black uppercase tracking-[0.13em] text-stone-600">EPANTRY user ID</span>
                <input
                  value={userIdInput}
                  onChange={(event) => setUserIdInput(event.target.value)}
                  placeholder="Paste user ID"
                  className="focus-ring mt-1.5 w-full border-0 border-b border-stone-400 bg-transparent px-0 py-2 text-[14px] font-semibold outline-none transition placeholder:text-stone-400 focus:border-[#245D87] sm:mt-2 sm:py-3 sm:text-[15px]"
                />
              </label>
              <button type="submit" className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 bg-[#173A56] px-3.5 py-2.5 text-[12px] font-black text-white sm:px-5 sm:py-3 sm:text-[14px]">
                <Search size={16} />
                <span className="hidden sm:inline">Find user</span>
                <span className="sm:hidden">Find</span>
              </button>
            </form>

            {selectedUserId ? (
              <div className="pt-4 sm:pt-8">
                {isLoadingAssignment ? (
                  <div className="py-9 text-center"><LoaderCircle size={24} className="mx-auto animate-spin text-[#245D87]" /></div>
                ) : assignmentLoadError ? (
                  <p className="border-l-2 border-red-500 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{getErrorMessage(assignmentLoadError)}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-[#245D87]/20 pb-3 sm:gap-4 sm:pb-4">
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={18} className="text-[#245D87]" />
                        <div>
                          <p className="text-[15px] font-black text-stone-950">Choose the admin role</p>
                          <p className="mt-0.5 text-[12px] font-medium text-stone-500">Select only what this person needs.</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">{selectedRoleKeys.length} selected</span>
                    </div>

                    <div className="border-b border-[#245D87]/20">
                      {assignableRoles.map((role) => {
                        const roleKey = getRoleKey(role)
                        const selected = selectedRoleKeys.includes(roleKey)
                        return (
                          <label key={roleKey} className={`group/role grid cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[#245D87]/12 px-1 py-2.5 transition last:border-b-0 sm:grid-cols-[30px_220px_minmax(0,1fr)_auto] sm:gap-4 sm:px-2 sm:py-4 ${selected ? 'bg-white/55' : 'hover:bg-white/45'}`}>
                            <input type="checkbox" checked={selected} onChange={() => toggleRole(roleKey)} className="accent-[#245D87]" />
                            <span className="text-[13px] font-black leading-5 text-stone-900 sm:text-[14px]">{role.name || roleKey}</span>
                            <span className="hidden truncate text-[12px] leading-5 text-stone-600 sm:block">{role.description || 'Admin access role'}</span>
                            <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${selected ? 'text-[#245D87]' : 'text-stone-400'}`}>{selected ? 'Selected' : 'Add'}</span>
                          </label>
                        )
                      })}
                    </div>

                    {assignmentError ? (
                      <p className="mt-5 border-l-2 border-red-500 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{assignmentError}</p>
                    ) : null}

                    <div className="mt-3.5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3">
                      <button
                        type="button"
                        onClick={saveAssignment}
                        disabled={isMutatingAdminControlPlane || selectedRoleKeys.length === 0}
                        className="focus-ring inline-flex flex-1 items-center justify-center gap-2 bg-[#173A56] px-3.5 py-2.5 text-[12px] font-black text-white disabled:opacity-40 sm:flex-none sm:px-4 sm:py-3 sm:text-[14px]"
                      >
                        {isMutatingAdminControlPlane ? <LoaderCircle size={16} className="animate-spin" /> : null}
                        {assignment ? 'Save role changes' : 'Grant admin access'}
                      </button>
                      {assignment ? (
                        <button
                          type="button"
                          onClick={revokeAssignment}
                          disabled={isMutatingAdminControlPlane}
                          className="focus-ring flex-1 border border-red-300 bg-white/60 px-3.5 py-2.5 text-[12px] font-black text-red-700 hover:bg-red-50 disabled:opacity-40 sm:flex-none sm:px-4 sm:py-3 sm:text-[14px]"
                        >
                          Remove admin access
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* AUDIT EXIT */}
      <section className="bg-[#173A56] px-4 py-4 text-white sm:px-8 sm:py-6 lg:px-10">
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">04 · Verify</p>
            <p className="mt-1 text-[12px] font-black leading-4 text-white sm:mt-1.5 sm:text-[15px] sm:leading-5">Important access changes should end in the audit history.</p>
          </div>
          <Link to="/admin/audit" className="focus-ring shrink-0 border-b border-sky-200 pb-1 text-[11px] font-black text-sky-100 transition hover:text-white sm:text-[12px]">
            Open audit history →
          </Link>
        </div>
      </section>
    </AdminShell>
  )
}
