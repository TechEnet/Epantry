import {
  Boxes,
  CircleAlert,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  Truck,
  WalletCards,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createPartnerConnection,
  createPurchaseOrders,
  getExecutionScaleErrorMessage,
  getHostExecutionScale,
  runPartnerSync,
  submitPurchaseOrder,
  transitionPurchaseOrder,
} from '../services/executionScale.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 outline-none sm:px-3.5 sm:py-2.5 sm:text-sm'

const buttonClass =
  'focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm'

function titleize(
  value,
) {
  return String(
    value ||
    '',
  )
    .split('_')
    .filter(
      Boolean,
    )
    .map(
      (
        part,
      ) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function executionScaleDisplayError(message) {
  const value = String(message || '')

  if (/M22|execution[- ]scale/i.test(value) && /not enabled|disabled|unavailable/i.test(value)) {
    return 'Partner execution tools are not available in this environment yet.'
  }

  return value
}

function money(
  amountMinor,
  currency = 'INR',
) {
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
      amountMinor ||
      0,
    ) /
      100,
  )
}

function partnerDefaults() {
  return {
    partnerKey:
      '',

    displayName:
      '',

    partnerType:
      'retailer_sync',

    baseUrl:
      '',

    credentialEnvKey:
      '',

    webhookSecretEnvKey:
      '',

    catalogSyncPath:
      '',

    inventorySyncPath:
      '',

    supplierPurchaseOrderPath:
      '',

    payoutExecutionPath:
      '',

    allowCatalogSync:
      true,

    allowInventorySync:
      false,

    allowSupplierPo:
      false,

    allowPayout:
      false,

    allowWebhook:
      true,
  }
}

export default function ExecutionScalePanel() {
  const [
    data,
    setData,
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

  const [
    partnerForm,
    setPartnerForm,
  ] =
    useState(
      partnerDefaults(),
    )

  const [
    procurementPlanId,
    setProcurementPlanId,
  ] =
    useState(
      '',
    )

  const [
    procurementReason,
    setProcurementReason,
  ] =
    useState(
      'Create purchase-order drafts from the reviewed supplier plan.',
    )

  const [
    reasonByOrder,
    setReasonByOrder,
  ] =
    useState({})

  const [
    supplierConnectionByOrder,
    setSupplierConnectionByOrder,
  ] =
    useState({})

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
          setData(
            await getHostExecutionScale(),
          )
        } catch (
          requestError
        ) {
          setError(
            executionScaleDisplayError(
              getExecutionScaleErrorMessage(
                requestError,

                'Unable to load partner execution workspace.',
              ),
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

  const supplierConnections =
    useMemo(
      () =>
        (
          data
            ?.partnerConnections ||
          []
        ).filter(
          (
            item,
          ) =>
            item.partnerType ===
              'supplier' &&
            item.status ===
              'active' &&
            item.allowedOperations
              ?.includes(
                'supplier_po_submit',
              ),
        ),
      [
        data,
      ],
    )

  async function run(
    task,
    message,
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
      await task()

      setNotice(
        message,
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getExecutionScaleErrorMessage(
          requestError,
        ),
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function createPartner() {
    const allowedOperations =
      []

    if (
      partnerForm
        .allowCatalogSync
    ) {
      allowedOperations.push(
        'catalog_sync',
      )
    }

    if (
      partnerForm
        .allowInventorySync
    ) {
      allowedOperations.push(
        'inventory_sync',
      )
    }

    if (
      partnerForm
        .allowSupplierPo
    ) {
      allowedOperations.push(
        'supplier_po_submit',
      )
    }

    if (
      partnerForm
        .allowPayout
    ) {
      allowedOperations.push(
        'payout_execute',
      )
    }

    if (
      partnerForm
        .allowWebhook
    ) {
      allowedOperations.push(
        'webhook_receive',
      )
    }

    await run(
      async () => {
        await createPartnerConnection({
          partnerKey:
            partnerForm
              .partnerKey,

          displayName:
            partnerForm
              .displayName,

          partnerType:
            partnerForm
              .partnerType,

          baseUrl:
            partnerForm
              .baseUrl,

          credentialEnvKey:
            partnerForm
              .credentialEnvKey,

          webhookSecretEnvKey:
            partnerForm
              .webhookSecretEnvKey,

          allowedOperations,

          operationPaths: {
            catalogSync:
              partnerForm
                .catalogSyncPath,

            inventorySync:
              partnerForm
                .inventorySyncPath,

            supplierPurchaseOrder:
              partnerForm
                .supplierPurchaseOrderPath,

            payoutExecution:
              partnerForm
                .payoutExecutionPath,
          },
        })

        setPartnerForm(
          partnerDefaults(),
        )
      },

      'Partner connection proposed. Admin activation is required before external execution.',
    )
  }

  async function createOrders() {
    await run(
      async () => {
        await createPurchaseOrders({
          procurementPlanId,

          reason:
            procurementReason,
        })

        setProcurementPlanId(
          '',
        )
      },

      'Purchase Order drafts created from existing M18 supplier selections. No supplier submission occurred automatically.',
    )
  }

  async function orderTransition(
    order,
    action,
  ) {
    const reason =
      reasonByOrder[
        order.id
      ] ||
      `M22 ${titleize(action)} transition recorded by Host.`

    await run(
      () =>
        transitionPurchaseOrder({
          purchaseOrderId:
            order.id,

          action,
          reason,

          observedTotalMinor:
            action ===
            'receive'
              ? order
                  .expectedTotalMinor
              : null,

          evidenceRefs:
            action ===
            'receive'
              ? [
                  `host-receiving:${order.poNumber}`,
                ]
              : [],
        }),

      `Purchase Order ${titleize(action)} recorded.`,
    )
  }

  async function submitOrder(
    order,
  ) {
    const connectionId =
      supplierConnectionByOrder[
        order.id
      ] ||
      ''

    if (!connectionId) {
      setError(
        'Choose an active supplier connection before submission.',
      )

      return
    }

    await run(
      () =>
        submitPurchaseOrder({
          purchaseOrderId:
            order.id,

          partnerConnectionId:
            connectionId,
        }),

      'Approved Purchase Order submitted once through the selected supplier adapter.',
    )
  }

  return (
    <section className="mt-4 space-y-3 sm:mt-7 sm:space-y-6">
      <div className="rounded-[20px] border border-emerald-300 bg-emerald-100/70 p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-7">
        <div className="flex items-start justify-between gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              PARTNER OPERATIONS
            </p>

            <h2 className="mt-1 text-[14px] font-black leading-[17px] tracking-tight text-stone-950 sm:mt-2 sm:text-2xl sm:leading-normal">
              <span className="sm:hidden">Partner operations & finance</span>
              <span className="hidden sm:inline">Partner connections, purchase orders & finance tracking</span>
            </h2>

            <p className="mt-1 max-w-4xl text-[10px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
              <span className="sm:hidden">Connect partners, prepare purchase orders and track payouts without changing core marketplace records.</span>
              <span className="hidden sm:inline">Connect approved partners, prepare purchase orders from reviewed plans, and monitor payout progress without changing your core marketplace or settlement records.</span>
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
            className="focus-ring ml-auto inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-violet-200 bg-violet-100 px-3 py-2 text-xs font-black text-violet-800 disabled:opacity-40 sm:ml-0 sm:gap-2 sm:border-emerald-200 sm:bg-white sm:px-4 sm:py-2.5 sm:text-sm sm:text-emerald-800"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            <span className="sm:hidden">Refresh</span>
            <span className="hidden sm:inline">Refresh data</span>
          </button>
        </div>

        <div
          className="mt-2 min-h-0 text-xs font-bold sm:mt-4 sm:min-h-6 sm:text-sm"
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
              Loading execution evidence…
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-6 xl:grid-cols-2">
        <section className="rounded-[20px] border border-sky-300 bg-sky-100/70 p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-7">
          <div className="flex items-start gap-2 sm:gap-3">
            <PlugZap
              className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 sm:h-[22px] sm:w-[22px]"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <h3 className="whitespace-nowrap text-[15px] font-black leading-4 text-stone-950 sm:whitespace-normal sm:text-lg sm:leading-normal">
                Partner connections
              </h3>

              <p className="mt-0.5 text-[10px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-sm sm:leading-6">
                <span className="sm:hidden">Add partner details and secure references. New connections wait for admin approval.</span>
                <span className="hidden sm:inline">Add partner connection details and secure environment references. New connections stay pending until an admin approves them.</span>
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Partner key</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.partnerKey
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        partnerKey:
                          event.target.value,
                      }),
                    )
                }
                placeholder="partner key"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Display name</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.displayName
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        displayName:
                          event.target.value,
                      }),
                    )
                }
                placeholder="Display name"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Partner type</span>
              <select
                className={
                  inputClass
                }
                value={
                  partnerForm.partnerType
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        partnerType:
                          event.target.value,

                        allowCatalogSync:
                          event.target.value ===
                          'retailer_sync',

                        allowInventorySync:
                          event.target.value ===
                          'retailer_sync',

                        allowSupplierPo:
                          event.target.value ===
                          'supplier',

                        allowPayout:
                          event.target.value ===
                          'payout_provider',
                      }),
                    )
                }
              >
                <option value="retailer_sync">
                  Retailer integration
                </option>

                <option value="supplier">
                  Supplier connection
                </option>

                <option value="payout_provider">
                  Payout provider
                </option>
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Partner URL</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.baseUrl
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        baseUrl:
                          event.target.value,
                      }),
                    )
                }
                placeholder="https://partner.example.com"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Credential key</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.credentialEnvKey
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        credentialEnvKey:
                          event.target.value.toUpperCase(),
                      }),
                    )
                }
                placeholder="Credential ENV key — not secret"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Webhook key</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.webhookSecretEnvKey
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        webhookSecretEnvKey:
                          event.target.value.toUpperCase(),
                      }),
                    )
                }
                placeholder="Webhook secret ENV key"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Catalog path</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.catalogSyncPath
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        catalogSyncPath:
                          event.target.value,
                      }),
                    )
                }
                placeholder="/v1/catalog"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Inventory path</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.inventorySyncPath
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        inventorySyncPath:
                          event.target.value,
                      }),
                    )
                }
                placeholder="/v1/inventory"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">PO path</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.supplierPurchaseOrderPath
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        supplierPurchaseOrderPath:
                          event.target.value,
                      }),
                    )
                }
                placeholder="/v1/purchase-orders"
              />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Payout path</span>
              <input
                className={
                  inputClass
                }
                value={
                  partnerForm.payoutExecutionPath
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPartnerForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        payoutExecutionPath:
                          event.target.value,
                      }),
                    )
                }
                placeholder="/v1/payouts"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-white/65 p-2.5 text-[10px] font-bold text-stone-600 sm:mt-3 sm:gap-3 sm:rounded-2xl sm:bg-stone-50 sm:p-4 sm:text-xs">
            {[
              [
                'allowCatalogSync',
                'Sync catalog',
              ],
              [
                'allowInventorySync',
                'Sync inventory',
              ],
              [
                'allowSupplierPo',
                'Send purchase orders',
              ],
              [
                'allowPayout',
                'Payout access',
              ],
              [
                'allowWebhook',
                'Signed webhook',
              ],
            ].map(
              ([
                key,
                label,
              ]) => (
                <label
                  key={
                    key
                  }
                  className="flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={
                      partnerForm[key]
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setPartnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            [key]:
                              event.target.checked,
                          }),
                        )
                    }
                  />

                  {label}
                </label>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={
              createPartner
            }
            disabled={
              busy ||
              !partnerForm.partnerKey.trim() ||
              !partnerForm.displayName.trim() ||
              !partnerForm.baseUrl.trim()
            }
            className={`${buttonClass} mt-3 sm:mt-4`}
          >
            <ShieldCheck
              size={16}
              aria-hidden="true"
            />

            Request connection
          </button>

          <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
            {(data?.partnerConnections || []).map(
              (
                connection,
              ) => (
                <article
                  key={
                    connection.id
                  }
                  className="rounded-xl border border-white/90 bg-white/78 p-3 sm:rounded-2xl sm:p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-stone-900">
                        {connection.displayName}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {connection.partnerKey}
                        {' · '}
                        {titleize(
                          connection.partnerType,
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                      {titleize(
                        connection.status,
                      )}
                    </span>
                  </div>

                  {connection.status ===
                    'active' &&
                  connection.partnerType ===
                    'retailer_sync' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {connection.allowedOperations?.includes(
                        'catalog_sync',
                      ) ? (
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            run(
                              () =>
                                runPartnerSync({
                                  partnerConnectionId:
                                    connection.id,

                                  operation:
                                    'catalog_sync',
                                }),

                              'Catalog sync delegated to the existing M16 catalog-ingest boundary.',
                            )
                          }
                          className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                        >
                          Sync catalog
                        </button>
                      ) : null}

                      {connection.allowedOperations?.includes(
                        'inventory_sync',
                      ) ? (
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            run(
                              () =>
                                runPartnerSync({
                                  partnerConnectionId:
                                    connection.id,

                                  operation:
                                    'inventory_sync',
                                }),

                              'Inventory observations delegated to the existing M05 append-only snapshot boundary.',
                            )
                          }
                          className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                        >
                          Sync inventory
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>

          <p className="mt-3 rounded-xl border border-indigo-300 bg-indigo-100/75 p-2.5 text-[10px] font-semibold leading-4 text-indigo-900 sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-xs sm:leading-5">
            <span className="sm:hidden">Retailer checkout stays in EPANTRY's existing flow; no second customer route is created.</span>
            <span className="hidden sm:inline">Retailer checkout links continue through EPANTRY's existing checkout system. This connection does not create a second customer checkout route.</span>
          </p>
        </section>

        <section className="rounded-[20px] border border-indigo-300 bg-indigo-100/65 p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-7">
          <div className="flex items-start gap-2 sm:gap-3">
            <Truck
              className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700 sm:h-[22px] sm:w-[22px]"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <h3 className="whitespace-nowrap text-[15px] font-black leading-4 text-stone-950 sm:whitespace-normal sm:text-lg sm:leading-normal">
                Purchase-order preparation
              </h3>

              <p className="mt-0.5 text-[10px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-sm sm:leading-6">
                <span className="sm:hidden">Create purchase-order drafts from the reviewed supplier plan. EPANTRY keeps the selected supplier.</span>
                <span className="hidden sm:inline">Turn the reviewed supplier plan into purchase-order drafts. EPANTRY keeps the selected supplier and does not switch suppliers automatically.</span>
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:block sm:space-y-3">
            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Plan ID</span>
              <input
              className={
                inputClass
              }
              value={
                procurementPlanId
              }
              onChange={
                (
                  event,
                ) =>
                  setProcurementPlanId(
                    event.target.value,
                  )
              }
              placeholder="Procurement plan ID"
            />
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:hidden">Purchase reason</span>
              <textarea
                rows={3}
                className={`${inputClass} h-[38px] resize-none sm:h-auto`}
                value={
                  procurementReason
                }
                onChange={
                  (
                    event,
                  ) =>
                    setProcurementReason(
                      event.target.value,
                    )
                }
              />
            </label>

            <button
              type="button"
              onClick={
                createOrders
              }
              disabled={
                busy ||
                !procurementPlanId.trim() ||
                procurementReason.trim().length <
                  10
              }
              className={`${buttonClass} col-span-2 w-full sm:w-auto`}
            >
              <Boxes
                size={16}
                aria-hidden="true"
              />

              Create purchase-order drafts
            </button>
          </div>

          <div className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-4">
            {(data?.purchaseOrders || []).length ? (
              data.purchaseOrders.map(
                (
                  order,
                ) => (
                  <article
                    key={
                      order.id
                    }
                    className="rounded-xl border border-white/90 bg-white/78 p-3 sm:rounded-2xl sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {order.poNumber}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          Supplier {order.supplierId}
                          {' · '}
                          {order.lines?.length || 0} lines
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                          {titleize(
                            order.status,
                          )}
                        </span>

                        <p className="mt-2 text-sm font-black text-stone-900">
                          {money(
                            order.expectedTotalMinor,
                            order.currency,
                          )}
                        </p>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      className={`${inputClass} mt-3`}
                      value={
                        reasonByOrder[order.id] ||
                        ''
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setReasonByOrder(
                            (
                              current,
                            ) => ({
                              ...current,

                              [order.id]:
                                event.target.value,
                            }),
                          )
                      }
                      placeholder="Lifecycle reason / receiving note"
                    />

                    {order.status ===
                    'draft' ? (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          orderTransition(
                            order,
                            'approve',
                          )
                        }
                        className={`${buttonClass} mt-3`}
                      >
                        <ShieldCheck
                          size={15}
                          aria-hidden="true"
                        />

                        Approve as checker
                      </button>
                    ) : null}

                    {order.status ===
                    'approved' ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <select
                          className={
                            inputClass
                          }
                          value={
                            supplierConnectionByOrder[
                              order.id
                            ] ||
                            ''
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              setSupplierConnectionByOrder(
                                (
                                  current,
                                ) => ({
                                  ...current,

                                  [order.id]:
                                    event.target.value,
                                }),
                              )
                          }
                        >
                          <option value="">
                            Select active supplier connection
                          </option>

                          {supplierConnections.map(
                            (
                              connection,
                            ) => (
                              <option
                                key={
                                  connection.id
                                }
                                value={
                                  connection.id
                                }
                              >
                                {connection.displayName}
                              </option>
                            ),
                          )}
                        </select>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            submitOrder(
                              order,
                            )
                          }
                          className={
                            buttonClass
                          }
                        >
                          <Send
                            size={15}
                            aria-hidden="true"
                          />

                          Submit once
                        </button>
                      </div>
                    ) : null}

                    {[
                      'submitted',
                      'acknowledged',
                      'partially_received',
                    ].includes(
                      order.status,
                    ) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.status ===
                        'submitted' ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              orderTransition(
                                order,
                                'acknowledge',
                              )
                            }
                            className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                          >
                            Record acknowledgement
                          </button>
                        ) : null}

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            orderTransition(
                              order,
                              'partially_receive',
                            )
                          }
                          className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                        >
                          Partial receive
                        </button>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            orderTransition(
                              order,
                              'receive',
                            )
                          }
                          className="focus-ring rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                        >
                          Receive & reconcile
                        </button>
                      </div>
                    ) : null}

                    {order.status ===
                    'received' ? (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          orderTransition(
                            order,
                            'close',
                          )
                        }
                        className="focus-ring mt-3 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                      >
                        Close PO
                      </button>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl border border-white/90 bg-white/74 p-2.5 text-[10px] font-semibold leading-4 text-stone-500 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                No purchase orders created yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[20px] border border-cyan-300 bg-cyan-100/65 p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-7">
        <div className="flex items-start gap-2 sm:gap-3">
          <WalletCards
            className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 sm:h-[22px] sm:w-[22px]"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <h3 className="whitespace-nowrap text-[15px] font-black leading-4 text-stone-950 sm:whitespace-normal sm:text-lg sm:leading-normal">
              Finance & payout tracking
            </h3>

            <p className="mt-0.5 text-[10px] font-semibold leading-4 text-stone-500 sm:mt-1 sm:text-sm sm:leading-6">
              <span className="sm:hidden">Track payout progress here. Final settlement stays controlled by EPANTRY finance.</span>
              <span className="hidden sm:inline">Track payout progress here. Final settlement and paid-status changes stay controlled by EPANTRY's finance workflow.</span>
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 sm:mt-5 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.payoutExecutions || []).length ? (
            data.payoutExecutions.map(
              (
                payout,
              ) => (
                <article
                  key={
                    payout.id
                  }
                  className="rounded-xl border border-white/90 bg-white/78 p-3 sm:rounded-2xl sm:p-4"
                >
                  <p className="text-sm font-black text-stone-950">
                    {money(
                      payout.amountMinor,
                      payout.currency,
                    )}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    Settlement {payout.settlementId}
                  </p>

                  <span className="mt-3 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                    {titleize(
                      payout.status,
                    )}
                  </span>

                  {payout.providerReference ? (
                    <p className="mt-2 break-all text-[11px] font-semibold text-stone-500">
                      Provider ref: {payout.providerReference}
                    </p>
                  ) : null}
                </article>
              ),
            )
          ) : (
            <p className="rounded-xl border border-white/90 bg-white/74 p-2.5 text-[10px] font-semibold leading-4 text-stone-500 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
              No payout activity recorded yet.
            </p>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-100/75 p-2.5 text-rose-900 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4">
          <CircleAlert
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <p className="text-[10px] font-semibold leading-4 sm:text-xs sm:leading-5">
            <span className="sm:hidden">Provider confirmation shows payout progress only. Final paid status follows EPANTRY finance reconciliation.</span>
            <span className="hidden sm:inline">A provider confirmation shows payout progress, not final settlement. Final paid status is confirmed only after EPANTRY finance reconciliation.</span>
          </p>
        </div>
      </section>

      <section className="rounded-[20px] border border-slate-300 bg-slate-100/85 p-3.5 text-stone-900 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-7">
        <div className="flex items-start gap-2 sm:gap-3">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 sm:h-[22px] sm:w-[22px]"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <h3 className="whitespace-nowrap text-[15px] font-black leading-4 sm:whitespace-normal sm:text-lg sm:leading-normal">
              How partner data is treated
            </h3>

            <p className="mt-0.5 text-[10px] font-semibold leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
              <span className="sm:hidden">Partner updates support decisions but do not replace final product, price, stock, delivery, order or settlement records.</span>
              <span className="hidden sm:inline">Partner responses are treated as supporting evidence, not final product, price, stock, delivery, purchase-order, ledger or settlement records. EPANTRY reconciles uncertain external updates before retrying.</span>
            </p>
          </div>
        </div>
      </section>
    </section>
  )
}