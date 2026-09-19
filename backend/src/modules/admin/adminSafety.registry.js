import {
  ADMIN_AUDIT_CRITICAL_ACTIONS,
} from './adminAudit.registry.js'

/*
|--------------------------------------------------------------------------
| Admin Privileged Safety Registry
|--------------------------------------------------------------------------
|
| This module DOES NOT introduce a new top-level role.
|
| EPANTRY application access remains:
|
| customer
| host
| super_admin
|
| Limited internal admins remain permission assignments inside the privileged
| administration domain.
|--------------------------------------------------------------------------
*/

export const ADMIN_MAKER_CHECKER_MODES =
  Object.freeze([
    'single_actor',
    'dual_control_ready',
  ])

/*
|--------------------------------------------------------------------------
| Dual-control Ready Actions
|--------------------------------------------------------------------------
|
| M06 adds Trust & Safety mutation because safety-critical Brand overrides
| require maker-checker separation.
|
| The registry marks policy readiness.
| M06 Brand override approval additionally enforces actual maker/checker
| identity separation between the Host proposer and platform checker.
|--------------------------------------------------------------------------
*/

export const ADMIN_DUAL_CONTROL_READY_ACTIONS =
  Object.freeze([
    'admin.role.create',
    'admin.role.update',
    'admin.role.disable',

    'admin.assignment.grant',
    'admin.assignment.update',
    'admin.assignment.revoke',

    'catalog.publish',
    'recipe.publish',

    'trust_safety.mutate',

    'finance.mutate',

    'cms.publish',
  ])

const ADMIN_DUAL_CONTROL_READY_ACTION_SET =
  new Set(
    ADMIN_DUAL_CONTROL_READY_ACTIONS,
  )

function freezeSafetyPolicy(
  policy,
) {
  return Object.freeze({
    ...policy,
  })
}

export const ADMIN_PRIVILEGED_SAFETY_POLICIES =
  Object.freeze(
    Object.fromEntries(
      ADMIN_AUDIT_CRITICAL_ACTIONS.map(
        (
          action,
        ) => [
          action,

          freezeSafetyPolicy({
            action,

            allowImpersonation:
              false,

            makerCheckerMode:
              ADMIN_DUAL_CONTROL_READY_ACTION_SET.has(
                action,
              )
                ? 'dual_control_ready'
                : 'single_actor',
          }),
        ],
      ),
    ),
  )

export function getAdminPrivilegedSafetyPolicy(
  action,
) {
  const normalized =
    String(
      action ||
        '',
    )
      .trim()
      .toLowerCase()

  if (!normalized) {
    return null
  }

  return (
    ADMIN_PRIVILEGED_SAFETY_POLICIES[
      normalized
    ] ||
    null
  )
}

export function isAdminActionMakerCheckerReady(
  action,
) {
  return (
    getAdminPrivilegedSafetyPolicy(
      action,
    )
      ?.makerCheckerMode ===
    'dual_control_ready'
  )
}

export function adminActionAllowsImpersonation(
  action,
) {
  return (
    getAdminPrivilegedSafetyPolicy(
      action,
    )
      ?.allowImpersonation ===
    true
  )
}