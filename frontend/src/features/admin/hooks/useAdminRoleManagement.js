import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  ADMIN_REASON_CODES,
  createAdminRole,
  getAdminPermissionCatalog,
  getAdminRoles,
  getAdminUserRoles,
  updateAdminRole,
  updateAdminUserRoles,
} from '../services/admin.service'

/*
|--------------------------------------------------------------------------
| Admin Control-plane Query Keys
|--------------------------------------------------------------------------
*/

export const ADMIN_ROLE_MANAGEMENT_QUERY_KEYS =
  Object.freeze({
    root:
      Object.freeze([
        'admin',
        'role-management',
      ]),

    permissions:
      Object.freeze([
        'admin',
        'role-management',
        'permissions',
      ]),

    roles:
      Object.freeze([
        'admin',
        'role-management',
        'roles',
      ]),

    assignments:
      Object.freeze([
        'admin',
        'role-management',
        'assignments',
      ]),

    assignment(
      userId,
    ) {
      return [
        'admin',
        'role-management',
        'assignments',
        String(
          userId ||
            '',
        ).trim(),
      ]
    },
  })

/*
|--------------------------------------------------------------------------
| Root Control-plane Access
|--------------------------------------------------------------------------
|
| Backend role/assignment management is intentionally restricted to the REAL
| Super Admin.
|
| A limited internal admin cannot become a control-plane administrator even
| if another delegated permission profile exists.
|
*/

function useRootAdminControlPlaneAccess() {
  const {
    isAdminAccessReady,
    isRootSuperAdmin,
  } = useAdmin()

  return (
    isAdminAccessReady &&
    isRootSuperAdmin
  )
}

/*
|--------------------------------------------------------------------------
| Permission Catalog
|--------------------------------------------------------------------------
*/

export function useAdminPermissionCatalog() {
  const canManageAdminControlPlane =
    useRootAdminControlPlaneAccess()

  const query =
    useQuery({
      queryKey:
        ADMIN_ROLE_MANAGEMENT_QUERY_KEYS
          .permissions,

      queryFn:
        getAdminPermissionCatalog,

      enabled:
        canManageAdminControlPlane,

      staleTime:
        60 * 1000,
    })

  return {
    ...query,

    canManageAdminControlPlane,

    permissions:
      Array.isArray(
        query.data?.permissions,
      )
        ? query.data.permissions
        : [],

    requestId:
      query.data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Admin Roles
|--------------------------------------------------------------------------
*/

export function useAdminRoles() {
  const canManageAdminControlPlane =
    useRootAdminControlPlaneAccess()

  const query =
    useQuery({
      queryKey:
        ADMIN_ROLE_MANAGEMENT_QUERY_KEYS
          .roles,

      queryFn:
        getAdminRoles,

      enabled:
        canManageAdminControlPlane,

      staleTime:
        30 * 1000,
    })

  return {
    ...query,

    canManageAdminControlPlane,

    roles:
      Array.isArray(
        query.data?.roles,
      )
        ? query.data.roles
        : [],

    requestId:
      query.data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| User Admin Assignment
|--------------------------------------------------------------------------
*/

export function useAdminUserRoleAssignment(
  userId,
) {
  const canManageAdminControlPlane =
    useRootAdminControlPlaneAccess()

  const normalizedUserId =
    String(
      userId ||
        '',
    ).trim()

  const query =
    useQuery({
      queryKey:
        ADMIN_ROLE_MANAGEMENT_QUERY_KEYS
          .assignment(
            normalizedUserId,
          ),

      queryFn:
        () =>
          getAdminUserRoles(
            normalizedUserId,
          ),

      enabled:
        canManageAdminControlPlane &&
        Boolean(
          normalizedUserId,
        ),

      staleTime:
        15 * 1000,
    })

  return {
    ...query,

    canManageAdminControlPlane,

    access:
      query.data?.access ||
      null,

    user:
      query.data
        ?.access
        ?.user ||
      null,

    assignment:
      query.data
        ?.access
        ?.assignment ||
      null,

    roles:
      Array.isArray(
        query.data
          ?.access
          ?.roles,
      )
        ? query.data
            .access
            .roles
        : [],

    requestId:
      query.data?.requestId ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Cache Helpers
|--------------------------------------------------------------------------
*/

async function refreshAdminRoleCatalog(
  queryClient,
) {
  await queryClient.invalidateQueries({
    queryKey:
      ADMIN_ROLE_MANAGEMENT_QUERY_KEYS
        .roles,
  })
}

async function refreshAdminAssignment(
  queryClient,
  userId,
) {
  const normalizedUserId =
    String(
      userId ||
        '',
    ).trim()

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        ADMIN_ROLE_MANAGEMENT_QUERY_KEYS
          .assignments,
    }),

    normalizedUserId
      ? queryClient.invalidateQueries({
          queryKey:
            ADMIN_ROLE_MANAGEMENT_QUERY_KEYS
              .assignment(
                normalizedUserId,
              ),
        })
      : Promise.resolve(),
  ])
}

/*
|--------------------------------------------------------------------------
| Role-management Mutations
|--------------------------------------------------------------------------
|
| Explicit actions are intentionally separate:
|
| createRole
| updateRole
| disableRole
|
| This avoids guessing audit reason semantics inside UI components.
|
*/

export function useAdminRoleManagementActions() {
  const queryClient =
    useQueryClient()

  const canManageAdminControlPlane =
    useRootAdminControlPlaneAccess()

  /*
  |--------------------------------------------------------------------------
  | Create Custom Role
  |--------------------------------------------------------------------------
  */

  const createRoleMutation =
    useMutation({
      mutationFn:
        ({
          key,
          name,
          description,
          permissionKeys,

          reasonDetails =
            null,
        }) =>
          createAdminRole({
            key,
            name,
            description,
            permissionKeys,

            reasonCode:
              ADMIN_REASON_CODES
                .ROLE_CREATED,

            reasonDetails,
          }),

      onSuccess:
        async () => {
          await refreshAdminRoleCatalog(
            queryClient,
          )
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Update Custom Role
  |--------------------------------------------------------------------------
  |
  | This is for ordinary changes:
  |
  | name
  | description
  | permissionKeys
  | re-enable status
  |
  | Disabling uses the dedicated disableRole action below because its backend
  | audit action uses a different controlled reason code.
  |
  */

  const updateRoleMutation =
    useMutation({
      mutationFn:
        ({
          roleId,

          name,
          description,
          permissionKeys,
          status,

          reasonDetails =
            null,
        }) =>
          updateAdminRole({
            roleId,

            name,
            description,
            permissionKeys,
            status,

            reasonCode:
              ADMIN_REASON_CODES
                .ROLE_UPDATED,

            reasonDetails,
          }),

      onSuccess:
        async () => {
          await refreshAdminRoleCatalog(
            queryClient,
          )
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Disable Custom Role
  |--------------------------------------------------------------------------
  */

  const disableRoleMutation =
    useMutation({
      mutationFn:
        ({
          roleId,

          reasonDetails =
            null,
        }) =>
          updateAdminRole({
            roleId,

            status:
              'disabled',

            reasonCode:
              ADMIN_REASON_CODES
                .ROLE_DISABLED,

            reasonDetails,
          }),

      onSuccess:
        async () => {
          await refreshAdminRoleCatalog(
            queryClient,
          )
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Grant Limited Internal-admin Access
  |--------------------------------------------------------------------------
  |
  | This does NOT set:
  |
  | superAdminEnabled
  | activeMode
  | hostEnabled
  | customerEnabled
  |
  | It only changes AdminAssignment.
  |
  */

  const grantAssignmentMutation =
    useMutation({
      mutationFn:
        ({
          userId,
          roleKeys,

          expiresAt =
            null,

          reasonDetails =
            null,
        }) =>
          updateAdminUserRoles({
            userId,

            roleKeys,

            expiresAt,

            reasonCode:
              ADMIN_REASON_CODES
                .ASSIGNMENT_GRANTED,

            reasonDetails,
          }),

      onSuccess:
        async (
          result,
          variables,
        ) => {
          await refreshAdminAssignment(
            queryClient,
            variables.userId,
          )

          return result
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Update Existing Limited-admin Assignment
  |--------------------------------------------------------------------------
  */

  const updateAssignmentMutation =
    useMutation({
      mutationFn:
        ({
          userId,
          roleKeys,

          expiresAt =
            null,

          reasonDetails =
            null,
        }) =>
          updateAdminUserRoles({
            userId,

            roleKeys,

            expiresAt,

            reasonCode:
              ADMIN_REASON_CODES
                .ASSIGNMENT_UPDATED,

            reasonDetails,
          }),

      onSuccess:
        async (
          result,
          variables,
        ) => {
          await refreshAdminAssignment(
            queryClient,
            variables.userId,
          )

          return result
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Revoke Limited Internal-admin Access
  |--------------------------------------------------------------------------
  |
  | Backend contract:
  |
  | roleKeys = []
  |
  | means revoke the AdminAssignment.
  |
  */

  const revokeAssignmentMutation =
    useMutation({
      mutationFn:
        ({
          userId,

          reasonDetails =
            null,
        }) =>
          updateAdminUserRoles({
            userId,

            roleKeys:
              [],

            expiresAt:
              null,

            reasonCode:
              ADMIN_REASON_CODES
                .ASSIGNMENT_REVOKED,

            reasonDetails,
          }),

      onSuccess:
        async (
          result,
          variables,
        ) => {
          await refreshAdminAssignment(
            queryClient,
            variables.userId,
          )

          return result
        },
    })

  /*
  |--------------------------------------------------------------------------
  | Combined State
  |--------------------------------------------------------------------------
  */

  const isMutatingRole =
    createRoleMutation
      .isPending ||
    updateRoleMutation
      .isPending ||
    disableRoleMutation
      .isPending

  const isMutatingAssignment =
    grantAssignmentMutation
      .isPending ||
    updateAssignmentMutation
      .isPending ||
    revokeAssignmentMutation
      .isPending

  const isMutatingAdminControlPlane =
    isMutatingRole ||
    isMutatingAssignment

  return {
    /*
    |--------------------------------------------------------------------------
    | Authority
    |--------------------------------------------------------------------------
    */

    canManageAdminControlPlane,

    /*
    |--------------------------------------------------------------------------
    | Role Actions
    |--------------------------------------------------------------------------
    */

    createRole:
      createRoleMutation
        .mutateAsync,

    updateRole:
      updateRoleMutation
        .mutateAsync,

    disableRole:
      disableRoleMutation
        .mutateAsync,

    /*
    |--------------------------------------------------------------------------
    | Assignment Actions
    |--------------------------------------------------------------------------
    */

    grantUserRoles:
      grantAssignmentMutation
        .mutateAsync,

    updateUserRoles:
      updateAssignmentMutation
        .mutateAsync,

    revokeUserRoles:
      revokeAssignmentMutation
        .mutateAsync,

    /*
    |--------------------------------------------------------------------------
    | Mutation Objects
    |--------------------------------------------------------------------------
    */

    createRoleMutation,

    updateRoleMutation,

    disableRoleMutation,

    grantAssignmentMutation,

    updateAssignmentMutation,

    revokeAssignmentMutation,

    /*
    |--------------------------------------------------------------------------
    | Combined State
    |--------------------------------------------------------------------------
    */

    isMutatingRole,

    isMutatingAssignment,

    isMutatingAdminControlPlane,
  }
}