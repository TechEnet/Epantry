import {
  ArrowRight,
  Crosshair,
  Megaphone,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getPublicSponsoredPlacement,
} from '../services/retailMedia.service'

const RETAIL_MEDIA_VIEWER_KEY =
  'epantry-retail-media-viewer-key'

const RETAIL_MEDIA_PREVIEW_MESSAGE =
  'epantry-retail-media-placement-select'

const RETAIL_MEDIA_PAGE_VIEW_KEY =
  typeof window === 'undefined'
    ? 'server'
    : typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `page-${Date.now()}-${Math.random().toString(36).slice(2)}`

function getRetailMediaViewerKey({
  audience = 'guest',
  userId = '',
} = {}) {
  const normalizedAudience =
    String(audience || 'guest').trim() ||
    'guest'

  const normalizedUserId =
    String(userId || 'anonymous').trim() ||
    'anonymous'

  if (typeof window === 'undefined') {
    return `${normalizedAudience}:${normalizedUserId}:${RETAIL_MEDIA_PAGE_VIEW_KEY}`
  }

  try {
    const existing =
      window.sessionStorage.getItem(
        RETAIL_MEDIA_VIEWER_KEY,
      )

    const baseViewerKey =
      existing ||
      (typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`)

    if (!existing) {
      window.sessionStorage.setItem(
        RETAIL_MEDIA_VIEWER_KEY,
        baseViewerKey,
      )
    }

    return `${baseViewerKey}:${normalizedAudience}:${normalizedUserId}:${RETAIL_MEDIA_PAGE_VIEW_KEY}`
  } catch {
    return `${normalizedAudience}:${normalizedUserId}:${RETAIL_MEDIA_PAGE_VIEW_KEY}`
  }
}

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function getPreviewState() {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      selectedSlotKey: '',
    }
  }

  const params =
    new URLSearchParams(
      window.location.search,
    )

  return {
    enabled:
      params.get('retailMediaPreview') === '1',
    selectedSlotKey:
      params.get('retailMediaSelectedSlot') || '',
  }
}

function formatEndTime(value) {
  if (!value) {
    return ''
  }

  const date =
    new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  try {
    return new Intl.DateTimeFormat(
      'en-IN',
      {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      },
    ).format(date)
  } catch {
    return date.toLocaleString()
  }
}

export default function SponsoredCampaignSlot({
  placement,
  slotKey,
  className = '',
  embedded = false,
  previewLabel = '',
  overlay = false,
}) {
  const {
    currentUser,
    activeMode,
    superAdminEnabled,
  } = useAuth()

  const viewerAudience =
    superAdminEnabled === true
      ? 'super_admin'
      : activeMode === 'host'
        ? 'host'
        : currentUser
          ? 'customer'
          : 'guest'

  const viewerUserId =
    currentUser?._id ||
    currentUser?.id ||
    currentUser?.userId ||
    ''

  const viewerKey =
    useMemo(
      () =>
        getRetailMediaViewerKey({
          audience:
            viewerAudience,
          userId:
            viewerUserId,
        }),
      [
        viewerAudience,
        viewerUserId,
      ],
    )

  const [sponsored, setSponsored] =
    useState(null)

  const [dismissed, setDismissed] =
    useState(false)

  const previewState =
    useMemo(
      getPreviewState,
      [],
    )

  useEffect(() => {
    let cancelled = false

    if (previewState.enabled) {
      setSponsored(null)
      setDismissed(false)

      return () => {
        cancelled = true
      }
    }

    async function load() {
      try {
        const result =
          await getPublicSponsoredPlacement({
            placement,
            slotKey,
            viewerKey,
          })

        const nextSponsored =
          result?.sponsored || null

        if (!cancelled) {
          setSponsored(
            nextSponsored,
          )
          setDismissed(false)
        }
      } catch {
        if (!cancelled) {
          setSponsored(null)
          setDismissed(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [
    placement,
    previewState.enabled,
    slotKey,
    viewerKey,
  ])

  if (previewState.enabled) {
    const selected =
      previewState.selectedSlotKey === slotKey

    const previewShellClass =
      overlay
        ? `absolute bottom-4 right-4 z-[70] w-[min(350px,calc(100%-2rem))] sm:bottom-6 sm:right-6 ${className}`
        : `${embedded ? '' : 'page-shell'} my-4 sm:my-6 ${className}`

    return (
      <section
        className={previewShellClass.trim()}
        data-retail-media-placement={placement}
        data-retail-media-slot={slotKey}
        data-retail-media-preview-slot="true"
      >
        <button
          type="button"
          onClick={() => {
            if (
              typeof window === 'undefined' ||
              window.parent === window
            ) {
              return
            }

            window.parent.postMessage(
              {
                type:
                  RETAIL_MEDIA_PREVIEW_MESSAGE,
                placement,
                slotKey,
              },
              window.location.origin,
            )
          }}
          className={`focus-ring group flex w-full items-center justify-between gap-3 rounded-[18px] border-2 border-dashed px-4 py-3 text-left shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-md transition ${
            selected
              ? 'border-[#176b57] bg-[#dff3ea]/95 shadow-[0_0_0_4px_rgba(31,122,85,0.12)]'
              : 'border-[#2a8b62] bg-white/94 hover:bg-[#edf8f3]'
          }`}
          aria-label={`Choose ${previewLabel || titleize(slotKey)} for this campaign`}
        >
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#176b57]">
              Ad position
            </span>
            <span className="mt-1 block text-sm font-black text-stone-950 sm:text-base">
              {previewLabel || titleize(slotKey)}
            </span>
            <span className="mt-1 block text-[10px] font-semibold leading-4 text-stone-600 sm:text-xs">
              Click this exact spot to place the promotion here.
            </span>
          </span>

          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#176b57] text-white transition group-hover:scale-105">
            <Crosshair
              size={16}
              aria-hidden="true"
            />
          </span>
        </button>
      </section>
    )
  }

  if (
    !sponsored ||
    dismissed
  ) {
    return null
  }

  const promotionPath =
    `/promotions/${encodeURIComponent(
      sponsored.campaignId || '',
    )}`

  const endTime =
    formatEndTime(
      sponsored.endsAt,
    )

  const shellClass =
    overlay
      ? `absolute bottom-4 right-4 z-40 w-[min(360px,calc(100%-2rem))] sm:bottom-6 sm:right-6 ${className}`
      : `${embedded ? '' : 'page-shell'} my-4 flex justify-end sm:my-6 ${className}`

  return (
    <section
      className={shellClass.trim()}
      aria-label="Sponsored promotion"
      data-retail-media-placement={placement}
      data-retail-media-slot={slotKey}
    >
      <article className="group relative w-full max-w-[360px] overflow-hidden rounded-[20px] border border-white/80 bg-white/95 shadow-[0_18px_46px_rgba(20,35,29,0.22)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
          }}
          className="focus-ring absolute right-2.5 top-2.5 z-20 grid size-8 place-items-center rounded-full border border-black/10 bg-white/92 text-stone-700 shadow-sm transition hover:bg-stone-950 hover:text-white"
          aria-label="Hide this promotion"
        >
          <X
            size={15}
            aria-hidden="true"
          />
        </button>

        <Link
          to={promotionPath}
          className="focus-ring block"
          aria-label={`View promotion from ${sponsored.sponsorName || 'EPANTRY partner'}`}
        >
          <div className="relative h-[118px] overflow-hidden bg-[linear-gradient(135deg,#e3f5eb,#eef2ff)]">
            {sponsored.imageUrl ? (
              <img
                src={sponsored.imageUrl}
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025] motion-reduce:transform-none"
              />
            ) : (
              <div className="grid h-full place-items-center text-[#176b57]">
                <Megaphone
                  size={34}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />

            <div className="absolute bottom-2.5 left-3 flex max-w-[calc(100%-3.5rem)] items-center gap-2">
              <span className="rounded-full bg-white/92 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#176b57] shadow-sm">
                {sponsored.sponsorLabel || 'Sponsored'}
              </span>

              {sponsored.sponsorName ? (
                <span className="truncate text-[10px] font-black text-white drop-shadow">
                  {sponsored.sponsorName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="px-4 pb-4 pt-3.5">
            <h2 className="line-clamp-2 text-[18px] font-black leading-[1.08] tracking-[-0.025em] text-stone-950">
              {sponsored.headline}
            </h2>

            {sponsored.body ? (
              <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-[1.45] text-stone-600">
                {sponsored.body}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200/80 pt-3">
              <div className="min-w-0">
                {endTime ? (
                  <p className="truncate text-[9px] font-bold text-stone-500">
                    Available until {endTime}
                  </p>
                ) : (
                  <p className="text-[9px] font-bold text-stone-500">
                    Paid promotion
                  </p>
                )}
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-black text-[#176b57]">
                View promotion
                <ArrowRight
                  size={13}
                  aria-hidden="true"
                />
              </span>
            </div>
          </div>
        </Link>
      </article>
    </section>
  )
}
