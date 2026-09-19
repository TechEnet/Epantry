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
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const buttonClass =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40'

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
      'Create governed supplier Purchase Order drafts from the reviewed M18 Procurement Plan.',
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
            getExecutionScaleErrorMessage(
              requestError,

              'Unable to load M22 execution-scale workspace.',
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
    <section className="mt-7 space-y-6">
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              M22 · Production Ecosystem + Execution Scale
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-950">
              Partner execution, procurement & finance evidence
            </h2>

            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-stone-600">
              M22 executes through existing authorities instead of replacing them: M05 owns Marketplace observations, M11 owns external commerce handoff, M16 owns settlement truth, M18 owns Procurement Plan truth, and M20 owns timeout/circuit reliability.
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
          ) : loading ? (
            <p className="text-stone-500">
              Loading execution evidence…
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <PlugZap
              size={22}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Part 1 · Partner Integration Hub
              </h3>

              <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">
                Store server-side connection metadata and environment secret references only. Every connection remains pending until M03 Admin review activates it.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                Retailer sync
              </option>

              <option value="supplier">
                Supplier
              </option>

              <option value="payout_provider">
                Payout provider
              </option>
            </select>

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
          </div>

          <div className="mt-3 flex flex-wrap gap-3 rounded-2xl bg-stone-50 p-4 text-xs font-bold text-stone-600">
            {[
              [
                'allowCatalogSync',
                'Catalog sync',
              ],
              [
                'allowInventorySync',
                'Inventory sync',
              ],
              [
                'allowSupplierPo',
                'Supplier PO',
              ],
              [
                'allowPayout',
                'Payout',
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
            className={`${buttonClass} mt-4`}
          >
            <ShieldCheck
              size={16}
              aria-hidden="true"
            />

            Propose connection
          </button>

          <div className="mt-5 space-y-3">
            {(data?.partnerConnections || []).map(
              (
                connection,
              ) => (
                <article
                  key={
                    connection.id
                  }
                  className="rounded-2xl border border-stone-200 p-4"
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

          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-950">
            M11 retailer checkout handoff remains server-owned through COMMERCE_EXTERNAL_PARTNERS_JSON. M22 does not create a second Customer redirect registry.
          </p>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <Truck
              size={22}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-lg font-black text-stone-950">
                Part 2 · Procurement Execution
              </h3>

              <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">
                Convert existing M18 supplier selections into explicit Purchase Order drafts. M22 does not recalculate shortages or silently select another supplier.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
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
              placeholder="M18 Procurement Plan ID"
            />

            <textarea
              rows={3}
              className={
                inputClass
              }
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
              className={
                buttonClass
              }
            >
              <Boxes
                size={16}
                aria-hidden="true"
              />

              Create PO drafts
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {(data?.purchaseOrders || []).length ? (
              data.purchaseOrders.map(
                (
                  order,
                ) => (
                  <article
                    key={
                      order.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
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
              <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                No M22 Purchase Orders yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <WalletCards
            size={22}
            className="mt-0.5 text-emerald-700"
            aria-hidden="true"
          />

          <div>
            <h3 className="text-lg font-black text-stone-950">
              Part 3 · Finance Execution & Reconciliation
            </h3>

            <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">
              Payout-provider execution is M03 finance.mutate only. Host can observe execution status here, but cannot create settlement, execute payout, reconcile payout or mark settlement paid through Host authority.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.payoutExecutions || []).length ? (
            data.payoutExecutions.map(
              (
                payout,
              ) => (
                <article
                  key={
                    payout.id
                  }
                  className="rounded-2xl border border-stone-200 p-4"
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
            <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
              No payout execution evidence yet.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <CircleAlert
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <p className="text-xs font-semibold leading-5">
            Provider confirmation is not settlement truth. After payout reconciliation, the existing M16 Admin Host Operations finance workflow must still perform the governed settlement paid transition. No duplicate CommerceLedgerEntry is created by M22.
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-stone-950 p-5 text-white sm:p-7">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={22}
            className="mt-0.5 text-emerald-400"
            aria-hidden="true"
          />

          <div>
            <h3 className="text-lg font-black">
              M22 trust boundary
            </h3>

            <p className="mt-2 text-sm font-semibold leading-6 text-stone-300">
              Partner prediction or provider response is never canonical Product, price, serviceability, inventory, Procurement Plan, ledger or paid-settlement truth. Economic writes use explicit idempotency keys, signed webhooks are evidence-only, and ambiguous external state must reconcile before retry.
            </p>
          </div>
        </div>
      </section>
    </section>
  )
}