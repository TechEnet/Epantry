import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowRight,
  Boxes,
  ChevronDown,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useAppStore,
} from '../../../store/app.store'

import AdvancedPantryPanel from '../../advancedExpansion/components/AdvancedPantryPanel'

import PantryStateBadge from '../components/PantryStateBadge'

import {
  getPantry,
  getPantryErrorMessage,
  stopTrackingPantryItem,
} from '../services/pantry.service'

const PANTRY_MEMORY_HEADING =
  'Your Pantry'

const PANTRY_TRUTH_NOTICE =
  'See what food is at home, what needs checking, and what should be used soon. EPANTRY keeps confirmed items separate from estimates so you can tell what is certain at a glance.'

const FILTERS = [
  {
    key:
      'all',

    label:
      'All',

    states:
      null,
  },

  {
    key:
      'confirmed',

    label:
      'Confirmed',

    states: [
      'confirmed_available',
      'replenished_elsewhere',
    ],
  },

  {
    key:
      'likely',

    label:
      'Likely',

    states: [
      'inferred_available',
    ],
  },

  {
    key:
      'running-low',

    label:
      'Running low',

    states: [
      'running_low',
    ],
  },

  {
    key:
      'uncertain',

    label:
      'Needs checking',

    states: [
      'uncertain',
    ],
  },

  {
    key:
      'out',

    label:
      'Out',

    states: [
      'out',
    ],
  },

  {
    key:
      'not-tracking',

    label:
      'Not tracking',

    states: [
      'do_not_track',
    ],
  },
]

function getItemId(
  item,
) {
  return (
    item?._id ||
    item?.id ||
    item?.pantryItemId ||
    null
  )
}

function getItemState(
  item,
) {
  return (
    item?.state ||
    item?.currentState ||
    item?.projectedState ||
    item?.projection
      ?.state ||
    'uncertain'
  )
}

function getItemTitle(
  item,
) {
  return (
    item?.displayName ||
    item?.name ||
    item?.canonicalIngredient
      ?.canonicalName ||
    item?.canonicalIngredient
      ?.name ||
    item?.ingredient
      ?.canonicalName ||
    item?.ingredient
      ?.name ||
    item?.canonicalPack
      ?.displayName ||
    item?.canonicalPack
      ?.name ||
    item?.pack
      ?.displayName ||
    'Pantry item'
  )
}

function getQuantity(
  item,
) {
  return (
    item?.quantity ||
    item?.currentQuantity ||
    item?.projectedQuantity ||
    item?.projection
      ?.quantity ||
    null
  )
}

function formatQuantity(
  quantity,
) {
  if (
    !quantity ||
    quantity.mode ===
      'unknown'
  ) {
    return 'Quantity not confirmed'
  }

  if (
    quantity.mode ===
      'exact' &&
    quantity.value !==
      undefined &&
    quantity.value !==
      null
  ) {
    return `${quantity.value} ${quantity.unit || ''}`.trim()
  }

  if (
    quantity.mode ===
      'range' &&
    quantity.min !==
      undefined &&
    quantity.max !==
      undefined
  ) {
    return `${quantity.min}–${quantity.max} ${quantity.unit || ''}`.trim()
  }

  if (
    quantity.value !==
      undefined &&
    quantity.value !==
      null
  ) {
    return `${quantity.value} ${quantity.unit || ''}`.trim()
  }

  return 'Quantity not confirmed'
}

function formatDate(
  value,
) {
  if (!value) {
    return 'No recent timestamp'
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
    return 'No recent timestamp'
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

function getUpdatedAt(
  item,
) {
  return (
    item?.lastObservedAt ||
    item?.lastObservationAt ||
    item?.projection
      ?.observedAt ||
    item?.updatedAt ||
    null
  )
}

export default function PantryPage() {
  const advancedPantryEnabled =
    useAppStore(
      (
        state,
      ) =>
        state.featureFlags?.[
          'm21.advanced_pantry'
        ] ===
        true,
    )

  const [
    items,
    setItems,
  ] =
    useState([])

  const [
    selectedFilter,
    setSelectedFilter,
  ] =
    useState(
      'all',
    )

  const [
    showAllItems,
    setShowAllItems,
  ] =
    useState(false)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    itemPendingRemoval,
    setItemPendingRemoval,
  ] =
    useState(null)

  const [
    removingItemId,
    setRemovingItemId,
  ] =
    useState(null)

  const loadPantry =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(
            true,
          )
        }

        setError(
          '',
        )

        try {
          const result =
            await getPantry({
              page:
                1,

              limit:
                50,
            })

          setItems(
            result.items,
          )
        } catch (
          loadError
        ) {
          setError(
            getPantryErrorMessage(
              loadError,
              'Unable to load your household Pantry.',
            ),
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      loadPantry()
    },
    [
      loadPantry,
    ],
  )

  const selectedFilterDefinition =
    useMemo(
      () =>
        FILTERS.find(
          (
            filter,
          ) =>
            filter.key ===
            selectedFilter,
        ) ||
        FILTERS[0],
      [
        selectedFilter,
      ],
    )

  const filteredItems =
    useMemo(
      () => {
        if (
          !selectedFilterDefinition.states
        ) {
          return items.filter(
            (
              item,
            ) =>
              getItemState(
                item,
              ) !==
              'do_not_track',
          )
        }

        return items.filter(
          (
            item,
          ) =>
            selectedFilterDefinition
              .states
              .includes(
                getItemState(
                  item,
                ),
              ),
        )
      },
      [
        items,
        selectedFilterDefinition,
      ],
    )

  const visibleItems =
    filteredItems.slice(0, 6)

  const allActiveItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            getItemState(item) !==
            'do_not_track',
        ),
      [items],
    )

  const confirmRemoveFromPantry =
    useCallback(
      async () => {
        const itemId =
          getItemId(
            itemPendingRemoval,
          )

        if (!itemId) {
          setItemPendingRemoval(
            null,
          )

          return
        }

        setRemovingItemId(
          itemId,
        )

        setError(
          '',
        )

        try {
          const result =
            await stopTrackingPantryItem(
              itemId,
            )

          const updatedItem =
            result?.item ||
            result?.pantryItem ||
            null

          setItems(
            (
              currentItems,
            ) =>
              currentItems.map(
                (
                  currentItem,
                ) => {
                  if (
                    getItemId(
                      currentItem,
                    ) !==
                    itemId
                  ) {
                    return currentItem
                  }

                  return updatedItem || {
                    ...currentItem,

                    state:
                      'do_not_track',

                    trackingPaused:
                      true,

                    updatedAt:
                      new Date().toISOString(),
                  }
                },
              ),
          )

          setItemPendingRemoval(
            null,
          )
        } catch (
          removeError
        ) {
          setError(
            getPantryErrorMessage(
              removeError,
              'Unable to remove this item from your active Pantry.',
            ),
          )
        } finally {
          setRemovingItemId(
            null,
          )
        }
      },
      [
        itemPendingRemoval,
      ],
    )

  return (
    <main className="page-shell !p-0">
      <div className="w-full max-w-none">
        <section className="sticky top-0 z-0 flex h-[100svh] min-h-[100svh] flex-col overflow-hidden bg-[radial-gradient(circle_at_14%_16%,rgba(209,250,229,0.88),transparent_34%),radial-gradient(circle_at_86%_12%,rgba(254,243,199,0.76),transparent_30%),linear-gradient(135deg,#fbfaf6_0%,#f3f8f2_48%,#edf7f3_100%)] shadow-[0_18px_50px_rgba(28,25,23,0.06)] relative lg:h-[133.333svh] lg:min-h-[133.333svh]">
          <div className="flex h-full flex-col px-6 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-7">
            <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-12">
              <div className="flex min-h-0 flex-col justify-start pt-2 lg:pt-1">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/90 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-800 shadow-sm backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Living Pantry
                </div>

                <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
                  {PANTRY_MEMORY_HEADING}
                </h1>

                <div className="mt-8 max-w-xl rounded-[30px] border border-white/90 bg-white/[0.72] p-6 shadow-[0_16px_36px_rgba(28,25,23,0.05)] backdrop-blur-sm sm:p-7 lg:mt-10">
                  <div className="space-y-3 text-base font-semibold leading-7 text-stone-600 sm:text-lg sm:leading-8">
                    <p>Living Pantry keeps a simple memory of the food you have at home.</p>
                    <p>It separates what you confirmed from what EPANTRY only expects, so you always know what needs checking.</p>
                    <p>Use it to spot food to use soon and plan the next basket without relying on memory.</p>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col justify-center gap-5 lg:py-7">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-x-8 lg:gap-y-8">
                  {[
                    ['1', 'Tell us what is at home', 'Add or confirm the food that is actually in your kitchen.'],
                    ['2', 'Check anything uncertain', 'If EPANTRY is unsure, it asks you to check instead of guessing.'],
                    ['3', 'Use food before it is wasted', 'See what should be used soon before useful food gets forgotten.'],
                    ['4', 'Plan the next basket', 'See what is missing or running low before you shop again.'],
                  ].map(([step, title, description]) => (
                    <article
                      key={step}
                      className="relative min-h-[180px] overflow-hidden rounded-[28px] border border-white/90 bg-white/80 p-5 shadow-[0_18px_42px_rgba(20,83,45,0.08)] ring-1 ring-inset ring-emerald-950/5 backdrop-blur-md sm:min-h-[190px]"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-800 text-sm font-black text-white shadow-[0_8px_18px_rgba(6,78,59,0.18)]">
                          {step}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/70">
                          Step 0{step}
                        </span>
                      </div>
                      <h2 className="mt-5 text-base font-black leading-tight text-stone-950 sm:text-lg">
                        {title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {description}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="flex flex-wrap justify-end gap-2.5 pr-1">
                  <Link
                    to="/waste-reduction"
                    className="focus-ring inline-flex min-h-14 min-w-[150px] items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-black text-amber-950 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
                  >
                    Use food soon
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Link
                    to="/next-basket"
                    className="focus-ring inline-flex min-h-14 min-w-[150px] items-center justify-between gap-3 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(4,120,87,0.18)] transition hover:bg-emerald-800"
                  >
                    Plan next basket
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('pantry-food-home')
                ?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
            }}
            className="focus-ring absolute bottom-14 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-900/10 bg-white/85 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-950 shadow-[0_10px_28px_rgba(6,78,59,0.12)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white sm:bottom-16 lg:bottom-24"
            aria-label="Scroll to your food at home"
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/25" aria-hidden="true" />
              <ChevronDown
                size={16}
                className="relative animate-bounce"
                aria-hidden="true"
              />
            </span>
            <span>Scroll to your food</span>
          </button>
        </section>

        <section
          id="pantry-food-home"
          className="relative z-20 -mt-6 flex h-[calc(100svh-72px)] min-h-[calc(100svh-72px)] flex-col overflow-hidden rounded-t-[36px] border-t border-emerald-100 bg-[radial-gradient(circle_at_88%_10%,rgba(186,230,253,0.30),transparent_28%),radial-gradient(circle_at_12%_92%,rgba(209,250,229,0.42),transparent_30%),linear-gradient(180deg,#fbfcfa_0%,#f5f8f3_100%)] shadow-[0_-24px_60px_rgba(28,25,23,0.10)]"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6 border-b border-emerald-100/80 px-5 py-4 sm:px-7">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Your food at home</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">What is in your Pantry?</h2>
              <p className="mt-1 text-sm text-stone-500">Choose a filter, then open an item to check or update it.</p>
            </div>

            <button
              type="button"
              onClick={() => loadPantry({ refresh: true })}
              disabled={refreshing || loading}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white/90 px-4 py-2.5 text-sm font-black text-stone-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh list
            </button>
          </div>


          <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-2.5 sm:px-5 sm:pb-4">
            <div className="flex flex-col gap-2.5 rounded-2xl border border-stone-200/80 bg-white/65 px-3 py-2.5 sm:flex-row sm:items-center">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">Show</span>
              <div className="flex flex-1 gap-2 overflow-x-auto pb-1 sm:justify-between sm:pb-0">
                {FILTERS.map((filter) => {
                  const active = filter.key === selectedFilter
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setSelectedFilter(filter.key)}
                      className={[
                        'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-black transition',
                        active
                          ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                          : 'border-stone-200 bg-white/90 text-stone-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800',
                      ].join(' ')}
                    >
                      {filter.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div>
            )}

            <div className="mt-3 min-h-0 flex-1 overflow-hidden">
              {loading ? (
                <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:grid-rows-2">
                  {[1, 2, 3, 4, 5, 6].map((key) => (
                    <div key={key} className="min-h-0 animate-pulse rounded-[20px] border border-stone-200 bg-stone-100" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-200">
                    <Boxes size={26} className="text-stone-400" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-lg font-black text-stone-900">Nothing to show here</h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">Try another filter, or add food to your Pantry as you cook, shop and confirm what is at home.</p>
                </div>
              ) : (
                <div className="grid h-full content-start gap-y-6 sm:grid-cols-2 lg:grid-cols-[repeat(3,320px)] lg:justify-between">
                  {visibleItems.map((item) => {
                    const itemId = getItemId(item)
                    const state = getItemState(item)
                    return (
                      <article
                        key={itemId || getItemTitle(item)}
                        className="group relative flex h-[220px] w-full max-w-[320px] flex-col overflow-hidden rounded-[30px] bg-[#edf5ef] p-5 shadow-[15px_15px_30px_#cbd8cf,-15px_-15px_30px_#ffffff] transition duration-200 hover:-translate-y-0.5 sm:justify-self-center lg:justify-self-auto"
                      >
                        <div className="flex justify-center pt-1">
                          <PantryStateBadge state={state} />
                        </div>

                        <div className="flex flex-1 items-center justify-center px-2 text-center">
                          <h2 className="line-clamp-2 text-[18px] font-black leading-tight tracking-[-0.02em] text-stone-950">
                            {getItemTitle(item)}
                          </h2>
                        </div>

                        <div className="mt-auto">
                          {itemId ? (
                            <div className="grid gap-2">
                              <Link
                                to={`/pantry/items/${encodeURIComponent(itemId)}`}
                                className="focus-ring inline-flex min-h-9 items-center justify-between rounded-[14px] bg-emerald-800 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-emerald-900"
                              >
                                Check & update
                                <ArrowRight size={14} aria-hidden="true" />
                              </Link>

                              {state !== 'do_not_track' ? (
                                <button
                                  type="button"
                                  onClick={() => setItemPendingRemoval(item)}
                                  disabled={removingItemId === itemId}
                                  className="focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[14px] border border-rose-200/90 bg-white/80 px-3 py-2 text-[10px] font-black text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 size={12} aria-hidden="true" />
                                  Remove from Pantry
                                </button>
                              ) : (
                                <span className="rounded-[14px] border border-stone-300 bg-white/70 px-3 py-2 text-center text-[10px] font-bold text-stone-600">Not being tracked</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-center text-xs font-semibold text-stone-500">History unavailable for this item.</p>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAllItems(true)
                }}
                className="focus-ring inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white/90 px-5 py-2 text-sm font-black text-stone-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
              >
                View all
              </button>
            </div>
          </div>
        </section>

        {advancedPantryEnabled ? <AdvancedPantryPanel /> : null}
      </div>

      {showAllItems ? (
        <div
          className="fixed inset-x-0 bottom-0 top-[84px] z-40 flex items-center justify-center bg-stone-950/20 px-4 py-4 backdrop-blur-xl"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAllItems(false)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-pantry-items-title"
            className="flex max-h-[calc(100svh-116px)] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/[0.72] shadow-[0_28px_90px_rgba(15,23,42,0.24)] ring-1 ring-white/55 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/70 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Your food at home</p>
                <h2 id="all-pantry-items-title" className="mt-1 text-2xl font-black tracking-tight text-stone-950">All Pantry items</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAllItems(false)}
                className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/80 text-stone-600 shadow-sm transition hover:bg-white"
                aria-label="Close all Pantry items"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {allActiveItems.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/80 bg-white/60 px-6 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-200">
                    <Boxes size={26} className="text-stone-400" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-stone-900">Nothing to show here</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {allActiveItems.map((item) => {
                    const itemId = getItemId(item)
                    const state = getItemState(item)

                    return (
                      <article
                        key={`all-${itemId || getItemTitle(item)}`}
                        className="group flex min-h-[220px] flex-col rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-[0_10px_28px_rgba(28,25,23,0.08)] ring-1 ring-stone-950/5 backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <PantryStateBadge state={state} />
                          <span className="text-[10px] font-black uppercase tracking-[0.13em] text-stone-400">Pantry item</span>
                        </div>

                        <h3 className="mt-3 text-lg font-black leading-tight text-stone-950">{getItemTitle(item)}</h3>

                        <div className="mt-3 rounded-2xl bg-white/70 p-3 ring-1 ring-inset ring-stone-200/80">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-stone-400">Quantity</p>
                          <p className="mt-1 text-sm font-black text-stone-900">{formatQuantity(getQuantity(item))}</p>
                          <div className="my-2 h-px bg-stone-200" />
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-stone-400">Last update</p>
                          <p className="mt-1 text-sm font-semibold text-stone-700">{formatDate(getUpdatedAt(item))}</p>
                        </div>

                        <div className="mt-auto pt-3">
                          {itemId ? (
                            <div className="grid gap-2">
                              <Link
                                to={`/pantry/items/${encodeURIComponent(itemId)}`}
                                onClick={() => setShowAllItems(false)}
                                className="focus-ring inline-flex items-center justify-between rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                              >
                                Check & update
                                <ArrowRight size={16} aria-hidden="true" />
                              </Link>

                              {state !== 'do_not_track' ? (
                                <button
                                  type="button"
                                  onClick={() => setItemPendingRemoval(item)}
                                  disabled={removingItemId === itemId}
                                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white/80 px-4 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  Remove from Pantry
                                </button>
                              ) : (
                                <span className="rounded-xl border border-stone-200 bg-white/70 px-3 py-2 text-center text-xs font-bold text-stone-500">Not being tracked</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs font-semibold text-stone-400">History unavailable for this item.</p>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {itemPendingRemoval ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !removingItemId) {
              setItemPendingRemoval(null)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-pantry-item-title"
            className="flex flex-col rounded-[28px] border border-stone-200 bg-white p-8 shadow-2xl"
            style={{
              width: '470px',
              maxWidth: 'calc(100vw - 32px)',
              minHeight: '380px',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-600">
                  Remove from Pantry
                </p>
                <h2
                  id="remove-pantry-item-title"
                  className="mt-3 text-3xl font-black leading-tight tracking-tight text-stone-950"
                >
                  Remove {getItemTitle(itemPendingRemoval)}?
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setItemPendingRemoval(null)}
                disabled={Boolean(removingItemId)}
                className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-500 transition hover:bg-stone-100 disabled:opacity-50"
                aria-label="Close remove confirmation"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <p className="mt-7 text-base leading-7 text-stone-600">
              EPANTRY will stop tracking this item in your active Pantry. Its history will stay saved under Not tracking.
            </p>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
              <button
                type="button"
                onClick={() => setItemPendingRemoval(null)}
                disabled={Boolean(removingItemId)}
                className="focus-ring rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Keep item
              </button>

              <button
                type="button"
                onClick={confirmRemoveFromPantry}
                disabled={Boolean(removingItemId)}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} aria-hidden="true" />
                {removingItemId ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
