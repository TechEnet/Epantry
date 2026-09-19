import {
  ArrowLeft,
  BadgeCheck,
  FileCheck2,
  History,
  RefreshCw,
  Save,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import AdminShell from '../components/AdminShell'

import {
  useAdmin,
} from '../context/AdminContext'

import useAdminCatalog from '../hooks/useAdminCatalog'

import useAdminCatalogGovernance from '../hooks/useAdminCatalogGovernance'

const QUANTITY_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'dozen',
]

function getVersionId(
  version,
) {
  return (
    version?.id ||
    version?._id ||
    ''
  )
}

export default function AdminProductEditorPage() {
  const {
    versionId,
  } =
    useParams()

  const {
    hasAdminPermission,
  } =
    useAdmin()

  const {
    selectedVersion,
    loading,
    mutating,
    error,
    loadVersion,
    updateDraft,
    submitForReview,
    createNextVersion,
    publishVersion,
    retireVersion,
  } =
    useAdminCatalog()

  const {
    evidenceSources,
    loading:
      governanceLoading,
    loadEvidenceSources,
  } =
    useAdminCatalogGovernance()

  const [
    form,
    setForm,
  ] =
    useState({
      displayName:
        '',

      gtin:
        '',

      quantity:
        '',

      unit:
        'g',

      countryOfOrigin:
        '',

      manufacturerName:
        '',
    })

  const [
    changeReason,
    setChangeReason,
  ] =
    useState(
      '',
    )

  const [
    reasonCode,
    setReasonCode,
  ] =
    useState(
      '',
    )

  const [
    reasonDetails,
    setReasonDetails,
  ] =
    useState(
      '',
    )

  const [
    message,
    setMessage,
  ] =
    useState(
      '',
    )

  useEffect(
    () => {
      if (
        !versionId
      ) {
        return
      }

      loadVersion(
        versionId,
      ).catch(
        () => {},
      )

      loadEvidenceSources({
        entityType:
          'product_version',

        entityId:
          versionId,

        page:
          1,

        limit:
          50,
      }).catch(
        () => {},
      )
    },
    [
      versionId,
      loadVersion,
      loadEvidenceSources,
    ],
  )

  useEffect(
    () => {
      if (
        !selectedVersion
      ) {
        return
      }

      setForm({
        displayName:
          selectedVersion.displayName ||
          '',

        gtin:
          selectedVersion.gtin ||
          '',

        quantity:
          selectedVersion.netQuantity
            ?.value ??
          '',

        unit:
          selectedVersion.netQuantity
            ?.unit ||
          'g',

        countryOfOrigin:
          selectedVersion.countryOfOrigin ||
          '',

        manufacturerName:
          selectedVersion.manufacturerName ||
          '',
      })
    },
    [
      selectedVersion,
    ],
  )

  const canMutate =
    hasAdminPermission(
      'catalog.mutate',
    )

  const canPublish =
    hasAdminPermission(
      'catalog.publish',
    )

  const publicationStatus =
    selectedVersion
      ?.publicationStatus ||
    'draft'

  const isDraft =
    publicationStatus ===
    'draft'

  const isReview =
    publicationStatus ===
    'in_review'

  const isPublished =
    publicationStatus ===
    'published'

  async function handleSave(
    event,
  ) {
    event.preventDefault()

    if (
      !selectedVersion ||
      !isDraft ||
      !canMutate
    ) {
      return
    }

    setMessage(
      '',
    )

    try {
      await updateDraft(
        getVersionId(
          selectedVersion,
        ),
        {
          displayName:
            form.displayName.trim(),

          gtin:
            form.gtin.trim() ||
            null,

          netQuantity: {
            value:
              Number(
                form.quantity,
              ),

            unit:
              form.unit,
          },

          countryOfOrigin:
            form.countryOfOrigin.trim(),

          manufacturerName:
            form.manufacturerName.trim(),
        },
      )

      setMessage(
        'Draft saved.',
      )
    } catch {
      // Hook exposes the request error.
    }
  }

  async function handleSubmitReview() {
    setMessage(
      '',
    )

    try {
      await submitForReview(
        versionId,
      )

      setMessage(
        'Product submitted for review.',
      )
    } catch {
      // Hook exposes error.
    }
  }

  async function handleNextVersion() {
    if (
      !changeReason.trim()
    ) {
      setMessage(
        'Enter a change reason first.',
      )

      return
    }

    try {
      await createNextVersion(
        versionId,
        changeReason,
      )

      setMessage(
        'New draft version created.',
      )
    } catch {
      // Hook exposes error.
    }
  }

  async function handlePublish() {
    if (
      !reasonCode.trim()
    ) {
      setMessage(
        'A controlled audit reason code is required.',
      )

      return
    }

    try {
      await publishVersion(
        versionId,
        {
          reasonCode,

          reasonDetails,
        },
      )

      setMessage(
        'Product Version published.',
      )
    } catch {
      // Hook exposes error.
    }
  }

  async function handleRetire() {
    if (
      !reasonCode.trim()
    ) {
      setMessage(
        'A controlled audit reason code is required.',
      )

      return
    }

    try {
      await retireVersion(
        versionId,
        {
          reasonCode,

          reasonDetails,
        },
      )

      setMessage(
        'Product Version retired.',
      )
    } catch {
      // Hook exposes error.
    }
  }

  return (
    <AdminShell
      title="Product Editor"
      description="Review and maintain versioned canonical product facts."
      actions={
        <Link
          to="/admin/catalog"
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />

          Catalog
        </Link>
      }
    >

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      )}


      {loading ||
      !selectedVersion ? (
        <div className="h-[520px] animate-pulse rounded-[24px] border border-stone-200 bg-white" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">

          {/* ===================================================
              EDITOR
          =================================================== */}

          <div className="space-y-5">

            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

              <div className="flex flex-wrap items-start justify-between gap-3">

                <div>

                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Product Version
                  </p>

                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    {
                      selectedVersion.displayName
                    }
                  </h2>

                </div>


                <span className="rounded-full bg-stone-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                  {
                    publicationStatus
                  }
                </span>

              </div>


              <form
                onSubmit={
                  handleSave
                }
                className="mt-6 grid gap-4 sm:grid-cols-2"
              >

                <label className="sm:col-span-2">

                  <span className="text-xs font-black text-stone-600">
                    Display name
                  </span>

                  <input
                    value={
                      form.displayName
                    }
                    disabled={
                      !isDraft ||
                      !canMutate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          displayName:
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none disabled:opacity-60"
                  />

                </label>


                <label>

                  <span className="text-xs font-black text-stone-600">
                    GTIN
                  </span>

                  <input
                    value={
                      form.gtin
                    }
                    disabled={
                      !isDraft ||
                      !canMutate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          gtin:
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none disabled:opacity-60"
                  />

                </label>


                <div className="grid grid-cols-[1fr_100px] gap-2">

                  <label>

                    <span className="text-xs font-black text-stone-600">
                      Quantity
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={
                        form.quantity
                      }
                      disabled={
                        !isDraft ||
                        !canMutate
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            quantity:
                              event.target
                                .value,
                          }),
                        )
                      }
                      className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none disabled:opacity-60"
                    />

                  </label>


                  <label>

                    <span className="text-xs font-black text-stone-600">
                      Unit
                    </span>

                    <select
                      value={
                        form.unit
                      }
                      disabled={
                        !isDraft ||
                        !canMutate
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            unit:
                              event.target
                                .value,
                          }),
                        )
                      }
                      className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-2 text-sm font-bold outline-none disabled:opacity-60"
                    >
                      {QUANTITY_UNITS.map(
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

                  </label>

                </div>


                <label>

                  <span className="text-xs font-black text-stone-600">
                    Country of origin
                  </span>

                  <input
                    value={
                      form.countryOfOrigin
                    }
                    disabled={
                      !isDraft ||
                      !canMutate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          countryOfOrigin:
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none disabled:opacity-60"
                  />

                </label>


                <label>

                  <span className="text-xs font-black text-stone-600">
                    Manufacturer
                  </span>

                  <input
                    value={
                      form.manufacturerName
                    }
                    disabled={
                      !isDraft ||
                      !canMutate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          manufacturerName:
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none disabled:opacity-60"
                  />

                </label>


                {isDraft &&
                  canMutate && (
                  <div className="sm:col-span-2">

                    <button
                      type="submit"
                      disabled={
                        mutating
                      }
                      className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                    >
                      <Save
                        size={15}
                        aria-hidden="true"
                      />

                      Save draft
                    </button>

                  </div>
                )}

              </form>

            </section>


            {/* =================================================
                LIFECYCLE
            ================================================= */}

            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

              <h2 className="font-black text-stone-950">
                Version lifecycle
              </h2>

              <p className="mt-1 text-sm text-stone-500">
                Review and publication remain permission controlled by the backend.
              </p>


              {isDraft &&
                canMutate && (
                <button
                  type="button"
                  onClick={
                    handleSubmitReview
                  }
                  disabled={
                    mutating
                  }
                  className="focus-ring mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white"
                >
                  <FileCheck2
                    size={16}
                    aria-hidden="true"
                  />

                  Submit for review
                </button>
              )}


              {isReview &&
                canPublish && (
                <div className="mt-5 space-y-3">

                  <input
                    value={
                      reasonCode
                    }
                    onChange={(
                      event,
                    ) =>
                      setReasonCode(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Controlled audit reason code"
                    className="focus-ring h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none"
                  />

                  <textarea
                    value={
                      reasonDetails
                    }
                    onChange={(
                      event,
                    ) =>
                      setReasonDetails(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Reason details"
                    rows={3}
                    className="focus-ring w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm font-semibold outline-none"
                  />

                  <button
                    type="button"
                    onClick={
                      handlePublish
                    }
                    disabled={
                      mutating
                    }
                    className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white"
                  >
                    <BadgeCheck
                      size={16}
                      aria-hidden="true"
                    />

                    Publish version
                  </button>

                </div>
              )}


              {isPublished &&
                canPublish && (
                <div className="mt-5 space-y-3">

                  <input
                    value={
                      reasonCode
                    }
                    onChange={(
                      event,
                    ) =>
                      setReasonCode(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Controlled audit reason code"
                    className="focus-ring h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none"
                  />

                  <textarea
                    value={
                      reasonDetails
                    }
                    onChange={(
                      event,
                    ) =>
                      setReasonDetails(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Retirement reason details"
                    rows={3}
                    className="focus-ring w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm font-semibold outline-none"
                  />

                  <button
                    type="button"
                    onClick={
                      handleRetire
                    }
                    disabled={
                      mutating
                    }
                    className="focus-ring rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700"
                  >
                    Retire published version
                  </button>

                </div>
              )}


              {!isDraft &&
                canMutate && (
                <div className="mt-6 border-t border-stone-100 pt-5">

                  <label>

                    <span className="text-xs font-black text-stone-600">
                      New version change reason
                    </span>

                    <textarea
                      value={
                        changeReason
                      }
                      onChange={(
                        event,
                      ) =>
                        setChangeReason(
                          event.target
                            .value,
                        )
                      }
                      rows={3}
                      className="focus-ring mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm font-semibold outline-none"
                    />

                  </label>

                  <button
                    type="button"
                    onClick={
                      handleNextVersion
                    }
                    disabled={
                      mutating
                    }
                    className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700"
                  >
                    <History
                      size={16}
                      aria-hidden="true"
                    />

                    Create next version
                  </button>

                </div>
              )}

            </section>

          </div>


          {/* ===================================================
              SIDEBAR
          =================================================== */}

          <aside className="space-y-5">

            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">

              <h2 className="font-black text-stone-950">
                Canonical identity
              </h2>

              <dl className="mt-4 space-y-3 text-sm">

                <div>

                  <dt className="text-xs font-bold text-stone-400">
                    Version
                  </dt>

                  <dd className="mt-1 font-black text-stone-800">
                    {
                      selectedVersion.version ||
                      1
                    }
                  </dd>

                </div>

                <div>

                  <dt className="text-xs font-bold text-stone-400">
                    Variant ID
                  </dt>

                  <dd className="mt-1 break-all text-xs font-bold text-stone-700">
                    {
                      selectedVersion.variantId ||
                      '—'
                    }
                  </dd>

                </div>

                <div>

                  <dt className="text-xs font-bold text-stone-400">
                    Pack ID
                  </dt>

                  <dd className="mt-1 break-all text-xs font-bold text-stone-700">
                    {
                      selectedVersion.packId ||
                      '—'
                    }
                  </dd>

                </div>

              </dl>

            </section>


            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between gap-3">

                <h2 className="font-black text-stone-950">
                  Evidence
                </h2>

                {governanceLoading && (
                  <RefreshCw
                    size={15}
                    className="animate-spin text-stone-400"
                    aria-hidden="true"
                  />
                )}

              </div>


              <p className="mt-1 text-xs leading-5 text-stone-500">
                Evidence metadata attached to this Product Version.
              </p>


              <div className="mt-4 space-y-3">

                {evidenceSources.length >
                0 ? (
                  evidenceSources.map(
                    (
                      evidence,
                      index,
                    ) => (
                      <div
                        key={
                          evidence.id ||
                          evidence._id ||
                          index
                        }
                        className="rounded-xl bg-stone-50 p-3"
                      >

                        <p className="text-xs font-black text-stone-800">
                          {
                            evidence.sourceName ||
                            evidence.sourceType ||
                            'Evidence source'
                          }
                        </p>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                          {
                            evidence.evidenceState ||
                            'source attached'
                          }
                        </p>

                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-stone-500">
                    No evidence metadata returned.
                  </p>
                )}

              </div>

            </section>

          </aside>

        </div>
      )}

    </AdminShell>
  )
}