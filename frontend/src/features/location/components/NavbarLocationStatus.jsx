import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import {
  ChevronDown,
  LocateFixed,
  MapPin,
  Navigation,
  Truck,
  X,
} from 'lucide-react'

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'

import {
  useNavigate,
} from 'react-router-dom'

import {
  useCurrentLocation,
} from '../hooks/useCurrentLocation'

import {
  useLocationStore,
} from '../store/location.store'

const ROTATION_INTERVAL_MS =
  5000

function buildLocationLabel(
  location,
) {
  if (!location) {
    return ''
  }

  const parts = [
    location.city,
    location.state,
  ].filter(Boolean)

  return parts.length
    ? parts.join(', ')
    : location.label ||
        location.country ||
        'Location available'
}

export default function NavbarLocationStatus({
  mobileStripOnly = false,
} = {}) {
  const shouldReduceMotion =
    useReducedMotion()

  const navigate =
    useNavigate()

  const [
    nowMs,
    setNowMs,
  ] = useState(
    () => Date.now(),
  )

  const [
    panelOpen,
    setPanelOpen,
  ] = useState(false)

  const [
    showDelivery,
    setShowDelivery,
  ] = useState(false)

  const [
    isDesktop,
    setIsDesktop,
  ] = useState(() =>
    typeof window === 'undefined'
      ? true
      : window.matchMedia('(min-width: 768px)').matches,
  )

  const [
    mobileEtaDismissed,
    setMobileEtaDismissed,
  ] = useState(false)

  const [
    etaHovered,
    setEtaHovered,
  ] = useState(false)

  const {
    currentLocation,
    status,
    error,
    requestCurrentLocation,
  } = useCurrentLocation()

  const deliveryContext =
    useLocationStore(
      (state) =>
        state.deliveryContext,
    )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const media =
      window.matchMedia('(min-width: 768px)')

    const sync = () =>
      setIsDesktop(media.matches)

    sync()
    media.addEventListener?.('change', sync)

    return () =>
      media.removeEventListener?.('change', sync)
  }, [])

  const hasDeliveryContext =
    Boolean(
      (
        deliveryContext?.label ||
        deliveryContext?.city
      ) &&
      (
        deliveryContext?.estimatedArrivalAt ||
        Number.isFinite(
          deliveryContext?.estimatedDeliveryMinutes,
        )
      ),
    )

  const isOrderEtaContext =
    hasDeliveryContext &&
    /^\/orders\/[^/?#]+/.test(
      String(
        deliveryContext?.targetPath || '',
      ),
    )

  useEffect(() => {
    setMobileEtaDismissed(false)
  }, [deliveryContext?.targetPath])

  useEffect(() => {
    if (!hasDeliveryContext) {
      return undefined
    }

    const intervalId =
      window.setInterval(
        () => {
          setNowMs(
            Date.now(),
          )
        },
        5000,
      )

    return () =>
      window.clearInterval(
        intervalId,
      )
  }, [hasDeliveryContext])

  useEffect(() => {
    if (
      !isDesktop ||
      !currentLocation ||
      !isOrderEtaContext ||
      shouldReduceMotion
    ) {
      setShowDelivery(false)
      return undefined
    }

    // Hover must lock the compact navbar card on the delivery state.
    // The previous implementation reset this to false as soon as hover
    // started, which also prevented the hover detail panel from appearing.
    if (etaHovered) {
      setShowDelivery(true)
      return undefined
    }

    // Resume the normal location <-> ETA rotation after hover ends.
    setShowDelivery(false)

    const intervalId =
      window.setInterval(
        () => {
          setShowDelivery(
            (value) => !value,
          )
        },
        ROTATION_INTERVAL_MS,
      )

    return () =>
      window.clearInterval(
        intervalId,
      )
  }, [
    currentLocation,
    etaHovered,
    isDesktop,
    isOrderEtaContext,
    shouldReduceMotion,
  ])

  const currentLabel =
    useMemo(
      () =>
        buildLocationLabel(
          currentLocation,
        ),
      [currentLocation],
    )

  const deliveryLabel =
    useMemo(
      () =>
        buildLocationLabel(
          deliveryContext,
        ),
      [deliveryContext],
    )

  const remainingDeliveryMinutes =
    useMemo(() => {
      const arrivalAtMs =
        Date.parse(
          deliveryContext?.estimatedArrivalAt ||
            '',
        )

      if (
        Number.isFinite(
          arrivalAtMs,
        )
      ) {
        return Math.max(
          0,
          Math.ceil(
            (
              arrivalAtMs -
              nowMs
            ) /
              60000,
          ),
        )
      }

      return Number.isFinite(
        deliveryContext?.estimatedDeliveryMinutes,
      )
        ? Math.max(
            0,
            Math.ceil(
              deliveryContext.estimatedDeliveryMinutes,
            ),
          )
        : null
    }, [
      deliveryContext?.estimatedArrivalAt,
      deliveryContext?.estimatedDeliveryMinutes,
      nowMs,
    ])

  const activeView =
    isDesktop &&
    isOrderEtaContext &&
    (showDelivery || !currentLocation)
      ? 'delivery'
      : 'current'

  const requesting =
    status === 'requesting'

  const approximate =
    currentLocation
      ?.accuracyMode ===
    'approximate'

  const handleMainClick =
    () => {
      if (
        activeView === 'delivery' &&
        deliveryContext?.targetPath
      ) {
        setPanelOpen(false)
        navigate(
          deliveryContext.targetPath,
        )
        return
      }

      if (!currentLocation) {
        requestCurrentLocation()
        return
      }

      setPanelOpen(
        (value) => !value,
      )
    }

  const deliveryHeadline =
    Number.isFinite(
      remainingDeliveryMinutes,
    )
      ? remainingDeliveryMinutes <= 0
        ? 'Arriving now'
        : `~${remainingDeliveryMinutes} min`
      : 'ETA unavailable'

  const buttonSurface =
    activeView === 'delivery'
      ? 'border-emerald-200 bg-[#f2fbf6] hover:border-emerald-300 hover:bg-[#eaf8f0]'
      : 'border-stone-200 bg-white hover:border-emerald-200 hover:bg-[#fafcfb]'

  if (mobileStripOnly) {
    if (
      isDesktop ||
      !isOrderEtaContext ||
      mobileEtaDismissed ||
      typeof document === 'undefined'
    ) {
      return null
    }

    const mobileStrip = (
      <div
        className="fixed inset-x-3 z-[120] md:hidden"
        style={{
          bottom:
            'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <div className="mx-auto flex w-full max-w-[520px] items-center gap-2.5 rounded-[18px] border border-emerald-200 bg-white/96 p-2.5 shadow-[0_18px_45px_rgba(28,25,23,0.22)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              if (deliveryContext?.targetPath) {
                navigate(
                  deliveryContext.targetPath,
                )
              }
            }}
            className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] px-1 py-1 text-left"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-emerald-700 text-white shadow-[0_5px_14px_rgba(4,120,87,0.18)]">
              <Truck
                size={16}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[7px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Your order is on the way
              </p>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
                <span className="shrink-0 text-[14px] font-black leading-none text-[#173f35]">
                  {deliveryHeadline}
                </span>
                <span className="truncate text-[8px] font-semibold text-stone-500">
                  {deliveryLabel
                    ? `to ${deliveryLabel}`
                    : 'estimated delivery'}
                </span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setMobileEtaDismissed(true)
            }
            className="focus-ring grid size-8 shrink-0 place-items-center rounded-full border border-stone-200 bg-stone-50 text-stone-500 transition hover:bg-stone-100"
            aria-label="Hide delivery estimate until refresh"
          >
            <X
              size={15}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    )

    // Render outside the navbar/backdrop-filter stacking context so
    // `position: fixed` is anchored to the real viewport bottom.
    return createPortal(
      mobileStrip,
      document.body,
    )
  }


  return (
    <div
      className="group relative w-full min-w-0"
      onMouseEnter={() => {
        if (
          isDesktop &&
          isOrderEtaContext &&
          !panelOpen
        ) {
          setEtaHovered(true)
          setShowDelivery(true)
        }
      }}
      onMouseLeave={() =>
        setEtaHovered(false)
      }
    >
      <button
        type="button"
        onClick={handleMainClick}
        className={`focus-ring flex h-12 w-full min-w-0 items-center gap-2 rounded-[17px] border px-2.5 text-left shadow-[0_6px_18px_rgba(28,25,23,0.07)] transition md:h-[50px] md:px-3 ${buttonSurface}`}
        aria-expanded={panelOpen}
        aria-label={
          activeView === 'delivery'
            ? 'Open delivery estimate'
            : currentLocation
              ? 'Location details'
              : 'Use current location'
        }
      >
        <div
          className={`grid size-8 shrink-0 place-items-center rounded-[11px] md:size-9 md:rounded-xl ${
            activeView === 'delivery'
              ? 'bg-emerald-700 text-white shadow-[0_5px_14px_rgba(4,120,87,0.18)]'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {activeView === 'delivery' ? (
            <Truck
              size={16}
              aria-hidden="true"
            />
          ) : (
            <MapPin
              size={16}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          {!currentLocation ? (
            <>
              <p className="text-[7px] font-black uppercase leading-none tracking-[0.12em] text-stone-400 md:text-[8px] md:tracking-[0.15em]">
                Delivery location
              </p>
              <p className="mt-1 truncate text-[10px] font-black leading-none text-stone-900 md:text-[12px]">
                {requesting
                  ? 'Finding your location…'
                  : 'Use current location'}
              </p>
            </>
          ) : (
            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.div
                key={activeView}
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 5,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: -5,
                      }
                }
                transition={{
                  duration: 0.22,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {activeView === 'delivery' ? (
                  <>
                    <p className="text-[7px] font-black uppercase leading-none tracking-[0.12em] text-emerald-700 md:text-[8px] md:tracking-[0.15em]">
                      Deliver in
                    </p>
                    <p className="mt-1 truncate text-[11px] font-black leading-none text-[#173f35] md:text-[13px]">
                      {deliveryHeadline}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="text-[7px] font-black uppercase leading-none tracking-[0.12em] text-stone-400 md:text-[8px] md:tracking-[0.15em]">
                        Current location
                      </p>
                      {approximate && (
                        <span className="hidden rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-amber-800 md:inline">
                          Approx.
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[10px] font-black leading-none text-stone-900 md:text-[12px]">
                      {currentLabel}
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {currentLocation && (
          <ChevronDown
            size={14}
            className="shrink-0 text-stone-400"
            aria-hidden="true"
          />
        )}
      </button>


      {isDesktop &&
        etaHovered &&
        isOrderEtaContext && (
          <div className="absolute left-0 top-full z-[75] hidden w-[330px] max-w-[calc(100vw-1rem)] pt-2 md:block">
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="overflow-hidden rounded-[20px] border border-emerald-100 bg-white shadow-[0_22px_55px_rgba(28,25,23,0.14)]"
            >
              <div className="border-b border-emerald-100 bg-[#f2fbf6] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-emerald-700 text-white">
                    <Truck size={17} aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">
                      Active order delivery
                    </p>
                    <p className="mt-1 text-[18px] font-black leading-none text-[#173f35]">
                      {deliveryHeadline}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-4 py-3.5">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-stone-400">
                    Delivering to
                  </p>
                  <p className="mt-1 text-[12px] font-extrabold leading-5 text-stone-800">
                    {deliveryLabel || 'Saved delivery address'}
                  </p>
                </div>

                {Number.isFinite(
                  deliveryContext?.estimatedRoadDistanceKm,
                ) && (
                  <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                    <Navigation
                      size={14}
                      className="shrink-0 text-emerald-700"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] font-bold text-stone-600">
                      {Math.round(
                        deliveryContext.estimatedRoadDistanceKm,
                      )}{' '}
                      km approx. delivery distance
                    </p>
                  </div>
                )}

                {deliveryContext?.targetPath && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        deliveryContext.targetPath,
                      )
                    }
                    className="focus-ring w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-[10px] font-black text-white transition hover:bg-[#0f3028]"
                  >
                    Open order tracking
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}


      <AnimatePresence>
        {panelOpen &&
          currentLocation && (
            <motion.div
              initial={{
                opacity: 0,
                y: 8,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 8,
                scale: 0.98,
              }}
              transition={{
                duration: 0.18,
              }}
              className="absolute left-0 top-[calc(100%+10px)] z-[70] w-[310px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-[0_22px_55px_rgba(28,25,23,0.14)]"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <LocateFixed
                      size={17}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black text-stone-900">
                        Current location
                      </p>
                      {approximate && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-800">
                          Approximate
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      {currentLocation.label ||
                        currentLabel}
                    </p>

                    {approximate && (
                      <p className="mt-2 text-[10px] leading-4 text-amber-700">
                        Precise device location was unavailable, so this location is approximate.
                      </p>
                    )}
                  </div>
                </div>

                {hasDeliveryContext && (
                  <div className="mt-3 rounded-[15px] border border-emerald-100 bg-[#f2fbf6] p-3">
                    <div className="flex items-start gap-2.5">
                      <Navigation
                        size={16}
                        className="mt-0.5 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />

                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Delivery estimate
                        </p>
                        <p className="mt-1 text-sm font-black text-[#173f35]">
                          {deliveryHeadline}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold text-stone-500">
                          {deliveryLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={requestCurrentLocation}
                  disabled={requesting}
                  className="focus-ring mt-4 w-full rounded-xl bg-[#173f35] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#0f3028] disabled:cursor-wait disabled:opacity-60"
                >
                  {requesting
                    ? 'Refreshing location…'
                    : 'Refresh current location'}
                </button>

                {error && (
                  <p className="mt-3 text-xs leading-5 text-red-600">
                    {error}
                  </p>
                )}
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {!currentLocation &&
        error && (
          <p className="absolute left-0 top-[calc(100%+6px)] z-[70] w-[300px] max-w-[calc(100vw-1rem)] rounded-xl border border-red-100 bg-white p-3 text-xs leading-5 text-red-600 shadow-lg">
            {error}
          </p>
        )}

    </div>
  )
}
