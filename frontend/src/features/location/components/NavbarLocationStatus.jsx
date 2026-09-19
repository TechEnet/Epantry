import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ChevronDown,
  LocateFixed,
  MapPin,
  Navigation,
  Truck,
} from 'lucide-react'

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'

import {
  useCurrentLocation,
} from '../hooks/useCurrentLocation'

import {
  useLocationStore,
} from '../store/location.store'

const ROTATION_INTERVAL_MS =
  4500

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

export default function NavbarLocationStatus() {
  const shouldReduceMotion =
    useReducedMotion()

  const [
    panelOpen,
    setPanelOpen,
  ] = useState(false)

  const [
    showDelivery,
    setShowDelivery,
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

  const hasDeliveryContext =
    Boolean(
      deliveryContext?.label ||
        deliveryContext?.city,
    )

  useEffect(() => {
    if (
      !currentLocation ||
      !hasDeliveryContext ||
      shouldReduceMotion
    ) {
      setShowDelivery(
        false,
      )

      return undefined
    }

    const intervalId =
      window.setInterval(
        () => {
          setShowDelivery(
            (value) =>
              !value,
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
    hasDeliveryContext,
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

  const activeView =
    showDelivery &&
    hasDeliveryContext
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
        !currentLocation
      ) {
        requestCurrentLocation()

        return
      }

      setPanelOpen(
        (value) =>
          !value,
      )
    }

  return (
    <div className="relative w-full min-w-0">

      <button
        type="button"
        onClick={
          handleMainClick
        }
        className="focus-ring flex h-12 w-full min-w-0 items-center gap-1 rounded-2xl border border-stone-200 bg-white px-2 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 md:gap-2.5 md:px-3"
        aria-expanded={
          panelOpen
        }
        aria-label={
          currentLocation
            ? 'Location details'
            : 'Use current location'
        }
      >

        {/* Hidden only on mobile to save width */}

        <div className="hidden size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 md:grid">

          {activeView ===
          'delivery' ? (
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

              <p className="text-[7px] font-bold uppercase leading-tight tracking-[0.04em] text-stone-400 md:text-[10px] md:tracking-[0.12em]">
                Current location
              </p>

              <p className="mt-0.5 text-[9px] font-black leading-[1.15] text-stone-800 md:mt-0 md:truncate md:text-xs md:leading-normal">

                {requesting
                  ? 'Finding location...'
                  : 'Use location'}

              </p>

            </>
          ) : (
            <AnimatePresence
              mode="wait"
              initial={false}
            >

              <motion.div
                key={
                  activeView
                }
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 7,
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
                        y: -7,
                      }
                }
                transition={{
                  duration: 0.2,
                }}
              >

                {activeView ===
                'delivery' ? (
                  <>

                    <p className="text-[7px] font-bold uppercase leading-tight tracking-[0.04em] text-emerald-700 md:text-[10px] md:tracking-[0.12em]">
                      Delivering to
                    </p>


                    <div className="min-w-0 md:flex md:items-center md:gap-2">

                      <p className="mt-0.5 text-[9px] font-black leading-[1.15] text-stone-900 md:mt-0 md:truncate md:text-xs md:leading-normal">
                        {
                          deliveryLabel
                        }
                      </p>


                      {Number.isFinite(
                        deliveryContext
                          ?.estimatedDeliveryMinutes,
                      ) && (
                        <span className="mt-0.5 inline-block shrink-0 rounded-full bg-emerald-700 px-1.5 py-0.5 text-[7px] font-black text-white md:mt-0 md:px-2 md:text-[10px]">

                          {
                            deliveryContext
                              .estimatedDeliveryMinutes
                          }{' '}
                          min

                        </span>
                      )}

                    </div>

                  </>
                ) : (
                  <>

                    <div className="flex min-w-0 items-center gap-1 md:gap-2">

                      <p className="text-[7px] font-bold uppercase leading-tight tracking-[0.04em] text-stone-400 md:text-[10px] md:tracking-[0.12em]">
                        Current location
                      </p>


                      {approximate && (
                        <span className="hidden rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-800 md:inline">
                          Approx.
                        </span>
                      )}

                    </div>


                    <p className="mt-0.5 whitespace-normal text-[9px] font-black leading-[1.15] text-stone-900 md:mt-0 md:truncate md:text-xs md:leading-normal">
                      {
                        currentLabel
                      }
                    </p>

                  </>
                )}

              </motion.div>

            </AnimatePresence>
          )}

        </div>


        {currentLocation && (
          <ChevronDown
            size={12}
            className="hidden shrink-0 text-stone-400 md:block md:size-[15px]"
            aria-hidden="true"
          />
        )}

      </button>


      {/* Detail Panel */}

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
              className="absolute left-0 top-[calc(100%+10px)] z-[70] w-[320px] max-w-[calc(100vw-1rem)] rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl shadow-stone-900/10"
            >

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
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">
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
                      Precise device location was unavailable, so this city-level location was estimated from the current network.
                    </p>
                  )}

                </div>

              </div>


              {hasDeliveryContext && (
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-stone-50 p-3">

                  <Navigation
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />


                  <div>

                    <p className="text-xs font-black text-stone-900">
                      Delivery destination
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      {
                        deliveryLabel
                      }
                    </p>

                    <p className="mt-1 text-xs font-bold text-emerald-700">

                      {Number.isFinite(
                        deliveryContext
                          ?.estimatedDeliveryMinutes,
                      )
                        ? `Estimated delivery in ${deliveryContext.estimatedDeliveryMinutes} min`
                        : 'Delivery ETA will appear when fulfillment confirms it.'}

                    </p>

                  </div>

                </div>
              )}


              <button
                type="button"
                onClick={
                  requestCurrentLocation
                }
                disabled={
                  requesting
                }
                className="focus-ring mt-4 w-full rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60"
              >

                {requesting
                  ? 'Refreshing location...'
                  : 'Refresh current location'}

              </button>


              {error && (
                <p className="mt-3 text-xs leading-5 text-red-600">
                  {error}
                </p>
              )}

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