import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getCurrentAdminAccess,
  hasAdminPermission as hasAdminPermissionService,
  hasAllAdminPermissions as hasAllAdminPermissionsService,
  hasAnyAdminPermission as hasAnyAdminPermissionService,
  normalizeCurrentAdminAccess,
} from '../services/admin.service'

const AdminContext =
  createContext(null)

/*
|--------------------------------------------------------------------------
| Empty Administrative Access
|--------------------------------------------------------------------------
|
| This is the safe frontend default.
|
| It grants nothing.
|
*/

const EMPTY_ADMIN_ACCESS =
  Object.freeze({
    isAdmin:
      false,

    isRootSuperAdmin:
      false,

    source:
      'none',

    roleKeys:
      Object.freeze([]),

    permissionKeys:
      Object.freeze([]),
  })

/*
|--------------------------------------------------------------------------
| Administrative Access Status
|--------------------------------------------------------------------------
|
| idle:
|   no authenticated application session
|
| loading:
|   checking backend admin authorization
|
| ready:
|   backend confirmed administrative access
|
| no-access:
|   authenticated Customer / Host with no admin authority
|
| mfa-required:
|   backend confirmed this is an administrative identity, but the current
|   session has not satisfied MFA assurance for the admin surface
|
| error:
|   unexpected bootstrap failure
|
*/

export const ADMIN_ACCESS_STATUSES =
  Object.freeze({
    IDLE:
      'idle',

    LOADING:
      'loading',

    READY:
      'ready',

    NO_ACCESS:
      'no-access',

    MFA_REQUIRED:
      'mfa-required',

    ERROR:
      'error',
  })

/*
|--------------------------------------------------------------------------
| Error Helpers
|--------------------------------------------------------------------------
*/

function hasApiErrorCode(
  error,
  expectedCode,
) {
  if (
    !Array.isArray(
      error?.errors,
    )
  ) {
    return false
  }

  return error.errors.some(
    (item) =>
      item?.code ===
      expectedCode,
  )
}

function isNoAdminAccessError(
  error,
) {
  return (
    error?.status ===
      403 &&
    hasApiErrorCode(
      error,
      'ADMIN_ACCESS_REQUIRED',
    )
  )
}

function isAdminMfaRequiredError(
  error,
) {
  return (
    error?.status ===
      428 &&
    hasApiErrorCode(
      error,
      'AUTH_MFA_REQUIRED',
    )
  )
}

/*
|--------------------------------------------------------------------------
| Provisional MFA-required Access
|--------------------------------------------------------------------------
|
| /admin/access checks:
|
| resolved admin authority
|        ↓
| requireAdminAccess
|        ↓
| requireMfaAssurance
|
| Therefore AUTH_MFA_REQUIRED from this endpoint already proves that the
| backend resolved this identity as an administrator.
|
| We intentionally DO NOT invent permission keys here.
|
| Until MFA succeeds:
|
| permissionKeys = []
|
| so no privileged frontend action can become available.
|
*/

function createMfaRequiredAccess({
  superAdminEnabled,
}) {
  const isRootSuperAdmin =
    superAdminEnabled ===
    true

  return {
    isAdmin:
      true,

    isRootSuperAdmin,

    source:
      isRootSuperAdmin
        ? 'super_admin'
        : 'assignment',

    roleKeys:
      isRootSuperAdmin
        ? [
            'root_super_admin',
          ]
        : [],

    permissionKeys:
      [],
  }
}

/*
|--------------------------------------------------------------------------
| Provider
|--------------------------------------------------------------------------
*/

export function AdminProvider({
  children,
}) {
  const {
    isAuthenticated,
    isBootstrapping:
      isAuthBootstrapping,
    currentUser,
    superAdminEnabled,
  } = useAuth()

  const [
    adminAccess,
    setAdminAccess,
  ] =
    useState(
      EMPTY_ADMIN_ACCESS,
    )

  const [
    adminStatus,
    setAdminStatus,
  ] =
    useState(
      ADMIN_ACCESS_STATUSES.IDLE,
    )

  const [
    adminError,
    setAdminError,
  ] =
    useState(null)

  /*
  |--------------------------------------------------------------------------
  | Request Generation
  |--------------------------------------------------------------------------
  |
  | Prevents a stale /admin/access response from restoring admin state after
  | logout or another newer bootstrap.
  |
  */

  const requestGenerationRef =
    useRef(0)

  /*
  |--------------------------------------------------------------------------
  | Clear Administrative State
  |--------------------------------------------------------------------------
  */

  const clearAdminAccess =
    useCallback(
      () => {
        requestGenerationRef
          .current +=
          1

        setAdminAccess(
          EMPTY_ADMIN_ACCESS,
        )

        setAdminStatus(
          ADMIN_ACCESS_STATUSES.IDLE,
        )

        setAdminError(
          null,
        )
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Refresh Administrative Access
  |--------------------------------------------------------------------------
  |
  | Important:
  |
  | This endpoint is intentionally requested for every authenticated user.
  |
  | Why?
  |
  | Limited internal admins are NOT:
  |
  | superAdminEnabled = true
  |
  | and they do NOT receive an "admin" activeMode.
  |
  | Therefore frontend cannot safely infer delegated admin access from the
  | ordinary application identity.
  |
  | Backend /admin/access remains the source of truth.
  |
  */

  const refreshAdminAccess =
    useCallback(
      async () => {
        if (
          !isAuthenticated
        ) {
          clearAdminAccess()

          return {
            access:
              EMPTY_ADMIN_ACCESS,

            status:
              ADMIN_ACCESS_STATUSES.IDLE,
          }
        }

        const requestGeneration =
          requestGenerationRef
            .current +
          1

        requestGenerationRef
          .current =
          requestGeneration

        setAdminStatus(
          ADMIN_ACCESS_STATUSES.LOADING,
        )

        setAdminError(
          null,
        )

        try {
          const result =
            await getCurrentAdminAccess()

          if (
            requestGenerationRef
              .current !==
            requestGeneration
          ) {
            return result
          }

          const normalizedAccess =
            normalizeCurrentAdminAccess(
              result?.access,
            )

          /*
          |--------------------------------------------------------------------------
          | Defensive Fail-closed Check
          |--------------------------------------------------------------------------
          |
          | /admin/access should only return success to an actual admin.
          |
          | If an unexpected response ever says otherwise, frontend treats it
          | as no access.
          |
          */

          if (
            normalizedAccess
              .isAdmin !==
            true
          ) {
            setAdminAccess(
              EMPTY_ADMIN_ACCESS,
            )

            setAdminStatus(
              ADMIN_ACCESS_STATUSES.NO_ACCESS,
            )

            return {
              ...result,

              access:
                EMPTY_ADMIN_ACCESS,
            }
          }

          setAdminAccess(
            normalizedAccess,
          )

          setAdminStatus(
            ADMIN_ACCESS_STATUSES.READY,
          )

          return {
            ...result,

            access:
              normalizedAccess,
          }
        } catch (error) {
          if (
            requestGenerationRef
              .current !==
            requestGeneration
          ) {
            throw error
          }

          /*
          |--------------------------------------------------------------------------
          | Ordinary Customer / Host
          |--------------------------------------------------------------------------
          |
          | This is expected and is NOT treated as an application error.
          |
          */

          if (
            isNoAdminAccessError(
              error,
            )
          ) {
            setAdminAccess(
              EMPTY_ADMIN_ACCESS,
            )

            setAdminStatus(
              ADMIN_ACCESS_STATUSES.NO_ACCESS,
            )

            setAdminError(
              null,
            )

            return {
              access:
                EMPTY_ADMIN_ACCESS,

              status:
                ADMIN_ACCESS_STATUSES.NO_ACCESS,
            }
          }

          /*
          |--------------------------------------------------------------------------
          | Actual Admin Without MFA Assurance
          |--------------------------------------------------------------------------
          |
          | Because backend checks requireAdminAccess before MFA, this 428 is
          | only reachable by an identity that already has admin authority.
          |
          | No permissions are exposed until MFA succeeds.
          |
          */

          if (
            isAdminMfaRequiredError(
              error,
            )
          ) {
            const provisionalAccess =
              createMfaRequiredAccess({
                superAdminEnabled,
              })

            setAdminAccess(
              provisionalAccess,
            )

            setAdminStatus(
              ADMIN_ACCESS_STATUSES.MFA_REQUIRED,
            )

            setAdminError(
              null,
            )

            return {
              access:
                provisionalAccess,

              status:
                ADMIN_ACCESS_STATUSES.MFA_REQUIRED,
            }
          }

          /*
          |--------------------------------------------------------------------------
          | Unexpected Error
          |--------------------------------------------------------------------------
          */

          setAdminAccess(
            EMPTY_ADMIN_ACCESS,
          )

          setAdminStatus(
            ADMIN_ACCESS_STATUSES.ERROR,
          )

          setAdminError(
            error,
          )

          throw error
        }
      },
      [
        isAuthenticated,
        superAdminEnabled,
        clearAdminAccess,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Authentication-driven Bootstrap
  |--------------------------------------------------------------------------
  |
  | AuthContext owns the application session.
  |
  | Whenever that identity changes:
  |
  | login
  | logout
  | session bootstrap
  | session refresh
  |
  | AdminContext re-evaluates its own independent backend authorization.
  |
  */

  useEffect(
    () => {
      if (
        isAuthBootstrapping
      ) {
        return undefined
      }

      if (
        !isAuthenticated
      ) {
        clearAdminAccess()

        return undefined
      }

      let active =
        true

      refreshAdminAccess()
        .catch(
          () => {
            /*
            |--------------------------------------------------------------------------
            | Error State Already Captured
            |--------------------------------------------------------------------------
            |
            | Avoid an unhandled promise rejection from this background
            | bootstrap. Consumers can inspect adminError/adminStatus.
            |
            */
          },
        )

      return () => {
        active =
          false

        if (!active) {
          requestGenerationRef
            .current +=
            1
        }
      }
    },
    [
      isAuthenticated,
      isAuthBootstrapping,
      currentUser,
      clearAdminAccess,
      refreshAdminAccess,
    ],
  )

  /*
  |--------------------------------------------------------------------------
  | Derived State
  |--------------------------------------------------------------------------
  */

  const isAdminAccessLoading =
    isAuthBootstrapping ||
    adminStatus ===
      ADMIN_ACCESS_STATUSES.LOADING

  const isAdminAccessReady =
    adminStatus ===
    ADMIN_ACCESS_STATUSES.READY

  const hasAdminAccess =
    adminAccess?.isAdmin ===
      true &&
    (
      adminStatus ===
        ADMIN_ACCESS_STATUSES.READY ||
      adminStatus ===
        ADMIN_ACCESS_STATUSES.MFA_REQUIRED
    )

  const isAdminMfaRequired =
    adminStatus ===
    ADMIN_ACCESS_STATUSES.MFA_REQUIRED

  const isRootSuperAdmin =
    adminAccess
      ?.isRootSuperAdmin ===
    true

  const adminSource =
    adminAccess?.source ||
    'none'

  const adminRoleKeys =
    useMemo(
      () =>
        Array.isArray(
          adminAccess
            ?.roleKeys,
        )
          ? [
              ...adminAccess
                .roleKeys,
            ]
          : [],
      [
        adminAccess,
      ],
    )

  const adminPermissionKeys =
    useMemo(
      () =>
        Array.isArray(
          adminAccess
            ?.permissionKeys,
        )
          ? [
              ...adminAccess
                .permissionKeys,
            ]
          : [],
      [
        adminAccess,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Permission Helpers
  |--------------------------------------------------------------------------
  |
  | These helpers are UX helpers only.
  |
  | Backend permission middleware remains final authority.
  |
  */

  const hasAdminPermission =
    useCallback(
      (
        permissionKey,
      ) =>
        adminStatus ===
          ADMIN_ACCESS_STATUSES.READY &&
        hasAdminPermissionService(
          adminAccess,
          permissionKey,
        ),
      [
        adminAccess,
        adminStatus,
      ],
    )

  const hasAnyAdminPermission =
    useCallback(
      (
        permissionKeys,
      ) =>
        adminStatus ===
          ADMIN_ACCESS_STATUSES.READY &&
        hasAnyAdminPermissionService(
          adminAccess,
          permissionKeys,
        ),
      [
        adminAccess,
        adminStatus,
      ],
    )

  const hasAllAdminPermissions =
    useCallback(
      (
        permissionKeys,
      ) =>
        adminStatus ===
          ADMIN_ACCESS_STATUSES.READY &&
        hasAllAdminPermissionsService(
          adminAccess,
          permissionKeys,
        ),
      [
        adminAccess,
        adminStatus,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Context Value
  |--------------------------------------------------------------------------
  */

  const value =
    useMemo(
      () => ({
        /*
        |--------------------------------------------------------------------------
        | Effective Administrative Access
        |--------------------------------------------------------------------------
        */

        adminAccess,

        adminStatus,

        adminError,

        hasAdminAccess,

        isAdminAccessLoading,

        isAdminAccessReady,

        isAdminMfaRequired,

        isRootSuperAdmin,

        adminSource,

        adminRoleKeys,

        adminPermissionKeys,

        /*
        |--------------------------------------------------------------------------
        | Permission UX Helpers
        |--------------------------------------------------------------------------
        */

        hasAdminPermission,

        hasAnyAdminPermission,

        hasAllAdminPermissions,

        /*
        |--------------------------------------------------------------------------
        | Actions
        |--------------------------------------------------------------------------
        */

        refreshAdminAccess,

        clearAdminAccess,
      }),
      [
        adminAccess,
        adminStatus,
        adminError,
        hasAdminAccess,
        isAdminAccessLoading,
        isAdminAccessReady,
        isAdminMfaRequired,
        isRootSuperAdmin,
        adminSource,
        adminRoleKeys,
        adminPermissionKeys,
        hasAdminPermission,
        hasAnyAdminPermission,
        hasAllAdminPermissions,
        refreshAdminAccess,
        clearAdminAccess,
      ],
    )

  return (
    <AdminContext.Provider
      value={value}
    >
      {children}
    </AdminContext.Provider>
  )
}

/*
|--------------------------------------------------------------------------
| useAdmin
|--------------------------------------------------------------------------
*/

export function useAdmin() {
  const context =
    useContext(
      AdminContext,
    )

  if (!context) {
    throw new Error(
      'useAdmin must be used inside AdminProvider.',
    )
  }

  return context
}