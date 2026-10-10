import { ClipboardCheck, FileClock, RefreshCw, Scale, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminShell from '../../admin/components/AdminShell'
import MediaPrivacyReviewQueue from '../components/MediaPrivacyReviewQueue'
import {
  createRegulatoryProfile,
  createRetentionPolicy,
  getHardeningErrorMessage,
  listPrivacyRequests,
  listRegulatoryProfiles,
  listRetentionPolicies,
  transitionRegulatoryProfile,
  transitionRetentionPolicy,
  updatePrivacyRequest,
} from '../services/hardening.service'

const inputClass = 'focus-ring min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400'
const buttonClass = 'focus-ring inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0f5132] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a3f27] disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton = 'focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-[#164b38] hover:bg-[#f2f8f4] disabled:opacity-50'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function titleize(value) {
  return String(value || '').split('_').filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
}

function SectionLoading({ loading, error, empty, children }) {
  if (loading && !children) return <p className="py-4 text-sm text-stone-600">Loading records…</p>
  if (error) return (
    <div role="alert" className="my-3 flex min-w-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 break-words">Could not load this section. {error}</p>
    </div>
  )
  if (!children) return <p className="rounded-xl bg-stone-50 px-3 py-4 text-sm text-stone-600">{empty}</p>
  return children
}

function LifecycleButtons({ record, onAction, busy }) {
  const action = record.status === 'draft' ? 'submit' : record.status === 'in_review' ? 'approve' : record.status === 'approved' ? 'activate' : null
  if (!action) return <span className="text-sm text-stone-500">No action needed</span>
  return (
    <button type="button" disabled={busy} onClick={() => onAction(record, action)} className={secondaryButton}>
      {action === 'submit' ? 'Send for review' : action === 'approve' ? 'Approve' : 'Make active'}
    </button>
  )
}

function Field({ label, children, span = false }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-stone-700 ${span ? 'sm:col-span-2' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function CollectionHeader({ icon: Icon, index, title, description, count, tone = 'green' }) {
  const tones = { green: 'bg-[#dff4e9] text-[#13593f]', blue: 'bg-[#e5f1fb] text-[#2b6484]', violet: 'bg-[#ece6fc] text-[#64489a]' }
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone] || tones.green}`}><Icon size={19} aria-hidden="true" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-emerald-800">{index}</p>
        <h2 className="text-lg font-bold leading-snug text-[#173d30] sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-stone-600">{description}</p>
      </div>
      {typeof count === 'number' ? <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-[#164b38]">{count}</span> : null}
    </div>
  )
}

export default function AdminPrivacyOpsPage() {
  const [privacyRequests, setPrivacyRequests] = useState([])
  const [retentionPolicies, setRetentionPolicies] = useState([])
  const [regulatoryProfiles, setRegulatoryProfiles] = useState([])
  const [loadState, setLoadState] = useState({ privacy: 'loading', retention: 'loading', regulatory: 'loading' })
  const [loadErrors, setLoadErrors] = useState({ privacy: '', retention: '', regulatory: '' })
  const [selectedPrivacyId, setSelectedPrivacyId] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState('in_review')
  const [blockedReasonCode, setBlockedReasonCode] = useState('')
  const [exportArtifactStatus, setExportArtifactStatus] = useState('not_generated')
  const [workflowReason, setWorkflowReason] = useState('Reviewed customer privacy request.')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [showAllRequests, setShowAllRequests] = useState(false)
  const [showAllRetention, setShowAllRetention] = useState(false)
  const [showAllRegulatory, setShowAllRegulatory] = useState(false)
  const [retentionForm, setRetentionForm] = useState({
    policyKey: '', dataClass: '', purpose: '', retentionDays: '365', dispositionAction: 'delete',
    effectiveFrom: new Date().toISOString().slice(0, 10), evidenceRef: '',
    reason: 'Create a new data retention policy draft.',
  })
  const [regulatoryForm, setRegulatoryForm] = useState({
    profileKey: '', jurisdiction: 'IN', operatorApplicability: 'platform_operator',
    effectiveFrom: new Date().toISOString().slice(0, 10), methodologyVersion: 'v1', evidenceRef: '',
    reason: 'Create a new regulatory profile draft.',
  })

  const selectedPrivacy = useMemo(() => privacyRequests.find((item) => item.id === selectedPrivacyId) || null, [privacyRequests, selectedPrivacyId])

  const load = useCallback(async () => {
    setLoadState({ privacy: 'loading', retention: 'loading', regulatory: 'loading' })
    setLoadErrors({ privacy: '', retention: '', regulatory: '' })
    const jobs = [
      ['privacy', () => listPrivacyRequests({ limit: 200 }), 'privacyRequests', setPrivacyRequests],
      ['retention', listRetentionPolicies, 'policies', setRetentionPolicies],
      ['regulatory', listRegulatoryProfiles, 'profiles', setRegulatoryProfiles],
    ]
    // Each queue loads independently, so one failed API cannot hide the other queues.
    await Promise.all(jobs.map(async ([key, fetcher, field, setter]) => {
      try {
        const response = await fetcher()
        if (!Array.isArray(response?.[field])) throw new Error('Unexpected response from the server.')
        setter(response[field])
        setLoadState((current) => ({ ...current, [key]: 'ready' }))
      } catch (requestError) {
        setLoadErrors((current) => ({ ...current, [key]: getHardeningErrorMessage(requestError, 'Please try Refresh.') }))
        setLoadState((current) => ({ ...current, [key]: 'error' }))
      }
    }))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selectedPrivacy) return
    setWorkflowStatus(selectedPrivacy.status === 'submitted' ? 'in_review' : selectedPrivacy.status)
    setBlockedReasonCode(selectedPrivacy.blockedReasonCode || '')
    setExportArtifactStatus(selectedPrivacy.exportArtifactStatus || 'not_generated')
  }, [selectedPrivacy])

  async function savePrivacyWorkflow() {
    if (!selectedPrivacy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await updatePrivacyRequest(selectedPrivacy.id, {
        status: workflowStatus, blockedReasonCode, exportArtifactStatus, reason: workflowReason,
      })
      setNotice('Privacy request updated. The decision has been recorded.')
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, 'Unable to update this request.'))
    } finally { setBusy(false) }
  }

  async function runLifecycle(kind, record, action) {
    setBusy(true); setError(''); setNotice('')
    try {
      const reason = `Admin ${action} action for ${kind}.`
      if (kind === 'retention policy') await transitionRetentionPolicy(record.id, action, reason)
      else await transitionRegulatoryProfile(record.id, action, reason)
      setNotice(`${titleize(action)} completed for ${kind}.`)
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, `Unable to ${action} ${kind}.`))
    } finally { setBusy(false) }
  }

  async function submitRetentionVersion(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await createRetentionPolicy({
        policyKey: retentionForm.policyKey, dataClass: retentionForm.dataClass,
        purpose: retentionForm.purpose,
        retentionDays: retentionForm.dispositionAction === 'retain' ? null : Number(retentionForm.retentionDays),
        dispositionAction: retentionForm.dispositionAction, immutableRecordClass: false,
        applicability: ['platform_operator'], effectiveFrom: new Date(retentionForm.effectiveFrom).toISOString(),
        effectiveTo: null,
        evidenceRefs: [{ referenceType: 'policy_source', reference: retentionForm.evidenceRef, note: 'Retention policy evidence source.' }],
        reason: retentionForm.reason,
      })
      setNotice('Retention policy draft created.')
      setRetentionForm((value) => ({ ...value, policyKey: '', dataClass: '', purpose: '', evidenceRef: '' }))
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, 'Unable to create the retention policy.'))
    } finally { setBusy(false) }
  }

  async function submitRegulatoryVersion(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await createRegulatoryProfile({
        profileKey: regulatoryForm.profileKey, jurisdiction: regulatoryForm.jurisdiction,
        operatorApplicability: [regulatoryForm.operatorApplicability],
        effectiveFrom: new Date(regulatoryForm.effectiveFrom).toISOString(), effectiveTo: null,
        requiredFields: [], calculationMethodologyVersion: regulatoryForm.methodologyVersion,
        presentationRules: {},
        evidenceRefs: [{ referenceType: 'regulatory_source', reference: regulatoryForm.evidenceRef, note: 'Regulatory profile source.' }],
        reason: regulatoryForm.reason,
      })
      setNotice('Regulatory profile draft created.')
      setRegulatoryForm((value) => ({ ...value, profileKey: '', evidenceRef: '' }))
      await load()
    } catch (requestError) {
      setError(getHardeningErrorMessage(requestError, 'Unable to create the regulatory profile.'))
    } finally { setBusy(false) }
  }

  const requestItems = showAllRequests ? privacyRequests : privacyRequests.slice(0, 6)
  const retentionItems = showAllRetention ? retentionPolicies : retentionPolicies.slice(0, 6)
  const regulatoryItems = showAllRegulatory ? regulatoryProfiles : regulatoryProfiles.slice(0, 6)
  const statusLabel = (status) => status === 'in_review' ? 'In review' : titleize(status)

  return (
    <AdminShell
      title="Image Privacy & Safety Review"
      description="Review the privacy of uploaded images and manage customer data requests."
      actions={
        <button type="button" onClick={load} disabled={Object.values(loadState).some((value) => value === 'loading')} className={secondaryButton}>
          <RefreshCw size={16} aria-hidden="true" className="mr-2" />Refresh
        </button>
      }
    >
      <div className="min-w-0 space-y-4 sm:space-y-6">
        <section className="overflow-hidden rounded-[16px] border border-[#bddfce] bg-[#dff1e8]">
          <div className="grid gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#176344]">IMAGE SAFETY & DATA PRIVACY</p>
              <h2 className="mt-1 text-xl font-bold leading-tight text-[#103f30] sm:text-2xl">Review images. Protect people.</h2>
              <p className="mt-2 text-sm leading-5 text-[#365a4d]">Check uploaded photos for privacy risks, then handle customer data requests and policies below.</p>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#cce6db] bg-white text-center lg:min-w-[270px]">
              {[
                ['Requests', privacyRequests.length, loadState.privacy],
                ['Policies', retentionPolicies.length, loadState.retention],
                ['Legal profiles', regulatoryProfiles.length, loadState.regulatory],
              ].map(([label, count, state]) => (
                <div key={label} className="min-w-0 border-r border-stone-100 px-2 py-3 last:border-0">
                  <p className="text-xl font-bold text-[#104331]" aria-label={`${label}: ${state === 'error' ? 'Unavailable' : count}`}>
                    {state === 'error' ? '—' : state === 'loading' ? '…' : count}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-stone-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#d6e9df] border-t border-[#d6e9df] bg-white/55 text-[#164936]">
            {['01  Check uploads', '02  Decide & save', '03  Manage data'].map((step) => (
              <div key={step} className="min-w-0 px-2 py-3 text-center text-xs font-semibold leading-4 sm:px-4 sm:text-sm">{step}</div>
            ))}
          </div>
        </section>

        {error || notice ? (
          <div role={error ? 'alert' : 'status'} aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {error || notice}
          </div>
        ) : null}

        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-col gap-1 border-l-4 border-[#0f7654] pl-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#173d30] sm:text-xl">1. Check uploaded images</h2>
              <p className="mt-1 text-sm text-stone-600">Open flagged image evidence, choose a privacy decision, and save the reason.</p>
            </div>
            <p className="text-xs font-semibold text-stone-600 sm:text-right">Product approval stays in Product Review and Bulk Product Review.</p>
          </div>
          <MediaPrivacyReviewQueue />
        </div>

        <section className="border-t border-stone-300 pt-4 sm:pt-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#173d30] sm:text-xl">2. Customer data requests</h2>
              <p className="mt-1 text-sm text-stone-600">Review customer requests and update their progress. These are separate from image checks.</p>
            </div>
          </div>
        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 rounded-[16px] border border-stone-200 bg-white p-4 sm:p-6">
            <CollectionHeader icon={ShieldCheck} index="02 · Customer requests" title="Privacy requests" description="Choose a customer request to check its status and history." count={loadState.privacy === 'ready' ? privacyRequests.length : undefined} />
            <div className="mt-4 divide-y divide-stone-100 border-y border-stone-100">
              <SectionLoading loading={loadState.privacy === 'loading'} error={loadErrors.privacy} empty="No privacy requests have been submitted.">
                {requestItems.length ? requestItems.map((request) => (
                  <button
                    key={request.id} type="button" onClick={() => setSelectedPrivacyId(request.id)}
                    aria-pressed={selectedPrivacyId === request.id}
                    className={`focus-ring flex w-full min-w-0 items-start justify-between gap-3 px-2 py-3 text-left transition hover:bg-[#f3f8f5] ${selectedPrivacyId === request.id ? 'bg-[#eaf7ef]' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-950">{titleize(request.requestType)}</p>
                      <p className="mt-0.5 break-words text-sm text-stone-600">{request.user?.email || request.userId || 'Customer'} · {formatDate(request.requestedAt)}</p>
                      <p className="mt-1 text-xs text-stone-500">Retention decisions: {request.retentionEvaluation?.length || 0}</p>
                    </div>
                    <span className="max-w-[110px] shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-center text-xs font-semibold text-stone-600">{statusLabel(request.status)}</span>
                  </button>
                )) : null}
              </SectionLoading>
            </div>
            {privacyRequests.length > 6 ? (
              <button type="button" className={`${secondaryButton} mt-3 w-full sm:w-auto`} onClick={() => setShowAllRequests((value) => !value)}>
                {showAllRequests ? 'Show fewer requests' : `View all ${privacyRequests.length} requests`}
              </button>
            ) : null}
            {privacyRequests.length >= 200 ? <p className="mt-2 text-xs text-stone-600">Showing the 200 most recent requests. Older records remain saved.</p> : null}
          </div>

          <div className="min-w-0 rounded-[16px] border border-[#d9e6f2] bg-[#edf5fa] p-4 sm:p-6">
            <CollectionHeader icon={ClipboardCheck} index="03 · Make a decision" title="Review a request" description="Set the status, explain why, then save your decision." tone="blue" />
            {selectedPrivacy ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-white px-3 py-3 text-sm text-stone-700">
                  <p className="font-bold text-[#153e32]">{titleize(selectedPrivacy.requestType)}</p>
                  <p className="mt-1 break-words">{selectedPrivacy.user?.email || selectedPrivacy.userId}</p>
                  <p className="mt-1 text-xs text-stone-500">Submitted {formatDate(selectedPrivacy.requestedAt)} · Retention decisions: {selectedPrivacy.retentionEvaluation?.length || 0}</p>
                </div>
                <Field label="Request status">
                  <select className={inputClass} value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value)}>
                    {['submitted', 'in_review', 'blocked', 'processing', 'completed', 'rejected', 'cancelled'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                  </select>
                </Field>
                <Field label="Reason if blocked">
                  <input className={inputClass} value={blockedReasonCode} onChange={(event) => setBlockedReasonCode(event.target.value)} placeholder="Enter a reason code if needed" />
                </Field>
                <Field label="Data export status">
                  <select className={inputClass} value={exportArtifactStatus} onChange={(event) => setExportArtifactStatus(event.target.value)}>
                    {['not_generated', 'available', 'expired'].map((value) => <option key={value} value={value}>{titleize(value)}</option>)}
                  </select>
                </Field>
                <Field label="Reason for this decision">
                  <textarea className={inputClass} rows={3} value={workflowReason} onChange={(event) => setWorkflowReason(event.target.value)} />
                </Field>
                <button type="button" disabled={busy} onClick={savePrivacyWorkflow} className={`${buttonClass} w-full sm:w-auto`}>Save decision</button>
                <p className="text-xs text-stone-600">Changes require authorised access and may require recent verification.</p>
              </div>
            ) : <div className="mt-4 rounded-xl bg-white px-4 py-5 text-sm text-stone-600">Choose a customer request on the left to review it.</div>}
          </div>
        </section>

        </section>

        <div className="border-l-4 border-[#987bd0] pl-3">
          <h2 className="text-lg font-bold text-[#173d30] sm:text-xl">3. Data retention & legal rules</h2>
          <p className="mt-1 text-sm text-stone-600">Create drafts, send them for review, and activate approved versions when authorised.</p>
        </div>
        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-[20px] border border-stone-200 bg-white">
            <div className="border-b border-[#d6ece2] bg-[#ecf7f0] p-4 sm:p-6">
              <CollectionHeader icon={FileClock} index="04 · Data retention" title="Retention policies" description="Set how long each type of data is kept and what happens next." count={loadState.retention === 'ready' ? retentionPolicies.length : undefined} />
              <p className="mt-3 text-sm text-[#245c43]">Draft → Submit → Approve → Activate</p>
            </div>
            <div className="p-4 sm:p-6">
              <h3 className="text-base font-bold text-[#173d30]">Set a data retention rule</h3>
              <form className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={submitRetentionVersion}>
                <Field label="Policy name / key"><input required className={inputClass} value={retentionForm.policyKey} onChange={(event) => setRetentionForm((value) => ({ ...value, policyKey: event.target.value }))} placeholder="e.g. customer-records" /></Field>
                <Field label="Data category"><input required className={inputClass} value={retentionForm.dataClass} onChange={(event) => setRetentionForm((value) => ({ ...value, dataClass: event.target.value }))} placeholder="e.g. order records" /></Field>
                <Field label="Why is this data needed?" span><input required minLength={10} className={inputClass} value={retentionForm.purpose} onChange={(event) => setRetentionForm((value) => ({ ...value, purpose: event.target.value }))} placeholder="Describe why it is kept" /></Field>
                <Field label="Keep for (days)"><input className={inputClass} type="number" min="0" disabled={retentionForm.dispositionAction === 'retain'} value={retentionForm.retentionDays} onChange={(event) => setRetentionForm((value) => ({ ...value, retentionDays: event.target.value }))} /></Field>
                <Field label="After the retention period">
                  <select className={inputClass} value={retentionForm.dispositionAction} onChange={(event) => setRetentionForm((value) => ({ ...value, dispositionAction: event.target.value }))}>
                    {['delete', 'anonymize', 'restrict', 'retain'].map((value) => <option key={value} value={value}>{titleize(value)}</option>)}
                  </select>
                </Field>
                <Field label="Start date"><input required type="date" className={inputClass} value={retentionForm.effectiveFrom} onChange={(event) => setRetentionForm((value) => ({ ...value, effectiveFrom: event.target.value }))} /></Field>
                <Field label="Evidence / document reference"><input required className={inputClass} value={retentionForm.evidenceRef} onChange={(event) => setRetentionForm((value) => ({ ...value, evidenceRef: event.target.value }))} placeholder="Policy or approval reference" /></Field>
                <Field label="Reason for creating this policy" span><textarea required rows={2} className={inputClass} value={retentionForm.reason} onChange={(event) => setRetentionForm((value) => ({ ...value, reason: event.target.value }))} /></Field>
                <button className={`${buttonClass} sm:col-span-2`} type="submit" disabled={busy}>Save retention draft</button>
              </form>
              <div className="mt-5 border-t border-stone-200 pt-4">
                <h3 className="text-base font-bold text-[#173d30]">Saved data retention rules</h3>
                <div className="mt-2 divide-y divide-stone-100">
                  <SectionLoading loading={loadState.retention === 'loading'} error={loadErrors.retention} empty="No retention policies have been created.">
                    {retentionItems.length ? retentionItems.map((policy) => (
                      <article key={policy.id} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-stone-950">{policy.policyKey} · v{policy.versionNumber}</p>
                          <p className="mt-1 break-words text-sm text-stone-600">{policy.dataClass} · Starts {formatDate(policy.effectiveFrom)}</p>
                          <p className="mt-1 text-xs font-semibold text-emerald-800">{titleize(policy.status)}</p>
                        </div>
                        <LifecycleButtons record={policy} busy={busy} onAction={(record, action) => runLifecycle('retention policy', record, action)} />
                      </article>
                    )) : null}
                  </SectionLoading>
                </div>
                {retentionPolicies.length > 6 ? <button type="button" className={`${secondaryButton} mt-3 w-full sm:w-auto`} onClick={() => setShowAllRetention((value) => !value)}>{showAllRetention ? 'Show fewer policies' : `View all ${retentionPolicies.length} policies`}</button> : null}
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[20px] border border-stone-200 bg-white">
            <div className="border-b border-[#e7def9] bg-[#f3eefb] p-4 sm:p-6">
              <CollectionHeader icon={Scale} index="05 · Legal requirements" title="Regulatory profiles" description="Keep data-handling requirements up to date for each region." count={loadState.regulatory === 'ready' ? regulatoryProfiles.length : undefined} tone="violet" />
              <p className="mt-3 text-sm text-[#615082]">Draft → Send for review → Approve → Activate</p>
            </div>
            <div className="p-4 sm:p-6">
              <h3 className="text-base font-bold text-[#173d30]">Add a legal requirements draft</h3>
              <form className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={submitRegulatoryVersion}>
                <Field label="Profile name / key"><input required className={inputClass} value={regulatoryForm.profileKey} onChange={(event) => setRegulatoryForm((value) => ({ ...value, profileKey: event.target.value }))} placeholder="e.g. india-platform" /></Field>
                <Field label="Country / region code"><input required className={inputClass} value={regulatoryForm.jurisdiction} onChange={(event) => setRegulatoryForm((value) => ({ ...value, jurisdiction: event.target.value }))} placeholder="IN" /></Field>
                <Field label="Who does this apply to?">
                  <select className={inputClass} value={regulatoryForm.operatorApplicability} onChange={(event) => setRegulatoryForm((value) => ({ ...value, operatorApplicability: event.target.value }))}>
                    {['consumer_service', 'marketplace_operator', 'brand_content_operator', 'hospitality_operator', 'platform_operator'].map((value) => <option key={value} value={value}>{titleize(value)}</option>)}
                  </select>
                </Field>
                <Field label="Start date"><input required type="date" className={inputClass} value={regulatoryForm.effectiveFrom} onChange={(event) => setRegulatoryForm((value) => ({ ...value, effectiveFrom: event.target.value }))} /></Field>
                <Field label="Method / version"><input required className={inputClass} value={regulatoryForm.methodologyVersion} onChange={(event) => setRegulatoryForm((value) => ({ ...value, methodologyVersion: event.target.value }))} placeholder="v1" /></Field>
                <Field label="Legal evidence reference"><input required className={inputClass} value={regulatoryForm.evidenceRef} onChange={(event) => setRegulatoryForm((value) => ({ ...value, evidenceRef: event.target.value }))} placeholder="Regulation or document" /></Field>
                <Field label="Reason for this profile" span><textarea required rows={2} className={inputClass} value={regulatoryForm.reason} onChange={(event) => setRegulatoryForm((value) => ({ ...value, reason: event.target.value }))} /></Field>
                <button className={`${buttonClass} sm:col-span-2`} type="submit" disabled={busy}>Save regulatory draft</button>
              </form>
              <div className="mt-5 border-t border-stone-200 pt-4">
                <h3 className="text-base font-bold text-[#173d30]">Saved legal profiles</h3>
                <div className="mt-2 divide-y divide-stone-100">
                  <SectionLoading loading={loadState.regulatory === 'loading'} error={loadErrors.regulatory} empty="No regulatory profiles have been created.">
                    {regulatoryItems.length ? regulatoryItems.map((profile) => (
                      <article key={profile.id} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-stone-950">{profile.profileKey} · v{profile.versionNumber}</p>
                          <p className="mt-1 break-words text-sm text-stone-600">{profile.jurisdiction} · {profile.calculationMethodologyVersion} · Starts {formatDate(profile.effectiveFrom)}</p>
                          <p className="mt-1 break-words text-xs text-stone-600">Applies to: {(profile.operatorApplicability || []).map(titleize).join(', ') || '—'}</p>
                          <p className="mt-1 text-xs font-semibold text-emerald-800">{titleize(profile.status)}</p>
                        </div>
                        <LifecycleButtons record={profile} busy={busy} onAction={(record, action) => runLifecycle('regulatory profile', record, action)} />
                      </article>
                    )) : null}
                  </SectionLoading>
                </div>
                {regulatoryProfiles.length > 6 ? <button type="button" className={`${secondaryButton} mt-3 w-full sm:w-auto`} onClick={() => setShowAllRegulatory((value) => !value)}>{showAllRegulatory ? 'Show fewer profiles' : `View all ${regulatoryProfiles.length} profiles`}</button> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 items-start gap-3 rounded-xl border border-[#d4e7e0] bg-[#f0f7f3] px-4 py-3 text-sm text-[#245240]">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Image clearance does not approve a product listing. Customer data changes need authorised access and may require identity verification; each decision is recorded.</p>
        </section>

      </div>
    </AdminShell>
  )
}
