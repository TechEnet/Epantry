import {
  CalendarDays,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  Users,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  bookCreatorSession,
  cancelCreatorBooking,
  createCreatorSession,
  getExpansionExecutionErrorMessage,
  listCreatorSessions,
  listMyCreatorBookings,
  listMyCreatorSessions,
  publishCreatorSession,
  verifyCreatorBookingPayment,
} from '../services/expansionExecution.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const primaryButton =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40'

function money(
  amountMinor,
  currency = 'INR',
) {
  if (!amountMinor) {
    return 'Free'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )
}

function formatDate(value) {
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

function loadRazorpayScript() {
  return new Promise(
    (
      resolve,
    ) => {
      if (
        window.Razorpay
      ) {
        resolve(
          true,
        )

        return
      }

      const existing =
        document.querySelector(
          'script[data-epantry-razorpay="true"]',
        )

      if (existing) {
        existing.addEventListener(
          'load',
          () =>
            resolve(
              true,
            ),
          {
            once:
              true,
          },
        )

        existing.addEventListener(
          'error',
          () =>
            resolve(
              false,
            ),
          {
            once:
              true,
          },
        )

        return
      }

      const script =
        document.createElement(
          'script',
        )

      script.src =
        'https://checkout.razorpay.com/v1/checkout.js'

      script.async =
        true

      script.dataset.epantryRazorpay =
        'true'

      script.onload =
        () =>
          resolve(
            true,
          )

      script.onerror =
        () =>
          resolve(
            false,
          )

      document.body.appendChild(
        script,
      )
    },
  )
}

function newSessionForm() {
  const start =
    new Date(
      Date.now() +
        24 *
          60 *
          60 *
          1000,
    )

  const end =
    new Date(
      start.getTime() +
        90 *
          60 *
          1000,
    )

  const localValue =
    (
      date,
    ) =>
      new Date(
        date.getTime() -
          date.getTimezoneOffset() *
            60 *
            1000,
      )
        .toISOString()
        .slice(
          0,
          16,
        )

  return {
    courseId:
      '',

    title:
      '',

    summary:
      '',

    startsAt:
      localValue(
        start,
      ),

    endsAt:
      localValue(
        end,
      ),

    timezone:
      'Asia/Kolkata',

    capacity:
      20,

    accessType:
      'free',

    priceMinor:
      0,

    currency:
      'INR',

    cancellationCutoffMinutes:
      120,

    commercialDisclosure:
      '',
  }
}

export default function CreatorProTransactionsPanel() {
  const [
    sessions,
    setSessions,
  ] =
    useState(
      [],
    )

  const [
    bookings,
    setBookings,
  ] =
    useState(
      [],
    )

  const [
    creatorState,
    setCreatorState,
  ] =
    useState({
      hasCreatorProfile:
        false,

      sessions:
        [],
    })

  const [
    form,
    setForm,
  ] =
    useState(
      newSessionForm(),
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    notice,
    setNotice,
  ] =
    useState(
      '',
    )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const [
            publicResult,
            bookingResult,
            creatorResult,
          ] =
            await Promise.all([
              listCreatorSessions(),

              listMyCreatorBookings(),

              listMyCreatorSessions(),
            ])

          setSessions(
            publicResult?.sessions ||
            [],
          )

          setBookings(
            bookingResult?.bookings ||
            [],
          )

          setCreatorState(
            creatorResult || {
              hasCreatorProfile:
                false,

              sessions:
                [],
            },
          )
        } catch (
          requestError
        ) {
          setError(
            getExpansionExecutionErrorMessage(
              requestError,

              'Unable to load M22 Creator session execution.',
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  const bookingBySession =
    useMemo(
      () =>
        new Map(
          bookings.map(
            (
              booking,
            ) => [
              booking.sessionId,
              booking,
            ],
          ),
        ),
      [
        bookings,
      ],
    )

  async function run(
    task,
    successMessage,
  ) {
    setBusy(
      true,
    )

    setError(
      '',
    )

    setNotice(
      '',
    )

    try {
      const result =
        await task()

      setNotice(
        successMessage,
      )

      await load()

      return result
    } catch (
      requestError
    ) {
      setError(
        getExpansionExecutionErrorMessage(
          requestError,
        ),
      )

      return null
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function launchHostedCheckout(
    result,
  ) {
    if (
      !result?.checkout
    ) {
      return
    }

    const ready =
      await loadRazorpayScript()

    if (
      !ready ||
      !window.Razorpay
    ) {
      setError(
        'Hosted payment checkout could not be loaded.',
      )

      return
    }

    const bookingId =
      result.booking.id

    const checkout =
      result.checkout

    const razorpay =
      new window.Razorpay({
        key:
          checkout.keyId,

        order_id:
          checkout.providerOrderId,

        amount:
          checkout.amountMinor,

        currency:
          checkout.currency,

        name:
          'EPANTRY',

        description:
          'Creator session booking',

        handler:
          async (
            response,
          ) => {
            await run(
              () =>
                verifyCreatorBookingPayment({
                  bookingId,

                  providerOrderId:
                    response.razorpay_order_id,

                  providerPaymentId:
                    response.razorpay_payment_id,

                  signature:
                    response.razorpay_signature,
                }),

              'Hosted checkout evidence verified and booking confirmed. No creator payout or settlement was inferred.',
            )
          },

        modal: {
          ondismiss:
            () => {
              setNotice(
                'Checkout closed. The reserved booking remains payment-required until verified or cancelled.',
              )
            },
        },
      })

    razorpay.open()
  }

  async function book(session) {
    const result =
      await run(
        () =>
          bookCreatorSession(
            session.id,
          ),

        session.accessType ===
        'paid'
          ? 'Seat reserved. Hosted checkout is opening from server-owned session price.'
          : 'Creator session booking confirmed.',
      )

    if (
      result?.checkout
    ) {
      await launchHostedCheckout(
        result,
      )
    }
  }

  async function createSession() {
    await run(
      async () => {
        await createCreatorSession({
          courseId:
            form.courseId,

          title:
            form.title,

          summary:
            form.summary,

          startsAt:
            new Date(
              form.startsAt,
            ).toISOString(),

          endsAt:
            new Date(
              form.endsAt,
            ).toISOString(),

          timezone:
            form.timezone,

          capacity:
            Number(
              form.capacity,
            ),

          accessType:
            form.accessType,

          priceMinor:
            form.accessType ===
            'paid'
              ? Number(
                  form.priceMinor,
                )
              : 0,

          currency:
            form.currency,

          cancellationCutoffMinutes:
            Number(
              form.cancellationCutoffMinutes,
            ),

          commercialDisclosure:
            form.commercialDisclosure,
        })

        setForm(
          newSessionForm(),
        )
      },

      'Creator session draft created. It still requires existing M15 course + M21 governance before publication.',
    )
  }

  if (loading) {
    return (
      <section className="mt-8 grid min-h-48 place-items-center rounded-[28px] border border-stone-200 bg-white shadow-sm">
        <LoaderCircle
          className="animate-spin text-emerald-700"
          aria-label="Loading Creator sessions"
        />
      </section>
    )
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              M22 · Creator / Pro Transactions
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-950">
              Governed classes, seats & hosted checkout
            </h2>

            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-stone-600">
              Creator remains a Customer-side profile. Sessions reuse M15 Course truth and M21 rights/governance. Paid booking uses server-owned economics and hosted Razorpay Checkout; EPANTRY never collects raw card fields here.
            </p>
          </div>

          <button
            type="button"
            onClick={
              load
            }
            disabled={
              busy
            }
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 disabled:opacity-40"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            Refresh
          </button>
        </div>

        <div
          className="mt-4 min-h-6 text-sm font-bold"
          aria-live="polite"
        >
          {error ? (
            <p className="text-red-700">
              {error}
            </p>
          ) : notice ? (
            <p className="text-emerald-800">
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <CalendarDays
            size={22}
            className="mt-0.5 text-emerald-700"
            aria-hidden="true"
          />

          <div>
            <h3 className="text-lg font-black text-stone-950">
              Upcoming sessions
            </h3>

            <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">
              Capacity is reserved atomically. Free and entitlement sessions never create a payment order; paid sessions use backend-created provider economics only.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {sessions.length ? (
            sessions.map(
              (
                session,
              ) => {
                const booking =
                  bookingBySession.get(
                    session.id,
                  )

                return (
                  <article
                    key={
                      session.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-black text-stone-950">
                          {session.title}
                        </h4>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {formatDate(
                            session.startsAt,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-900">
                        {session.accessType ===
                        'entitled'
                          ? 'Entitlement'
                          : money(
                              session.priceMinor,
                              session.currency,
                            )}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      {session.summary ||
                        'Creator session linked to an existing governed Course.'}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-stone-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Users
                          size={14}
                          aria-hidden="true"
                        />

                        {session.seatsRemaining} seats remaining
                      </span>

                      <span>
                        Ends{' '}
                        {formatDate(
                          session.endsAt,
                        )}
                      </span>
                    </div>

                    {booking ? (
                      <div className="mt-4 rounded-xl bg-stone-50 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-stone-600">
                          Booking:{' '}
                          {booking.status.replaceAll(
                            '_',
                            ' ',
                          )}
                        </p>

                        {[
                          'confirmed',
                          'payment_required',
                        ].includes(
                          booking.status,
                        ) ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              run(
                                () =>
                                  cancelCreatorBooking({
                                    bookingId:
                                      booking.id,

                                    reason:
                                      'Customer requested cancellation before the governed session cancellation cutoff.',
                                  }),

                                'Booking cancellation recorded. Paid booking refunds are review-required and are not silently claimed.',
                              )
                            }
                            className="focus-ring mt-3 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700"
                          >
                            Cancel booking
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          busy ||
                          session.seatsRemaining <=
                            0
                        }
                        onClick={() =>
                          book(
                            session,
                          )
                        }
                        className={`${primaryButton} mt-4`}
                      >
                        {session.accessType ===
                        'paid' ? (
                          <CreditCard
                            size={15}
                            aria-hidden="true"
                          />
                        ) : (
                          <TicketCheck
                            size={15}
                            aria-hidden="true"
                          />
                        )}

                        Book session
                      </button>
                    )}
                  </article>
                )
              },
            )
          ) : (
            <p className="rounded-2xl bg-stone-50 p-5 text-sm font-semibold text-stone-500 lg:col-span-2">
              No upcoming governed Creator sessions.
            </p>
          )}
        </div>
      </section>

      {creatorState.hasCreatorProfile ? (
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={22}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Creator session studio
              </h3>

              <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">
                Creating a session does not publish it. Publication rechecks the existing M15 Course and requires an approved M21 CreatorContent governance record.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              className={
                inputClass
              }
              value={
                form.courseId
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    courseId:
                      event.target.value,
                  }),
                )
              }
              placeholder="Existing M15 Course ID"
            />

            <input
              className={
                inputClass
              }
              value={
                form.title
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    title:
                      event.target.value,
                  }),
                )
              }
              placeholder="Session title"
            />

            <input
              type="datetime-local"
              className={
                inputClass
              }
              value={
                form.startsAt
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    startsAt:
                      event.target.value,
                  }),
                )
              }
            />

            <input
              type="datetime-local"
              className={
                inputClass
              }
              value={
                form.endsAt
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    endsAt:
                      event.target.value,
                  }),
                )
              }
            />

            <select
              className={
                inputClass
              }
              value={
                form.accessType
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    accessType:
                      event.target.value,

                    priceMinor:
                      event.target.value ===
                      'paid'
                        ? current.priceMinor
                        : 0,
                  }),
                )
              }
            >
              <option value="free">
                Free
              </option>

              <option value="entitled">
                Existing Pro entitlement
              </option>

              <option value="paid">
                Paid hosted checkout
              </option>
            </select>

            <input
              type="number"
              min="1"
              max="10000"
              className={
                inputClass
              }
              value={
                form.capacity
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    capacity:
                      Number(
                        event.target.value,
                      ),
                  }),
                )
              }
              placeholder="Capacity"
            />

            {form.accessType ===
            'paid' ? (
              <input
                type="number"
                min="1"
                className={
                  inputClass
                }
                value={
                  form.priceMinor
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      priceMinor:
                        Number(
                          event.target.value,
                        ),
                    }),
                  )
                }
                placeholder="Price in minor units"
              />
            ) : null}

            <input
              type="number"
              min="0"
              max="10080"
              className={
                inputClass
              }
              value={
                form.cancellationCutoffMinutes
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    cancellationCutoffMinutes:
                      Number(
                        event.target.value,
                      ),
                  }),
                )
              }
              placeholder="Cancellation cutoff minutes"
            />

            <textarea
              rows={3}
              className={`${inputClass} sm:col-span-2`}
              value={
                form.summary
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    summary:
                      event.target.value,
                  }),
                )
              }
              placeholder="Session summary"
            />

            <textarea
              rows={3}
              className={`${inputClass} sm:col-span-2`}
              value={
                form.commercialDisclosure
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    commercialDisclosure:
                      event.target.value,
                  }),
                )
              }
              placeholder="Commercial / sponsored disclosure if relevant"
            />
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !form.courseId.trim() ||
              !form.title.trim()
            }
            onClick={
              createSession
            }
            className={`${primaryButton} mt-4`}
          >
            <CalendarDays
              size={15}
              aria-hidden="true"
            />

            Create draft
          </button>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {(creatorState.sessions || []).map(
              (
                session,
              ) => (
                <article
                  key={
                    session.id
                  }
                  className="rounded-2xl border border-stone-200 p-4"
                >
                  <p className="text-sm font-black text-stone-950">
                    {session.title}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    {session.status}
                    {' · '}
                    {formatDate(
                      session.startsAt,
                    )}
                  </p>

                  {session.status ===
                  'draft' ? (
                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        run(
                          () =>
                            publishCreatorSession(
                              session.id,
                            ),

                          'Creator session published after existing Course and CreatorContent governance checks.',
                        )
                      }
                      className="focus-ring mt-3 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                    >
                      Publish governed session
                    </button>
                  ) : null}
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <CircleAlert
          size={18}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />

        <p className="text-xs font-semibold leading-5">
          Payment verification is booking evidence, not Creator payout or M16 settlement truth. Paid cancellations create refund-review-required evidence; this UI never claims an automatic refund, creator settlement, or new application role.
        </p>
      </div>
    </section>
  )
}