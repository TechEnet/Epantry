import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Home,
  LoaderCircle,
  MailPlus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Users,
  XCircle,
} from 'lucide-react'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  useHousehold,
} from '../context/HouseholdContext'

import {
  removeHouseholdMember,
  updateHouseholdMemberRole,
} from '../services/household.service'

import {
  createHouseholdInvitation,
  listHouseholdInvitations,
  resendHouseholdInvitation,
  revokeHouseholdInvitation,
} from '../services/householdInvitation.service'

function getRoleLabel(
  role,
  roleLabel,
) {
  switch (role) {
    case 'owner':
      return 'Owner'

    case 'admin':
      return 'Admin'

    default: {
      const label =
        String(
          roleLabel ||
            '',
        ).trim()

      return label ||
        'Member'
    }
  }
}

const MEMBER_INVITE_ROLE_OPTIONS = [
  {
    value: 'member',
    label: 'Member',
    roleLabel: 'Member',
  },
  {
    value: 'partner',
    label: 'Partner / Spouse',
    roleLabel: 'Partner / Spouse',
  },
  {
    value: 'parent',
    label: 'Parent',
    roleLabel: 'Parent',
  },
  {
    value: 'child',
    label: 'Child',
    roleLabel: 'Child',
  },
  {
    value: 'other',
    label: 'Other',
    roleLabel: '',
  },
]

function getInviteRoleDetails(
  roleOption,
  customRoleLabel,
) {
  if (
    roleOption ===
    'admin'
  ) {
    return {
      role: 'admin',
      roleLabel: 'Admin',
    }
  }

  const option =
    MEMBER_INVITE_ROLE_OPTIONS.find(
      (entry) =>
        entry.value ===
        roleOption,
    ) ||
    MEMBER_INVITE_ROLE_OPTIONS[0]

  return {
    role: 'member',
    roleLabel:
      option.value ===
        'other'
        ? String(
            customRoleLabel ||
              '',
          ).trim()
        : option.roleLabel,
  }
}

function getInvitationStatusClasses(
  status,
) {
  switch (status) {
    case 'accepted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'

    case 'declined':
    case 'revoked':
      return 'border-stone-200 bg-stone-100 text-stone-600'

    case 'expired':
      return 'border-amber-200 bg-amber-50 text-amber-800'

    default:
      return 'border-blue-200 bg-blue-50 text-blue-800'
  }
}

function formatDate(
  value,
) {
  if (!value) {
    return 'Not available'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not available'
  }

  return date.toLocaleDateString()
}

function formatDateTime(
  value,
) {
  if (!value) {
    return 'Not available'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not available'
  }

  return date.toLocaleString()
}

function ActionNotice({
  notice,
}) {
  if (!notice?.message) {
    return null
  }

  const isError =
    notice.type ===
    'error'

  return (
    <div
      className={[
        'mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6',
        isError
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      ].join(' ')}
      role={
        isError
          ? 'alert'
          : 'status'
      }
    >
      {isError ? (
        <CircleAlert
          size={20}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          size={20}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      )}

      <span>
        {notice.message}
      </span>
    </div>
  )
}

export default function HouseholdPage() {
  const {
    currentUser,
  } = useAuth()

  const {
    household,
    membership,
    households,
    members,
    hasHousehold,
    isLoadingHousehold,
    isCreatingHousehold,
    isLoadingMembers,
    householdError,
    membersError,
    refreshHousehold,
    createHousehold,
    selectHousehold,
    loadMembers,
  } = useHousehold()

  const [
    form,
    setForm,
  ] = useState({
    name:
      '',
    usualPeopleCount:
      '1',
  })

  const [
    formError,
    setFormError,
  ] = useState('')

  const [
    inviteForm,
    setInviteForm,
  ] = useState({
    householdId:
      '',
    email:
      '',
    role:
      'member',
    customRoleLabel:
      '',
  })

  const [
    invitations,
    setInvitations,
  ] = useState([])

  const [
    isLoadingInvitations,
    setIsLoadingInvitations,
  ] = useState(false)

  const [
    invitationError,
    setInvitationError,
  ] = useState('')

  const [
    actionKey,
    setActionKey,
  ] = useState('')

  const [
    notice,
    setNotice,
  ] = useState(null)

  const manageableHouseholds =
    useMemo(
      () =>
        (Array.isArray(
          households,
        )
          ? households
          : []
        ).filter(
          (entry) =>
            entry?.membership?.role ===
              'owner' ||
            entry?.membership?.role ===
              'admin',
        ),
      [
        households,
      ],
    )

  const inviteTarget =
    useMemo(
      () =>
        manageableHouseholds.find(
          (entry) =>
            entry?.household?.id ===
            inviteForm.householdId,
        ) ||
        null,
      [
        manageableHouseholds,
        inviteForm.householdId,
      ],
    )

  const canManageHousehold =
    membership?.role ===
      'owner' ||
    membership?.role ===
      'admin'

  const canSendInvites =
    manageableHouseholds.length >
    0

  const isOwner =
    membership?.role ===
    'owner'

  const inviteTargetIsOwner =
    inviteTarget?.membership?.role ===
    'owner'

  useEffect(() => {
    if (
      manageableHouseholds.length ===
      0
    ) {
      setInviteForm(
        (current) => ({
          ...current,
          householdId:
            '',
        }),
      )
      return
    }

    const stillAvailable =
      manageableHouseholds.some(
        (entry) =>
          entry?.household?.id ===
          inviteForm.householdId,
      )

    if (stillAvailable) {
      return
    }

    const preferred =
      manageableHouseholds.find(
        (entry) =>
          entry?.household?.id ===
          household?.id,
      ) ||
      manageableHouseholds[0]

    setInviteForm(
      (current) => ({
        ...current,
        householdId:
          preferred?.household?.id ||
          '',
        role:
          'member',
        customRoleLabel:
          '',
      }),
    )
  }, [
    manageableHouseholds,
    household?.id,
    inviteForm.householdId,
  ])

  const activeInvitationCount =
    useMemo(
      () =>
        invitations.filter(
          (invitation) =>
            invitation.status ===
            'pending',
        ).length,
      [
        invitations,
      ],
    )

  const loadInvitations =
    useCallback(
      async () => {
        if (
          !inviteForm.householdId ||
          !inviteTarget
        ) {
          setInvitations([])
          setInvitationError('')
          return []
        }

        setIsLoadingInvitations(
          true,
        )
        setInvitationError('')

        try {
          const data =
            await listHouseholdInvitations(
              inviteForm.householdId,
            )

          const nextInvitations =
            Array.isArray(
              data?.invitations,
            )
              ? data.invitations
              : []

          setInvitations(
            nextInvitations,
          )

          return nextInvitations
        } catch (error) {
          setInvitationError(
            error?.message ||
              'Unable to load household invitations.',
          )
          throw error
        } finally {
          setIsLoadingInvitations(
            false,
          )
        }
      },
      [
        inviteForm.householdId,
        inviteTarget,
      ],
    )

  useEffect(() => {
    if (
      !hasHousehold ||
      !household?.id
    ) {
      return
    }

    void loadMembers()
      .catch(
        () => undefined,
      )
  }, [
    hasHousehold,
    household?.id,
    loadMembers,
  ])

  useEffect(() => {
    if (
      !hasHousehold ||
      !inviteForm.householdId ||
      !inviteTarget
    ) {
      setInvitations([])
      return
    }

    void loadInvitations()
      .catch(
        () => undefined,
      )
  }, [
    hasHousehold,
    inviteForm.householdId,
    inviteTarget,
    loadInvitations,
  ])

  const updateField =
    (
      key,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [key]:
            value,
        }),
      )
      setFormError('')
    }

  const handleCreate =
    async (
      event,
    ) => {
      event.preventDefault()

      const name =
        form.name.trim()

      const usualPeopleCount =
        Number(
          form.usualPeopleCount,
        )

      if (
        name.length <
        2
      ) {
        setFormError(
          'Enter a household name with at least 2 characters.',
        )
        return
      }

      if (
        !Number.isInteger(
          usualPeopleCount,
        ) ||
        usualPeopleCount <
          1 ||
        usualPeopleCount >
          50
      ) {
        setFormError(
          'Usual people count must be between 1 and 50.',
        )
        return
      }

      try {
        await createHousehold({
          name,
          usualPeopleCount,
        })
        setFormError('')
      } catch (error) {
        setFormError(
          error?.message ||
            'Unable to create your household.',
        )
      }
    }

  const handleInvite =
    async (
      event,
    ) => {
      event.preventDefault()

      if (
        !inviteForm.householdId ||
        !inviteTarget ||
        actionKey
      ) {
        return
      }

      const email =
        inviteForm.email
          .trim()
          .toLowerCase()

      if (!email) {
        setNotice({
          type:
            'error',
          message:
            'Enter the email address you want to invite.',
        })
        return
      }

      const roleDetails =
        getInviteRoleDetails(
          inviteForm.role,
          inviteForm.customRoleLabel,
        )

      if (
        inviteForm.role ===
          'other' &&
        !roleDetails.roleLabel
      ) {
        setNotice({
          type:
            'error',
          message:
            'Enter a name for the custom household role.',
        })
        return
      }

      if (
        inviteForm.role ===
          'other' &&
        ['owner', 'admin'].includes(
          roleDetails.roleLabel
            .toLowerCase(),
        )
      ) {
        setNotice({
          type:
            'error',
          message:
            'Owner and Admin are reserved household access roles. Choose the matching role option instead.',
        })
        return
      }

      const role =
        inviteTargetIsOwner
          ? roleDetails.role
          : 'member'

      const roleLabel =
        role ===
          'admin'
          ? 'Admin'
          : roleDetails.roleLabel

      setActionKey(
        'create-invitation',
      )
      setNotice(null)

      try {
        const result =
          await createHouseholdInvitation(
            inviteForm.householdId,
            {
              email,
              role,
              roleLabel,
            },
          )

        setInviteForm(
          (current) => ({
            ...current,
            email:
              '',
            role:
              'member',
            customRoleLabel:
              '',
          }),
        )

        await loadInvitations()

        const delivered =
          result?.delivery
            ?.delivered ===
          true

        setNotice({
          type:
            'success',
          message:
            delivered
              ? `Invitation sent to ${email}.`
              : `Invitation created for ${email}. Email delivery is pending retry, so you can use Resend after delivery is restored.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to create the household invitation.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleResendInvitation =
    async (
      invitation,
    ) => {
      if (
        !inviteForm.householdId ||
        !invitation?.id ||
        actionKey
      ) {
        return
      }

      setActionKey(
        `resend:${invitation.id}`,
      )
      setNotice(null)

      try {
        const result =
          await resendHouseholdInvitation(
            inviteForm.householdId,
            invitation.id,
          )

        await loadInvitations()

        setNotice({
          type:
            'success',
          message:
            result?.delivery
              ?.delivered ===
            true
              ? `Invitation resent to ${invitation.invitedEmail}. The previous link is no longer valid.`
              : `Invitation link was rotated for ${invitation.invitedEmail}, but email delivery is pending retry.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to resend the household invitation.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleRevokeInvitation =
    async (
      invitation,
    ) => {
      if (
        !inviteForm.householdId ||
        !invitation?.id ||
        actionKey
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `Revoke the invitation for ${invitation.invitedEmail}?`,
        )

      if (!confirmed) {
        return
      }

      setActionKey(
        `revoke:${invitation.id}`,
      )
      setNotice(null)

      try {
        await revokeHouseholdInvitation(
          inviteForm.householdId,
          invitation.id,
        )

        await loadInvitations()

        setNotice({
          type:
            'success',
          message:
            `Invitation for ${invitation.invitedEmail} was revoked.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to revoke the household invitation.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleMemberRoleChange =
    async (
      member,
      nextRole,
    ) => {
      if (
        !household?.id ||
        !member?.membershipId ||
        actionKey ||
        member.role ===
          nextRole
      ) {
        return
      }

      setActionKey(
        `role:${member.membershipId}`,
      )
      setNotice(null)

      try {
        await updateHouseholdMemberRole(
          household.id,
          member.membershipId,
          nextRole,
        )

        await loadMembers()

        setNotice({
          type:
            'success',
          message:
            `${member.user.name} is now a household ${getRoleLabel(
              nextRole,
            ).toLowerCase()}.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to update the household member role.',
        })
      } finally {
        setActionKey('')
      }
    }

  const handleRemoveMember =
    async (
      member,
    ) => {
      if (
        !household?.id ||
        !member?.membershipId ||
        actionKey
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `Remove ${member.user.name} from ${household.name}?`,
        )

      if (!confirmed) {
        return
      }

      setActionKey(
        `remove:${member.membershipId}`,
      )
      setNotice(null)

      try {
        await removeHouseholdMember(
          household.id,
          member.membershipId,
        )

        await loadMembers()

        setNotice({
          type:
            'success',
          message:
            `${member.user.name} was removed from the household.`,
        })
      } catch (error) {
        setNotice({
          type:
            'error',
          message:
            error?.message ||
            'Unable to remove the household member.',
        })
      } finally {
        setActionKey('')
      }
    }

  if (isLoadingHousehold) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-stone-200 bg-white">
          <div className="text-center">
            <LoaderCircle
              size={30}
              className="mx-auto animate-spin text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-bold text-stone-600">
              Loading household...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (
    householdError &&
    !household
  ) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-xl rounded-[28px] border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <CircleAlert
            size={32}
            className="text-red-600"
            aria-hidden="true"
          />
          <h1 className="mt-5 text-2xl font-black text-stone-950">
            Unable to load household
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {householdError.message ||
              'Please try again.'}
          </p>
          <button
            type="button"
            onClick={() => {
              void refreshHousehold()
                .catch(
                  () => undefined,
                )
            }}
            className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!hasHousehold) {
    const canCreateHousehold =
      currentUser?.accountStatus ===
      'active'

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Home
              size={27}
              aria-hidden="true"
            />
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Household
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            Create your household
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            Household setup gives EPANTRY a shared context for pantry items, planning, lists and household-level food preferences. You can invite family members after creating it.
          </p>

          {!canCreateHousehold ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <CircleAlert
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold leading-6 text-amber-900">
                  Household creation becomes available when your EPANTRY account is active.
                </p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleCreate}
              className="mt-8 grid gap-5"
              noValidate
            >
              {formError ? (
                <div
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="household-name"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Household name
                </label>
                <input
                  id="household-name"
                  type="text"
                  maxLength={120}
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      'name',
                      event.target.value,
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950"
                  placeholder="e.g. Sharma Household"
                />
              </div>

              <div>
                <label
                  htmlFor="household-people"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Usual number of people
                </label>
                <input
                  id="household-people"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  step="1"
                  value={form.usualPeopleCount}
                  onChange={(event) =>
                    updateField(
                      'usualPeopleCount',
                      event.target.value,
                    )
                  }
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950"
                />
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  This is planning context, not the number of registered EPANTRY accounts.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreatingHousehold}
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingHousehold ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Home
                    size={18}
                    aria-hidden="true"
                  />
                )}
                {isCreatingHousehold
                  ? 'Creating household...'
                  : 'Create household'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 pb-8 pt-4 sm:px-6 sm:pt-5 lg:px-8">
      <div className="w-full max-w-none">
        <header className="rounded-[28px] bg-stone-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Household
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {household.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Shared Customer context for pantry, planning and household decisions.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void Promise.all([
                  refreshHousehold(),
                  loadMembers(),
                  canSendInvites
                    ? loadInvitations()
                    : Promise.resolve([]),
                ]).catch(
                  () => undefined,
                )
              }}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-stone-950 transition hover:bg-stone-100"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </header>

        <ActionNotice
          notice={notice}
        />

        <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              How your household works
            </p>
            <h2 className="mt-2 text-2xl font-black text-stone-950">
              Your account can belong to more than one household.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Use your own EPANTRY login, switch the household you are working in, and keep the role you were given in each household.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Home
                    size={17}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Step 1
                  </p>
                  <p className="mt-0.5 text-sm font-black text-stone-950">
                    Choose a household
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-600">
                Choose which household is active before using shared Pantry, meal planning and other household features.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Send
                    size={17}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Step 2
                  </p>
                  <p className="mt-0.5 text-sm font-black text-stone-950">
                    Invite your people
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-600">
                If you are Owner or Admin, choose the household, role and verified email address before sending an invite.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Users
                    size={17}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Step 3
                  </p>
                  <p className="mt-0.5 text-sm font-black text-stone-950">
                    They join safely
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-600">
                A new person registers as a Customer, reviews who invited them and accepts or rejects the requested role.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <ShieldCheck
                    size={17}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Step 4
                  </p>
                  <p className="mt-0.5 text-sm font-black text-stone-950">
                    Manage access
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-600">
                Each household keeps its own Owner, Admin or Member role. Invitations never grant Owner access.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                Your households
              </p>
              <h2 className="mt-2 text-2xl font-black text-stone-950">
                See where you belong and what role you have.
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                The active household is the one EPANTRY uses for Pantry, meal planning and other shared household features.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(Array.isArray(households) ? households : []).map(
              (entry) => {
                const isActive =
                  entry?.household?.id ===
                  household?.id

                return (
                  <div
                    key={entry.household.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-stone-950">
                          {entry.household.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          Your role: {getRoleLabel(entry.membership.role, entry.membership.roleLabel)}
                        </p>
                      </div>
                      <span className={[
                        'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-white text-stone-600',
                      ].join(' ')}>
                        {isActive
                          ? 'Active'
                          : getRoleLabel(entry.membership.role, entry.membership.roleLabel)}
                      </span>
                    </div>

                    {!isActive ? (
                      <button
                        type="button"
                        disabled={Boolean(actionKey)}
                        onClick={() => {
                          setActionKey(
                            `select:${entry.household.id}`,
                          )
                          setNotice(null)

                          void selectHousehold(
                            entry.household.id,
                          )
                            .then(() => {
                              setNotice({
                                type:
                                  'success',
                                message:
                                  `${entry.household.name} is now your active household.`,
                              })
                            })
                            .catch((error) => {
                              setNotice({
                                type:
                                  'error',
                                message:
                                  error?.message ||
                                  'Unable to switch household.',
                              })
                            })
                            .finally(() => {
                              setActionKey('')
                            })
                        }}
                        className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-stone-200 bg-white px-3 text-xs font-black text-stone-800 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Use this household
                      </button>
                    ) : null}
                  </div>
                )
              },
            )}
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <Home
              size={20}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">
              Household
            </p>
            <p className="mt-2 font-black text-stone-950">
              {household.name}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <Users
              size={20}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">
              Active members
            </p>
            <p className="mt-2 font-black text-stone-950">
              {members.length}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <ShieldCheck
              size={20}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">
              Your role
            </p>
            <p className="mt-2 font-black text-stone-950">
              {getRoleLabel(
                membership.role,
                membership.roleLabel,
              )}
            </p>
          </div>
        </div>

        {canSendInvites ? (
          <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Invite people
                </p>
                <h2 className="mt-2 text-2xl font-black text-stone-950">
                  Add household members
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                  Invitations are sent by email. The invited account must sign in with the same verified email address before joining.
                </p>
              </div>

              <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-600">
                {activeInvitationCount} pending
              </div>
            </div>

            <form
              onSubmit={handleInvite}
              className="mt-6 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_180px_auto]"
            >
              <div>
                <label
                  htmlFor="household-invite-household"
                  className="sr-only"
                >
                  Household
                </label>
                <select
                  id="household-invite-household"
                  value={inviteForm.householdId}
                  onChange={(event) => {
                    setInviteForm(
                      (current) => ({
                        ...current,
                        householdId:
                          event.target.value,
                        role:
                          'member',
                        customRoleLabel:
                          '',
                      }),
                    )
                    setNotice(null)
                  }}
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-800"
                >
                  {manageableHouseholds.map(
                    (entry) => (
                      <option
                        key={entry.household.id}
                        value={entry.household.id}
                      >
                        {entry.household.name} · {getRoleLabel(entry.membership.role, entry.membership.roleLabel)}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="household-invite-email"
                  className="sr-only"
                >
                  Email address
                </label>
                <input
                  id="household-invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteForm.email}
                  onChange={(event) => {
                    setInviteForm(
                      (current) => ({
                        ...current,
                        email:
                          event.target.value,
                      }),
                    )
                    setNotice(null)
                  }}
                  placeholder="family@example.com"
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950"
                />
              </div>

              <div>
                <label
                  htmlFor="household-invite-role"
                  className="sr-only"
                >
                  Household role
                </label>
                <select
                  id="household-invite-role"
                  value={inviteForm.role}
                  onChange={(event) => {
                    setInviteForm(
                      (current) => ({
                        ...current,
                        role:
                          event.target.value,
                        customRoleLabel:
                          event.target.value ===
                            'other'
                            ? current.customRoleLabel
                            : '',
                      }),
                    )
                    setNotice(null)
                  }}
                  className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-800"
                >
                  <option value="member">
                    Member
                  </option>
                  {inviteTargetIsOwner ? (
                    <option value="admin">
                      Admin
                    </option>
                  ) : null}
                  <option value="partner">
                    Partner / Spouse
                  </option>
                  <option value="parent">
                    Parent
                  </option>
                  <option value="child">
                    Child
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>

                {inviteForm.role ===
                'other' ? (
                  <input
                    type="text"
                    value={inviteForm.customRoleLabel}
                    maxLength={40}
                    onChange={(event) => {
                      setInviteForm(
                        (current) => ({
                          ...current,
                          customRoleLabel:
                            event.target.value,
                        }),
                      )
                      setNotice(null)
                    }}
                    placeholder="e.g. Sister, Caregiver"
                    aria-label="Custom household role name"
                    className="focus-ring mt-2 min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950"
                  />
                ) : null}
              </div>

              <button
                type="submit"
                disabled={Boolean(actionKey)}
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionKey ===
                'create-invitation' ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send
                    size={17}
                    aria-hidden="true"
                  />
                )}
                Send invite
              </button>
            </form>

            {!inviteTargetIsOwner ? (
              <p className="mt-3 text-xs leading-5 text-stone-500">
                Household admins can invite standard members. Only the household owner can invite another admin.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                Membership
              </p>
              <h2 className="mt-2 text-2xl font-black text-stone-950">
                Household members
              </h2>
            </div>
            <Users
              size={24}
              className="text-stone-400"
              aria-hidden="true"
            />
          </div>

          {membersError ? (
            <div
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              role="alert"
            >
              {membersError.message ||
                'Unable to load household members.'}
            </div>
          ) : null}

          {isLoadingMembers ? (
            <div className="flex min-h-32 items-center justify-center">
              <LoaderCircle
                size={24}
                className="animate-spin text-emerald-700"
                aria-label="Loading household members"
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {members.map(
                (member) => {
                  const canChangeRole =
                    isOwner &&
                    !member.isCurrentUser &&
                    member.role !==
                      'owner'

                  const canRemove =
                    !member.isCurrentUser &&
                    member.role !==
                      'owner' &&
                    (
                      isOwner ||
                      (
                        membership.role ===
                          'admin' &&
                        member.role ===
                          'member'
                      )
                    )

                  const rowActionPending =
                    actionKey.endsWith(
                      member.membershipId,
                    )

                  return (
                    <div
                      key={member.membershipId}
                      className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-black text-stone-950">
                              {member.user.name}
                            </p>
                            {member.isCurrentUser ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                                You
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            Joined {formatDate(
                              member.joinedAt,
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {canChangeRole ? (
                            <label className="relative">
                              <span className="sr-only">
                                Change role for {member.user.name}
                              </span>
                              <select
                                value={member.role}
                                disabled={
                                  Boolean(actionKey)
                                }
                                onChange={(event) => {
                                  void handleMemberRoleChange(
                                    member,
                                    event.target.value,
                                  )
                                }}
                                className="focus-ring min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-black text-stone-700 disabled:opacity-60"
                              >
                                <option value="member">
                                  Member
                                </option>
                                <option value="admin">
                                  Admin
                                </option>
                              </select>
                            </label>
                          ) : (
                            <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
                              {getRoleLabel(
                                member.role,
                                member.roleLabel,
                              )}
                            </span>
                          )}

                          {canChangeRole &&
                          member.role ===
                            'member' &&
                          member.roleLabel &&
                          member.roleLabel !==
                            'Member' ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">
                              {member.roleLabel}
                            </span>
                          ) : null}

                          {canRemove ? (
                            <button
                              type="button"
                              disabled={Boolean(actionKey)}
                              onClick={() => {
                                void handleRemoveMember(
                                  member,
                                )
                              }}
                              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {rowActionPending ? (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2
                                  size={14}
                                  aria-hidden="true"
                                />
                              )}
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                },
              )}

              {members.length ===
              0 ? (
                <p className="py-8 text-center text-sm font-semibold text-stone-500">
                  No active household members were found.
                </p>
              ) : null}
            </div>
          )}

          {isOwner ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <UserRoundCog
                size={19}
                className="mt-0.5 shrink-0 text-stone-500"
                aria-hidden="true"
              />
              <p className="text-xs leading-5 text-stone-600">
                Only the owner can promote or demote household admins. Ownership transfer is intentionally not handled by the normal member-role control.
              </p>
            </div>
          ) : null}
        </section>

        {canSendInvites ? (
          <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Invitations
                </p>
                <h2 className="mt-2 text-2xl font-black text-stone-950">
                  Invitation history
                </h2>
              </div>
              <MailPlus
                size={24}
                className="text-stone-400"
                aria-hidden="true"
              />
            </div>

            {invitationError ? (
              <div
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
                role="alert"
              >
                {invitationError}
              </div>
            ) : null}

            {isLoadingInvitations ? (
              <div className="flex min-h-32 items-center justify-center">
                <LoaderCircle
                  size={24}
                  className="animate-spin text-emerald-700"
                  aria-label="Loading household invitations"
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                {invitations.map(
                  (invitation) => {
                    const isPending =
                      invitation.status ===
                      'pending'

                    const canResend =
                      invitation.status ===
                        'pending' ||
                      invitation.status ===
                        'expired'

                    const isAdminInvitation =
                      invitation.role ===
                      'admin'

                    const adminCanAct =
                      inviteTargetIsOwner ||
                      !isAdminInvitation

                    return (
                      <div
                        key={invitation.id}
                        className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-all font-black text-stone-950">
                                {invitation.invitedEmail}
                              </p>
                              <span
                                className={[
                                  'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
                                  getInvitationStatusClasses(
                                    invitation.status,
                                  ),
                                ].join(' ')}
                              >
                                {invitation.status}
                              </span>
                              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-stone-600">
                                {getRoleLabel(
                                  invitation.role,
                                  invitation.roleLabel,
                                )}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-500">
                              <span>
                                Created {formatDate(
                                  invitation.createdAt,
                                )}
                              </span>
                              <span>
                                Expires {formatDateTime(
                                  invitation.expiresAt,
                                )}
                              </span>
                              <span>
                                Delivery: {invitation.deliveryStatus ||
                                  'pending'}
                              </span>
                              {invitation.resendCount >
                              0 ? (
                                <span>
                                  Resent {invitation.resendCount} time{invitation.resendCount ===
                                  1
                                    ? ''
                                    : 's'}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {adminCanAct &&
                          (
                            isPending ||
                            canResend
                          ) ? (
                            <div className="flex flex-wrap gap-2">
                              {canResend ? (
                                <button
                                  type="button"
                                  disabled={Boolean(actionKey)}
                                  onClick={() => {
                                    void handleResendInvitation(
                                      invitation,
                                    )
                                  }}
                                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-black text-stone-700 transition hover:bg-stone-100 disabled:opacity-60"
                                >
                                  {actionKey ===
                                  `resend:${invitation.id}` ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <RotateCcw
                                      size={14}
                                      aria-hidden="true"
                                    />
                                  )}
                                  Resend
                                </button>
                              ) : null}

                              {isPending ? (
                                <button
                                  type="button"
                                  disabled={Boolean(actionKey)}
                                  onClick={() => {
                                    void handleRevokeInvitation(
                                      invitation,
                                    )
                                  }}
                                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                                >
                                  {actionKey ===
                                  `revoke:${invitation.id}` ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <XCircle
                                      size={14}
                                      aria-hidden="true"
                                    />
                                  )}
                                  Revoke
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  },
                )}

                {invitations.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
                    <Clock3
                      size={24}
                      className="mx-auto text-stone-400"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-black text-stone-800">
                      No invitations yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      New invitations and their lifecycle will appear here.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
