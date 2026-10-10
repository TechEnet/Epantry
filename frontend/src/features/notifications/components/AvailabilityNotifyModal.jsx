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
      className="fixed inset-0 z-[180] grid place-items-center bg-black/28 px-4 backdrop-blur-[2px]"
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
        className="relative max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[24px] border border-emerald-200 bg-[#fbfcf7] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:p-6"
        style={{ width: 'min(460px, calc(100vw - 32px))', maxWidth: '100%' }}
      >
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="focus-ring absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:text-stone-950 disabled:opacity-40"
          aria-label="Close"
        >
          <X
            size={16}
            aria-hidden="true"
          />
        </button>

        <div className="grid size-11 place-items-center rounded-2xl bg-emerald-700 text-white shadow-[0_10px_24px_rgba(4,120,87,0.18)]">
          {success ? (
            <CheckCircle2
              size={20}
              aria-hidden="true"
            />
          ) : (
            <BellRing
              size={20}
              aria-hidden="true"
            />
          )}
        </div>

        <p className="mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
          {success
            ? 'Notification saved'
            : 'Not available yet'}
        </p>

        <h2
          id="availability-notify-title"
          className="mt-1 text-[20px] font-black leading-[1.08] tracking-[-0.03em] text-stone-950"
        >
          {success
            ? 'We’ll keep an eye on it.'
            : `${detail.displayName} isn’t available on EPANTRY yet.`}
        </h2>

        <p className="mt-2 text-[11px] font-medium leading-5 text-stone-600">
          {success ||
            'Tap Notify Me and we’ll send you an EPANTRY notification when a sellable listing becomes available.'}
        </p>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold leading-4 text-rose-700">
            {error}
          </p>
        ) : null}

        {!success ? (
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="focus-ring h-11 rounded-xl border border-stone-200 bg-white text-[11px] font-black text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleNotify}
              disabled={saving}
              className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(4,120,87,0.16)] transition hover:bg-emerald-800 disabled:opacity-55"
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
            className="focus-ring mt-5 h-11 w-full rounded-xl bg-emerald-700 text-[11px] font-black text-white transition hover:bg-emerald-800"
          >
            Done
          </button>
        )}
      </section>
    </div>
  )
}
