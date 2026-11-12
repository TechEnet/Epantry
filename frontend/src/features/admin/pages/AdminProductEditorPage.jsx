import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  History,
  Package,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { useAdmin } from '../context/AdminContext'
import useAdminCatalog from '../hooks/useAdminCatalog'
import useAdminCatalogGovernance from '../hooks/useAdminCatalogGovernance'

const QUANTITY_UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'dozen']

const FIELD_CLASS =
  'focus-ring mt-2 h-12 w-full min-w-0 rounded-xl border border-[#DCDDD6] bg-white px-3.5 text-[15px] font-medium text-[#202421] outline-none transition-colors placeholder:text-[#879189] focus:border-[#173F35] disabled:cursor-not-allowed disabled:bg-[#F0F0EC] disabled:text-[#66736B]'
const TEXTAREA_CLASS =
  'focus-ring mt-2 w-full min-w-0 rounded-xl border border-[#DCDDD6] bg-white p-3.5 text-[15px] leading-relaxed text-[#202421] outline-none transition-colors placeholder:text-[#879189] focus:border-[#173F35] disabled:bg-[#F0F0EC]'
const PRIMARY_CLASS =
  'focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#235445] disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY_CLASS =
  'focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CCD4CC] bg-white px-5 py-3 text-[15px] font-semibold text-[#173F35] transition-colors hover:bg-[#F0F3EE] disabled:cursor-not-allowed disabled:opacity-50'

function getVersionId(version) {
  return String(version?.id || version?._id || '')
}

function displayStatus(status) {
  const labels = {
    draft: 'Draft',
    in_review: 'In review',
    published: 'Published',
    retired: 'Retired',
  }
  return labels[status] || String(status || 'Unknown').replaceAll('_', ' ')
}

function InfoField({ label, value }) {
  return (
    <div className="min-w-0 border-b border-[#E7E5DE] py-3 last:border-b-0">
      <dt className="text-[13px] font-medium text-[#66736B]">{label}</dt>
      <dd className="mt-1 break-words text-[15px] font-semibold text-[#173F35]">{value || 'Not provided'}</dd>
    </div>
  )
}

function EditorField({ label, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[14px] font-semibold text-[#344A40]">{label}</span>
      {children}
    </label>
  )
}

export default function AdminProductEditorPage() {
  const { versionId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const openedFromEdit = searchParams.get('edit') === '1'
  const { hasAdminPermission } = useAdmin()
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
  } = useAdminCatalog()
  const {
    evidenceSources,
    loading: governanceLoading,
    error: governanceError,
    loadEvidenceSources,
    clearEvidenceSources,
  } = useAdminCatalogGovernance()

  const [form, setForm] = useState({
    displayName: '',
    gtin: '',
    quantity: '',
    unit: 'g',
    countryOfOrigin: '',
    manufacturerName: '',
  })
  const [changeReason, setChangeReason] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [reasonDetails, setReasonDetails] = useState('')
  const [message, setMessage] = useState('')
  const [failedImageUrl, setFailedImageUrl] = useState('')

  useEffect(() => {
    if (!versionId) return
    setMessage('')
    clearEvidenceSources()
    loadVersion(versionId).catch(() => {})
    loadEvidenceSources({
      entityType: 'product_version',
      entityId: versionId,
      page: 1,
      limit: 50,
    }).catch(() => {})
  }, [versionId, loadVersion, loadEvidenceSources, clearEvidenceSources])

  useEffect(() => {
    if (!selectedVersion || getVersionId(selectedVersion) !== String(versionId)) return
    setForm({
      displayName: selectedVersion.displayName || '',
      gtin: selectedVersion.gtin || '',
      quantity: selectedVersion.netQuantity?.value ?? '',
      unit: selectedVersion.netQuantity?.unit || 'g',
      countryOfOrigin: selectedVersion.countryOfOrigin || '',
      manufacturerName: selectedVersion.manufacturerName || '',
    })
  }, [selectedVersion, versionId])

  const canMutate = hasAdminPermission('catalog.mutate')
  const canPublish = hasAdminPermission('catalog.publish')
  const isCurrentVersion = Boolean(
    selectedVersion && getVersionId(selectedVersion) === String(versionId),
  )
  const publicationStatus = isCurrentVersion
    ? selectedVersion.publicationStatus || 'draft'
    : 'draft'
  const isDraft = publicationStatus === 'draft'
  const isReview = publicationStatus === 'in_review'
  const isPublished = publicationStatus === 'published'
  const isRetired = publicationStatus === 'retired'
  const editable = isDraft && canMutate

  // Use the same version image already shown in the Catalog listing.
  const productImage = isCurrentVersion && Array.isArray(selectedVersion.images)
    ? selectedVersion.images.find((image) => typeof image?.url === 'string' && image.url.trim())
    : null
  const productImageUrl = productImage?.url?.trim() || ''
  const showProductImage = Boolean(productImageUrl && failedImageUrl !== productImageUrl)

  const statusHint = isDraft
    ? 'Edit the details, save, then submit for review.'
    : isReview
      ? 'This version is awaiting a publication decision.'
      : isPublished
        ? 'Published facts are locked. Make a new version to change them.'
        : 'This version is read-only.'

  async function handleSave(event) {
    event.preventDefault()
    if (!isCurrentVersion || !editable) return
    setMessage('')
    const quantity = Number(form.quantity)
    if (!form.displayName.trim() || form.quantity === '' || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage('Enter a product name and a quantity greater than zero.')
      return
    }
    if (form.gtin.trim() && !/^\d{8,14}$/.test(form.gtin.trim())) {
      setMessage('Barcode must contain 8 to 14 digits.')
      return
    }
    try {
      await updateDraft(getVersionId(selectedVersion), {
        displayName: form.displayName.trim(),
        gtin: form.gtin.trim() || null,
        netQuantity: { value: quantity, unit: form.unit },
        countryOfOrigin: form.countryOfOrigin.trim(),
        manufacturerName: form.manufacturerName.trim(),
      })
      setMessage('Draft saved.')
    } catch {
      // Request errors are displayed by the catalog hook.
    }
  }

  async function handleSubmitReview() {
    if (!isDraft || !canMutate || !isCurrentVersion) return
    setMessage('')
    try {
      await submitForReview(versionId)
      setMessage('Product submitted for review.')
    } catch {
      // Request errors are displayed by the catalog hook.
    }
  }

  async function handleNextVersion() {
    if (!isPublished || !canMutate || !isCurrentVersion) return
    setMessage('')
    if (changeReason.trim().length < 3) {
      setMessage('Enter at least 3 characters explaining the new version.')
      return
    }
    try {
      const next = await createNextVersion(versionId, changeReason.trim())
      const nextId = getVersionId(next)
      if (nextId && nextId !== String(versionId)) {
        navigate(`/admin/catalog/products/${encodeURIComponent(nextId)}`)
      } else {
        setMessage('New version created. Return to the catalog to open it.')
      }
    } catch {
      // Request errors are displayed by the catalog hook.
    }
  }

  async function handlePublish() {
    if (!isReview || !canPublish || !isCurrentVersion) return
    setMessage('')
    if (!reasonCode.trim()) {
      setMessage('Enter an audit reason code before publishing.')
      return
    }
    try {
      await publishVersion(versionId, {
        reasonCode: reasonCode.trim(),
        reasonDetails: reasonDetails.trim(),
      })
      setMessage('Product version published.')
    } catch {
      // Request errors are displayed by the catalog hook.
    }
  }

  async function handleRetire() {
    if (!isPublished || !canPublish || !isCurrentVersion) return
    setMessage('')
    if (!reasonCode.trim() || reasonDetails.trim().length < 3) {
      setMessage('Enter an audit code and at least 3 characters explaining retirement.')
      return
    }
    try {
      await retireVersion(versionId, {
        reasonCode: reasonCode.trim(),
        reasonDetails: reasonDetails.trim(),
      })
      setMessage('Product version retired.')
    } catch {
      // Request errors are displayed by the catalog hook.
    }
  }

  const hasAvailableAction =
    (isDraft && canMutate) ||
    (isReview && canPublish) ||
    (isPublished && (canMutate || canPublish))

  return (
    <AdminShell
      title="Product Editor"
      description="Product details and version control."
      actions={
        <Link
          to="/admin/catalog"
          className={SECONDARY_CLASS}
        >
          <ArrowLeft size={17} aria-hidden="true" /> Catalog
        </Link>
      }
    >
      <div id="epantry-product-editor-mobile" className="min-w-0 space-y-5 pb-5 text-[#202421] sm:space-y-7">
      <style>{`
        @media (max-width: 639px) {
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > div:last-child {
            padding: 0 !important;
          }
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > header {
            padding: 12px 14px 13px !important;
            background: #F7F6F2 !important;
          }
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > header > div:first-child {
            margin-bottom: 9px !important;
          }
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > header > div:nth-child(2) {
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 9px !important;
          }
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > header h1 {
            font-size: clamp(23px, 6vw, 27px) !important;
            line-height: 1.12 !important;
            letter-spacing: -.035em !important;
          }
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > header div:nth-child(2) p {
            display: none !important;
          }
          main:has(#epantry-product-editor-mobile) .epantry-workspace-canvas > header a {
            min-height: 40px;
            padding: 8px 11px;
            font-size: 13px;
            white-space: nowrap;
          }
          #epantry-product-editor-mobile {
            width: 100%;
            min-width: 0;
            margin: 0;
            padding: 0 0 20px;
            background: #F7F6F2;
          }
          #epantry-product-editor-mobile > :not(style) {
            margin: 0;
          }
          #epantry-product-editor-mobile .ppe-hero {
            border: 0;
            border-radius: 0;
          }
          #epantry-product-editor-mobile .ppe-hero-main {
            padding: 17px 15px 17px;
          }
          #epantry-product-editor-mobile .ppe-hero-layout {
            display: grid;
            grid-template-columns: 112px minmax(0,1fr);
            align-items: center;
            gap: 14px;
          }
          #epantry-product-editor-mobile .ppe-product-image {
            width: 112px;
            height: 122px;
            border-radius: 12px;
            align-self: center;
          }
          #epantry-product-editor-mobile .ppe-hero-copy { min-width: 0; }
          #epantry-product-editor-mobile .ppe-hero-kicker {
            font-size: 11px;
            line-height: 1.2;
            gap: 5px;
          }
          #epantry-product-editor-mobile .ppe-hero-kicker svg { width: 14px; height: 14px; }
          #epantry-product-editor-mobile .ppe-product-name {
            margin-top: 7px;
            font-size: clamp(19px, 5.2vw, 24px);
            line-height: 1.14;
            letter-spacing: -.03em;
            overflow-wrap: break-word;
          }
          #epantry-product-editor-mobile .ppe-status-copy { display: none; }
          #epantry-product-editor-mobile .ppe-product-meta {
            margin-top: 11px;
            gap: 4px 11px;
            font-size: 12px;
            line-height: 1.35;
          }
          #epantry-product-editor-mobile .ppe-version-panel {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 15px;
          }
          #epantry-product-editor-mobile .ppe-version-panel > div:first-child {
            display: flex;
            align-items: baseline;
            gap: 8px;
          }
          #epantry-product-editor-mobile .ppe-version-panel > div:first-child p:first-child {
            font-size: 12px;
          }
          #epantry-product-editor-mobile .ppe-version-panel > div:first-child p:last-child {
            margin: 0;
            font-size: 23px;
          }
          #epantry-product-editor-mobile .ppe-version-panel > div:last-child {
            padding: 0;
            border: 0;
            gap: 7px;
          }
          #epantry-product-editor-mobile .ppe-version-panel > div:last-child > span:first-child {
            display: none;
          }
          #epantry-product-editor-mobile .ppe-version-panel > div:last-child > span:last-child {
            font-size: 12px;
            padding: 6px 9px;
          }
          #epantry-product-editor-mobile .ppe-edit-notice {
            border-left-width: 3px;
            padding: 11px 14px;
            gap: 8px;
            background: #FFF6EF;
          }
          #epantry-product-editor-mobile .ppe-edit-notice-copy {
            font-size: 12px;
            line-height: 1.4;
            flex: 1 1 170px;
          }
          #epantry-product-editor-mobile .ppe-edit-notice a {
            min-height: 38px;
            padding: 7px 11px;
            font-size: 12px;
          }
          #epantry-product-editor-mobile .ppe-editor-nav {
            margin-top: 0;
            border-top: 0;
            background: #FFFDFB;
          }
          #epantry-product-editor-mobile .ppe-editor-nav a {
            gap: 6px;
            min-height: 45px;
            padding: 9px 5px;
            font-size: 12px;
            line-height: 1.2;
          }
          #epantry-product-editor-mobile .ppe-main-grid { gap: 0; }
          #epantry-product-editor-mobile .ppe-details-section,
          #epantry-product-editor-mobile .ppe-evidence-sidebar,
          #epantry-product-editor-mobile .ppe-actions {
            padding: 18px 14px 0;
          }
          #epantry-product-editor-mobile .ppe-details-header {
            margin-bottom: 12px;
            padding-bottom: 10px;
          }
          #epantry-product-editor-mobile .ppe-details-header > p { display: none; }
          #epantry-product-editor-mobile .ppe-details-header h3,
          #epantry-product-editor-mobile .ppe-actions h3 { font-size: 22px; line-height: 1.2; }
          #epantry-product-editor-mobile .ppe-details-header span { font-size: 12px; }
          #epantry-product-editor-mobile .ppe-product-form {
            border-radius: 0;
            border-left: 0;
            border-right: 0;
          }
          #epantry-product-editor-mobile .ppe-product-fields {
            gap: 12px;
            padding: 13px 0;
          }
          #epantry-product-editor-mobile .ppe-product-fields label span { font-size: 13px; }
          #epantry-product-editor-mobile .ppe-product-fields input,
          #epantry-product-editor-mobile .ppe-product-fields select {
            height: 45px;
            margin-top: 6px;
            font-size: 14px;
          }
          #epantry-product-editor-mobile .ppe-form-footer {
            padding: 10px 12px;
            gap: 9px;
            border-radius: 8px;
          }
          #epantry-product-editor-mobile .ppe-form-help { display: none; }
          #epantry-product-editor-mobile .ppe-form-footer:has(> .ppe-form-help:only-child) {
            display: none;
          }
          #epantry-product-editor-mobile .ppe-evidence-sidebar { gap: 10px; }
          #epantry-product-editor-mobile .ppe-evidence-content {
            border-top-width: 2px;
            padding: 13px 14px;
          }
          #epantry-product-editor-mobile .ppe-evidence-content > p:first-child { display: none; }
          #epantry-product-editor-mobile .ppe-evidence-content h3 { font-size: 19px; }
          #epantry-product-editor-mobile .ppe-evidence-content p:not(:first-child) {
            margin-top: 5px;
            font-size: 13px;
            line-height: 1.45;
          }
          #epantry-product-editor-mobile .ppe-evidence-sidebar > details {
            padding: 12px 14px;
          }
          #epantry-product-editor-mobile .ppe-actions {
            margin-top: 17px;
            border-top-width: 1px;
            padding-top: 16px;
          }
          #epantry-product-editor-mobile .ppe-actions > p:first-child { display: none; }
          #epantry-product-editor-mobile .ppe-version-intro { display: none; }
          #epantry-product-editor-mobile .ppe-actions > div {
            margin-top: 13px;
          }
          #epantry-product-editor-mobile .ppe-update-block,
          #epantry-product-editor-mobile .ppe-retire-block {
            padding: 16px 14px;
          }
          #epantry-product-editor-mobile .ppe-update-block > p:nth-child(2) { display: none; }
          #epantry-product-editor-mobile .ppe-update-block > p:first-child,
          #epantry-product-editor-mobile .ppe-retire-block > p:first-child {
            font-size: 18px;
            line-height: 1.25;
          }
          #epantry-product-editor-mobile .ppe-retire-block > p:nth-child(2) {
            font-size: 13px;
            line-height: 1.45;
          }
          #epantry-product-editor-mobile .ppe-actions textarea { min-height: 76px; }
          #epantry-product-editor-mobile .ppe-update-block button,
          #epantry-product-editor-mobile .ppe-retire-block button {
            width: 100%;
          }
        }
        @media (max-width: 350px) {
          #epantry-product-editor-mobile .ppe-hero-layout { grid-template-columns: 98px minmax(0,1fr); gap: 11px; }
          #epantry-product-editor-mobile .ppe-product-image { width: 98px; height: 108px; }
          #epantry-product-editor-mobile .ppe-product-name { font-size: 19px; }
        }
      `}</style>
        {error && (
          <div role="alert" className="border-l-4 border-red-600 bg-[#FFF0ED] p-4 text-[15px] font-medium text-[#973D35]">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="border-l-4 border-[#B66B46] bg-[#F5E6DB] p-4 text-[15px] font-medium text-[#173F35]">
            {message}
          </div>
        )}

        {!isCurrentVersion ? (
          <div className="rounded-2xl border border-[#E3E3DB] bg-[#F7F6F2] p-7 sm:p-10">
            {loading ? (
              <div role="status" className="flex items-center gap-3 text-[16px] font-semibold text-[#173F35]">
                <RefreshCw className="animate-spin" size={19} aria-hidden="true" /> Loading product details...
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[17px] font-semibold text-[#173F35]">Product could not be opened.</p>
                <button type="button" className={SECONDARY_CLASS} onClick={() => loadVersion(versionId).catch(() => {})}>
                  <RefreshCw size={17} aria-hidden="true" /> Retry
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* A compact editorial product header, not a second form card. */}
            <section className="ppe-hero overflow-hidden rounded-[20px] border border-[#E2D5C9] bg-[#F0DDD0]">
              <div className="ppe-hero-grid grid lg:grid-cols-[minmax(0,1fr)_290px]">
                <div className="ppe-hero-main min-w-0 px-5 py-6 sm:px-8 sm:py-8">
                  <div className="ppe-hero-layout flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
                    {/* Larger pantry-style thumbnail with no decorative border or framed card. */}
                    <div className="ppe-product-image h-[136px] w-[188px] shrink-0 overflow-hidden rounded-2xl bg-transparent sm:h-[176px] sm:w-[244px]">
                      {showProductImage ? (
                        <img
                          src={productImageUrl}
                          alt={productImage.alt || selectedVersion.displayName || 'Product image'}
                          onError={() => setFailedImageUrl(productImageUrl)}
                          className="block h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#EBD0BE] text-[#173F35]" aria-label="Product image unavailable">
                          <span className="text-[52px] font-semibold leading-none" aria-hidden="true">
                            {String(selectedVersion.displayName || 'P').trim().charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ppe-hero-copy min-w-0 flex-1">
                      <p className="ppe-hero-kicker flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.035em] text-[#895741]">
                        <Package size={17} aria-hidden="true" /> Product record
                      </p>
                      <h2 className="ppe-product-name mt-3 max-w-[780px] break-words text-[27px] font-bold leading-[1.12] tracking-[-0.035em] text-[#173F35] sm:text-[37px]">
                        {selectedVersion.displayName || 'Untitled product'}
                      </h2>
                      <p className="ppe-status-copy mt-3 max-w-2xl text-[15px] leading-relaxed text-[#525C52]">{statusHint}</p>
                      <div className="ppe-product-meta mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[#344A40]">
                        <span><strong className="font-semibold">Pack:</strong> {selectedVersion.netQuantity?.value ?? '—'} {selectedVersion.netQuantity?.unit || ''}</span>
                        <span><strong className="font-semibold">Origin:</strong> {selectedVersion.countryOfOrigin || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ppe-version-panel flex flex-col justify-between gap-4 bg-[#173F35] px-5 py-6 text-white sm:px-7 sm:py-8">
                  <div>
                    <p className="text-[13px] font-medium text-[#D7E5DB]">Current version</p>
                    <p className="mt-1 text-[42px] font-bold leading-none tabular-nums">{selectedVersion.version ?? 1}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/20 pt-4">
                    <span className="text-[14px] text-[#D7E5DB]">Publication status</span>
                    <span className="rounded-md bg-white px-3 py-1.5 text-[13px] font-bold text-[#173F35]">{displayStatus(publicationStatus)}</span>
                  </div>
                </div>
              </div>
            </section>

            {openedFromEdit && !editable && (
              <div role="status" className="ppe-edit-notice flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#B86B4A] bg-[#FFF7F1] px-4 py-3 text-[14px] leading-6 text-[#173F35] sm:px-5">
                <p className="ppe-edit-notice-copy">
                  {isPublished && canMutate
                    ? 'This published version is protected. Create a new draft version to make changes.'
                    : isReview
                      ? 'This version is under review. Return it to draft before changing product details.'
                      : 'This version cannot be edited directly.'}
                </p>
                {isPublished && canMutate && (
                  <a href="#version-actions" className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[#173F35] px-4 py-2 font-semibold text-white hover:bg-[#285949]">
                    Create editable version <ArrowRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            <nav aria-label="Product editor sections" className="ppe-editor-nav grid grid-cols-3 gap-0 border-y border-[#DADFD7] bg-[#F7F6F2]">
              {[
                ['01', 'Product details', 'Details', '#product-details'],
                ['02', 'Evidence & IDs', 'Evidence', '#product-evidence'],
                ['03', 'Version actions', 'Actions', '#version-actions'],
              ].map(([number, label, mobileLabel, target]) => (
                <a
                  key={number}
                  href={target}
                  className="focus-ring flex min-h-12 items-center justify-center gap-2 border-r border-[#DADFD7] px-2 py-3 text-center text-[13px] font-semibold text-[#173F35] last:border-r-0 hover:bg-[#EDEFE8] sm:min-h-14 sm:text-[15px]"
                >
                  <span className="font-bold text-[#A35C3D]">{number}</span>
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{mobileLabel}</span>
                </a>
              ))}
            </nav>

            <div className="ppe-main-grid grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_310px] xl:gap-8">
              <section id="product-details" className="ppe-details-section min-w-0 scroll-mt-24">
                <header className="ppe-details-header mb-5 border-b border-[#CCD4CC] pb-4">
                  <p className="text-[13px] font-bold uppercase text-[#A35C3D]">01 / Product information</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[24px] font-bold tracking-[-0.025em] text-[#173F35] sm:text-[28px]">Product details</h3>
                    <span className="text-[14px] font-medium text-[#617065]">{editable ? 'Draft · editable' : 'Read only'}</span>
                  </div>
                </header>

                <form onSubmit={handleSave} className="ppe-product-form overflow-hidden border border-[#DFE2DA] bg-[#FFFDFB]">
                  <div className="ppe-product-fields grid gap-4 p-4 sm:gap-5 sm:p-6 md:grid-cols-2">
                    <EditorField label="Product name" className="md:col-span-2">
                      <input className={FIELD_CLASS} value={form.displayName} disabled={!editable || mutating} maxLength={350}
                        onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
                    </EditorField>
                    <EditorField label="Barcode / GTIN">
                      <input className={FIELD_CLASS} value={form.gtin} disabled={!editable || mutating} inputMode="numeric" maxLength={14}
                        onChange={(event) => setForm((current) => ({ ...current, gtin: event.target.value }))} />
                    </EditorField>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_105px] gap-3">
                      <EditorField label="Quantity">
                        <input type="number" min="0" step="any" className={FIELD_CLASS} value={form.quantity} disabled={!editable || mutating}
                          onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
                      </EditorField>
                      <EditorField label="Unit">
                        <select className={FIELD_CLASS} value={form.unit} disabled={!editable || mutating}
                          onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}>
                          {QUANTITY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </EditorField>
                    </div>
                    <EditorField label="Country of origin">
                      <input className={FIELD_CLASS} value={form.countryOfOrigin} disabled={!editable || mutating} maxLength={120}
                        onChange={(event) => setForm((current) => ({ ...current, countryOfOrigin: event.target.value }))} />
                    </EditorField>
                    <EditorField label="Manufacturer">
                      <input className={FIELD_CLASS} value={form.manufacturerName} disabled={!editable || mutating} maxLength={250}
                        onChange={(event) => setForm((current) => ({ ...current, manufacturerName: event.target.value }))} />
                    </EditorField>
                  </div>
                  <div className="ppe-form-footer flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E3DD] bg-[#F4F3EE] px-4 py-4 sm:px-6">
                    <p className="ppe-form-help max-w-lg text-[14px] leading-6 text-[#617065]">
                      {editable ? 'Save your changes before sending this version for review.' : 'Published and reviewed records cannot be edited directly.'}
                    </p>
                    {editable && (
                      <button type="submit" disabled={mutating} className={PRIMARY_CLASS}>
                        <Save size={17} aria-hidden="true" /> {mutating ? 'Saving...' : 'Save draft'}
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <aside id="product-evidence" className="ppe-evidence-sidebar min-w-0 scroll-mt-24 space-y-6">
                <section className="ppe-evidence-content border-t-4 border-[#B86B4A] bg-[#F2EBE3] p-5 sm:p-6">
                  <p className="text-[13px] font-bold uppercase text-[#895741]">02 / Supporting evidence</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h3 className="text-[21px] font-bold text-[#173F35]">Evidence</h3>
                    {governanceLoading && <RefreshCw size={17} className="animate-spin text-[#173F35]" aria-label="Loading evidence" />}
                  </div>
                  {governanceError && <p role="alert" className="mt-3 text-[14px] text-red-700">Evidence could not be loaded.</p>}
                  {!governanceLoading && !governanceError && evidenceSources.length === 0 && (
                    <p className="mt-3 text-[15px] leading-6 text-[#647067]">No evidence sources attached to this version.</p>
                  )}
                  {!governanceLoading && !governanceError && evidenceSources.length > 0 && (
                    <ul className="mt-3 divide-y divide-[#DED5CA]">
                      {evidenceSources.map((evidence, index) => (
                        <li key={evidence.id || evidence._id || index} className="py-3">
                          <p className="break-words text-[15px] font-semibold text-[#173F35]">
                            {evidence.sourceName || evidence.sourceType || 'Evidence source'}
                          </p>
                          <p className="mt-1 text-[13px] font-medium text-[#687568]">
                            {evidence.evidenceState || 'Source attached'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <details className="group border border-[#DDE2D9] bg-white px-5 py-4 open:pb-5 sm:px-6">
                  <summary className="focus-ring flex cursor-pointer items-center justify-between gap-3 text-[16px] font-bold text-[#173F35]">
                    Canonical identity
                    <span className="text-[13px] font-medium text-[#687568] group-open:hidden">View IDs +</span>
                    <span className="hidden text-[13px] font-medium text-[#687568] group-open:inline">Hide IDs −</span>
                  </summary>
                  <dl className="mt-4 border-t border-[#E3E8DF]">
                    <InfoField label="Version" value={selectedVersion.version ?? 1} />
                    <InfoField label="Variant ID" value={selectedVersion.variantId || '—'} />
                    <InfoField label="Pack ID" value={selectedVersion.packId || '—'} />
                  </dl>
                </details>
              </aside>
            </div>

            <section id="version-actions" className="ppe-actions scroll-mt-24 border-t border-[#CDD5CA] pt-5 sm:pt-7">
              <p className="text-[13px] font-bold uppercase text-[#A35C3D]">03 / Version control</p>
              <h3 className="mt-1 text-[24px] font-bold tracking-[-0.025em] text-[#173F35] sm:text-[28px]"><span className="hidden sm:inline">What happens next?</span><span className="sm:hidden">Version actions</span></h3>
              <p className="ppe-version-intro mt-2 text-[15px] leading-relaxed text-[#5D6D61]">{statusHint}</p>

              {isDraft && canMutate && (
                <div className="mt-5 flex flex-col gap-4 border-l-4 border-[#173F35] bg-[#E9EFE8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="text-[18px] font-bold text-[#173F35]">Ready for review?</p>
                    <p className="mt-1 text-[14px] leading-6 text-[#526658]">Submit the saved draft for approval.</p>
                  </div>
                  <button type="button" onClick={handleSubmitReview} disabled={mutating} className={PRIMARY_CLASS}>
                    <FileCheck2 size={17} aria-hidden="true" /> Submit for review <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}

              {isReview && canPublish && (
                <div className="mt-5 border border-[#D8DED3] bg-[#F7F6F2] p-5 sm:p-6">
                  <p className="text-[18px] font-bold text-[#173F35]">Publish this version</p>
                  <p className="mt-1 text-[14px] text-[#5C6C60]">Record the audit reason before publishing.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <EditorField label="Audit reason code">
                      <input className={FIELD_CLASS} value={reasonCode} maxLength={120} onChange={(e) => setReasonCode(e.target.value)} placeholder="Required" />
                    </EditorField>
                    <EditorField label="Reason details (optional)">
                      <textarea rows={2} className={TEXTAREA_CLASS} value={reasonDetails} maxLength={2000} onChange={(e) => setReasonDetails(e.target.value)} placeholder="Supporting context" />
                    </EditorField>
                  </div>
                  <button type="button" className={`${PRIMARY_CLASS} mt-4`} onClick={handlePublish} disabled={mutating}>
                    <BadgeCheck size={17} aria-hidden="true" /> Publish version
                  </button>
                </div>
              )}

              {isPublished && (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {canMutate && (
                    <div className="ppe-update-block min-w-0 border-t-4 border-[#B86B4A] bg-[#F1DED0] p-5 sm:p-6">
                      <p className="text-[19px] font-bold text-[#173F35]">Create an updated version</p>
                      <p className="mt-1 text-[14px] leading-6 text-[#53675B]">Keep the published record intact and start a new draft.</p>
                      <EditorField label="What needs to change?" className="mt-4">
                        <textarea rows={3} className={TEXTAREA_CLASS} maxLength={2000} value={changeReason}
                          onChange={(event) => setChangeReason(event.target.value)} placeholder="Explain the update (at least 3 characters)" />
                      </EditorField>
                      <button type="button" onClick={handleNextVersion} disabled={mutating} className={`${PRIMARY_CLASS} mt-4`}>
                        <History size={17} aria-hidden="true" /> Create next version
                      </button>
                    </div>
                  )}
                  {canPublish && (
                    <div className="ppe-retire-block min-w-0 border border-[#E0DDD4] bg-white p-5 sm:p-6">
                      <p className="text-[19px] font-bold text-[#173F35]">Retire published version</p>
                      <p className="mt-1 text-[14px] leading-6 text-[#647066]">Use this only when the current record must leave the active catalog.</p>
                      <EditorField label="Audit reason code" className="mt-4">
                        <input className={FIELD_CLASS} value={reasonCode} maxLength={120} onChange={(e) => setReasonCode(e.target.value)} placeholder="Required" />
                      </EditorField>
                      <EditorField label="Reason for retirement" className="mt-4">
                        <textarea className={TEXTAREA_CLASS} rows={3} maxLength={2000} value={reasonDetails}
                          onChange={(e) => setReasonDetails(e.target.value)} placeholder="Required (at least 3 characters)" />
                      </EditorField>
                      <button type="button" onClick={handleRetire} disabled={mutating}
                        className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCA9A0] bg-[#FFF3F0] px-5 py-3 text-[15px] font-semibold text-[#9B3930] hover:bg-[#FFE7E2] disabled:cursor-not-allowed disabled:opacity-50">
                        Retire version
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(isRetired || !hasAvailableAction) && (
                <div className="mt-5 flex items-start gap-3 border border-[#DDE2D9] bg-[#F4F4EF] p-5 text-[15px] leading-6 text-[#53665A]">
                  <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#173F35]" aria-hidden="true" />
                  <p>{isRetired ? 'This version has been retired and remains available as a historical record.' : 'You can view this record. Changes and publication require the appropriate admin permissions.'}</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  )
}
