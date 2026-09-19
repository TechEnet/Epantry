import {
  useEffect,
  useState,
} from 'react'

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Home,
  LoaderCircle,
  MailCheck,
  ShieldCheck,
  UserRoundCheck,
  X,
  XCircle,
} from 'lucide-react'

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  useHousehold,
} from '../context/HouseholdContext'

import {
  acceptHouseholdInvitation,
  declineHouseholdInvitation,
  getHouseholdInvitation,
} from '../services/householdInvitation.service'

function getRoleLabel(
  role,
  roleLabel,
) {
  if (
    role ===
    'admin'
  ) {
    return 'Household Admin'
  }

  const label =
    String(
      roleLabel ||
        '',
    ).trim()

  return label ||
    'Household Member'
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

function getInvitationStatusCopy(
  status,
) {
  switch (status) {
    case 'accepted':
      return {
        title:
          'Invitation already accepted',
        description:
          'This invitation has already been used to join the household.',
      }

    case 'declined':
      return {
        title:
          'Invitation declined',
        description:
          'This invitation was declined and can no longer be accepted.',
      }

    case 'revoked':
      return {
        title:
          'Invitation revoked',
        description:
          'The household owner or admin revoked this invitation.',
      }

    case 'expired':
      return {
        title:
          'Invitation expired',
        description:
          'Ask the household owner or admin to resend the invitation.',
      }

    default:
      return {
        title:
          'Household invitation',
        description:
          'Review the invitation before joining this household.',
      }
  }
}

export default function HouseholdInvitationPage() {
  const {
    token,
  } = useParams()

  const navigate =
    useNavigate()

  const {
    refreshHousehold,
  } = useHousehold()

  const [
    invitationData,
    setInvitationData,
  ] = useState(null)

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const [
    action,
    setAction,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  const [
    success,
    setSuccess,
  ] = useState('')

  useEffect(() => {
    let isActive =
      true

    const loadInvitation =
      async () => {
        if (!token) {
          setError(
            'This household invitation link is incomplete.',
          )
          setIsLoading(
            false,
          )
          return
        }

        setIsLoading(
          true,
        )
        setError('')

        try {
          const data =
            await getHouseholdInvitation(
              token,
            )

          if (isActive) {
            setInvitationData(
              data,
            )
          }
        } catch (requestError) {
          if (isActive) {
            setError(
              requestError?.message ||
                'Unable to load this household invitation.',
            )
          }
        } finally {
          if (isActive) {
            setIsLoading(
              false,
            )
          }
        }
      }

    void loadInvitation()

    return () => {
      isActive =
        false
    }
  }, [
    token,
  ])

  const invitation =
    invitationData?.invitation ||
    null

  const household =
    invitationData?.household ||
    null

  const inviter =
    invitationData?.inviter ||
    null

  const statusCopy =
    getInvitationStatusCopy(
      invitation?.status,
    )

  const handleAccept =
    async () => {
      if (
        !token ||
        action
      ) {
        return
      }

      setAction(
        'accept',
      )
      setError('')
      setSuccess('')

      try {
        const result =
          await acceptHouseholdInvitation(
            token,
          )

        setInvitationData(
          (current) => ({
            ...current,
            invitation:
              result?.invitation ||
              current?.invitation,
          }),
        )

        await refreshHousehold()

        setSuccess(
          result?.alreadyAccepted
            ? 'You are already a member of this household.'
            : 'Invitation accepted. Your household access is now active.',
        )

        navigate(
          '/account/household',
          {
            replace:
              true,
          },
        )
      } catch (requestError) {
        setError(
          requestError?.message ||
            'Unable to accept the household invitation.',
        )
      } finally {
        setAction('')
      }
    }

  const handleDecline =
    async () => {
      if (
        !token ||
        action
      ) {
        return
      }

      setAction(
        'decline',
      )
      setError('')
      setSuccess('')

      try {
        const result =
          await declineHouseholdInvitation(
            token,
          )

        setInvitationData(
          (current) => ({
            ...current,
            invitation:
              result?.invitation ||
              current?.invitation,
          }),
        )

        setSuccess(
          'Invitation declined. No household access was added to your account.',
        )

        navigate(
          '/dashboard',
          {
            replace:
              true,
          },
        )
      } catch (requestError) {
        setError(
          requestError?.message ||
            'Unable to decline the household invitation.',
        )
      } finally {
        setAction('')
      }
    }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-stone-200 bg-white">
          <div className="text-center">
            <LoaderCircle
              size={30}
              className="mx-auto animate-spin text-emerald-700"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-bold text-stone-600">
              Loading household invitation...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (
    error &&
    !invitation
  ) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <CircleAlert
            size={32}
            className="text-red-600"
            aria-hidden="true"
          />
          <h1 className="mt-5 text-2xl font-black text-stone-950">
            Unable to open invitation
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {error}
          </p>
          <Link
            to="/account/household"
            className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white"
          >
            Open Household
            <ArrowRight
              size={16}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    )
  }

  const isPending =
    invitation?.status ===
    'pending'

  const isAccepted =
    invitation?.status ===
    'accepted'

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-md sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto">
        <section className="relative overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-2xl">
          <button
            type="button"
            onClick={() =>
              navigate(
                '/dashboard',
              )
            }
            className="focus-ring absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close invitation"
          >
            <X
              size={17}
              aria-hidden="true"
            />
          </button>
          <div className="bg-stone-950 p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                  Household Invitation
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight">
                  {statusCopy.title}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
                  {statusCopy.description}
                </p>

                {isPending ? (
                  <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white">
                    {inviter?.name || 'A household administrator'} invited you to join {household?.name || 'this household'} as {getRoleLabel(invitation?.role, invitation?.roleLabel)}.
                  </p>
                ) : null}
              </div>

              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-600">
                <MailCheck
                  size={22}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {success ? (
              <div
                className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900"
                role="status"
              >
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{success}</span>
              </div>
            ) : null}

            {error ? (
              <div
                className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-900"
                role="alert"
              >
                <CircleAlert
                  size={20}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <Home
                  size={20}
                  className="text-emerald-700"
                  aria-hidden="true"
                />
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                  Household
                </p>
                <p className="mt-2 text-lg font-black text-stone-950">
                  {household?.name ||
                    'Household'}
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <ShieldCheck
                  size={20}
                  className="text-emerald-700"
                  aria-hidden="true"
                />
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                  Access level
                </p>
                <p className="mt-2 text-lg font-black text-stone-950">
                  {getRoleLabel(
                    invitation?.role,
                    invitation?.roleLabel,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 p-5">
                <UserRoundCheck
                  size={19}
                  className="text-stone-500"
                  aria-hidden="true"
                />
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                  Invited email
                </p>
                <p className="mt-2 break-all text-sm font-bold text-stone-900">
                  {invitation?.invitedEmail}
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 p-5">
                <Clock3
                  size={19}
                  className="text-stone-500"
                  aria-hidden="true"
                />
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                  Expires
                </p>
                <p className="mt-2 text-sm font-bold text-stone-900">
                  {formatDateTime(
                    invitation?.expiresAt,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-sm font-black text-violet-950">
                Your existing households stay available
              </p>
              <p className="mt-1 text-xs leading-5 text-violet-800">
                Accepting adds this household with the invited role. It does not remove your other active household memberships.
              </p>
            </div>

            {isPending ? (
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={Boolean(action)}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action === 'decline' ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                  Decline
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={Boolean(action)}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action === 'accept' ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      size={17}
                      aria-hidden="true"
                    />
                  )}
                  Accept invitation
                </button>
              </div>
            ) : (
              <div className="mt-7 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    navigate(
                      isAccepted
                        ? '/account/household'
                        : '/dashboard',
                    )
                  }}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 text-sm font-black text-white"
                >
                  {isAccepted
                    ? 'Open household'
                    : 'Back to dashboard'}
                  <ArrowRight
                    size={17}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}

            {success &&
            invitation?.status ===
              'accepted' ? (
              <div className="mt-4 flex justify-end">
                <Link
                  to="/account/household"
                  className="focus-ring inline-flex items-center gap-2 text-sm font-black text-emerald-700"
                >
                  Continue to Household
                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
