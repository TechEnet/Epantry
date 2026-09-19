import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ArrowLeft,
  Boxes,
  Clock3,
  EyeOff,
  PackageX,
  RefreshCw,
  Save,
  ShoppingBag,
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import PantryStateBadge from '../components/PantryStateBadge'

import {
  correctPantryQuantity,
  getPantryErrorMessage,
  getPantryItemHistory,
  markPantryItemBoughtElsewhere,
  markPantryItemFinished,
  stopTrackingPantryItem,
  updatePantryStorage,
  updatePantryUseSoon,
} from '../services/pantry.service'

const OBSERVATION_LABELS = Object.freeze({
  i_have_this:
    'I have this',

  manual_quantity_correction:
    'Exact quantity corrected',

  finished:
    'Marked finished',

  bought_elsewhere:
    'Bought elsewhere',

  storage_update:
    'Storage updated',

  use_soon:
    'Use soon by',

  do_not_track:
    'Tracking stopped',

  opened:
    'Opened',

  recipe_cooked:
    'Recipe cooked',

  marketplace_purchase:
    'Marketplace purchase signal',

  commerce_email_history:
    'Purchase history signal',

  inference:
    'Inferred Pantry signal',
})

function formatDate(
  value,
) {
  if (!value) {
    return 'Timestamp unavailable'
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
    return 'Timestamp unavailable'
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

function formatDateOnly(
  value,
) {
  if (!value) {
    return 'Not set'
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
    return 'Not set'
  }

  return new Intl.DateTimeFormat(
    'en-IN',

    {
      dateStyle:
        'medium',
    },
  ).format(
    date,
  )
}

function toDateInputValue(
  value,
) {
  if (!value) {
    return ''
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
    return ''
  }

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    )

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    )

  return `${year}-${month}-${day}`
}

function formatQuantity(
  quantity,
) {
  if (!quantity) {
    return 'No quantity signal'
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
    quantity.min !==
      null &&
    quantity.max !==
      undefined &&
    quantity.max !==
      null
  ) {
    return `${quantity.min}–${quantity.max} ${quantity.unit || ''}`.trim()
  }

  return 'No quantity signal'
}

function formatSourceType(
  sourceType,
) {
  if (!sourceType) {
    return 'Pantry observation'
  }

  return (
    OBSERVATION_LABELS[
      sourceType
    ] ||
    sourceType
      .split(
        '_',
      )
      .filter(
        Boolean,
      )
      .map(
        (
          part,
        ) =>
          `${part
            .charAt(
              0,
            )
            .toUpperCase()}${part.slice(
            1,
          )}`,
      )
      .join(
        ' ',
      )
  )
}

function getItemState(
  item,
) {
  return (
    item?.state ||
    'uncertain'
  )
}

function getItemIdentity(
  item,
) {
  return (
    item?.displayName ||
    item?.canonicalIngredient
      ?.canonicalName ||
    item?.canonicalIngredient
      ?.name ||
    item?.canonicalPack
      ?.displayName ||
    item?.canonicalPack
      ?.name ||
    (
      item?.canonicalIngredientId
        ? `Ingredient ${item.canonicalIngredientId}`
        : null
    ) ||
    (
      item?.canonicalPackId
        ? `Pack ${item.canonicalPackId}`
        : null
    ) ||
    'Household Pantry item'
  )
}

export default function PantryItemHistoryPage() {
  const {
    itemId,
  } =
    useParams()

  const [
    item,
    setItem,
  ] =
    useState(
      null,
    )

  const [
    observations,
    setObservations,
  ] =
    useState(
      [],
    )

  const [
    pagination,
    setPagination,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    )

  const [
    actionPending,
    setActionPending,
  ] =
    useState(
      '',
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState(
      '',
    )

  const [
    quantityValue,
    setQuantityValue,
  ] =
    useState(
      '',
    )

  const [
    quantityUnit,
    setQuantityUnit,
  ] =
    useState(
      '',
    )

  const [
    storageZone,
    setStorageZone,
  ] =
    useState(
      '',
    )

  const [
    useSoonDate,
    setUseSoonDate,
  ] =
    useState(
      '',
    )

  const loadHistory =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (!itemId) {
          setError(
            'Pantry item ID is missing.',
          )

          setLoading(
            false,
          )

          return
        }

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
            await getPantryItemHistory(
              itemId,

              {
                page:
                  1,

                limit:
                  50,
              },
            )

          setItem(
            result.item ||
              null,
          )

          setObservations(
            result.observations ||
              [],
          )

          setPagination(
            result.pagination ||
              null,
          )

          const currentQuantity =
            result.item
              ?.quantity

          if (
            currentQuantity?.mode ===
              'exact'
          ) {
            setQuantityValue(
              String(
                currentQuantity.value ??
                  '',
              ),
            )

            setQuantityUnit(
              currentQuantity.unit ||
                '',
            )
          } else if (
            currentQuantity?.unit
          ) {
            setQuantityUnit(
              currentQuantity.unit,
            )
          }

          setStorageZone(
            result.item
              ?.storageZone ||
              '',
          )

          setUseSoonDate(
            toDateInputValue(
              result.item
                ?.useSoonAt,
            ),
          )
        } catch (
          loadError
        ) {
          setError(
            getPantryErrorMessage(
              loadError,

              'Unable to load Pantry item history.',
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

      [
        itemId,
      ],
    )

  useEffect(
    () => {
      loadHistory()
    },

    [
      loadHistory,
    ],
  )

  const runAction =
    useCallback(
      async (
        actionKey,
        action,
        message,
      ) => {
        if (
          !itemId ||
          actionPending
        ) {
          return
        }

        setActionPending(
          actionKey,
        )

        setError(
          '',
        )

        setSuccessMessage(
          '',
        )

        try {
          await action()

          setSuccessMessage(
            message,
          )

          await loadHistory({
            refresh:
              true,
          })
        } catch (
          actionError
        ) {
          setError(
            getPantryErrorMessage(
              actionError,
            ),
          )
        } finally {
          setActionPending(
            '',
          )
        }
      },

      [
        actionPending,
        itemId,
        loadHistory,
      ],
    )

  const handleQuantityCorrection =
    async (
      event,
    ) => {
      event.preventDefault()

      await runAction(
        'quantity',

        () =>
          correctPantryQuantity(
            itemId,

            {
              value:
                quantityValue,

              unit:
                quantityUnit,
            },
          ),

        'Exact quantity correction recorded as a new observation.',
      )
    }

  const handleStorageUpdate =
    async (
      event,
    ) => {
      event.preventDefault()

      await runAction(
        'storage',

        () =>
          updatePantryStorage(
            itemId,
            storageZone,
          ),

        'Storage update recorded as a new observation.',
      )
    }

  const handleUseSoonUpdate =
    async (
      event,
    ) => {
      event.preventDefault()

      await runAction(
        'use-soon',

        () =>
          updatePantryUseSoon(
            itemId,
            useSoonDate,
          ),

        'Use-soon date recorded as a new observation.',
      )
    }

  const observationCountLabel =
    useMemo(
      () => {
        const total =
          pagination
            ?.total

        if (
          Number.isFinite(
            total,
          )
        ) {
          return `${total} observation${total === 1 ? '' : 's'}`
        }

        return `${observations.length} observation${
          observations.length ===
          1
            ? ''
            : 's'
        }`
      },

      [
        observations.length,
        pagination,
      ],
    )

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/pantry"
          className="inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft
            size={16}
            aria-hidden="true"
          />

          Back to Living Pantry
        </Link>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-5 py-6 sm:px-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  P15 · Household Pantry
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                  Pantry item history
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                  Observation history is append-only. Corrections below create a
                  new Pantry observation; previous signals remain visible for
                  household traceability.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadHistory({
                    refresh:
                      true,
                  })
                }
                disabled={
                  refreshing ||
                  Boolean(
                    actionPending,
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                  aria-hidden="true"
                />

                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800 sm:px-7">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 sm:px-7">
              {successMessage}
            </div>
          )}

          {loading ? (
            <div className="p-5 sm:p-7">
              <div className="h-40 animate-pulse rounded-[24px] bg-stone-100" />
            </div>
          ) : (
            <>
              <div className="grid gap-5 border-b border-stone-200 bg-stone-50/70 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <p className="text-sm font-black text-stone-950">
                    {
                      getItemIdentity(
                        item,
                      )
                    }
                  </p>

                  <div className="mt-3">
                    <PantryStateBadge
                      state={
                        getItemState(
                          item,
                        )
                      }
                      showDescription
                    />
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
                    <p>
                      <span className="font-black text-stone-800">
                        Current quantity:{' '}
                      </span>

                      {
                        formatQuantity(
                          item
                            ?.quantity,
                        )
                      }
                    </p>

                    <p>
                      <span className="font-black text-stone-800">
                        Storage:{' '}
                      </span>

                      {
                        item
                          ?.storageZone ||
                        'Not recorded'
                      }
                    </p>

                    <p>
                      <span className="font-black text-stone-800">
                        Last signal:{' '}
                      </span>

                      {
                        formatDate(
                          item
                            ?.lastObservationAt,
                        )
                      }
                    </p>

                    <p>
                      <span className="font-black text-stone-800">
                        Tracking:{' '}
                      </span>

                      {
                        item
                          ?.trackingPaused
                          ? 'Not tracking'
                          : 'Active'
                      }
                    </p>

                    <p>
                      <span className="font-black text-stone-800">
                        Use soon by:{' '}
                      </span>

                      {
                        formatDateOnly(
                          item
                            ?.useSoonAt,
                        )
                      }
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700">
                  {
                    observationCountLabel
                  }
                </div>
              </div>

              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.95fr_1.05fr]">
                <section>
                  <h2 className="text-lg font-black text-stone-950">
                    Correct Pantry state
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    These controls never rewrite or delete old history. Every
                    change is recorded as another observation.
                  </p>

                  <form
                    onSubmit={
                      handleQuantityCorrection
                    }
                    className="mt-5 rounded-[22px] border border-stone-200 p-4"
                  >
                    <h3 className="font-black text-stone-900">
                      Correct exact quantity
                    </h3>

                    <div className="mt-4 grid grid-cols-[1fr_0.8fr] gap-3">
                      <label className="text-sm font-bold text-stone-700">
                        Quantity

                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={
                            quantityValue
                          }
                          onChange={(
                            event,
                          ) =>
                            setQuantityValue(
                              event
                                .target
                                .value,
                            )
                          }
                          required
                          className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600"
                        />
                      </label>

                      <label className="text-sm font-bold text-stone-700">
                        Unit

                        <input
                          type="text"
                          value={
                            quantityUnit
                          }
                          onChange={(
                            event,
                          ) =>
                            setQuantityUnit(
                              event
                                .target
                                .value,
                            )
                          }
                          placeholder="g, ml, pcs"
                          required
                          className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        Boolean(
                          actionPending,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save
                        size={16}
                        aria-hidden="true"
                      />

                      {
                        actionPending ===
                        'quantity'
                          ? 'Saving…'
                          : 'Save exact quantity'
                      }
                    </button>
                  </form>

                  <form
                    onSubmit={
                      handleUseSoonUpdate
                    }
                    className="mt-4 rounded-[22px] border border-stone-200 p-4"
                  >
                    <h3 className="font-black text-stone-900">
                      Use soon by
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Tell EPANTRY when you would prefer to use this item. This
                      is household guidance, not an expiry date.
                    </p>

                    <label className="mt-4 block text-sm font-bold text-stone-700">
                      Date

                      <input
                        type="date"
                        value={
                          useSoonDate
                        }
                        onChange={(
                          event,
                        ) =>
                          setUseSoonDate(
                            event
                              .target
                              .value,
                          )
                        }
                        required
                        className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={
                        Boolean(
                          actionPending,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-black text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save
                        size={16}
                        aria-hidden="true"
                      />

                      {
                        actionPending ===
                        'use-soon'
                          ? 'Saving…'
                          : 'Save use-soon date'
                      }
                    </button>
                  </form>

                  <form
                    onSubmit={
                      handleStorageUpdate
                    }
                    className="mt-4 rounded-[22px] border border-stone-200 p-4"
                  >
                    <h3 className="font-black text-stone-900">
                      Update storage
                    </h3>

                    <label className="mt-4 block text-sm font-bold text-stone-700">
                      Storage zone

                      <input
                        type="text"
                        value={
                          storageZone
                        }
                        onChange={(
                          event,
                        ) =>
                          setStorageZone(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Pantry shelf, fridge, freezer"
                        required
                        className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={
                        Boolean(
                          actionPending,
                        )
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-black text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Boxes
                        size={16}
                        aria-hidden="true"
                      />

                      {
                        actionPending ===
                        'storage'
                          ? 'Saving…'
                          : 'Update storage'
                      }
                    </button>
                  </form>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          'finished',

                          () =>
                            markPantryItemFinished(
                              itemId,
                            ),

                          'Finished observation recorded.',
                        )
                      }
                      disabled={
                        Boolean(
                          actionPending,
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-black text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <PackageX
                        size={16}
                        aria-hidden="true"
                      />

                      Finished
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          'bought-elsewhere',

                          () =>
                            markPantryItemBoughtElsewhere(
                              itemId,
                            ),

                          'Bought elsewhere observation recorded.',
                        )
                      }
                      disabled={
                        Boolean(
                          actionPending,
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm font-black text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShoppingBag
                        size={16}
                        aria-hidden="true"
                      />

                      Bought elsewhere
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          'do-not-track',

                          () =>
                            stopTrackingPantryItem(
                              itemId,
                            ),

                          'Do not track observation recorded.',
                        )
                      }
                      disabled={
                        Boolean(
                          actionPending,
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-stone-100 px-3 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <EyeOff
                        size={16}
                        aria-hidden="true"
                      />

                      Do not track
                    </button>
                  </div>
                </section>

                <section>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-stone-950">
                        Observation history
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-stone-500">
                        Newest observations appear first.
                      </p>
                    </div>

                    <Clock3
                      size={22}
                      className="text-stone-400"
                      aria-hidden="true"
                    />
                  </div>

                  {
                    observations.length ===
                    0 ? (
                      <div className="mt-5 rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center text-sm font-semibold text-stone-500">
                        No Pantry observations are available for this item yet.
                      </div>
                    ) : (
                      <ol className="mt-5 space-y-3">
                        {
                          observations.map(
                            (
                              observation,
                              index,
                            ) => (
                              <li
                                key={
                                  observation.id ||
                                  `${observation.sourceType || 'observation'}-${
                                    observation.observedAt ||
                                    index
                                  }`
                                }
                                className="rounded-[22px] border border-stone-200 bg-white p-4"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="font-black text-stone-900">
                                      {
                                        formatSourceType(
                                          observation
                                            .sourceType,
                                        )
                                      }
                                    </p>

                                    <p className="mt-1 text-xs font-semibold text-stone-500">
                                      {
                                        formatDate(
                                          observation
                                            .observedAt ||
                                            observation
                                              .createdAt,
                                        )
                                      }
                                    </p>
                                  </div>

                                  {
                                    observation
                                      .customerCorrection && (
                                      <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                                        Household correction
                                      </span>
                                    )
                                  }
                                </div>

                                <div className="mt-3 grid gap-1.5 text-sm text-stone-600 sm:grid-cols-2">
                                  {
                                    observation
                                      .stateSignal && (
                                      <p>
                                        <span className="font-black text-stone-800">
                                          State signal:{' '}
                                        </span>

                                        {
                                          observation
                                            .stateSignal
                                        }
                                      </p>
                                    )
                                  }

                                  {
                                    observation
                                      .quantity && (
                                      <p>
                                        <span className="font-black text-stone-800">
                                          Quantity:{' '}
                                        </span>

                                        {
                                          formatQuantity(
                                            observation
                                              .quantity,
                                          )
                                        }
                                      </p>
                                    )
                                  }

                                  {
                                    observation
                                      .storageZone && (
                                      <p>
                                        <span className="font-black text-stone-800">
                                          Storage:{' '}
                                        </span>

                                        {
                                          observation
                                            .storageZone
                                        }
                                      </p>
                                    )
                                  }

                                  {
                                    observation
                                      .useSoonAt && (
                                      <p>
                                        <span className="font-black text-stone-800">
                                          Use soon by:{' '}
                                        </span>

                                        {
                                          formatDateOnly(
                                            observation
                                              .useSoonAt,
                                          )
                                        }
                                      </p>
                                    )
                                  }

                                  <p>
                                    <span className="font-black text-stone-800">
                                      Projection:{' '}
                                    </span>

                                    {
                                      observation
                                        .projectionApplied
                                        ? 'Applied'
                                        : 'Preserved in history'
                                    }
                                  </p>
                                </div>

                                {
                                  observation
                                    .note && (
                                    <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600">
                                      {
                                        observation
                                          .note
                                      }
                                    </p>
                                  )
                                }
                              </li>
                            ),
                          )
                        }
                      </ol>
                    )
                  }
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}