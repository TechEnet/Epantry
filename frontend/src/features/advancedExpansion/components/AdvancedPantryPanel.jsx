import {
  Brain,
  Clock3,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  cancelReceiptImport,
  createReceiptImport,
  getAdvancedExpansionErrorMessage,
  getAdvancedPlanningIntelligence,
  getHouseholdMemory,
  listReceiptImports,
  recordLeftover,
  reviewReceiptLine,
  updateMemoryControl,
} from '../services/advancedExpansion.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const buttonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50'

const NO_AUTOMATIC_PURCHASE_NOTICE =
  'No automatic Meal Plan change, Cart, Checkout or purchase occurs here.'

function lineKey() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `line_${crypto.randomUUID()}`
  }

  return `line_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`
}

function eventKey() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `leftover_${crypto.randomUUID()}`
  }

  return `leftover_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`
}

function newReceiptLine() {
  return {
    lineKey:
      lineKey(),

    label:
      '',

    barcode:
      '',

    quantityMode:
      'unknown',

    quantityValue:
      '',

    quantityUnit:
      'piece',
  }
}

function titleize(
  value,
) {
  return String(
    value ||
    '',
  )
    .split('_')
    .filter(Boolean)
    .map(
      (
        part,
      ) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
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

function localDateTimeValue(
  date,
) {
  const value =
    date instanceof Date
      ? date
      : new Date(
          date,
        )

  const shifted =
    new Date(
      value.getTime() -
      value.getTimezoneOffset() *
        60 *
        1000,
    )

  return shifted
    .toISOString()
    .slice(
      0,
      16,
    )
}

export default function AdvancedPantryPanel() {
  const [
    receipts,
    setReceipts,
  ] =
    useState([])

  const [
    memory,
    setMemory,
  ] =
    useState(null)

  const [
    planning,
    setPlanning,
  ] =
    useState(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    busy,
    setBusy,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    notice,
    setNotice,
  ] =
    useState('')

  const [
    manualPackByLine,
    setManualPackByLine,
  ] =
    useState({})

  const [
    receiptForm,
    setReceiptForm,
  ] =
    useState({
      sourceKind:
        'receipt',

      merchantLabel:
        '',

      market:
        'IN',

      purchasedAt:
        localDateTimeValue(
          new Date(),
        ),

      sourceArtifactRef:
        '',

      explicitImportAcknowledged:
        false,

      lines: [
        newReceiptLine(),
      ],
    })

  const defaultUseSoon =
    useMemo(
      () => {
        const date =
          new Date()

        date.setDate(
          date.getDate() +
            2,
        )

        return localDateTimeValue(
          date,
        )
      },
      [],
    )

  const [
    leftoverForm,
    setLeftoverForm,
  ] =
    useState({
      recipeVersionId:
        '',

      leftoverServings:
        '1',

      storageZone:
        'fridge',

      occurredAt:
        localDateTimeValue(
          new Date(),
        ),

      useSoonAt:
        defaultUseSoon,

      note:
        '',
    })

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
            receiptResult,
            memoryResult,
            planningResult,
          ] =
            await Promise.all([
              listReceiptImports(),

              getHouseholdMemory(),

              getAdvancedPlanningIntelligence(),
            ])

          setReceipts(
            receiptResult
              ?.receiptImports ||
              [],
          )

          setMemory(
            memoryResult ||
            null,
          )

          setPlanning(
            planningResult ||
            null,
          )
        } catch (
          loadError
        ) {
          setError(
            getAdvancedExpansionErrorMessage(
              loadError,
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

  function updateReceiptLine(
    lineId,
    patch,
  ) {
    setReceiptForm(
      (
        current,
      ) => ({
        ...current,

        lines:
          current.lines.map(
            (
              line,
            ) =>
              line.lineKey ===
              lineId
                ? {
                    ...line,
                    ...patch,
                  }
                : line,
          ),
      }),
    )
  }

  function removeReceiptLine(
    lineId,
  ) {
    setReceiptForm(
      (
        current,
      ) => ({
        ...current,

        lines:
          current.lines.length <=
          1
            ? current.lines
            : current.lines.filter(
                (
                  line,
                ) =>
                  line.lineKey !==
                  lineId,
              ),
      }),
    )
  }

  async function submitReceipt(
    event,
  ) {
    event.preventDefault()

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
      const lines =
        receiptForm.lines.map(
          (
            line,
          ) => ({
            lineKey:
              line.lineKey,

            label:
              line.label,

            barcode:
              line.barcode,

            quantity:
              line.quantityMode ===
                'exact'
                ? {
                    mode:
                      'exact',

                    value:
                      Number(
                        line.quantityValue,
                      ),

                    unit:
                      line.quantityUnit,
                  }
                : {
                    mode:
                      'unknown',
                  },
          }),
        )

      const result =
        await createReceiptImport({
          sourceKind:
            receiptForm.sourceKind,

          merchantLabel:
            receiptForm
              .merchantLabel,

          market:
            receiptForm.market,

          purchasedAt:
            new Date(
              receiptForm.purchasedAt,
            ).toISOString(),

          sourceArtifactRef:
            receiptForm
              .sourceArtifactRef,

          explicitImportAcknowledged:
            receiptForm
              .explicitImportAcknowledged,

          lines,
        })

      setNotice(
        `Receipt ${result?.receiptImport?.receiptImportId || ''} imported for review. Nothing was added to Pantry automatically.`,
      )

      setReceiptForm(
        (
          current,
        ) => ({
          ...current,

          merchantLabel:
            '',

          sourceArtifactRef:
            '',

          explicitImportAcknowledged:
            false,

          lines: [
            newReceiptLine(),
          ],
        }),
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getAdvancedExpansionErrorMessage(
          requestError,
          'Unable to import receipt evidence.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function reviewLine({
    receiptImportId,
    line,
    action,
  }) {
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
      const manualPack =
        manualPackByLine[
          `${receiptImportId}:${line.lineKey}`
        ] ||
        ''

      await reviewReceiptLine({
        receiptImportId,

        lineKey:
          line.lineKey,

        action,

        canonicalPackId:
          action ===
            'apply' &&
          !line.canonicalPackId
            ? manualPack
            : undefined,
      })

      setNotice(
        action ===
          'apply'
          ? 'Customer-confirmed receipt evidence was sent to the existing M09 Pantry observation pipeline.'
          : 'Receipt line excluded. It was not projected into Pantry.',
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getAdvancedExpansionErrorMessage(
          requestError,
          'Unable to review this receipt line.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function cancelImport(
    receiptImportId,
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
      await cancelReceiptImport(
        receiptImportId,
      )

      setNotice(
        'Receipt import cancelled before Pantry application.',
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getAdvancedExpansionErrorMessage(
          requestError,
          'Unable to cancel this receipt import.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function controlMemory(
    memoryFactId,
    action,
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
      await updateMemoryControl({
        memoryFactId,
        action,
      })

      setNotice(
        action ===
          'forget'
          ? 'This learned household memory was forgotten and its stored identity/evidence was cleared.'
          : `Household memory ${action} applied.`,
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getAdvancedExpansionErrorMessage(
          requestError,
          'Unable to update household memory.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function submitLeftover(
    event,
  ) {
    event.preventDefault()

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
      await recordLeftover({
        eventKey:
          eventKey(),

        recipeVersionId:
          leftoverForm
            .recipeVersionId,

        leftoverServings:
          Number(
            leftoverForm
              .leftoverServings,
          ),

        storageZone:
          leftoverForm
            .storageZone,

        occurredAt:
          new Date(
            leftoverForm
              .occurredAt,
          ).toISOString(),

        useSoonAt:
          new Date(
            leftoverForm
              .useSoonAt,
          ).toISOString(),

        note:
          leftoverForm.note,
      })

      setNotice(
        'Explicit leftover evidence recorded. No Pantry quantity, Meal Plan or purchase was changed automatically.',
      )

      setLeftoverForm(
        (
          current,
        ) => ({
          ...current,

          recipeVersionId:
            '',

          leftoverServings:
            '1',

          note:
            '',
        }),
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getAdvancedExpansionErrorMessage(
          requestError,
          'Unable to record leftover evidence.',
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  return (
    <section
      className="mt-8 space-y-6"
      aria-labelledby="m21-intelligence-title"
    >
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              M21 Advanced Expansion · Batch 1
            </p>

            <h2
              id="m21-intelligence-title"
              className="mt-2 text-2xl font-black tracking-tight text-stone-950"
            >
              Purchase memory, predictive Pantry and leftovers
            </h2>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-stone-600">
              Receipt evidence stays reviewable, predictions stay
              non-authoritative, and leftovers are explicit Customer
              evidence. Existing M09 Pantry and M13 planning remain
              the source systems rather than being replaced.
            </p>
          </div>

          <button
            type="button"
            onClick={
              load
            }
            disabled={
              loading ||
              busy
            }
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            Refresh intelligence
          </button>
        </div>

        <div
          className="mt-4 min-h-6 text-sm font-semibold"
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
          ) : loading ? (
            <p className="text-stone-500">
              Loading advanced household intelligence…
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <ReceiptText
              className="mt-0.5 shrink-0 text-emerald-700"
              size={22}
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Receipt / Purchase Vault
              </h3>

              <p className="mt-1 text-sm font-medium leading-6 text-stone-600">
                Import structured receipt evidence. Even an exact barcode
                match waits for your review before it becomes a Pantry
                observation.
              </p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={
              submitReceipt
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className={
                  inputClass
                }
                value={
                  receiptForm.sourceKind
                }
                onChange={
                  (
                    event,
                  ) =>
                    setReceiptForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        sourceKind:
                          event.target.value,
                      }),
                    )
                }
                aria-label="Receipt source kind"
              >
                <option value="receipt">
                  Receipt
                </option>

                <option value="receipt_photo">
                  Receipt photo evidence
                </option>

                <option value="purchase_history">
                  Purchase history import
                </option>
              </select>

              <input
                className={
                  inputClass
                }
                value={
                  receiptForm.merchantLabel
                }
                onChange={
                  (
                    event,
                  ) =>
                    setReceiptForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        merchantLabel:
                          event.target.value,
                      }),
                    )
                }
                placeholder="Merchant label (optional)"
              />

              <input
                required
                className={
                  inputClass
                }
                type="datetime-local"
                value={
                  receiptForm.purchasedAt
                }
                onChange={
                  (
                    event,
                  ) =>
                    setReceiptForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        purchasedAt:
                          event.target.value,
                      }),
                    )
                }
                aria-label="Purchase time"
              />

              <input
                required
                className={
                  inputClass
                }
                value={
                  receiptForm.market
                }
                onChange={
                  (
                    event,
                  ) =>
                    setReceiptForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        market:
                          event.target.value.toUpperCase(),
                      }),
                    )
                }
                placeholder="Market"
              />

              <input
                className={`${inputClass} sm:col-span-2`}
                value={
                  receiptForm.sourceArtifactRef
                }
                onChange={
                  (
                    event,
                  ) =>
                    setReceiptForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        sourceArtifactRef:
                          event.target.value,
                      }),
                    )
                }
                placeholder="Private source artifact reference (optional; raw image is not analytics payload)"
              />
            </div>

            <div className="space-y-3">
              {receiptForm.lines.map(
                (
                  line,
                  index,
                ) => (
                  <fieldset
                    key={
                      line.lineKey
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <legend className="px-1 text-xs font-black uppercase tracking-wide text-stone-500">
                      Receipt line {index + 1}
                    </legend>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        required
                        className={
                          inputClass
                        }
                        value={
                          line.label
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            updateReceiptLine(
                              line.lineKey,
                              {
                                label:
                                  event.target.value,
                              },
                            )
                        }
                        placeholder="Item label"
                      />

                      <input
                        className={
                          inputClass
                        }
                        value={
                          line.barcode
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            updateReceiptLine(
                              line.lineKey,
                              {
                                barcode:
                                  event.target.value,
                              },
                            )
                        }
                        placeholder="Barcode / GTIN (optional)"
                      />

                      <select
                        className={
                          inputClass
                        }
                        value={
                          line.quantityMode
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            updateReceiptLine(
                              line.lineKey,
                              {
                                quantityMode:
                                  event.target.value,
                              },
                            )
                        }
                        aria-label={`Receipt line ${index + 1} quantity mode`}
                      >
                        <option value="unknown">
                          Quantity unknown
                        </option>

                        <option value="exact">
                          Exact receipt quantity
                        </option>
                      </select>

                      {line.quantityMode ===
                      'exact' ? (
                        <div className="grid grid-cols-[1fr_110px] gap-2">
                          <input
                            required
                            className={
                              inputClass
                            }
                            type="number"
                            min="0"
                            step="any"
                            value={
                              line.quantityValue
                            }
                            onChange={
                              (
                                event,
                              ) =>
                                updateReceiptLine(
                                  line.lineKey,
                                  {
                                    quantityValue:
                                      event.target.value,
                                  },
                                )
                            }
                            placeholder="Quantity"
                          />

                          <select
                            className={
                              inputClass
                            }
                            value={
                              line.quantityUnit
                            }
                            onChange={
                              (
                                event,
                              ) =>
                                updateReceiptLine(
                                  line.lineKey,
                                  {
                                    quantityUnit:
                                      event.target.value,
                                  },
                                )
                            }
                            aria-label={`Receipt line ${index + 1} unit`}
                          >
                            {[
                              'piece',
                              'g',
                              'kg',
                              'ml',
                              'l',
                              'bunch',
                              'slice',
                            ].map(
                              (
                                unit,
                              ) => (
                                <option
                                  key={
                                    unit
                                  }
                                  value={
                                    unit
                                  }
                                >
                                  {unit}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      ) : (
                        <p className="rounded-xl bg-stone-50 px-3 py-2.5 text-xs font-semibold text-stone-500">
                          No exact Pantry quantity will be invented.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeReceiptLine(
                          line.lineKey,
                        )
                      }
                      disabled={
                        receiptForm.lines.length <=
                        1
                      }
                      className="focus-ring mt-3 inline-flex items-center gap-2 text-xs font-black text-stone-500 disabled:opacity-30"
                    >
                      <Trash2
                        size={14}
                        aria-hidden="true"
                      />

                      Remove line
                    </button>
                  </fieldset>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setReceiptForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    lines: [
                      ...current.lines,
                      newReceiptLine(),
                    ],
                  }),
                )
              }
              className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-black text-stone-700"
            >
              <Plus
                size={16}
                aria-hidden="true"
              />

              Add receipt line
            </button>

            <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
              <input
                required
                type="checkbox"
                className="mt-1"
                checked={
                  receiptForm
                    .explicitImportAcknowledged
                }
                onChange={
                  (
                    event,
                  ) =>
                    setReceiptForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        explicitImportAcknowledged:
                          event.target.checked,
                      }),
                    )
                }
              />

              <span>
                I am intentionally importing this receipt/purchase source
                for my household. I understand each line remains
                reviewable and is not automatically treated as current
                inventory.
              </span>
            </label>

            <button
              type="submit"
              disabled={
                busy
              }
              className={
                buttonClass
              }
            >
              <ReceiptText
                size={16}
                aria-hidden="true"
              />

              Import for review
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <PackageCheck
              className="mt-0.5 shrink-0 text-emerald-700"
              size={22}
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Review imported lines
              </h3>

              <p className="mt-1 text-sm font-medium leading-6 text-stone-600">
                Exact canonical matches are suggestions until you apply
                them. Unresolved lines need an explicit canonical Pack
                selection or can be excluded.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {receipts.length ? (
              receipts.map(
                (
                  receipt,
                ) => (
                  <article
                    key={
                      receipt.receiptImportId
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {receipt.merchantLabel ||
                            titleize(
                              receipt.sourceKind,
                            )}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {receipt.receiptImportId}
                          {' · '}
                          {formatDate(
                            receipt.purchasedAt,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                        {titleize(
                          receipt.status,
                        )}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      {receipt.lines.map(
                        (
                          line,
                        ) => {
                          const manualKey =
                            `${receipt.receiptImportId}:${line.lineKey}`

                          const resolved =
                            Boolean(
                              line.canonicalPackId,
                            )

                          return (
                            <div
                              key={
                                line.lineKey
                              }
                              className="rounded-xl bg-stone-50 p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-black text-stone-900">
                                    {line.label}
                                  </p>

                                  <p className="mt-1 text-xs font-semibold text-stone-500">
                                    {titleize(
                                      line.matchState,
                                    )}
                                    {' · '}
                                    {titleize(
                                      line.matchMethod,
                                    )}
                                    {' · confidence '}
                                    {line.confidenceClass}
                                  </p>
                                </div>

                                {line.pantryApplied ? (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800">
                                    Applied
                                  </span>
                                ) : line.matchState ===
                                  'excluded' ? (
                                  <span className="rounded-full bg-stone-200 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                                    Excluded
                                  </span>
                                ) : null}
                              </div>

                              {!line.pantryApplied &&
                              line.matchState !==
                                'excluded' ? (
                                <div className="mt-3 space-y-2">
                                  {!resolved ? (
                                    <input
                                      className={
                                        inputClass
                                      }
                                      value={
                                        manualPackByLine[
                                          manualKey
                                        ] ||
                                        ''
                                      }
                                      onChange={
                                        (
                                          event,
                                        ) =>
                                          setManualPackByLine(
                                            (
                                              current,
                                            ) => ({
                                              ...current,

                                              [manualKey]:
                                                event.target.value,
                                            }),
                                          )
                                      }
                                      placeholder="Canonical Pack ID for unresolved line"
                                      aria-label={`Canonical Pack ID for ${line.label}`}
                                    />
                                  ) : (
                                    <p className="text-xs font-semibold text-emerald-700">
                                      Canonical Pack match:{' '}
                                      {line.canonicalPackId}
                                    </p>
                                  )}

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        busy ||
                                        (
                                          !resolved &&
                                          !(
                                            manualPackByLine[
                                              manualKey
                                            ] ||
                                            ''
                                          ).trim()
                                        )
                                      }
                                      onClick={() =>
                                        reviewLine({
                                          receiptImportId:
                                            receipt.receiptImportId,

                                          line,

                                          action:
                                            'apply',
                                        })
                                      }
                                      className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                                    >
                                      Confirm & apply to Pantry
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        busy
                                      }
                                      onClick={() =>
                                        reviewLine({
                                          receiptImportId:
                                            receipt.receiptImportId,

                                          line,

                                          action:
                                            'exclude',
                                        })
                                      }
                                      className="focus-ring rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-40"
                                    >
                                      Exclude line
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        },
                      )}
                    </div>

                    {receipt.status ===
                      'needs_review' &&
                    !receipt.lines.some(
                      (
                        line,
                      ) =>
                        line.pantryApplied,
                    ) ? (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          cancelImport(
                            receipt.receiptImportId,
                          )
                        }
                        className="focus-ring mt-3 text-xs font-black text-red-700 disabled:opacity-40"
                      >
                        Cancel this import
                      </button>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                No receipt imports yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <Brain
              className="mt-0.5 shrink-0 text-emerald-700"
              size={22}
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Household Memory & Predictive Depletion
              </h3>

              <p className="mt-1 text-sm font-medium leading-6 text-stone-600">
                Repeated confirmed purchase evidence can create a
                qualitative replenishment prediction. It never becomes
                exact stock or purchase authority.
              </p>
            </div>
          </div>

          {memory?.enabled ===
          false ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
              Household-memory predictions are paused because current
              personalization consent is not granted. Existing facts
              remain visible only so you can control or forget them.{' '}

              <Link
                to="/account/settings"
                className="font-black underline"
              >
                Review account consent
              </Link>
              .
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {(memory?.predictions ||
              []).length ? (
              memory.predictions.map(
                (
                  prediction,
                ) => (
                  <article
                    key={
                      prediction.memoryFactId
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {prediction.label ||
                            'Household staple'}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {titleize(
                            prediction.state,
                          )}
                          {' · '}
                          {prediction.observationCount}
                          {' confirmed observations · '}
                          {prediction.confidenceClass}
                          {' confidence class'}
                        </p>
                      </div>

                      <Clock3
                        size={18}
                        className="text-stone-400"
                        aria-hidden="true"
                      />
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-5 text-stone-600">
                      Predicted replenishment:{' '}
                      {formatDate(
                        prediction.predictedReplenishmentAt,
                      )}
                      . Current Pantry state:{' '}
                      {titleize(
                        prediction.currentPantryState ||
                          'unknown',
                      )}
                      .
                    </p>

                    <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-amber-700">
                      Prediction ≠ inventory truth · no automatic purchase
                    </p>
                  </article>
                ),
              )
            ) : (
              <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                No replenishment prediction has enough reviewed household
                evidence yet.
              </p>
            )}
          </div>

          {(memory?.facts ||
            []).length ? (
            <div className="mt-5 border-t border-stone-200 pt-5">
              <h4 className="text-sm font-black text-stone-950">
                Memory controls
              </h4>

              <div className="mt-3 space-y-2">
                {memory.facts.map(
                  (
                    fact,
                  ) => (
                    <div
                      key={
                        fact.memoryFactId
                      }
                      className="flex flex-col gap-3 rounded-xl bg-stone-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-xs font-black text-stone-800">
                          {fact.details?.label ||
                            titleize(
                              fact.factType,
                            )}
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-stone-500">
                          {titleize(
                            fact.status,
                          )}
                          {' · '}
                          {titleize(
                            fact.sourceType,
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {fact.status ===
                        'active' ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              controlMemory(
                                fact.memoryFactId,
                                'pause',
                              )
                            }
                            className="focus-ring rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-stone-700"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              busy ||
                              memory?.enabled ===
                                false
                            }
                            onClick={() =>
                              controlMemory(
                                fact.memoryFactId,
                                'resume',
                              )
                            }
                            className="focus-ring rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-stone-700 disabled:opacity-40"
                          >
                            Resume
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            controlMemory(
                              fact.memoryFactId,
                              'forget',
                            )
                          }
                          className="focus-ring rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-red-700"
                        >
                          Forget
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <UtensilsCrossed
              className="mt-0.5 shrink-0 text-emerald-700"
              size={22}
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Explicit Leftovers
              </h3>

              <p className="mt-1 text-sm font-medium leading-6 text-stone-600">
                Leftovers exist only when the household says they exist.
                EPANTRY does not infer leftover servings from recipe
                completion.
              </p>
            </div>
          </div>

          <form
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onSubmit={
              submitLeftover
            }
          >
            <input
              required
              className={`${inputClass} sm:col-span-2`}
              value={
                leftoverForm.recipeVersionId
              }
              onChange={
                (
                  event,
                ) =>
                  setLeftoverForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      recipeVersionId:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Published Recipe Version ID"
            />

            <input
              required
              className={
                inputClass
              }
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={
                leftoverForm.leftoverServings
              }
              onChange={
                (
                  event,
                ) =>
                  setLeftoverForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      leftoverServings:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Leftover servings"
            />

            <select
              className={
                inputClass
              }
              value={
                leftoverForm.storageZone
              }
              onChange={
                (
                  event,
                ) =>
                  setLeftoverForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      storageZone:
                        event.target.value,
                    }),
                  )
              }
              aria-label="Leftover storage zone"
            >
              <option value="fridge">
                Fridge
              </option>

              <option value="freezer">
                Freezer
              </option>

              <option value="other">
                Other
              </option>
            </select>

            <label className="text-xs font-black text-stone-600">
              Observed at

              <input
                required
                className={`${inputClass} mt-1`}
                type="datetime-local"
                value={
                  leftoverForm.occurredAt
                }
                onChange={
                  (
                    event,
                  ) =>
                    setLeftoverForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        occurredAt:
                          event.target.value,
                      }),
                    )
                }
              />
            </label>

            <label className="text-xs font-black text-stone-600">
              Use soon by

              <input
                required
                className={`${inputClass} mt-1`}
                type="datetime-local"
                value={
                  leftoverForm.useSoonAt
                }
                onChange={
                  (
                    event,
                  ) =>
                    setLeftoverForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        useSoonAt:
                          event.target.value,
                      }),
                    )
                }
              />
            </label>

            <textarea
              className={`${inputClass} sm:col-span-2`}
              rows={3}
              value={
                leftoverForm.note
              }
              onChange={
                (
                  event,
                ) =>
                  setLeftoverForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      note:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Optional household note"
            />

            <button
              type="submit"
              disabled={
                busy ||
                memory?.enabled ===
                  false
              }
              className={`${buttonClass} sm:col-span-2`}
            >
              <UtensilsCrossed
                size={16}
                aria-hidden="true"
              />

              Record explicit leftover
            </button>
          </form>

          {memory?.enabled ===
          false ? (
            <p className="mt-3 text-xs font-semibold text-amber-700">
              Personalization consent is required before storing
              household-memory leftover facts.
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 shrink-0 text-emerald-700"
            size={22}
            aria-hidden="true"
          />

          <div>
            <h3 className="text-lg font-black text-stone-950">
              Advanced planning composition
            </h3>

            <p className="mt-1 text-sm font-medium leading-6 text-stone-600">
              M21 does not replace M13. It puts explicit leftovers first,
              then existing use-soon/running-low evidence, M13 Next
              Possibility and M13 Next Basket.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-stone-50 p-4">
            <p className="text-2xl font-black text-stone-950">
              {planning
                ?.explicitLeftovers
                ?.length ||
                0}
            </p>

            <p className="mt-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Explicit leftovers
            </p>
          </article>

          <article className="rounded-2xl bg-stone-50 p-4">
            <p className="text-2xl font-black text-stone-950">
              {planning
                ?.existingM13
                ?.wasteReduction
                ?.summary
                ?.totalAtRiskSignals ||
                0}
            </p>

            <p className="mt-1 text-xs font-black uppercase tracking-wide text-stone-500">
              M13 use-soon / risk signals
            </p>
          </article>

          <article className="rounded-2xl bg-stone-50 p-4">
            <p className="text-2xl font-black text-stone-950">
              {planning
                ?.existingM13
                ?.nextPossibility
                ?.summary
                ?.total ||
                0}
            </p>

            <p className="mt-1 text-xs font-black uppercase tracking-wide text-stone-500">
              M13 Next Possibilities
            </p>
          </article>

          <article className="rounded-2xl bg-stone-50 p-4">
            <p className="text-2xl font-black text-stone-950">
              {planning
                ?.existingM13
                ?.nextBasket
                ?.summary
                ?.total ||
                0}
            </p>

            <p className="mt-1 text-xs font-black uppercase tracking-wide text-stone-500">
              M13 Next Basket
            </p>
          </article>
        </div>

        {(planning
          ?.explicitLeftovers ||
          []).length ? (
          <div className="mt-5 space-y-2">
            {planning.explicitLeftovers.map(
              (
                leftover,
              ) => (
                <article
                  key={
                    leftover.memoryFactId
                  }
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <p className="text-sm font-black text-emerald-950">
                    {leftover.details
                      ?.label ||
                      'Leftover meal'}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-emerald-900/80">
                    {leftover.details
                      ?.leftoverServings ||
                      '—'}
                    {' servings · '}
                    {titleize(
                      leftover.details
                        ?.storageZone,
                    )}
                    {' · use soon '}
                    {formatDate(
                      leftover.details
                        ?.useSoonAt,
                    )}
                  </p>
                </article>
              ),
            )}
          </div>
        ) : null}

        <p className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs font-semibold leading-5 text-stone-600">
          {NO_AUTOMATIC_PURCHASE_NOTICE} Pantry quantities are never
          invented, and allergen/dietary truth remains governed by
          existing Food Intelligence.
        </p>
      </section>
    </section>
  )
}