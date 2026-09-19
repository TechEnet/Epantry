import {
  CircleAlert,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import AdminShell from '../components/AdminShell'

import {
  useAdminPermissionCatalog,
  useAdminRoleManagementActions,
  useAdminRoles,
  useAdminUserRoleAssignment,
} from '../hooks/useAdminRoleManagement'

function getErrorMessage(
  error,
) {
  return (
    error?.message ||
    'Unable to complete this administrative request.'
  )
}

function getRoleKey(
  role,
) {
  return (
    role?.key ||
    role?.roleKey ||
    ''
  )
}

function getAssignmentRoleKeys(
  access,
) {
  const directKeys =
    access?.assignment
      ?.roleKeys

  if (
    Array.isArray(
      directKeys,
    )
  ) {
    return directKeys.map(
      String,
    )
  }

  const roles =
    access?.roles

  if (
    Array.isArray(
      roles,
    )
  ) {
    return roles
      .map(
        getRoleKey,
      )
      .filter(Boolean)
  }

  return []
}

export default function AdminRolesPage() {
  const {
    permissions,
    isLoading:
      isLoadingPermissions,
  } =
    useAdminPermissionCatalog()

  const {
    roles,
    isLoading:
      isLoadingRoles,
    error:
      rolesError,
  } =
    useAdminRoles()

  const {
    createRole,
    disableRole,

    grantUserRoles,
    updateUserRoles,
    revokeUserRoles,

    isMutatingAdminControlPlane,
  } =
    useAdminRoleManagementActions()

  const [
    roleForm,
    setRoleForm,
  ] = useState({
    key:
      '',

    name:
      '',

    description:
      '',

    permissionKeys:
      [],
  })

  const [
    createError,
    setCreateError,
  ] = useState('')

  const [
    userIdInput,
    setUserIdInput,
  ] = useState('')

  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState('')

  const [
    selectedRoleKeys,
    setSelectedRoleKeys,
  ] = useState([])

  const [
    assignmentError,
    setAssignmentError,
  ] = useState('')

  const {
    access:
      userAccess,

    assignment,

    isLoading:
      isLoadingAssignment,

    error:
      assignmentLoadError,
  } =
    useAdminUserRoleAssignment(
      selectedUserId,
    )

  useEffect(
    () => {
      if (
        !userAccess
      ) {
        return
      }

      setSelectedRoleKeys(
        getAssignmentRoleKeys(
          userAccess,
        ),
      )
    },
    [
      userAccess,
    ],
  )

  const delegablePermissions =
    useMemo(
      () =>
        permissions.filter(
          (permission) =>
            permission
              ?.delegable !==
            false,
        ),
      [
        permissions,
      ],
    )

  const assignableRoles =
    useMemo(
      () =>
        roles.filter(
          (role) =>
            role?.status !==
              'disabled' &&
            getRoleKey(
              role,
            ) !==
              'root_super_admin',
        ),
      [
        roles,
      ],
    )

  const togglePermission =
    (
      permissionKey,
    ) => {
      setRoleForm(
        (
          current,
        ) => ({
          ...current,

          permissionKeys:
            current
              .permissionKeys
              .includes(
                permissionKey,
              )
              ? current
                  .permissionKeys
                  .filter(
                    (
                      key,
                    ) =>
                      key !==
                      permissionKey,
                  )
              : [
                  ...current
                    .permissionKeys,

                  permissionKey,
                ],
        }),
      )
    }

  const toggleRole =
    (
      roleKey,
    ) => {
      setSelectedRoleKeys(
        (
          current,
        ) =>
          current.includes(
            roleKey,
          )
            ? current.filter(
                (
                  key,
                ) =>
                  key !==
                  roleKey,
              )
            : [
                ...current,
                roleKey,
              ],
      )
    }

  const submitNewRole =
    async (
      event,
    ) => {
      event.preventDefault()

      setCreateError(
        '',
      )

      try {
        await createRole({
          ...roleForm,

          reasonDetails:
            'Created through EPANTRY Roles & Permissions interface.',
        })

        setRoleForm({
          key:
            '',

          name:
            '',

          description:
            '',

          permissionKeys:
            [],
        })
      } catch (
        error
      ) {
        setCreateError(
          getErrorMessage(
            error,
          ),
        )
      }
    }

  const lookupUser =
    (
      event,
    ) => {
      event.preventDefault()

      const normalized =
        userIdInput.trim()

      if (!normalized) {
        return
      }

      setAssignmentError(
        '',
      )

      setSelectedUserId(
        normalized,
      )
    }

  const saveAssignment =
    async () => {
      if (
        !selectedUserId
      ) {
        return
      }

      setAssignmentError(
        '',
      )

      try {
        if (
          assignment
        ) {
          await updateUserRoles({
            userId:
              selectedUserId,

            roleKeys:
              selectedRoleKeys,

            reasonDetails:
              'Updated through EPANTRY Roles & Permissions interface.',
          })
        } else {
          await grantUserRoles({
            userId:
              selectedUserId,

            roleKeys:
              selectedRoleKeys,

            reasonDetails:
              'Granted through EPANTRY Roles & Permissions interface.',
          })
        }
      } catch (
        error
      ) {
        setAssignmentError(
          getErrorMessage(
            error,
          ),
        )
      }
    }

  const revokeAssignment =
    async () => {
      if (
        !selectedUserId
      ) {
        return
      }

      setAssignmentError(
        '',
      )

      try {
        await revokeUserRoles({
          userId:
            selectedUserId,

          reasonDetails:
            'Revoked through EPANTRY Roles & Permissions interface.',
        })

        setSelectedRoleKeys(
          [],
        )
      } catch (
        error
      ) {
        setAssignmentError(
          getErrorMessage(
            error,
          ),
        )
      }
    }

  return (
    <AdminShell
      title="Roles & Permissions"
      description="Create limited administrative profiles and assign scoped internal authority without changing Customer, Host or Super Admin application access."
    >

      {rolesError && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">

          <CircleAlert
            size={19}
            className="shrink-0"
          />

          {
            getErrorMessage(
              rolesError,
            )
          }

        </div>
      )}


      {/* ===========================================================
          ROLE CATALOG
      =========================================================== */}

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex items-start justify-between gap-4">

          <div>

            <h2 className="text-lg font-black text-stone-950">
              Administrative profiles
            </h2>

            <p className="mt-1 text-sm text-stone-500">
              System and custom permission profiles currently available.
            </p>

          </div>

          <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
            {
              roles.length
            } roles
          </div>

        </div>


        {isLoadingRoles ? (
          <div className="grid min-h-40 place-items-center">

            <LoaderCircle
              size={24}
              className="animate-spin text-emerald-700"
            />

          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">

            {roles.map(
              (role) => {
                const roleKey =
                  getRoleKey(
                    role,
                  )

                const isSystem =
                  role?.isSystem ===
                    true ||
                  role?.system ===
                    true

                return (
                  <article
                    key={
                      role.id ||
                      roleKey
                    }
                    className="rounded-[20px] border border-stone-200 bg-stone-50/60 p-4"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="font-black text-stone-950">
                            {
                              role.name ||
                              roleKey
                            }
                          </h3>

                          {isSystem && (
                            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-stone-600">
                              System
                            </span>
                          )}

                          {role.status ===
                            'disabled' && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-red-700">
                              Disabled
                            </span>
                          )}

                        </div>

                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          {roleKey}
                        </p>

                      </div>


                      {!isSystem &&
                        role.status !==
                          'disabled' && (
                          <button
                            type="button"
                            disabled={
                              isMutatingAdminControlPlane
                            }
                            onClick={async () => {
                              try {
                                await disableRole({
                                  roleId:
                                    role.id,

                                  reasonDetails:
                                    'Disabled through EPANTRY Roles & Permissions interface.',
                                })
                              } catch (
                                error
                              ) {
                                setCreateError(
                                  getErrorMessage(
                                    error,
                                  ),
                                )
                              }
                            }}
                            className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            aria-label={`Disable ${role.name || roleKey}`}
                          >
                            <Trash2
                              size={15}
                            />
                          </button>
                        )}

                    </div>


                    {role.description && (
                      <p className="mt-3 text-sm leading-5 text-stone-500">
                        {
                          role.description
                        }
                      </p>
                    )}


                    <div className="mt-4 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">

                      {(
                        role.permissionKeys ||
                        []
                      ).map(
                        (
                          permission,
                        ) => (
                          <span
                            key={
                              permission
                            }
                            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-stone-600 ring-1 ring-stone-200"
                          >
                            {
                              permission
                            }
                          </span>
                        ),
                      )}

                    </div>

                  </article>
                )
              },
            )}

          </div>
        )}

      </section>


      {/* ===========================================================
          CREATE ROLE
      =========================================================== */}

      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex items-center gap-3">

          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Plus
              size={20}
            />
          </div>

          <div>

            <h2 className="text-lg font-black text-stone-950">
              Create custom role
            </h2>

            <p className="text-sm text-stone-500">
              Only delegable permissions can be included.
            </p>

          </div>

        </div>


        <form
          onSubmit={
            submitNewRole
          }
          className="mt-5"
        >

          <div className="grid gap-4 md:grid-cols-2">

            <label>

              <span className="text-xs font-black text-stone-600">
                Role key
              </span>

              <input
                required
                value={
                  roleForm.key
                }
                onChange={(
                  event,
                ) =>
                  setRoleForm(
                    (
                      current,
                    ) => ({
                      ...current,
                      key:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="operations_support"
                className="focus-ring mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
              />

            </label>


            <label>

              <span className="text-xs font-black text-stone-600">
                Display name
              </span>

              <input
                required
                value={
                  roleForm.name
                }
                onChange={(
                  event,
                ) =>
                  setRoleForm(
                    (
                      current,
                    ) => ({
                      ...current,
                      name:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Operations Support"
                className="focus-ring mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
              />

            </label>

          </div>


          <label className="mt-4 block">

            <span className="text-xs font-black text-stone-600">
              Description
            </span>

            <textarea
              value={
                roleForm.description
              }
              onChange={(
                event,
              ) =>
                setRoleForm(
                  (
                    current,
                  ) => ({
                    ...current,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              rows={3}
              className="focus-ring mt-2 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
            />

          </label>


          <div className="mt-5">

            <p className="text-xs font-black text-stone-600">
              Permissions
            </p>

            {isLoadingPermissions ? (
              <LoaderCircle
                size={20}
                className="mt-4 animate-spin text-emerald-700"
              />
            ) : (
              <div className="mt-3 grid max-h-[300px] gap-2 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2 xl:grid-cols-3">

                {delegablePermissions.map(
                  (
                    permission,
                  ) => {
                    const permissionKey =
                      permission.key ||
                      permission
                        .permissionKey

                    const selected =
                      roleForm
                        .permissionKeys
                        .includes(
                          permissionKey,
                        )

                    return (
                      <label
                        key={
                          permissionKey
                        }
                        className={[
                          'flex',
                          'cursor-pointer',
                          'items-start',
                          'gap-3',
                          'rounded-xl',
                          'border',
                          'p-3',
                          'transition',

                          selected
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-stone-200 bg-white',
                        ].join(
                          ' ',
                        )}
                      >

                        <input
                          type="checkbox"
                          checked={
                            selected
                          }
                          onChange={() =>
                            togglePermission(
                              permissionKey,
                            )
                          }
                          className="mt-0.5 accent-emerald-700"
                        />

                        <span className="min-w-0">

                          <span className="block break-all text-xs font-black text-stone-800">
                            {
                              permissionKey
                            }
                          </span>

                          {permission.description && (
                            <span className="mt-1 block text-[11px] leading-4 text-stone-500">
                              {
                                permission.description
                              }
                            </span>
                          )}

                        </span>

                      </label>
                    )
                  },
                )}

              </div>
            )}

          </div>


          {createError && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {createError}
            </p>
          )}


          <button
            type="submit"
            disabled={
              isMutatingAdminControlPlane
            }
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {isMutatingAdminControlPlane ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <Plus
                size={16}
              />
            )}

            Create role
          </button>

        </form>

      </section>


      {/* ===========================================================
          USER ASSIGNMENT
      =========================================================== */}

      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex items-center gap-3">

          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <UserCog
              size={20}
            />
          </div>

          <div>

            <h2 className="text-lg font-black text-stone-950">
              User role assignment
            </h2>

            <p className="text-sm text-stone-500">
              Assign limited administrative profiles to an existing EPANTRY user.
            </p>

          </div>

        </div>


        <form
          onSubmit={
            lookupUser
          }
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >

          <input
            value={
              userIdInput
            }
            onChange={(
              event,
            ) =>
              setUserIdInput(
                event.target
                  .value,
              )
            }
            placeholder="Mongo user ID"
            className="focus-ring min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
          />

          <button
            type="submit"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-black text-white"
          >
            <Search
              size={16}
            />

            Load user
          </button>

        </form>


        {selectedUserId && (
          <div className="mt-5 rounded-[20px] border border-stone-200 bg-stone-50 p-4">

            {isLoadingAssignment ? (
              <div className="py-8 text-center">

                <LoaderCircle
                  size={22}
                  className="mx-auto animate-spin text-emerald-700"
                />

              </div>
            ) : assignmentLoadError ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                {
                  getErrorMessage(
                    assignmentLoadError,
                  )
                }
              </p>
            ) : (
              <>

                <div className="flex items-center gap-2">

                  <ShieldCheck
                    size={17}
                    className="text-emerald-700"
                  />

                  <p className="text-sm font-black text-stone-950">
                    Administrative profiles
                  </p>

                </div>


                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">

                  {assignableRoles.map(
                    (
                      role,
                    ) => {
                      const roleKey =
                        getRoleKey(
                          role,
                        )

                      const selected =
                        selectedRoleKeys
                          .includes(
                            roleKey,
                          )

                      return (
                        <label
                          key={
                            roleKey
                          }
                          className={[
                            'cursor-pointer',
                            'rounded-xl',
                            'border',
                            'p-3',

                            selected
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-stone-200 bg-white',
                          ].join(
                            ' ',
                          )}
                        >

                          <div className="flex items-start gap-2">

                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
                              onChange={() =>
                                toggleRole(
                                  roleKey,
                                )
                              }
                              className="mt-0.5 accent-emerald-700"
                            />

                            <span>

                              <span className="block text-sm font-black text-stone-800">
                                {
                                  role.name ||
                                  roleKey
                                }
                              </span>

                              <span className="mt-1 block text-[10px] text-stone-400">
                                {roleKey}
                              </span>

                            </span>

                          </div>

                        </label>
                      )
                    },
                  )}

                </div>


                {assignmentError && (
                  <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {assignmentError}
                  </p>
                )}


                <div className="mt-5 flex flex-wrap gap-3">

                  <button
                    type="button"
                    onClick={
                      saveAssignment
                    }
                    disabled={
                      isMutatingAdminControlPlane ||
                      selectedRoleKeys.length ===
                        0
                    }
                    className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
                  >
                    {isMutatingAdminControlPlane && (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                      />
                    )}

                    {
                      assignment
                        ? 'Update assignment'
                        : 'Grant access'
                    }
                  </button>


                  {assignment && (
                    <button
                      type="button"
                      onClick={
                        revokeAssignment
                      }
                      disabled={
                        isMutatingAdminControlPlane
                      }
                      className="focus-ring rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      Revoke admin access
                    </button>
                  )}

                </div>

              </>
            )}

          </div>
        )}

      </section>

    </AdminShell>
  )
}