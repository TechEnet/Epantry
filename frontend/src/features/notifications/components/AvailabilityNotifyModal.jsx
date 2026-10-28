import {
  BellRing,
  CheckCircle2,
  X,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  createAvailabilityWatch,
} from '../../analytics/services/analytics.service'

export const AVAILABILITY_MISSING_EVENT =
  'epantry:availability-missing'

const PENDING_AVAILABILITY_WATCH_KEY =
  'epantry-pending-availability-watch'

function normalizeDetail(
  value,
) {
  const query =
    String(
      value?.query ||
        value?.displayName ||
        '',
    ).trim()

  if (
    query.length <
      2
  ) {
    return null
  }

  return {
    query,
    displayName:
      String(
        value?.displayName ||
          query,
      ).trim(),
    canonicalIngredientId:
      value?.canonicalIngredientId ||
      null,
    packId:
      value?.packId ||
      null,
    source:
      [
        'search',
        'recipe',
        'product',
      ].includes(
        value?.source,
      )
        ? value.source
        : 'search',
  }
}

export function openAvailabilityNotifyModal(
  detail,
) {
  if (
    typeof window ===
      'undefined'
  ) {
    return
  }

  const normalized =
    normalizeDetail(
      detail,
    )

  if (!normalized) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      AVAILABILITY_MISSING_EVENT,
      {
        detail:
          normalized,
      },
    ),
  )
}

function readPendingWatch() {
  if (
    typeof window ===
      'undefined'
  ) {
    return null
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        PENDING_AVAILABILITY_WATCH_KEY,
      )

    return raw
      ? normalizeDetail(
          JSON.parse(
            raw,
          ),
        )
      : null
  } catch {
    return null
  }
}

function clearPendingWatch() {
  try {
    window.sessionStorage.removeItem(
      PENDING_AVAILABILITY_WATCH_KEY,
    )
  } catch {
    // Session persistence is best-effort only.
  }
}

export default function AvailabilityNotifyModal() {
  const {
    isAuthenticated,
    customerEnabled,
  } = useAuth()

  const navigate =
    useNavigate()

  const location =
    useLocation()

  const [
    detail,
    setDetail,
  ] =
    useState(null)

  const [
    saving,
    setSaving,
  ] =
    useState(false)

  const [
    success,
    setSuccess,
  ] =
    useState('')

  const [
    error,
    setError,
  ] =
    useState('')

  const close =
    useCallback(
      () => {
        if (saving) {
          return
        }

        setDetail(
          null,
        )
        setSuccess(
          '',
        )
        setError(
          '',
        )
      },
      [
        saving,
      ],
    )

  const saveWatch =
    useCallback(
      async (
        target,
      ) => {
        const normalized =
          normalizeDetail(
            target,
          )

        if (!normalized) {
          return
        }

        setDetail(
          normalized,
        )
        setSaving(
          true,
        )
        setSuccess(
          '',
        )
        setError(
          '',
        )

        try {
          const result =
            await createAvailabilityWatch({
              query:
                normalized.query,
              canonicalIngredientId:
                normalized.canonicalIngredientId,
              packId:
                normalized.packId,
              source:
                normalized.source,
            })

          if (
            result?.alreadyAvailable
          ) {
            setSuccess(
              `${result?.match?.displayName || normalized.displayName} is available now. Search again to open it.`,
            )
          } else {
            setSuccess(
              `We’ll notify you when ${normalized.displayName} becomes available on EPANTRY.`,
            )
          }

          window.dispatchEvent(
            new CustomEvent(
              'epantry:notifications-changed',
            ),
          )
        } catch (
          saveError
        ) {
          setError(
            saveError?.response?.data?.message ||
              saveError?.message ||
              'Unable to save this notification request right now.',
          )
        } finally {
          setSaving(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      const handleMissing =
        (
          event,
        ) => {
          const normalized =
            normalizeDetail(
              event?.detail,
            )

          if (!normalized) {
            return
          }

          setDetail(
            normalized,
          )
          setSuccess(
            '',
          )
          setError(
            '',
          )
        }

      window.addEventListener(
        AVAILABILITY_MISSING_EVENT,
        handleMissing,
      )

      return () => {
        window.removeEventListener(
          AVAILABILITY_MISSING_EVENT,
          handleMissing,
        )
      }
    },
    [],
  )

  useEffect(
    () => {
      if (
        !isAuthenticated ||
        customerEnabled !==
          true
      ) {
        return
      }

      const pending =
        readPendingWatch()

      if (!pending) {
        return
      }

      clearPendingWatch()
      void saveWatch(
        pending,
      )
    },
    [
      isAuthenticated,
      customerEnabled,
      saveWatch,
    ],
  )

  const handleNotify =
    async () => {
      if (!detail) {
        return
      }

      if (
        !isAuthenticated ||
        customerEnabled !==
          true
      ) {
        try {
          window.sessionStorage.setItem(
            PENDING_AVAILABILITY_WATCH_KEY,
            JSON.stringify(
              detail,
            ),
          )
        } catch {
          // Session persistence is best-effort only.
        }

        navigate(
          '/login',
          {
            state: {
              from: {
                pathname:
                  location.pathname,
                search:
                  location.search,
              },
            },
          },
        )

        setDetail(
          null,
        )
        return
      }

      await saveWatch(
        detail,
      )
    }

  if (!detail) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[180] grid place-items-center bg-[#0D1C18]/55 px-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          close()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-notify-title"
        className="relative max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[24px] border border-[#D9DED2] border-t-[3px] border-t-[#CF8666] bg-[#F0F2EB] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:p-6"
        style={{ width: 'min(460px, calc(100vw - 32px))', maxWidth: '100%', backgroundColor: '#F0F2EB', borderColor: '#D9DED2', borderTopColor: '#CF8666', color: '#173F35' }}
      >
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="focus-ring absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-[#CFD9CD] bg-[#F8F6EF] text-[#173F35] transition hover:text-[#0E3027] disabled:opacity-40"
          aria-label="Close"
        >
          <X
            size={16}
            aria-hidden="true"
          />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F4D9CA] text-[#173F35]">
            {success ? (
              <CheckCircle2
                size={19}
                aria-hidden="true"
              />
            ) : (
              <BellRing
                size={19}
                aria-hidden="true"
              />
            )}
          </div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#AA573B]"
            style={{ color: '#AA573B' }}
          >
            {success
              ? 'Notification saved'
              : 'Availability update'}
          </p>
        </div>

        <h2
          id="availability-notify-title"
          className="mt-4 break-words text-[23px] font-extrabold leading-[1.16] tracking-[-0.025em] text-[#173F35]"
          style={{ color: '#173F35' }}
        >
          {success
            ? 'We’ll keep an eye on it.'
            : detail.displayName}
        </h2>

        {!success ? (
          <p className="mt-1 text-[15px] font-semibold leading-5 text-[#2A594B]">
            Not available on EPANTRY yet
          </p>
        ) : null}

        <p
          className="mt-2 text-[13px] font-medium leading-[1.5] text-[#52665C]"
          style={{ color: '#52665C' }}
        >
          {success ||
            'Tap Notify Me to get an alert when this item is available to buy.'}
        </p>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold leading-4 text-rose-700">
            {error}
          </p>
        ) : null}

        {!success ? (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="focus-ring h-11 rounded-xl border border-[#C8D3C6] bg-[#F8F6F0] text-[13px] font-semibold text-[#173F35] transition hover:bg-[#E7EBE3] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleNotify}
              disabled={saving}
              className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(4,120,87,0.16)] transition hover:bg-[#275A4C] disabled:opacity-55"
            >
              <BellRing
                size={14}
                aria-hidden="true"
              />
              {saving
                ? 'Saving...'
                : isAuthenticated
                  ? 'Notify Me'
                  : 'Sign in & Notify'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={close}
            className="focus-ring mt-4 h-11 w-full rounded-xl bg-[#173F35] text-[13px] font-semibold text-white transition hover:bg-[#275A4C]"
          >
            Done
          </button>
        )}
      </section>
    </div>
  )
}
