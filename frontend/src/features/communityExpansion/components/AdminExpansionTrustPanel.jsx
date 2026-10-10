import {
  BadgeCheck,
  CircleAlert,
  FileWarning,
  Megaphone,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import {
  useAdmin,
} from '../../admin/context/AdminContext'

import {
  getCommunityExpansionErrorMessage,
  listAdminCommunityReports,
  listAdminCreatorContent,
  resolveAdminCommunityReport,
  reviewAdminCreatorContent,
} from '../services/communityExpansion.service'

import {
  listAdminAdDecisionLogs,
  listAdminRetailMediaCampaigns,
  reviewAdminRetailMediaCampaign,
} from '../../retailMedia/services/retailMedia.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

function titleize(value) {
  return String(
    value || '',
  )
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function formatMoneyMinor(
  amountMinor,
  currency = 'INR',
) {
  const amount = Number(amountMinor || 0) / 100

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

export default function AdminExpansionTrustPanel() {
  const [searchParams] = useSearchParams()
  const focusCampaignId = searchParams.get('focusCampaign') || ''

  const {
    hasAdminPermission,
    isRootSuperAdmin,
  } =
    useAdmin()

  const canMutate =
    hasAdminPermission(
      'trust_safety.mutate',
    )

  const canReviewRetailMedia =
    canMutate &&
    isRootSuperAdmin

  const [reports, setReports] =
    useState([])

  const [creatorContent, setCreatorContent] =
    useState([])

  const [campaigns, setCampaigns] =
    useState([])

  const [decisionLogs, setDecisionLogs] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')

  const [loadErrors, setLoadErrors] = useState({})

  const [notice, setNotice] =
    useState('')

  const [reasonById, setReasonById] =
    useState({})

  const [evidenceById, setEvidenceById] =
    useState({})

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          // One unavailable feature must not hide other successful review queues.
          const results = await Promise.allSettled([
            listAdminCommunityReports({ limit: 50 }),
            listAdminCreatorContent({ limit: 50 }),
            listAdminRetailMediaCampaigns({ limit: 50 }),
            listAdminAdDecisionLogs({ limit: 50 }),
          ])
          const nextErrors = {}
          const keys = ['reports', 'creatorContent', 'campaigns', 'logs']
          const setters = [setReports, setCreatorContent, setCampaigns, setDecisionLogs]
          const fields = ['reports', 'creatorContent', 'campaigns', 'adDecisionLogs']
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              setters[index](result.value?.[fields[index]] || [])
            } else {
              const message = getCommunityExpansionErrorMessage(result.reason)
              nextErrors[keys[index]] = message.includes('not enabled for this environment')
                ? 'This feature is not enabled here yet. Other review queues remain available.'
                : message
            }
          })
          setLoadErrors(nextErrors)
        } finally {
          setLoading(false)
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [load],
  )

  useEffect(() => {
    if (!focusCampaignId || loading) return undefined

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`retail-media-campaign-${focusCampaignId}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [focusCampaignId, campaigns, loading])

  function evidenceRefs(id) {
    return String(
      evidenceById[id] || '',
    )
      .split('\n')
      .map(
        (value) =>
          value.trim(),
      )
      .filter(Boolean)
  }

  async function run(
    task,
    message,
  ) {
    setBusy(true)
    setNotice('')
    setError('')

    try {
      await task()
      setNotice(message)
      await load()
    } catch (requestError) {
      setError(
        getCommunityExpansionErrorMessage(
          requestError,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5 min-w-0 space-y-4 sm:mt-6">
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700">Reports, courses & promotions</p>
          <h2 className="mt-1 text-lg font-bold text-[#164838] sm:text-xl">Keep public content safe and trustworthy.</h2>
          <p className="mt-1 text-sm leading-5 text-stone-600">Check reported posts, review creator courses and confirm that promotions follow the rules.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || busy}
          className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
        >
          <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          Refresh reviews
        </button>
      </div>
      <div
        className="text-sm font-medium"
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
            Loading review activity…
          </p>
        ) : null}
      </div>

      {Object.values(loadErrors).some((message) => message.includes('not enabled here yet')) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-sky-500 bg-sky-50 px-3 py-3 text-sm text-sky-950">
          <p>Community Trust is switched off in this environment. Reports and creator courses need this feature enabled to load.</p>
          <Link to="/admin/policy" className="focus-ring shrink-0 font-bold underline underline-offset-2">Open Feature Access</Link>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-[18px] border border-amber-100 bg-[#fff9eb] p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <FileWarning
              size={18}
              className="mt-0.5 text-amber-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-black text-stone-950">
                Community safety reports
              </h3>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                Review reports about spam, unsafe advice, false claims, copyright or undisclosed ads.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {loadErrors.reports ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-800">{loadErrors.reports}</p>
            ) : reports.length ? (
              reports.map(
                (report) => (
                  <article
                    key={report.id}
                    className="rounded-xl border border-stone-200 p-3"
                  >
                    <p className="text-xs font-black text-stone-900">
                      {titleize(
                        report.reason,
                      )}
                    </p>

                    <p className="mt-1 text-[13px] font-semibold text-stone-500">
                      {titleize(
                        report.subjectType,
                      )} · {titleize(
                        report.status,
                      )}
                    </p>

                    {canMutate &&
                    ['open', 'in_review'].includes(
                      report.status,
                    ) ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reasonById[report.id] || ''}
                          onChange={(event) =>
                            setReasonById(
                              (current) => ({
                                ...current,
                                [report.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Why are you making this decision?"
                        />

                        <textarea
                          rows={2}
                          className={inputClass}
                          value={evidenceById[report.id] || ''}
                          onChange={(event) =>
                            setEvidenceById(
                              (current) => ({
                                ...current,
                                [report.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Evidence or reference, one per line"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  resolveAdminCommunityReport({
                                    reportId:
                                      report.id,
                                    action:
                                      'quarantine_content',
                                    reason:
                                      reasonById[report.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(report.id),
                                  }),
                                'Reported content was restricted.',
                              )
                            }
                            className="focus-ring rounded-lg bg-amber-600 px-3 py-2 text-[13px] font-black text-white"
                          >
                            Quarantine
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  resolveAdminCommunityReport({
                                    reportId:
                                      report.id,
                                    action:
                                      'dismiss',
                                    reason:
                                      reasonById[report.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(report.id),
                                  }),
                                'Community report dismissed.',
                              )
                            }
                            className="focus-ring rounded-lg border border-stone-200 px-3 py-2 text-[13px] font-black"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                No community reports available.
              </p>
            )}
          </div>
        </section>

        <section id="creator-content-governance" className="min-w-0 rounded-[18px] border border-sky-100 bg-[#f0f7fc] p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <BadgeCheck
              size={18}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-black text-stone-950">
                Creator courses & videos
              </h3>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                Check course content, video rights and sponsorship details before publication.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {loadErrors.creatorContent ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-800">{loadErrors.creatorContent}</p>
            ) : creatorContent.length ? (
              creatorContent.map(
                (item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-stone-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-stone-900">
                          {item.content?.title || titleize(item.contentType)}
                        </p>

                        <p className="mt-1 text-[13px] font-semibold text-stone-500">
                          {item.creator?.displayName ? `${item.creator.displayName} · ` : ''}
                          {titleize(item.governanceState)}
                          {item.content?.accessType ? ` · ${titleize(item.content.accessType)}` : ''}
                        </p>
                      </div>

                      {item.rights?.sponsored ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black uppercase text-amber-900">
                          {item.rights?.sponsorLabel ||
                            'Sponsored'}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-[13px] font-semibold leading-5 text-stone-500">
                      Content owner: {item.rights?.ownerOrLicensor || '—'} · Removal status: {item.rights?.takedownState || 'clear'}
                    </p>

                    {item.rights?.sponsored ? (
                      <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[13px] font-semibold text-amber-900">
                        Disclosure: {item.rights?.disclosureText || 'Missing'}
                      </p>
                    ) : null}

                    {canMutate &&
                    item.governanceState ===
                      'pending_review' ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reasonById[item.id] || ''}
                          onChange={(event) =>
                            setReasonById(
                              (current) => ({
                                ...current,
                                [item.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Reason for your decision"
                        />

                        <textarea
                          rows={2}
                          className={inputClass}
                          value={evidenceById[item.id] || ''}
                          onChange={(event) =>
                            setEvidenceById(
                              (current) => ({
                                ...current,
                                [item.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Evidence or reference, one per line"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminCreatorContent({
                                    creatorContentId:
                                      item.id,
                                    decision:
                                      'approved',
                                    reason:
                                      reasonById[item.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(item.id),
                                  }),
                                'Creator content approved.',
                              )
                            }
                            className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-[13px] font-black text-white"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminCreatorContent({
                                    creatorContentId:
                                      item.id,
                                    decision:
                                      'restricted',
                                    reason:
                                      reasonById[item.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(item.id),
                                  }),
                                'Creator content sent back for changes.',
                              )
                            }
                            className="focus-ring rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-black text-amber-900"
                          >
                            Request changes
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                No creator courses awaiting review.
              </p>
            )}
          </div>
        </section>

        <section id="retail-media-review" className="min-w-0 scroll-mt-28 rounded-[18px] border border-emerald-100 bg-[#edf6ef] p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-start gap-2">
            <Megaphone
              size={18}
              className="mt-0.5 text-emerald-700"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-sm font-black text-stone-950">
                Sponsored promotions
              </h3>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                Review paid campaigns. Ads cannot override food-safety rules or use private health information for targeting.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-[400px] space-y-3 overflow-y-auto pr-1">
            {loadErrors.campaigns ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-800">{loadErrors.campaigns}</p>
            ) : campaigns.length ? (
              campaigns.map(
                (campaign) => (
                  <article
                    id={`retail-media-campaign-${campaign.id}`}
                    key={campaign.id}
                    className={[
                      'scroll-mt-32 rounded-xl border p-3 transition',
                      focusCampaignId === campaign.id
                        ? 'border-emerald-400 bg-emerald-50/70 ring-4 ring-emerald-100'
                        : 'border-stone-200 bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-stone-900">
                          {campaign.title}
                        </p>

                        <p className="mt-1 text-[13px] font-semibold text-stone-500">
                          {titleize(
                            campaign.status,
                          )} · {campaign.promotedEntityType}
                        </p>
                      </div>

                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black uppercase text-amber-900">
                        {campaign.creative?.sponsorLabel || 'Sponsored'}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                            Host payment
                          </p>
                          <p className="mt-1 text-xs font-black text-stone-950">
                            {formatMoneyMinor(
                              campaign.payment?.requiredAmountMinor,
                              campaign.payment?.currency || 'INR',
                            )}
                          </p>
                        </div>

                        <span
                          className={[
                            'rounded-full px-2.5 py-1 text-xs font-black uppercase',
                            campaign.payment?.status === 'paid'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-white text-stone-600',
                          ].join(' ')}
                        >
                          {campaign.payment?.status === 'paid'
                            ? 'Paid'
                            : 'Awaiting payment'}
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-semibold leading-4 text-stone-600">
                        {campaign.payment?.recipient ||
                          'EPANTRY platform (Super Admin controlled)'}
                      </p>
                    </div>

                    {campaign.status === 'pending_review' &&
                    campaign.payment?.status !== 'paid' ? (
                      <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3 text-[13px] font-semibold leading-5 text-sky-800">
                        Waiting for the Host to complete the Razorpay test payment before Super Admin approval.
                      </p>
                    ) : null}

                    {!isRootSuperAdmin &&
                    campaign.status === 'pending_review' &&
                    campaign.payment?.status === 'paid' ? (
                      <p className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-[13px] font-semibold leading-5 text-violet-800">
                        Payment is complete. Final campaign approval is restricted to the root Super Admin.
                      </p>
                    ) : null}

                    {canReviewRetailMedia &&
                    campaign.status ===
                      'pending_review' &&
                    campaign.payment?.status === 'paid' ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          rows={2}
                          className={inputClass}
                          value={reasonById[campaign.id] || ''}
                          onChange={(event) =>
                            setReasonById(
                              (current) => ({
                                ...current,
                                [campaign.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Promotion review reason"
                        />

                        <textarea
                          rows={2}
                          className={inputClass}
                          value={evidenceById[campaign.id] || ''}
                          onChange={(event) =>
                            setEvidenceById(
                              (current) => ({
                                ...current,
                                [campaign.id]:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="Evidence or reference, one per line"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminRetailMediaCampaign({
                                    campaignId:
                                      campaign.id,
                                    decision:
                                      'approve',
                                    reason:
                                      reasonById[campaign.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(campaign.id),
                                  }),
                                'Promotion approved.',
                              )
                            }
                            className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-[13px] font-black text-white"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  reviewAdminRetailMediaCampaign({
                                    campaignId:
                                      campaign.id,
                                    decision:
                                      'reject',
                                    reason:
                                      reasonById[campaign.id] || '',
                                    evidenceRefs:
                                      evidenceRefs(campaign.id),
                                  }),
                                'Promotion rejected.',
                              )
                            }
                            className="focus-ring rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-black text-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ),
              )
            ) : (
              <p className="rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                No promotions found in this review queue.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert
                size={16}
                className="mt-0.5 text-stone-500"
                aria-hidden="true"
              />

              <p className="text-[13px] font-semibold leading-5 text-stone-600">
                Decision history is kept for review. Ad views do not count as sales or payments.
              </p>
            </div>

            <p className="mt-2 text-sm font-semibold text-stone-900">
              Recorded promotion decisions: {loadErrors.logs ? "Unavailable" : decisionLogs.length}
            </p>
            {loadErrors.logs ? <p role="alert" className="mt-1 text-sm text-red-700">{loadErrors.logs}</p> : null}
          </div>
        </section>
      </div>

      <div className="flex items-start gap-2 border-l-4 border-amber-400 bg-amber-50 px-3 py-3 text-amber-950">
        <CircleAlert
          size={18}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />

        <p className="text-sm leading-5">
          Creator content and promotions must still meet food, allergen and delivery rules. Verification does not grant new account roles or permissions.
        </p>
      </div>
    </section>
  )
}