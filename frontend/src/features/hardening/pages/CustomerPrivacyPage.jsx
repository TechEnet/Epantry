import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  createPrivacyRequest,
  getHardeningErrorMessage,
  getPrivacyContext,
  listOwnPrivacyRequests,
} from '../services/hardening.service'

const PRIVACY_STATUS = {
  submitted: { label: 'Submitted', style: 'bg-[#E7EDE4] text-[#173F35]' },
  in_review: { label: 'Under review', style: 'bg-[#E7EDE4] text-[#173F35]' },
  blocked: { label: 'On hold', style: 'bg-[#FFF1E5] text-[#8B462E]' },
  processing: { label: 'In progress', style: 'bg-[#E6EDF4] text-[#234763]' },
  completed: { label: 'Completed', style: 'bg-[#DCEFE5] text-[#17533B]' },
  rejected: { label: 'Not approved', style: 'bg-[#FCE8E5] text-[#942D2D]' },
  cancelled: { label: 'Cancelled', style: 'bg-[#EEEDEA] text-[#52534F]' },
}

function humanize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function requestLabel(type) {
  if (type === 'access_export') return 'Data copy requested'
  if (type === 'deletion') return 'Deletion review requested'
  return humanize(type) || 'Privacy request'
}

export default function CustomerPrivacyPage() {
  const [context, setContext] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const [contextResult, requestResult] = await Promise.all([
        getPrivacyContext(),
        listOwnPrivacyRequests(),
      ])

      setContext(contextResult)
      // GET /privacy/requests returns { requests: [...] }, not privacyRequests.
      setRequests(Array.isArray(requestResult?.requests) ? requestResult.requests : [])
    } catch (requestError) {
      setLoadError(
        getHardeningErrorMessage(
          requestError,
          'We could not load your privacy requests. Please try again.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(requestType) {
    setSubmitting(requestType)
    setError('')
    setNotice('')

    try {
      const result = await createPrivacyRequest({
        requestType,
        scope: 'account',
      })

      setNotice(
        result?.deduplicated
          ? 'You already have an open request for this. You can track it below.'
          : 'Your request has been sent. You can follow its progress below.',
      )
      await load()
    } catch (requestError) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'We could not send your request. You may need to sign in again.',
        ),
      )
    } finally {
      setSubmitting('')
    }
  }

  return (
    <main className="min-w-0 w-full bg-[#F7F6F2] px-3 pb-8 pt-5 text-[#202421] sm:px-6 sm:pb-12 sm:pt-9 lg:px-9 xl:px-11">
      <div className="w-full max-w-none">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#D3D8CA] pb-6 sm:pb-8">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[13px] font-bold tracking-[0.1em] text-[#956044]">
              ACCOUNT / PRIVACY
            </p>
            <h1 className="max-w-[780px] text-[30px] font-bold leading-[1.12] tracking-[-0.04em] text-[#202421] sm:text-[38px] lg:text-[44px]">
              Your data. Your choice.
            </h1>
            <p className="mt-3 max-w-[660px] text-[15px] leading-relaxed text-[#555B52] sm:text-base">
              Request a copy of your data, ask for deletion, and see the progress of your requests.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading || Boolean(submitting)}
            className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#CBD2C5] bg-[#F7F6F2] px-4 text-[14px] font-semibold text-[#173F35] transition-colors hover:bg-[#EAEFE6] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </button>
        </header>

        {(error || notice) && (
          <div
            role={error ? 'alert' : 'status'}
            aria-live="polite"
            className={`mt-5 rounded-xl border px-4 py-3 text-[14px] font-medium leading-relaxed ${
              error
                ? 'border-[#EDB8B2] bg-[#FFF0ED] text-[#952D25]'
                : 'border-[#C5D8C8] bg-[#E9F3EA] text-[#173F35]'
            }`}
          >
            {error || notice}
          </div>
        )}

        <section aria-label="Privacy actions" className="mt-5 grid gap-3 sm:mt-7 sm:gap-5 lg:grid-cols-2">
          <article className="relative flex min-w-0 flex-col overflow-hidden rounded-[18px] bg-[#173F35] px-5 py-6 text-[#F7F6F2] sm:p-7 lg:min-h-[260px] lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#355B4E] text-[#F7F6F2]">
                <Download size={23} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="mt-1 text-[13px] font-semibold text-[#D4E4D7]">01 / ACCESS</span>
            </div>
            <h2 className="mt-5 text-[23px] font-bold leading-tight tracking-[-0.025em] sm:text-[27px]">
              Get a copy of your data
            </h2>
            <p className="mt-2 max-w-[540px] text-[14px] leading-[1.6] text-[#E0EBE2] sm:text-[15px]">
              Ask for a secure copy of your eligible EPANTRY account data. We’ll let you know when it’s ready.
            </p>
            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => submit('access_export')}
              className="focus-ring mt-6 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-[#F7F6F2] px-5 text-[14px] font-bold text-[#173F35] transition-colors hover:bg-[#E2E9DD] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting === 'access_export' ? 'Sending request…' : 'Request my data'}
              {submitting !== 'access_export' && <ArrowUpRight size={17} aria-hidden="true" />}
            </button>
          </article>

          <article className="relative flex min-w-0 flex-col rounded-[18px] border border-[#E5CEBF] bg-[#F4E7DE] px-5 py-6 sm:p-7 lg:min-h-[260px] lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#E9CDBB] text-[#8E3C29]">
                <Trash2 size={23} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="mt-1 text-[13px] font-semibold text-[#9D6249]">02 / DELETE</span>
            </div>
            <h2 className="mt-5 text-[23px] font-bold leading-tight tracking-[-0.025em] sm:text-[27px]">
              Request account deletion
            </h2>
            <p className="mt-2 max-w-[540px] text-[14px] leading-[1.6] text-[#5B514B] sm:text-[15px]">
              Ask us to review which data can be deleted or restricted. Some legal and financial records may need to stay.
            </p>
            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => submit('deletion')}
              className="focus-ring mt-6 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-[#8D3C2C] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#713022] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting === 'deletion' ? 'Sending request…' : 'Request deletion review'}
              {submitting !== 'deletion' && <ArrowUpRight size={17} aria-hidden="true" />}
            </button>
          </article>
        </section>

        <aside className="mt-4 flex items-start gap-3 rounded-[15px] bg-[#E4E9DA] px-4 py-4 sm:mt-5 sm:gap-4 sm:px-6 sm:py-5">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[#173F35]" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[#173F35]">How your request is handled</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-[#354A3E] sm:text-[15px]">
              Requests are reviewed under our privacy and record-keeping rules. Asking for deletion does not erase all data immediately.
              {context?.consentSnapshot ? ' Your saved consent choices are also considered.' : ''}
            </p>
          </div>
        </aside>

        <section aria-labelledby="privacy-request-title" className="mt-8 sm:mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#CDD4C7] pb-4">
            <div>
              <p className="mb-1 text-[13px] font-bold text-[#A0573B]">YOUR HISTORY</p>
              <h2 id="privacy-request-title" className="text-[24px] font-bold tracking-[-0.035em] sm:text-[29px]">
                Your requests
              </h2>
              <p className="mt-1 text-[14px] text-[#62675F] sm:text-[15px]">
                Check what you’ve asked for and where it stands.
              </p>
            </div>
            {!loading && !loadError && (
              <span className="rounded-full bg-[#E5EADD] px-3 py-1.5 text-[13px] font-bold text-[#173F35]">
                {requests.length} {requests.length === 1 ? 'request' : 'requests'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 text-[15px] text-[#5C675E]" role="status">
              <Clock3 size={20} aria-hidden="true" />
              Loading your requests…
            </div>
          ) : loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-6" role="alert">
              <p className="max-w-2xl text-[14px] leading-relaxed text-[#9A3529]">{loadError}</p>
              <button
                type="button"
                className="focus-ring rounded-lg border border-[#C7D2C6] px-4 py-2 text-[14px] font-semibold text-[#173F35]"
                onClick={load}
              >
                Try again
              </button>
            </div>
          ) : requests.length > 0 ? (
            <div className="divide-y divide-[#D6DACF]">
              {requests.map((request, index) => {
                const status = PRIVACY_STATUS[request.status] || {
                  label: humanize(request.status) || 'Unknown',
                  style: 'bg-[#EEEDEA] text-[#52534F]',
                }
                const isExport = request.requestType === 'access_export'
                return (
                  <article key={request.id || request.requestId || index} className="grid min-w-0 gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.55fr)] sm:items-center sm:gap-6 sm:py-6">
                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isExport ? 'bg-[#E1EADB] text-[#173F35]' : 'bg-[#F3E0D5] text-[#A14F34]'}`}>
                        {isExport ? <FileText size={20} aria-hidden="true" /> : <Trash2 size={20} aria-hidden="true" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold text-[#202421] sm:text-[17px]">{requestLabel(request.requestType)}</h3>
                        <p className="mt-1 text-[13px] leading-relaxed text-[#60675E] sm:text-[14px]">
                          {formatDate(request.requestedAt)}
                        </p>
                        {request.requestId && (
                          <p className="mt-1 break-all text-[12px] leading-relaxed text-[#747A71] sm:text-[13px]">
                            Reference: {request.requestId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold ${status.style}`}>
                        {request.status === 'completed' && <CheckCircle2 size={14} className="mr-1.5" aria-hidden="true" />}
                        {status.label}
                      </span>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#60675E]">
                        {request.retentionEvaluation?.length || 0} record-keeping {request.retentionEvaluation?.length === 1 ? 'check' : 'checks'}
                        {isExport && request.exportArtifactStatus
                          ? ` · Data copy: ${humanize(request.exportArtifactStatus)}`
                          : ''}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="flex items-start gap-3 py-7 sm:py-9">
              <FileText size={22} className="mt-0.5 shrink-0 text-[#C86C42]" aria-hidden="true" />
              <div>
                <p className="text-[16px] font-bold text-[#202421]">No requests yet</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#62675F] sm:text-[15px]">
                  When you request a data copy or deletion review, its progress will appear here.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
