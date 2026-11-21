import {
  BadgeCheck,
  CircleAlert,
  FileWarning,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
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
  'focus-ring w-full border border-[#D7DDCF] bg-white px-3.5 py-2.5 text-sm font-medium text-[#202421] outline-none'

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
    <div className="min-w-0 space-y-5 text-[#202421] sm:space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4 border-b border-[#D7DDCF] pb-5">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.10em] text-[#C56C42]">02 / Content checks</p>
          <h2 className="mt-1 text-[21px] font-bold leading-tight tracking-tight text-[#202421] sm:text-[31px]">Keep the community in good hands.</h2>
          <p className="mt-2 hidden max-w-2xl text-[15px] text-[#173F35] sm:block">Reports, creator courses and paid promotions, each in its own review lane.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || busy}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#173F35] bg-[#F7F6F2] px-5 py-2.5 text-sm font-bold text-[#173F35] transition hover:bg-[#D7DDCF] disabled:opacity-50"
        >
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'animate-spin' : ''} /> Refresh checks
        </button>
      </div>

      {error ? <div role="alert" className="border-l-4 border-red-700 bg-[#F7F6F2] px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
      {notice ? <div role="status" className="border-l-4 border-[#173F35] bg-[#D7DDCF] px-4 py-3 text-sm font-semibold text-[#173F35]">{notice}</div> : null}
      {loading ? <div role="status" className="flex items-center gap-2 border border-[#D7DDCF] bg-[#F7F6F2] p-4 text-sm text-[#173F35]"><RefreshCw size={16} className="animate-spin" /> Updating review queues…</div> : null}

      {Object.values(loadErrors).some((message) => message.includes('not enabled here yet')) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-l-4 border-[#C56C42] bg-[#D7DDCF]/55 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <CircleAlert size={17} className="shrink-0 text-[#173F35] sm:h-[21px] sm:w-[21px]" />
            <p className="text-sm font-semibold leading-6 text-[#202421]">Some review tools are switched off. Available queues still work.</p>
          </div>
          <Link to="/admin/policy" className="focus-ring inline-flex shrink-0 items-center gap-1 border-b border-[#173F35] pb-0.5 text-sm font-bold text-[#173F35]">Feature settings <span aria-hidden="true">↗</span></Link>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
        <section id="community-reports" className="min-w-0 overflow-hidden rounded-[16px] border border-[#D7DDCF] bg-[#F7F6F2]">
          <header className="flex items-center justify-between gap-3 border-b border-[#D7DDCF] bg-[#C56C42]/20 px-4 py-5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 bg-[#C56C42] text-[#202421]"><FileWarning size={18} className="sm:h-[22px] sm:w-[22px]" /></span>
              <div>
                <h3 className="text-[16px] font-bold text-[#202421] sm:text-[18px]">Community reports</h3>
                <p className="mt-0.5 hidden text-sm text-[#173F35] sm:block">Safety and reported posts</p>
              </div>
            </div>
            <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full sm:h-9 sm:min-w-9 bg-[#F7F6F2] px-2 text-base font-extrabold tabular-nums text-[#202421]">{reports.length}</span>
          </header>
          <div className="max-h-[490px] divide-y divide-[#D7DDCF] overflow-y-auto overscroll-contain">
            {loadErrors.reports ? (
              <p role="alert" className="p-4 text-sm text-[#173F35]">{loadErrors.reports.includes('not enabled here yet') ? 'Not active yet.' : loadErrors.reports}</p>
            ) : reports.length ? reports.map((report) => (
              <article key={report.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-[#202421]">{titleize(report.reason)}</p>
                  <span className="text-xs font-bold text-[#C56C42]">{titleize(report.status)}</span>
                </div>
                <p className="mt-1 text-sm text-[#173F35]">{titleize(report.subjectType)}</p>
                {canMutate && ['open', 'in_review'].includes(report.status) ? (
                  <div className="mt-4 space-y-2 border-t border-[#D7DDCF] pt-3">
                    <label htmlFor={`report-reason-${report.id}`} className="block text-sm font-semibold text-[#202421]">Decision reason</label>
                    <textarea id={`report-reason-${report.id}`} rows={2} className={inputClass} value={reasonById[report.id] || ''} onChange={(event) => setReasonById((current) => ({...current, [report.id]: event.target.value}))} placeholder="Why are you making this decision?" />
                    <label htmlFor={`report-evidence-${report.id}`} className="block text-sm font-semibold text-[#202421]">Evidence or links</label>
                    <textarea id={`report-evidence-${report.id}`} rows={2} className={inputClass} value={evidenceById[report.id] || ''} onChange={(event) => setEvidenceById((current) => ({...current, [report.id]: event.target.value}))} placeholder="One reference per line" />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" disabled={busy} onClick={() => run(() => resolveAdminCommunityReport({reportId:report.id, action:'quarantine_content', reason:reasonById[report.id] || '', evidenceRefs:evidenceRefs(report.id)}), 'Reported content was restricted.')} className="focus-ring bg-[#173F35] px-4 py-2 text-sm font-bold text-[#F7F6F2] disabled:opacity-50">Restrict content</button>
                      <button type="button" disabled={busy} onClick={() => run(() => resolveAdminCommunityReport({reportId:report.id, action:'dismiss', reason:reasonById[report.id] || '', evidenceRefs:evidenceRefs(report.id)}), 'Community report dismissed.')} className="focus-ring border border-[#D7DDCF] bg-white px-4 py-2 text-sm font-semibold text-[#173F35] disabled:opacity-50">Dismiss report</button>
                    </div>
                  </div>
                ) : null}
              </article>
            )) : (
              <div className="flex items-center gap-3 px-4 py-5 sm:px-6"><ShieldCheck size={22} className="shrink-0 text-[#173F35]" /><p className="text-[15px] font-medium text-[#173F35]">No safety reports are waiting.</p></div>
            )}
          </div>
        </section>

        <section id="creator-content-governance" className="min-w-0 overflow-hidden rounded-[16px] border border-[#D7DDCF] bg-[#F7F6F2]">
          <header className="flex items-center justify-between gap-3 border-b border-[#D7DDCF] bg-[#D7DDCF] px-4 py-5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 bg-[#173F35] text-[#F7F6F2]"><BadgeCheck size={18} className="sm:h-[22px] sm:w-[22px]" /></span>
              <div><h3 className="text-[16px] font-bold text-[#202421] sm:text-[18px]">Creator courses & videos</h3><p className="mt-0.5 hidden text-sm text-[#173F35] sm:block">Content, rights and disclosures</p></div>
            </div>
            <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full sm:h-9 sm:min-w-9 bg-[#F7F6F2] px-2 text-base font-extrabold tabular-nums text-[#202421]">{creatorContent.length}</span>
          </header>
          <div className="max-h-[490px] divide-y divide-[#D7DDCF] overflow-y-auto overscroll-contain">
            {loadErrors.creatorContent ? (
              <p role="alert" className="p-4 text-sm text-[#173F35]">{loadErrors.creatorContent.includes('not enabled here yet') ? 'Not active yet.' : loadErrors.creatorContent}</p>
            ) : creatorContent.length ? creatorContent.map((item) => (
              <article key={item.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#202421]">{item.content?.title || titleize(item.contentType)}</p>
                  {item.rights?.sponsored ? <span className="bg-[#C56C42] px-2.5 py-1 text-xs font-bold text-[#202421]">{item.rights?.sponsorLabel || 'Sponsored'}</span> : null}
                </div>
                <p className="mt-1 text-sm text-[#173F35]">{item.creator?.displayName ? `${item.creator.displayName} · ` : ''}{titleize(item.governanceState)}{item.content?.accessType ? ` · ${titleize(item.content.accessType)}` : ''}</p>
                <p className="mt-2 text-sm text-[#173F35]">Rights holder: {item.rights?.ownerOrLicensor || 'Not provided'} · Removal status: {item.rights?.takedownState || 'clear'}</p>
                {item.rights?.sponsored ? <p className="mt-2 border-l-[3px] border-[#C56C42] pl-3 text-sm text-[#202421]">Sponsorship disclosure: {item.rights?.disclosureText || 'Missing'}</p> : null}
                {canMutate && item.governanceState === 'pending_review' ? (
                  <div className="mt-4 space-y-2 border-t border-[#D7DDCF] pt-3">
                    <label htmlFor={`content-reason-${item.id}`} className="block text-sm font-semibold text-[#202421]">Decision reason</label>
                    <textarea id={`content-reason-${item.id}`} rows={2} className={inputClass} value={reasonById[item.id] || ''} onChange={(event) => setReasonById((current) => ({...current, [item.id]: event.target.value}))} placeholder="Reason for your decision" />
                    <label htmlFor={`content-evidence-${item.id}`} className="block text-sm font-semibold text-[#202421]">Evidence or links</label>
                    <textarea id={`content-evidence-${item.id}`} rows={2} className={inputClass} value={evidenceById[item.id] || ''} onChange={(event) => setEvidenceById((current) => ({...current, [item.id]: event.target.value}))} placeholder="One reference per line" />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" disabled={busy} onClick={() => run(() => reviewAdminCreatorContent({creatorContentId:item.id, decision:'approved', reason:reasonById[item.id] || '', evidenceRefs:evidenceRefs(item.id)}), 'Creator content approved.')} className="focus-ring bg-[#173F35] px-4 py-2 text-sm font-bold text-[#F7F6F2] disabled:opacity-50">Approve content</button>
                      <button type="button" disabled={busy} onClick={() => run(() => reviewAdminCreatorContent({creatorContentId:item.id, decision:'restricted', reason:reasonById[item.id] || '', evidenceRefs:evidenceRefs(item.id)}), 'Creator content sent back for changes.')} className="focus-ring border border-[#C56C42] bg-white px-4 py-2 text-sm font-semibold text-[#202421] disabled:opacity-50">Request changes</button>
                    </div>
                  </div>
                ) : null}
              </article>
            )) : (
              <div className="flex items-center gap-3 px-4 py-5 sm:px-6"><BadgeCheck size={22} className="shrink-0 text-[#173F35]" /><p className="text-[15px] font-medium text-[#173F35]">No courses or videos are waiting.</p></div>
            )}
          </div>
        </section>
      </div>

      <section id="retail-media-review" className="scroll-mt-28 overflow-hidden rounded-[18px] border border-[#D7DDCF] bg-[#F7F6F2]">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-[#173F35] px-5 py-6 text-[#F7F6F2] sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12 bg-[#C56C42] text-[#202421]"><Megaphone size={19} className="sm:h-[25px] sm:w-[25px]" /></span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#D7DDCF]">03 / Paid content</p>
              <h3 className="mt-1 text-[19px] font-bold leading-tight text-[#F7F6F2] sm:text-[27px]">Sponsored campaigns</h3>
              <p className="mt-1 hidden text-sm text-[#D7DDCF] sm:block">Campaign approvals and recorded payments</p>
            </div>
          </div>
          <div className="flex items-center gap-5 sm:gap-7">
            <span className="text-center"><strong className="block text-[21px] font-extrabold tabular-nums leading-none text-[#F7F6F2] sm:text-[26px]">{campaigns.length}</strong><span className="mt-1 block text-xs text-[#D7DDCF]">Campaigns</span></span>
            <span className="border-l border-[#F7F6F2]/25 pl-5 text-center sm:pl-7"><strong className="block text-[21px] font-extrabold tabular-nums leading-none text-[#F7F6F2] sm:text-[26px]">{loadErrors.logs ? '—' : decisionLogs.length}</strong><span className="mt-1 block text-xs text-[#D7DDCF]">Decisions logged</span></span>
          </div>
        </header>
        <div className="divide-y divide-[#D7DDCF]">
          {loadErrors.campaigns ? (
            <p role="alert" className="px-4 py-5 text-sm font-semibold text-red-800 sm:px-6">{loadErrors.campaigns}</p>
          ) : campaigns.length ? campaigns.map((campaign) => (
            <article id={`retail-media-campaign-${campaign.id}`} key={campaign.id} className={`scroll-mt-32 px-5 py-6 sm:px-7 ${focusCampaignId === campaign.id ? 'border-l-4 border-[#C56C42] bg-[#D7DDCF]/50' : 'bg-[#F7F6F2]'}`}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.32fr)] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[18px] font-extrabold leading-tight text-[#202421] sm:text-[21px]">{campaign.title}</h4>
                    <span className="rounded-full bg-[#D7DDCF] px-3 py-1 text-xs font-bold text-[#173F35]">{titleize(campaign.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#173F35]">{campaign.promotedEntityType} · Sponsor: {campaign.creative?.sponsorLabel || 'Sponsored'}</p>
                  {campaign.status === 'pending_review' && campaign.payment?.status !== 'paid' ? <p className="mt-3 border-l-[3px] border-[#C56C42] pl-3 text-sm text-[#202421]">Host payment must be completed before approval.</p> : null}
                  {!isRootSuperAdmin && campaign.status === 'pending_review' && campaign.payment?.status === 'paid' ? <p className="mt-3 border-l-[3px] border-[#C56C42] pl-3 text-sm text-[#202421]">Payment received. Final approval requires the root Super Admin.</p> : null}
                  {canReviewRetailMedia && campaign.status === 'pending_review' && campaign.payment?.status === 'paid' ? (
                    <div className="mt-4 space-y-2 border-t border-[#D7DDCF] pt-4">
                      <label htmlFor={`campaign-reason-${campaign.id}`} className="block text-sm font-semibold">Decision reason</label>
                      <textarea id={`campaign-reason-${campaign.id}`} rows={2} className={inputClass} value={reasonById[campaign.id] || ''} onChange={(event) => setReasonById((current) => ({...current, [campaign.id]: event.target.value}))} placeholder="Promotion review reason" />
                      <label htmlFor={`campaign-evidence-${campaign.id}`} className="block text-sm font-semibold">Evidence or links</label>
                      <textarea id={`campaign-evidence-${campaign.id}`} rows={2} className={inputClass} value={evidenceById[campaign.id] || ''} onChange={(event) => setEvidenceById((current) => ({...current, [campaign.id]: event.target.value}))} placeholder="One reference per line" />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" disabled={busy} onClick={() => run(() => reviewAdminRetailMediaCampaign({campaignId:campaign.id, decision:'approve', reason:reasonById[campaign.id] || '', evidenceRefs:evidenceRefs(campaign.id)}), 'Promotion approved.')} className="focus-ring bg-[#173F35] px-4 py-2 text-sm font-bold text-[#F7F6F2] disabled:opacity-50">Approve promotion</button>
                        <button type="button" disabled={busy} onClick={() => run(() => reviewAdminRetailMediaCampaign({campaignId:campaign.id, decision:'reject', reason:reasonById[campaign.id] || '', evidenceRefs:evidenceRefs(campaign.id)}), 'Promotion rejected.')} className="focus-ring border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Reject</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="self-start rounded-[14px] border-l-[5px] border-[#C56C42] bg-[#D7DDCF] px-5 py-5 lg:w-full">
                  <p className="text-xs font-extrabold uppercase tracking-[.10em] text-[#173F35]">Host payment</p>
                  <p className="mt-2 text-[25px] font-extrabold leading-tight tabular-nums text-[#202421] sm:text-[30px]">{formatMoneyMinor(campaign.payment?.requiredAmountMinor, campaign.payment?.currency || 'INR')}</p>
                  <span className="mt-2 inline-flex rounded-full bg-[#173F35] px-3 py-1 text-sm font-bold text-[#F7F6F2]">{campaign.payment?.status === 'paid' ? 'Paid' : 'Awaiting payment'}</span>
                  <p className="mt-3 text-xs leading-5 text-[#173F35]">{campaign.payment?.recipient || 'EPANTRY platform (Super Admin controlled)'}</p>
                </div>
              </div>
            </article>
          )) : (
            <div className="flex items-center gap-3 px-4 py-6 sm:px-6"><ShieldAlert size={22} className="shrink-0 text-[#173F35]" /><p className="text-sm text-[#173F35]">No sponsored promotions in this queue.</p></div>
          )}
        </div>
        {loadErrors.logs ? <p role="alert" className="border-t border-[#D7DDCF] px-4 py-3 text-sm text-red-800 sm:px-6">{loadErrors.logs}</p> : null}
        <footer className="border-t border-[#D7DDCF] bg-[#D7DDCF]/40 px-5 py-3 text-sm text-[#173F35] sm:px-7">Promotion decisions are logged. Ad views are not sales.</footer>
      </section>

      <div className="border-l-[4px] border-[#C56C42] bg-[#D7DDCF]/45 px-4 py-3 text-sm leading-6 text-[#173F35]">
        Approvals still require food-safety and content-rights checks. Creator verification does not change account roles.
      </div>
    </div>
  )
}
