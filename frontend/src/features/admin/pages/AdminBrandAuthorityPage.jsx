import {
  BadgeCheck,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  FilePenLine,
  UsersRound,
  Inbox,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell'
import { useAdmin } from '../context/AdminContext'
import {
  approveAdminBrandClaim,
  changeAdminBrandAuthorityLifecycle,
  getAdminBrandClaim,
  listAdminBrandAuthorities,
  listAdminBrandClaims,
  listAdminBrandConflicts,
  listAdminBrandOverrides,
  rejectAdminBrandClaim,
  resolveAdminBrandConflict,
  reviewAdminBrandIdentityCheck,
  reviewAdminBrandOverride,
} from '../../brands/services/brandAuthority.service'

// Only presentation is scoped to this workspace. The existing Brand API and
// permission-controlled mutations remain the single source of truth.
const AUTHORITY_SCOPES = [
  'official_content',
  'regulated_facts',
  'claims_certifications',
  'packaging_media',
  'brand_recipes',
]
const SCOPE_LABELS = {
  official_content: 'Official brand content',
  regulated_facts: 'Regulated product facts',
  claims_certifications: 'Claims & certifications',
  packaging_media: 'Packaging & images',
  brand_recipes: 'Brand recipes',
}
const DECISION_LABELS = {
  verified: 'Verify evidence',
  rejected: 'Reject evidence',
  conflict: 'Flag conflict',
  approve: 'Approve change',
  reject: 'Reject change',
  suspend: 'Pause access',
  revoke: 'Remove access',
}

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Something went wrong while updating this brand review.'
}

function humanize(value) {
  if (!value) return 'Not provided'
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function StatusPill({ value }) {
  const status = String(value || 'unknown').toLowerCase()
  const tone = ['rejected', 'revoked', 'conflict', 'quarantined'].includes(status)
    ? 'danger'
    : ['submitted', 'open', 'in_review', 'suspended', 'pending'].includes(status)
      ? 'attention'
      : ['inactive', 'draft', 'unknown'].includes(status)
        ? 'neutral'
        : 'success'
  return <span className="br-status" data-tone={tone}>{humanize(status)}</span>
}

function EmptyRow({ children }) {
  return (
    <div className="br-empty" role="status">
      <Inbox aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

const MOBILE_SECTION_TITLES = {
  'br-ownership': 'Ownership requests',
  'br-changes': 'Content changes',
  'br-conflicts': 'Conflicts',
  'br-access': 'Brand access',
}

function SectionHeading({ number, title, count, id }) {
  return (
    <div className="br-section-head">
      <div className="br-section-title">
        <span className="br-section-no">{number}</span>
        <h2 id={`${id}-title`}>
          <span className="br-heading-desktop">{title}</span>
          <span className="br-heading-mobile">{MOBILE_SECTION_TITLES[id] || title}</span>
        </h2>
      </div>
      <span className="br-section-count" aria-label={`${count} records`}>{count}</span>
    </div>
  )
}

export default function AdminBrandAuthorityPage() {
  const { hasAdminPermission } = useAdmin()
  const canVerify = hasAdminPermission('trust_safety.mutate')
  const canCatalogMutate = hasAdminPermission('catalog.mutate')
  const canReviewContent = canVerify || canCatalogMutate

  const [claims, setClaims] = useState([])
  const [authorities, setAuthorities] = useState([])
  const [proposals, setProposals] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [reason, setReason] = useState('Reviewed against the submitted brand evidence.')
  const [marketCodes, setMarketCodes] = useState('IN')
  const [selectedScopes, setSelectedScopes] = useState(['official_content'])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [claimResult, authorityResult, proposalResult, conflictResult] = await Promise.all([
        listAdminBrandClaims({ status: 'all', limit: 100 }),
        listAdminBrandAuthorities({ status: 'all', limit: 100 }),
        listAdminBrandOverrides({ status: 'all', limit: 100 }),
        listAdminBrandConflicts({ status: 'all', severity: 'all', limit: 100 }),
      ])
      setClaims(claimResult?.claims || [])
      setAuthorities(authorityResult?.authorities || [])
      setProposals(proposalResult?.proposals || [])
      setConflicts(conflictResult?.conflicts || [])
      setHasLoadedOnce(true)
    } catch (requestError) {
      // A failed request must not be presented as four genuine empty queues.
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function execute(operation, message) {
    if (busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await operation()
      setSuccess(message)
      await loadAll()
      if (selectedClaim?.claim?.id) {
        const refreshed = await getAdminBrandClaim(selectedClaim.claim.id)
        setSelectedClaim(refreshed)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function openClaim(claimId) {
    setBusy(true)
    setError(null)
    try {
      const result = await getAdminBrandClaim(claimId)
      setSelectedClaim(result)
      setMarketCodes(result?.claim?.requestedMarketCodes?.join(', ') || 'IN')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  function toggleScope(scope) {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope])
  }

  const reviewableProposals = proposals.some((proposal) => ['submitted', 'in_review'].includes(proposal.status))
  const reviewableConflicts = conflicts.some((conflict) => ['open', 'in_review'].includes(conflict.status))
  const activeAuthorities = authorities.filter((authority) => authority.status === 'active')

  return (
    <AdminShell
      title="Brand Review & Access"
      description="Brand ownership, content reviews and access."
      actions={
        <button type="button" onClick={loadAll} disabled={loading || busy} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#cfd9cc] bg-[#f7f6f2] px-4 text-sm font-bold text-[#173f35] disabled:opacity-50">
          <RefreshCw size={16} aria-hidden="true" />Refresh
        </button>
      }
    >
      <div id="epantry-brand-review">
        <style>{BRAND_REVIEW_STYLES}</style>
        {error && <div className="br-alert" role="alert">{error} <button type="button" className="br-btn" onClick={loadAll}>Try again</button></div>}
        {success && <div className="br-success" role="status">{success}</div>}
        {loading ? <div className="br-loading" aria-label="Loading brand reviews" /> : !hasLoadedOnce ? (
          <div className="br-section-body"><EmptyRow>Brand data could not be loaded. Use Try again above.</EmptyRow></div>
        ) : (
          <>
            <div className="br-intro">
              <div className="br-intro-text">
                <p className="br-eyebrow">Brand governance</p>
                <h2>Review what matters.</h2>
                <p>Ownership, brand changes and access—managed in one place.</p>
              </div>
              <nav className="br-summary" aria-label="Jump to brand review sections">
                <a href="#br-ownership"><span><b>{claims.length}</b><small>Ownership requests</small></span><BadgeCheck aria-hidden="true" /></a>
                <a href="#br-changes"><span><b>{proposals.length}</b><small>Content changes</small></span><FilePenLine aria-hidden="true" /></a>
                <a href="#br-conflicts"><span><b>{conflicts.length}</b><small>Conflicts</small></span><ShieldAlert aria-hidden="true" /></a>
                <a href="#br-access"><span><b>{activeAuthorities.length}</b><small>Active access</small></span><UsersRound aria-hidden="true" /></a>
              </nav>
            </div>

            <section className="br-section" id="br-ownership" aria-labelledby="br-ownership-title" data-tone="blue">
              <SectionHeading id="br-ownership" number="01 / OWNERSHIP" title="Review ownership requests" count={claims.length} />
              <div className="br-section-body">
                {claims.length === 0 ? (
                  <EmptyRow>No ownership requests to review.</EmptyRow>
                ) : (
                  <div className="br-owner-layout">
                    <div className="br-owner-list">
                      <div className="br-list-caption">Choose a request</div>
                      {claims.map((claim) => (
                        <button
                          key={claim.id}
                          type="button"
                          disabled={busy}
                          onClick={() => openClaim(claim.id)}
                          className="br-claim-button"
                          aria-current={selectedClaim?.claim?.id === claim.id ? 'true' : undefined}
                        >
                          <div className="br-claim-header"><strong>{humanize(claim.claimType)}</strong><StatusPill value={claim.status} /></div>
                          <p className="br-caption">Brand: {claim.brandId}</p>
                        </button>
                      ))}
                    </div>
                    <div className="br-detail">
                      {!selectedClaim ? (
                        <EmptyRow>Choose a request to review its evidence.</EmptyRow>
                      ) : (
                        <>
                          <div className="br-detail-heading">
                            <div>
                              <p className="br-kicker">Ownership request</p>
                              <h3>{humanize(selectedClaim.claim?.claimType)}</h3>
                              <p className="br-caption">Brand: {selectedClaim.claim?.brandId}</p>
                            </div>
                            <StatusPill value={selectedClaim.claim?.status} />
                          </div>

                          <p className="br-block-title">Submitted evidence</p>
                          {selectedClaim.evidenceChecks?.length > 0 ? (
                            selectedClaim.evidenceChecks.map((check) => (
                              <div key={check.id} className="br-evidence-row">
                                <div className="br-evidence-content">
                                  <strong>{humanize(check.checkType)}</strong>
                                  <p className="br-caption">{check.evidenceReference || 'No document reference'}</p>
                                  {canVerify && (
                                    <div className="br-row-actions">
                                      {['verified', 'rejected', 'conflict'].map((decision) => (
                                        <button
                                          key={decision}
                                          type="button"
                                          disabled={busy}
                                          onClick={() => execute(
                                            () => reviewAdminBrandIdentityCheck(check.id, { decision, reason }),
                                            decision === 'verified' ? 'Evidence marked as verified.' : decision === 'rejected' ? 'Evidence rejected.' : 'Evidence flagged for conflict review.',
                                          )}
                                          className={`br-btn ${decision === 'rejected' ? 'br-btn-danger' : ''}`}
                                        >{DECISION_LABELS[decision]}</button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <StatusPill value={check.status} />
                              </div>
                            ))
                          ) : <EmptyRow>No evidence attached to this request.</EmptyRow>}

                          <div className="br-review-inputs">
                            <label className="br-field">
                              <span>Decision reason</span>
                              <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a short reason" />
                            </label>
                            {canVerify && <label className="br-field"><span>Approved markets</span><input value={marketCodes} onChange={(event) => setMarketCodes(event.target.value)} placeholder="IN, US" /></label>}
                          </div>

                          {canVerify && (
                            <>
                              <p className="br-block-title">Brand permissions</p>
                              <div className="br-scope-row">
                                {AUTHORITY_SCOPES.map((scope) => (
                                  <label key={scope} className="br-scope-option" data-selected={selectedScopes.includes(scope)}>
                                    <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
                                    {SCOPE_LABELS[scope] || humanize(scope)}
                                  </label>
                                ))}
                              </div>
                              <div className="br-row-actions" style={{ marginTop: 16 }}>
                                <button type="button" className="br-btn br-btn-primary" disabled={busy || selectedScopes.length === 0} onClick={() => execute(
                                  () => approveAdminBrandClaim(selectedClaim.claim.id, {
                                    marketCodes: marketCodes.split(',').map((item) => item.trim()).filter(Boolean),
                                    scopes: selectedScopes,
                                    reason,
                                  }),
                                  'Brand access approved.',
                                )}>Approve brand access</button>
                                <button type="button" className="br-btn br-btn-danger" disabled={busy} onClick={() => execute(
                                  () => rejectAdminBrandClaim(selectedClaim.claim.id, { reason }),
                                  'Brand access request rejected.',
                                )}>Reject request</button>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="br-section" id="br-changes" aria-labelledby="br-changes-title" data-tone="sage">
              <SectionHeading id="br-changes" number="02 / BRAND CONTENT" title="Review content changes" count={proposals.length} />
              <div className="br-section-body">
                {proposals.length === 0 ? <EmptyRow>No content changes waiting.</EmptyRow> : (
                  <>
                    {canReviewContent && reviewableProposals && (
                      <div className="br-note-strip"><label htmlFor="br-change-reason">Decision reason</label><input id="br-change-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
                    )}
                    {proposals.map((proposal) => (
                      <div className="br-flat-row" key={proposal.id}>
                        <div>
                          <strong>{proposal.fieldChanges?.length ? proposal.fieldChanges.map((change) => humanize(change.fieldKey)).join(', ') : 'Brand content update'}</strong>
                          <p className="br-flat-row-meta">Product: {proposal.packId}</p>
                        </div>
                        <StatusPill value={proposal.status} />
                        {canReviewContent && ['submitted', 'in_review'].includes(proposal.status) && (
                          <div className="br-flat-actions">
                            {['approve', 'reject', 'conflict'].map((decision) => (
                              <button
                                key={decision}
                                type="button"
                                disabled={busy}
                                className={`br-btn ${decision === 'approve' ? 'br-btn-primary' : decision === 'reject' ? 'br-btn-danger' : ''}`}
                                onClick={() => execute(
                                  () => reviewAdminBrandOverride(proposal.id, { decision, reason }),
                                  decision === 'approve' ? 'Brand content change approved.' : decision === 'reject' ? 'Brand content change rejected.' : 'Brand content change flagged for conflict review.',
                                )}
                              >{DECISION_LABELS[decision]}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            <div className="br-two-sections">
              <section className="br-section" id="br-conflicts" aria-labelledby="br-conflicts-title" data-tone="peach">
                <SectionHeading id="br-conflicts" number="03 / CONFLICTS" title="Resolve conflicts" count={conflicts.length} />
                <div className="br-section-body">
                  {conflicts.length === 0 ? <EmptyRow>No conflicts need attention.</EmptyRow> : (
                    <>
                      {canVerify && reviewableConflicts && <div className="br-note-strip"><label htmlFor="br-conflict-reason">Decision reason</label><input id="br-conflict-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>}
                      {conflicts.map((conflict) => (
                        <div key={conflict.id} className="br-flat-row">
                          <div>
                            <strong>{humanize(conflict.severity)} priority</strong>
                            <p className="br-flat-row-meta">{conflict.openedReason}</p>
                          </div>
                          <StatusPill value={conflict.status} />
                          {canVerify && ['open', 'in_review'].includes(conflict.status) && (
                            <div className="br-flat-actions">
                              {conflict.proposalIds?.[0] && (
                                <button type="button" disabled={busy} className="br-btn br-btn-primary" onClick={() => execute(
                                  () => resolveAdminBrandConflict(conflict.id, { resolution: 'approve_proposal', selectedProposalId: conflict.proposalIds[0], reason }),
                                  'Conflict resolved using the selected change.',
                                )}>Use selected change</button>
                              )}
                              <button type="button" disabled={busy} className="br-btn br-btn-danger" onClick={() => execute(
                                () => resolveAdminBrandConflict(conflict.id, { resolution: 'quarantine', reason }),
                                'Conflict held for manual review.',
                              )}>Hold for review</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>

              <section className="br-section" id="br-access" aria-labelledby="br-access-title" data-tone="lavender">
                <SectionHeading id="br-access" number="04 / BRAND ACCESS" title="Manage brand access" count={activeAuthorities.length} />
                <div className="br-section-body">
                  {authorities.length === 0 ? <EmptyRow>No active brand access yet.</EmptyRow> : (
                    <>
                      {canVerify && activeAuthorities.length > 0 && <div className="br-note-strip"><label htmlFor="br-access-reason">Decision reason</label><input id="br-access-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>}
                      {authorities.map((authority) => (
                        <div key={authority.id} className="br-flat-row">
                          <div>
                            <strong>{humanize(authority.authorityType)}</strong>
                            <p className="br-flat-row-meta">Brand: {authority.brandId}</p>
                          </div>
                          <StatusPill value={authority.status} />
                          {canVerify && authority.status === 'active' && (
                            <div className="br-flat-actions">
                              {['suspend', 'revoke'].map((action) => (
                                <button key={action} type="button" disabled={busy} className={`br-btn ${action === 'revoke' ? 'br-btn-danger' : ''}`} onClick={() => execute(
                                  () => changeAdminBrandAuthorityLifecycle(authority.id, { action, reason }),
                                  action === 'suspend' ? 'Brand access paused.' : 'Brand access removed.',
                                )}>{DECISION_LABELS[action]}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>
            </div>
            {busy && <div className="br-floating" role="status"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />Saving changes...</div>}
          </>
        )}
      </div>
    </AdminShell>
  )
}

const BRAND_REVIEW_STYLES = String.raw`
#epantry-brand-review .br-heading-mobile{display:none}
#epantry-brand-review{--br-forest:#173f35;--br-deep:#143d33;--br-sage:#dce0cf;--br-porcelain:#f7f6f2;--br-clay:#c86c42;--br-ink:#222b27;--br-muted:#63736a;--br-line:#d9dfd7;color:var(--br-ink);background:var(--br-porcelain);padding:4px 0 28px;min-width:0}
#epantry-brand-review *,#epantry-brand-review *::before,#epantry-brand-review *::after{box-sizing:border-box}
#epantry-brand-review button,#epantry-brand-review input,#epantry-brand-review textarea{font:inherit}
#epantry-brand-review button:focus-visible,#epantry-brand-review a:focus-visible,#epantry-brand-review input:focus-visible,#epantry-brand-review textarea:focus-visible{outline:3px solid #c86c42;outline-offset:2px}
#epantry-brand-review .br-intro{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(380px,.95fr);background:var(--br-forest);border-top:3px solid var(--br-clay);overflow:hidden;border-radius:12px;margin-bottom:26px}
#epantry-brand-review .br-intro-text{padding:24px 28px;color:#f7f6f2;display:flex;flex-direction:column;justify-content:center}
#epantry-brand-review .br-eyebrow{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#dcaf95;margin:0 0 9px}
#epantry-brand-review .br-intro h2{font-size:clamp(23px,2.2vw,32px);line-height:1.15;letter-spacing:-.035em;font-weight:750;color:#f7f6f2;margin:0 0 7px}
#epantry-brand-review .br-intro-text p:last-child{font-size:14px;line-height:1.55;color:#dfebe4;margin:0}
#epantry-brand-review .br-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:#e8eee5;padding:10px;gap:1px}
#epantry-brand-review .br-summary a{min-width:0;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;background:#f1f3ed;text-decoration:none;color:var(--br-forest);transition:background .18s,color .18s}
#epantry-brand-review .br-summary a:hover{background:var(--br-sage)}
#epantry-brand-review .br-summary b{display:block;font-size:28px;line-height:1.05;font-weight:800;font-variant-numeric:tabular-nums}
#epantry-brand-review .br-summary small{display:block;font-size:12px;line-height:1.35;font-weight:700;color:#536a5d;margin-top:3px}
#epantry-brand-review .br-summary svg{width:17px;height:17px;flex:0 0 auto}
#epantry-brand-review .br-section{margin:0 0 26px;scroll-margin-top:95px}
#epantry-brand-review .br-section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:16px 20px;border-top:2px solid var(--br-clay);background:#eaf0f5}
#epantry-brand-review .br-section[data-tone="sage"] .br-section-head{background:#e8eee6;border-top-color:#173f35}
#epantry-brand-review .br-section[data-tone="peach"] .br-section-head{background:#f6e7dd;border-top-color:var(--br-clay)}
#epantry-brand-review .br-section[data-tone="lavender"] .br-section-head{background:#eeeaf4;border-top-color:#6f688d}
#epantry-brand-review .br-section-title{min-width:0}
#epantry-brand-review .br-section-no{display:block;color:#b5603b;font-weight:800;font-size:12px;line-height:1.3;letter-spacing:.025em;text-transform:uppercase;margin-bottom:3px}
#epantry-brand-review .br-section-title h2{font-size:clamp(20px,1.6vw,25px);line-height:1.15;letter-spacing:-.027em;color:var(--br-forest);font-weight:750;margin:0}
#epantry-brand-review .br-section-count{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:7px 11px;background:#fffdfa;color:#173f35;font-size:13px;line-height:1.1;font-weight:750;border:1px solid #d7ded3;border-radius:100px}
#epantry-brand-review .br-section-body{background:#fffefa;border:1px solid #e5e8e1;border-top:0}
#epantry-brand-review .br-owner-layout{display:grid;grid-template-columns:minmax(245px,.42fr) minmax(0,.58fr);align-items:stretch}
#epantry-brand-review .br-owner-list{border-right:1px solid #e0e5df;background:#f3f6f1;max-height:570px;overflow-y:auto;overscroll-behavior:contain}
#epantry-brand-review .br-list-caption{padding:12px 15px;border-bottom:1px solid #dce4da;font-size:13px;font-weight:700;color:#536b5b}
#epantry-brand-review .br-claim-button{display:block;width:100%;border:0;border-bottom:1px solid #dce4da;background:transparent;text-align:left;cursor:pointer;padding:16px;transition:background .18s;position:relative;color:var(--br-ink)}
#epantry-brand-review .br-claim-button:hover{background:#e4ece3}
#epantry-brand-review .br-claim-button[aria-current="true"]{background:#fffaf4;box-shadow:inset 4px 0 0 var(--br-clay)}
#epantry-brand-review .br-claim-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
#epantry-brand-review .br-claim-button strong{display:block;font-size:15px;line-height:1.3;color:var(--br-forest)}
#epantry-brand-review .br-caption{color:var(--br-muted);font-size:13px;line-height:1.5;margin:5px 0 0;overflow-wrap:anywhere}
#epantry-brand-review .br-detail{padding:20px 24px;min-width:0}
#epantry-brand-review .br-detail-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:15px;border-bottom:1px solid var(--br-line)}
#epantry-brand-review .br-detail-heading h3{font-size:20px;line-height:1.2;color:var(--br-forest);font-weight:750;margin:0}
#epantry-brand-review .br-kicker{font-size:12px;line-height:1.3;color:#b95f3c;font-weight:800;letter-spacing:.02em;text-transform:uppercase;margin:0 0 5px}
#epantry-brand-review .br-block-title{font-weight:750;font-size:15px;line-height:1.35;color:var(--br-forest);margin:16px 0 10px}
#epantry-brand-review .br-evidence-row{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;border-top:1px solid var(--br-line);padding:13px 0}
#epantry-brand-review .br-evidence-row strong{font-size:14px;color:var(--br-ink)}
#epantry-brand-review .br-evidence-content{min-width:0;flex:1 1 250px}
#epantry-brand-review .br-row-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:11px}
#epantry-brand-review .br-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #b7c7ba;border-radius:7px;min-height:38px;padding:8px 13px;background:#fffefa;color:var(--br-forest);font-size:13px;font-weight:750;line-height:1.25;cursor:pointer;transition:background .16s,border-color .16s,transform .16s;text-decoration:none}
#epantry-brand-review .br-btn:hover:not(:disabled){background:#e4ece4;border-color:#739481;transform:translateY(-1px)}
#epantry-brand-review .br-btn:disabled{opacity:.53;cursor:not-allowed}
#epantry-brand-review .br-btn-primary{background:var(--br-forest);border-color:var(--br-forest);color:white}
#epantry-brand-review .br-btn-primary:hover:not(:disabled){background:#285d48;color:white}
#epantry-brand-review .br-btn-danger{border-color:#e6bcb5;color:#9c3e32;background:#fff5f2}
#epantry-brand-review .br-btn-danger:hover:not(:disabled){background:#fbe7e3}
#epantry-brand-review .br-btn-clay{border-color:#c86c42;color:#fff;background:#c86c42}
#epantry-brand-review .br-btn-clay:hover:not(:disabled){background:#b85e37;color:#fff}
#epantry-brand-review .br-review-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}
#epantry-brand-review .br-field{display:block;min-width:0}
#epantry-brand-review .br-field span{display:block;margin-bottom:6px;font-size:13px;font-weight:700;color:var(--br-forest)}
#epantry-brand-review .br-field input,#epantry-brand-review .br-field textarea{display:block;width:100%;min-height:42px;padding:10px 12px;border:1px solid #cfd8cd;border-radius:7px;background:white;color:var(--br-ink);font-size:14px;line-height:1.5;resize:vertical}
#epantry-brand-review .br-field textarea{min-height:83px}
#epantry-brand-review .br-scope-row{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0 0}
#epantry-brand-review .br-scope-option{display:inline-flex;align-items:center;gap:7px;cursor:pointer;border:1px solid #d5dfd2;background:#fafbf7;padding:9px 10px;border-radius:7px;font-size:13px;line-height:1.25;color:#355549;font-weight:650}
#epantry-brand-review .br-scope-option[data-selected="true"]{background:#dce9dd;border-color:#87a895}
#epantry-brand-review .br-scope-option input{accent-color:#173f35;width:15px;height:15px}
#epantry-brand-review .br-note-strip{display:flex;align-items:center;gap:12px;padding:12px 19px;border-bottom:1px solid var(--br-line);background:#fbfbf8}
#epantry-brand-review .br-note-strip label{font-size:13px;font-weight:750;color:var(--br-forest);white-space:nowrap}
#epantry-brand-review .br-note-strip input{flex:1;min-width:0;border:1px solid #d5ded5;background:white;border-radius:6px;min-height:38px;padding:7px 11px;font-size:13px;color:var(--br-ink)}
#epantry-brand-review .br-flat-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:17px 20px;border-bottom:1px solid var(--br-line);align-items:start}
#epantry-brand-review .br-flat-row:last-child{border-bottom:0}
#epantry-brand-review .br-flat-row strong{font-size:15px;line-height:1.35;color:var(--br-forest)}
#epantry-brand-review .br-flat-row-meta{font-size:13px;line-height:1.5;color:var(--br-muted);margin:5px 0 0;overflow-wrap:anywhere}
#epantry-brand-review .br-flat-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;margin-top:0}
#epantry-brand-review .br-empty{display:flex;align-items:center;gap:15px;min-height:74px;padding:17px 20px;color:#5a7062;font-size:14px;line-height:1.4;font-weight:600}
#epantry-brand-review .br-empty svg{width:24px;height:24px;flex:0 0 auto;color:#719880}
#epantry-brand-review .br-status{display:inline-flex;align-items:center;border:1px solid #dce3d8;border-radius:100px;background:#edf3ea;color:#335b45;padding:4px 8px;font-size:11px;line-height:1.2;font-weight:800;text-transform:capitalize;white-space:nowrap}
#epantry-brand-review .br-status[data-tone="attention"]{background:#fff1e9;color:#a65336;border-color:#f3ccaf}
#epantry-brand-review .br-status[data-tone="danger"]{background:#fff1ef;color:#9e433a;border-color:#ecc4bd}
#epantry-brand-review .br-status[data-tone="neutral"]{background:#f3f5f1;color:#576960;border-color:#dce3d9}
#epantry-brand-review .br-alert{border-left:4px solid #aa5143;background:#fff1ec;padding:12px 16px;font-size:14px;color:#903e31;line-height:1.5;margin:0 0 15px}
#epantry-brand-review .br-success{border-left:4px solid #21815a;background:#e7f2e9;padding:12px 16px;font-size:14px;color:#22563f;line-height:1.5;margin:0 0 15px}
#epantry-brand-review .br-loading{height:240px;border:1px solid #dbe0d8;background:linear-gradient(110deg,#ecf0e9,#f8f9f5,#ecf0e9);background-size:180% 100%;animation:br-pulse 1.5s ease-in-out infinite}
@keyframes br-pulse{to{background-position:-180% 0}}
#epantry-brand-review .br-floating{position:fixed;right:18px;bottom:18px;z-index:50;padding:12px 16px;border-radius:9px;background:#173f35;color:white;font-size:13px;box-shadow:0 12px 35px #102b2550;display:flex;align-items:center;gap:9px}
#epantry-brand-review .br-two-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:20px}
#epantry-brand-review .br-two-sections .br-flat-row{grid-template-columns:minmax(0,1fr);gap:8px}
#epantry-brand-review .br-two-sections .br-status{justify-self:start}
#epantry-brand-review .br-section-foot{padding:8px 18px;background:#fafbf7;border-top:1px solid #e4e9e1;font-size:12px;color:#63776a}
@media (max-width:950px){#epantry-brand-review .br-intro{grid-template-columns:1fr}#epantry-brand-review .br-owner-layout{grid-template-columns:1fr}#epantry-brand-review .br-owner-list{max-height:255px;border-right:0;border-bottom:1px solid #d9dfd8}#epantry-brand-review .br-two-sections{grid-template-columns:1fr}#epantry-brand-review .br-intro-text{padding:22px}}
@media (max-width:600px){#epantry-brand-review{padding:0 0 18px}#epantry-brand-review .br-intro{margin-bottom:21px;border-radius:8px}#epantry-brand-review .br-intro-text{padding:17px 17px 15px}#epantry-brand-review .br-intro h2{font-size:23px}#epantry-brand-review .br-intro-text p:last-child{font-size:13px}#epantry-brand-review .br-summary{padding:6px}#epantry-brand-review .br-summary a{padding:11px 12px}#epantry-brand-review .br-summary b{font-size:24px}#epantry-brand-review .br-summary small{font-size:12px}#epantry-brand-review .br-section{margin-bottom:22px}#epantry-brand-review .br-section-head{padding:14px 14px}#epantry-brand-review .br-section-title h2{font-size:21px}#epantry-brand-review .br-detail{padding:16px 14px}#epantry-brand-review .br-review-inputs{grid-template-columns:1fr}#epantry-brand-review .br-flat-row{padding:14px}#epantry-brand-review .br-empty{padding:16px 14px}#epantry-brand-review .br-note-strip{padding:12px 14px;flex-direction:column;align-items:stretch;gap:6px}#epantry-brand-review .br-claim-button{padding:13px 14px}}

/* Brand Review mobile presentation only: compact, full-width, and icon-free where decorative. */
@media (max-width:600px){
  /* Only this page: do not change the common Super Admin navigation. */
  main:has(#epantry-brand-review) .page-shell{padding:0 !important}
  main:has(#epantry-brand-review) .page-shell>div{border-radius:0 !important;border-left:0 !important;border-right:0 !important;box-shadow:none !important}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header{padding:11px 15px 13px !important}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header>div:first-child{margin-bottom:9px !important}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header>div:nth-child(2){grid-template-columns:minmax(0,1fr) auto !important;gap:10px !important;align-items:center !important}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header h1{font-size:clamp(22px,5.8vw,26px) !important;line-height:1.15 !important;letter-spacing:-.035em !important;overflow-wrap:normal}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header div:nth-child(2) p{display:none}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header div:nth-child(2) button{min-height:40px !important;padding:8px 11px !important;font-size:13px !important;white-space:nowrap}
  main:has(#epantry-brand-review) .epantry-workspace-canvas>div:last-child{padding:0 !important}
  #epantry-brand-review{padding:0 0 12px;background:#f7f6f2;overflow-x:clip}
  #epantry-brand-review .br-intro{display:block;margin:0 0 15px;border:0;border-top:2px solid var(--br-clay);border-radius:0;overflow:hidden}
  #epantry-brand-review .br-intro-text{padding:19px 18px 18px}
  #epantry-brand-review .br-eyebrow{font-size:12px;line-height:1.25;margin:0 0 8px}
  #epantry-brand-review .br-intro h2{font-size:26px;line-height:1.12;letter-spacing:-.035em;margin:0 0 7px}
  #epantry-brand-review .br-intro-text p:last-child{font-size:14px;line-height:1.48;max-width:33ch}
  #epantry-brand-review .br-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:0;gap:1px;background:#dce3da}
  #epantry-brand-review .br-summary a{min-height:77px;align-items:center;padding:12px 18px;background:#f3f5ef;gap:0}
  #epantry-brand-review .br-summary a:hover{background:#e7eee5}
  #epantry-brand-review .br-summary b{font-size:26px;line-height:1;font-weight:800}
  #epantry-brand-review .br-summary small{font-size:13px;line-height:1.28;margin-top:5px;font-weight:650}
  /* Summary symbols and empty-state inbox images carry no information. */
  #epantry-brand-review .br-summary svg,#epantry-brand-review .br-empty svg{display:none !important}
  #epantry-brand-review .br-section{margin:0;border-bottom:1px solid #e0e4dd;scroll-margin-top:78px}
  #epantry-brand-review .br-two-sections{display:grid;grid-template-columns:1fr;gap:0}
  #epantry-brand-review .br-section-head{padding:16px 18px 15px;gap:12px;align-items:center;min-height:0}
  #epantry-brand-review .br-section-no{font-size:12px;line-height:1.25;margin-bottom:6px;letter-spacing:.015em}
  #epantry-brand-review .br-section-title h2{font-size:23px;line-height:1.16;letter-spacing:-.025em;overflow-wrap:normal}
  #epantry-brand-review .br-heading-desktop{display:none}
  #epantry-brand-review .br-heading-mobile{display:inline}
  #epantry-brand-review .br-section-count{min-width:38px;min-height:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;padding:3px 9px;border:1px solid #d7dfd5;border-radius:9px;background:#fffefa;font-size:14px;line-height:1;font-weight:750;flex-shrink:0}
  #epantry-brand-review .br-section-body{min-width:0;background:#fffefa;border:0}
  #epantry-brand-review .br-empty{display:block;min-height:0;padding:16px 18px 18px;font-size:14px;line-height:1.5;font-weight:600;color:#4f695c}
  #epantry-brand-review .br-owner-list{max-height:235px;border-right:0;border-bottom:1px solid #d9dfd8}
  #epantry-brand-review .br-claim-button{min-height:56px;padding:13px 18px}
  #epantry-brand-review .br-claim-header{gap:8px;align-items:flex-start}
  #epantry-brand-review .br-detail{padding:17px 18px}
  #epantry-brand-review .br-detail-heading h3{font-size:19px;line-height:1.25}
  #epantry-brand-review .br-caption{font-size:13px;line-height:1.45}
  #epantry-brand-review .br-review-inputs{grid-template-columns:1fr;gap:12px}
  #epantry-brand-review .br-field input,#epantry-brand-review .br-field textarea{font-size:15px;min-height:46px}
  #epantry-brand-review .br-scope-row{gap:8px}
  #epantry-brand-review .br-scope-option{font-size:13px;padding:10px;min-height:44px}
  #epantry-brand-review .br-btn{min-height:44px;font-size:14px;padding:9px 12px}
  #epantry-brand-review .br-flat-row{padding:15px 18px;gap:10px}
  #epantry-brand-review .br-flat-row strong{font-size:15px}
  #epantry-brand-review .br-flat-row-meta{font-size:13px}
  #epantry-brand-review .br-note-strip{padding:12px 18px;flex-direction:column;align-items:stretch;gap:8px}
  #epantry-brand-review .br-note-strip input{min-height:44px;font-size:14px}
  #epantry-brand-review .br-row-actions,#epantry-brand-review .br-flat-actions{gap:8px}
  #epantry-brand-review .br-status{font-size:12px}
  #epantry-brand-review .br-section-foot{padding:10px 18px;font-size:13px}
}
@media (max-width:350px){
  main:has(#epantry-brand-review) .epantry-workspace-canvas>header h1{font-size:21px !important}
  #epantry-brand-review .br-intro h2{font-size:24px}
  #epantry-brand-review .br-summary a{padding:11px 13px}
  #epantry-brand-review .br-section-title h2{font-size:21px}
  #epantry-brand-review .br-section-head{padding:15px 14px}
}


`
