import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'

import {
  useState,
} from 'react'

import AdminShell from '../components/AdminShell'

import {
  useAdminAuditEvent,
  useAdminAuditEvents,
} from '../hooks/useAdminAuditExplorer'

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
        'medium',
    },
  ).format(
    date,
  )
}

function outcomeClasses(
  outcome,
) {
  switch (
    outcome
  ) {
    case 'success':
      return 'bg-emerald-100 text-emerald-800'

    case 'denied':
      return 'bg-amber-100 text-amber-800'

    case 'failed':
      return 'bg-red-100 text-red-700'

    default:
      return 'bg-stone-100 text-stone-600'
  }
}

function getErrorMessage(
  error,
) {
  return (
    error?.message ||
    'Unable to load administrative audit data.'
  )
}

function SnapshotBlock({
  title,
  value,
}) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return (
    <div>

      <p className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
        {title}
      </p>

      <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-stone-950 p-4 text-xs leading-5 text-stone-300">
        {
          JSON.stringify(
            value,
            null,
            2,
          )
        }
      </pre>

    </div>
  )
}

export default function AdminAuditPage() {
  const [
    filters,
    setFilters,
  ] = useState({
    page:
      1,

    limit:
      30,

    action:
      '',

    outcome:
      '',

    actorUserId:
      '',

    requestId:
      '',
  })

  const [
    form,
    setForm,
  ] = useState({
    action:
      '',

    outcome:
      '',

    actorUserId:
      '',

    requestId:
      '',
  })

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState('')

  const {
    events,
    pagination,
    isLoading,
    isFetching,
    error,
  } =
    useAdminAuditEvents(
      filters,
    )

  const {
    event:
      selectedEvent,

    isLoading:
      isLoadingDetail,

    error:
      detailError,
  } =
    useAdminAuditEvent(
      selectedEventId,
    )

  const submitFilters =
    (
      event,
    ) => {
      event.preventDefault()

      setFilters(
        (
          current,
        ) => ({
          ...current,

          ...form,

          page:
            1,
        }),
      )
    }

  const clearFilters =
    () => {
      const empty = {
        action:
          '',

        outcome:
          '',

        actorUserId:
          '',

        requestId:
          '',
      }

      setForm(
        empty,
      )

      setFilters(
        {
          ...empty,

          page:
            1,

          limit:
            30,
        },
      )
    }

  const totalPages =
    pagination?.totalPages ||
    0

  return (
    <AdminShell
      title="Audit Explorer"
      description="Read-only explorer for privileged administrative events, actors, controlled reasons and before/after state."
      actions={
        isFetching &&
        !isLoading ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-500 shadow-sm">
            <LoaderCircle
              size={14}
              className="animate-spin"
            />

            Refreshing
          </span>
        ) : null
      }
    >

      {/* ===========================================================
          FILTERS
      =========================================================== */}

      <form
        onSubmit={
          submitFilters
        }
        className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm"
      >

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

          <input
            value={
              form.action
            }
            onChange={(
              event,
            ) =>
              setForm(
                (
                  current,
                ) => ({
                  ...current,

                  action:
                    event.target
                      .value,
                }),
              )
            }
            placeholder="Action e.g. host.review.approve"
            className="focus-ring rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
          />


          <select
            value={
              form.outcome
            }
            onChange={(
              event,
            ) =>
              setForm(
                (
                  current,
                ) => ({
                  ...current,

                  outcome:
                    event.target
                      .value,
                }),
              )
            }
            className="focus-ring rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
          >
            <option value="">
              All outcomes
            </option>

            <option value="success">
              Success
            </option>

            <option value="denied">
              Denied
            </option>

            <option value="failed">
              Failed
            </option>
          </select>


          <input
            value={
              form.actorUserId
            }
            onChange={(
              event,
            ) =>
              setForm(
                (
                  current,
                ) => ({
                  ...current,

                  actorUserId:
                    event.target
                      .value,
                }),
              )
            }
            placeholder="Actor user ID"
            className="focus-ring rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
          />


          <input
            value={
              form.requestId
            }
            onChange={(
              event,
            ) =>
              setForm(
                (
                  current,
                ) => ({
                  ...current,

                  requestId:
                    event.target
                      .value,
                }),
              )
            }
            placeholder="Request ID"
            className="focus-ring rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm"
          />

        </div>


        <div className="mt-4 flex flex-wrap gap-2">

          <button
            type="submit"
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white"
          >
            <Search
              size={15}
            />

            Search audit
          </button>

          <button
            type="button"
            onClick={
              clearFilters
            }
            className="focus-ring rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-600"
          >
            Clear
          </button>

        </div>

      </form>


      {/* ===========================================================
          EVENTS
      =========================================================== */}

      <section className="mt-5 overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">

        {isLoading ? (
          <div className="grid min-h-72 place-items-center">

            <LoaderCircle
              size={27}
              className="animate-spin text-emerald-700"
            />

          </div>
        ) : error ? (
          <div className="p-5">

            <div className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">

              <CircleAlert
                size={19}
              />

              {
                getErrorMessage(
                  error,
                )
              }

            </div>

          </div>
        ) : events.length ===
          0 ? (
          <div className="grid min-h-72 place-items-center p-5 text-center">

            <div>

              <ShieldCheck
                size={30}
                className="mx-auto text-emerald-700"
              />

              <h2 className="mt-3 font-black text-stone-950">
                No audit events
              </h2>

              <p className="mt-1 text-sm text-stone-500">
                No events matched the selected filters.
              </p>

            </div>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[980px]">

              <thead className="bg-stone-50">

                <tr className="text-left text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">

                  <th className="px-5 py-4">
                    Event
                  </th>

                  <th className="px-5 py-4">
                    Actor
                  </th>

                  <th className="px-5 py-4">
                    Entity
                  </th>

                  <th className="px-5 py-4">
                    Outcome
                  </th>

                  <th className="px-5 py-4">
                    Occurred
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-stone-100">

                {events.map(
                  (auditEvent) => (
                    <tr
                      key={
                        auditEvent.eventId
                      }
                      onClick={() =>
                        setSelectedEventId(
                          auditEvent.eventId,
                        )
                      }
                      className="cursor-pointer transition hover:bg-emerald-50/40"
                    >

                      <td className="px-5 py-4">

                        <p className="text-sm font-black text-stone-950">
                          {
                            auditEvent.action
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-stone-400">
                          {
                            auditEvent.eventId
                          }
                        </p>

                      </td>


                      <td className="px-5 py-4">

                        <p className="text-sm font-semibold text-stone-700">
                          {
                            auditEvent
                              .actor
                              ?.source ||
                            '—'
                          }
                        </p>

                        <p className="mt-1 max-w-[180px] truncate text-[11px] text-stone-400">
                          {
                            auditEvent
                              .actor
                              ?.userId ||
                            '—'
                          }
                        </p>

                      </td>


                      <td className="px-5 py-4">

                        <p className="text-sm font-semibold text-stone-700">
                          {
                            auditEvent
                              .entity
                              ?.type ||
                            '—'
                          }
                        </p>

                        <p className="mt-1 max-w-[180px] truncate text-[11px] text-stone-400">
                          {
                            auditEvent
                              .entity
                              ?.id ||
                            '—'
                          }
                        </p>

                      </td>


                      <td className="px-5 py-4">

                        <span
                          className={[
                            'rounded-full',
                            'px-2.5',
                            'py-1',
                            'text-xs',
                            'font-black',
                            'capitalize',

                            outcomeClasses(
                              auditEvent.outcome,
                            ),
                          ].join(
                            ' ',
                          )}
                        >
                          {
                            auditEvent.outcome
                          }
                        </span>

                      </td>


                      <td className="px-5 py-4 text-sm text-stone-500">
                        {
                          formatDate(
                            auditEvent.occurredAt,
                          )
                        }
                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

          </div>
        )}


        {events.length >
          0 && (
          <div className="flex items-center justify-between border-t border-stone-200 px-5 py-4">

            <p className="text-xs font-semibold text-stone-500">
              Page {
                pagination?.page ||
                filters.page
              }
              {
                pagination?.total
                  ? ` · ${pagination.total} events`
                  : ''
              }
            </p>


            <div className="flex gap-2">

              <button
                type="button"
                disabled={
                  filters.page <=
                  1
                }
                onClick={() =>
                  setFilters(
                    (
                      current,
                    ) => ({
                      ...current,

                      page:
                        Math.max(
                          1,
                          current.page -
                            1,
                        ),
                    }),
                  )
                }
                className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-stone-200 disabled:opacity-40"
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
                    ? filters.page >=
                      totalPages
                    : events.length <
                      filters.limit
                }
                onClick={() =>
                  setFilters(
                    (
                      current,
                    ) => ({
                      ...current,

                      page:
                        current.page +
                        1,
                    }),
                  )
                }
                className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-stone-200 disabled:opacity-40"
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
          EVENT DETAIL
      =========================================================== */}

      {selectedEventId && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-stone-950/50 backdrop-blur-sm">

          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  Audit Event
                </p>

                <h2 className="mt-1 text-lg font-black text-stone-950">
                  Event details
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedEventId(
                    '',
                  )
                }
                className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-stone-200"
              >
                <X
                  size={17}
                />
              </button>

            </div>


            <div className="space-y-6 p-5 sm:p-6">

              {isLoadingDetail ? (
                <LoaderCircle
                  size={26}
                  className="mx-auto animate-spin text-emerald-700"
                />
              ) : detailError ? (
                <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {
                    getErrorMessage(
                      detailError,
                    )
                  }
                </p>
              ) : selectedEvent ? (
                <>

                  <div className="grid gap-3 sm:grid-cols-2">

                    <div className="rounded-2xl bg-stone-50 p-4">

                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                        Action
                      </p>

                      <p className="mt-2 break-all text-sm font-black text-stone-900">
                        {
                          selectedEvent.action
                        }
                      </p>

                    </div>

                    <div className="rounded-2xl bg-stone-50 p-4">

                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                        Outcome
                      </p>

                      <p className="mt-2 text-sm font-black capitalize text-stone-900">
                        {
                          selectedEvent.outcome
                        }
                      </p>

                    </div>

                  </div>


                  <div>

                    <p className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">
                      Reason
                    </p>

                    <div className="mt-2 rounded-2xl border border-stone-200 p-4">

                      <p className="text-sm font-black text-stone-900">
                        {
                          selectedEvent
                            .reason
                            ?.code ||
                          'No reason code'
                        }
                      </p>

                      {selectedEvent
                        .reason
                        ?.details && (
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          {
                            selectedEvent
                              .reason
                              .details
                          }
                        </p>
                      )}

                    </div>

                  </div>


                  <SnapshotBlock
                    title="Before"
                    value={
                      selectedEvent.beforeSnapshot
                    }
                  />

                  <SnapshotBlock
                    title="After"
                    value={
                      selectedEvent.afterSnapshot
                    }
                  />

                  <SnapshotBlock
                    title="Metadata"
                    value={
                      selectedEvent.metadata
                    }
                  />

                </>
              ) : null}

            </div>

          </aside>

        </div>
      )}

    </AdminShell>
  )
}