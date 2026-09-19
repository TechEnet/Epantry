import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  ShieldOff,
  Store,
  X,
} from 'lucide-react'

import {
  useState,
} from 'react'

import AdminShell from '../components/AdminShell'

import {
  useAdminHostReviewActions,
  useAdminHosts,
} from '../hooks/useAdminHostReview'

const STATUS_OPTIONS = [
  'pending',
  'active',
  'rejected',
  'suspended',
  'all',
]

function statusClasses(
  status,
) {
  switch (
    status
  ) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800'

    case 'pending':
      return 'bg-amber-100 text-amber-800'

    case 'rejected':
      return 'bg-red-100 text-red-700'

    case 'suspended':
      return 'bg-stone-200 text-stone-700'

    default:
      return 'bg-stone-100 text-stone-600'
  }
}

function formatDate(
  value,
) {
  if (!value) {
    return '—'
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
    return '—'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    date,
  )
}

function getErrorMessage(
  error,
) {
  return (
    error?.message ||
    'Unable to complete this administrative action.'
  )
}

export default function AdminHostReviewPage() {
  const [
    status,
    setStatus,
  ] = useState(
    'pending',
  )

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    actionTarget,
    setActionTarget,
  ] = useState(null)

  const [
    reasonDetails,
    setReasonDetails,
  ] = useState('')

  const [
    actionError,
    setActionError,
  ] = useState('')

  const {
    hosts,
    pagination,
    isLoading,
    isFetching,
    error,
  } = useAdminHosts({
    status,
    page,
    limit:
      20,
  })

  const {
    canApproveHost,
    canRejectHost,
    canSuspendHost,

    approveHost,
    rejectHost,
    suspendHost,

    isMutatingHost,
  } =
    useAdminHostReviewActions()

  const changeStatus =
    (
      nextStatus,
    ) => {
      setStatus(
        nextStatus,
      )

      setPage(
        1,
      )
    }

  const openAction =
    (
      host,
      action,
    ) => {
      setActionTarget({
        host,
        action,
      })

      setReasonDetails(
        '',
      )

      setActionError(
        '',
      )
    }

  const closeAction =
    () => {
      if (
        isMutatingHost
      ) {
        return
      }

      setActionTarget(
        null,
      )

      setReasonDetails(
        '',
      )

      setActionError(
        '',
      )
    }

  const submitAction =
    async () => {
      if (
        !actionTarget
      ) {
        return
      }

      const userId =
        actionTarget.host
          ?.id

      if (!userId) {
        setActionError(
          'This Host record does not contain a valid user ID.',
        )

        return
      }

      setActionError(
        '',
      )

      try {
        switch (
          actionTarget.action
        ) {
          case 'approve':
            await approveHost({
              userId,
              reasonDetails:
                reasonDetails.trim() ||
                null,
            })

            break

          case 'reject':
            await rejectHost({
              userId,
              reasonDetails:
                reasonDetails.trim() ||
                null,
            })

            break

          case 'suspend':
            await suspendHost({
              userId,
              reasonDetails:
                reasonDetails.trim() ||
                null,
            })

            break

          default:
            return
        }

        setActionTarget(
          null,
        )

        setReasonDetails(
          '',
        )
      } catch (
        actionRequestError
      ) {
        setActionError(
          getErrorMessage(
            actionRequestError,
          ),
        )
      }
    }

  const totalPages =
    pagination?.totalPages ||
    0

  return (
    <AdminShell
      title="Host Review"
      description="Review Host applications and manage approved Host access using the permission-scoped governance workflow."
      actions={
        isFetching &&
        !isLoading ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-500 shadow-sm">
            <LoaderCircle
              size={14}
              className="animate-spin"
            />

            Refreshing
          </div>
        ) : null
      }
    >

      {/* ===========================================================
          FILTER
      =========================================================== */}

      <div className="flex flex-wrap gap-2">

        {STATUS_OPTIONS.map(
          (item) => (
            <button
              key={
                item
              }
              type="button"
              onClick={() =>
                changeStatus(
                  item,
                )
              }
              className={[
                'focus-ring',
                'rounded-full',
                'px-4',
                'py-2',
                'text-xs',
                'font-black',
                'capitalize',
                'transition',

                status ===
                item
                  ? 'bg-emerald-700 text-white'
                  : 'border border-stone-200 bg-white text-stone-600 hover:border-emerald-200 hover:text-emerald-800',
              ].join(
                ' ',
              )}
            >
              {item}
            </button>
          ),
        )}

      </div>


      {/* ===========================================================
          CONTENT
      =========================================================== */}

      <section className="mt-5 overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">

        {isLoading ? (
          <div className="grid min-h-72 place-items-center">

            <div className="text-center">

              <LoaderCircle
                size={28}
                className="mx-auto animate-spin text-emerald-700"
              />

              <p className="mt-3 text-sm font-bold text-stone-500">
                Loading Host applications…
              </p>

            </div>

          </div>
        ) : error ? (
          <div className="p-6">

            <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-700">

              <CircleAlert
                size={20}
                className="shrink-0"
              />

              <p className="text-sm font-semibold">
                {
                  getErrorMessage(
                    error,
                  )
                }
              </p>

            </div>

          </div>
        ) : hosts.length ===
          0 ? (
          <div className="grid min-h-72 place-items-center p-6 text-center">

            <div>

              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Store
                  size={26}
                />
              </div>

              <h2 className="mt-4 text-lg font-black text-stone-950">
                No Host records
              </h2>

              <p className="mt-2 text-sm text-stone-500">
                There are no Host records matching the selected status.
              </p>

            </div>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[840px] border-collapse">

              <thead className="bg-stone-50">

                <tr className="text-left text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">

                  <th className="px-5 py-4">
                    Host
                  </th>

                  <th className="px-5 py-4">
                    Contact
                  </th>

                  <th className="px-5 py-4">
                    Status
                  </th>

                  <th className="px-5 py-4">
                    Updated
                  </th>

                  <th className="px-5 py-4 text-right">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-stone-100">

                {hosts.map(
                  (host) => {
                    const hostStatus =
                      host
                        ?.hostAccessStatus ||
                      'unknown'

                    return (
                      <tr
                        key={
                          host.id
                        }
                        className="hover:bg-stone-50/70"
                      >

                        <td className="px-5 py-4">

                          <p className="font-black text-stone-950">
                            {
                              host.name ||
                              'Unnamed user'
                            }
                          </p>

                          <p className="mt-1 max-w-[240px] truncate text-xs text-stone-400">
                            ID: {
                              host.id
                            }
                          </p>

                        </td>


                        <td className="px-5 py-4">

                          <p className="text-sm font-semibold text-stone-700">
                            {
                              host.email ||
                              '—'
                            }
                          </p>

                          <p className="mt-1 text-xs text-stone-400">
                            {
                              host.phone ||
                              'No phone'
                            }
                          </p>

                        </td>


                        <td className="px-5 py-4">

                          <span
                            className={[
                              'inline-flex',
                              'rounded-full',
                              'px-3',
                              'py-1',
                              'text-xs',
                              'font-black',
                              'capitalize',

                              statusClasses(
                                hostStatus,
                              ),
                            ].join(
                              ' ',
                            )}
                          >
                            {
                              hostStatus
                            }
                          </span>

                        </td>


                        <td className="px-5 py-4 text-sm text-stone-500">
                          {
                            formatDate(
                              host.updatedAt ||
                              host.hostRequestedAt,
                            )
                          }
                        </td>


                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2">

                            {hostStatus ===
                              'pending' &&
                              canApproveHost && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAction(
                                      host,
                                      'approve',
                                    )
                                  }
                                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800"
                                >
                                  <Check
                                    size={14}
                                  />

                                  Approve
                                </button>
                              )}


                            {hostStatus ===
                              'pending' &&
                              canRejectHost && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAction(
                                      host,
                                      'reject',
                                    )
                                  }
                                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-50"
                                >
                                  <X
                                    size={14}
                                  />

                                  Reject
                                </button>
                              )}


                            {hostStatus ===
                              'active' &&
                              canSuspendHost && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAction(
                                      host,
                                      'suspend',
                                    )
                                  }
                                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-black text-stone-700 transition hover:bg-stone-100"
                                >
                                  <ShieldOff
                                    size={14}
                                  />

                                  Suspend
                                </button>
                              )}

                          </div>

                        </td>

                      </tr>
                    )
                  },
                )}

              </tbody>

            </table>

          </div>
        )}


        {/* Pagination */}

        {!isLoading &&
          !error &&
          hosts.length >
            0 && (
            <div className="flex items-center justify-between border-t border-stone-200 px-5 py-4">

              <p className="text-xs font-semibold text-stone-500">
                Page {
                  pagination?.page ||
                  page
                }
                {
                  pagination?.total
                    ? ` · ${pagination.total} records`
                    : ''
                }
              </p>


              <div className="flex gap-2">

                <button
                  type="button"
                  disabled={
                    page <=
                    1
                  }
                  onClick={() =>
                    setPage(
                      (
                        current,
                      ) =>
                        Math.max(
                          1,
                          current -
                            1,
                        ),
                    )
                  }
                  className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>


                <button
                  type="button"
                  disabled={
                    totalPages >
                      0
                      ? page >=
                        totalPages
                      : hosts.length <
                        20
                  }
                  onClick={() =>
                    setPage(
                      (
                        current,
                      ) =>
                        current +
                        1,
                    )
                  }
                  className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>

              </div>

            </div>
          )}

      </section>


      {/* ===========================================================
          ACTION MODAL
      =========================================================== */}

      {actionTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-stone-950/50 p-4 backdrop-blur-sm">

          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-[26px] border border-stone-200 bg-white p-6 shadow-2xl"
          >

            <h2 className="text-xl font-black capitalize text-stone-950">
              {
                actionTarget.action
              } Host
            </h2>

            <p className="mt-2 text-sm leading-6 text-stone-500">
              You are about to {
                actionTarget.action
              } access for{' '}
              <span className="font-bold text-stone-800">
                {
                  actionTarget
                    .host
                    ?.name ||
                  actionTarget
                    .host
                    ?.email
                }
              </span>.
              This privileged action will be audited.
            </p>


            <label className="mt-5 block">

              <span className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
                Review note
              </span>

              <textarea
                value={
                  reasonDetails
                }
                onChange={(
                  event,
                ) =>
                  setReasonDetails(
                    event.target
                      .value,
                  )
                }
                rows={4}
                maxLength={1000}
                placeholder="Optional operational context for the audit trail…"
                className="focus-ring mt-2 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800"
              />

            </label>


            {actionError && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">

                <CircleAlert
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                {actionError}

              </div>
            )}


            <div className="mt-6 flex justify-end gap-3">

              <button
                type="button"
                onClick={
                  closeAction
                }
                disabled={
                  isMutatingHost
                }
                className="focus-ring rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black text-stone-600 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  submitAction
                }
                disabled={
                  isMutatingHost
                }
                className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {isMutatingHost && (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                  />
                )}

                Confirm {
                  actionTarget.action
                }
              </button>

            </div>

          </div>

        </div>
      )}

    </AdminShell>
  )
}