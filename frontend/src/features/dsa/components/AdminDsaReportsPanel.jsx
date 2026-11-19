import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../../api/apiClient'

const input = 'w-full rounded-xl border border-[#cbdcd2] bg-white px-3 py-2.5 text-sm text-[#193c31] focus:outline-none focus:ring-2 focus:ring-emerald-300'
const button = 'rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50'
const unwrap = r => r?.data?.data || r?.data || {}
const message = error => error?.response?.data?.message || error?.message || 'Unable to complete action.'
async function mutate(url, body, method = 'patch') {
  const response = await apiClient.get('/auth/csrf')
  const token = unwrap(response).csrfToken
  if (!token) throw new Error('Could not load CSRF protection.')
  return unwrap(await apiClient.request({ method, url, data: body, headers: { 'x-csrf-token': token } }))
}
export default function AdminDsaReportsPanel({ canDecide }) {
  const [records, setRecords] = useState([])
  const [traders, setTraders] = useState([])
  const [traderReason, setTraderReason] = useState({})
  const [selected, setSelected] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState('no_violation_found')
  const [caseReference, setCaseReference] = useState('')
  const [appealDecision, setAppealDecision] = useState('upheld')
  const [listingId, setListingId] = useState('')
  const [enforcementReason, setEnforcementReason] = useState('')
  const load = useCallback(async (nextPage = 1) => {
    setError(''); setLoading(true)
    try {
      const data = unwrap(await apiClient.get('/dsa/admin/reports', { params: { page: nextPage, limit: 20 } }))
      setRecords(data.items || []); setPage(nextPage); setTotal(data.total || 0)
      setSelected(old => (data.items || []).find(item => item.reference === old?.reference) || null)
    } catch (err) { setError(message(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(1) }, [load])
  const loadTraders = useCallback(async () => {
    try { setTraders(unwrap(await apiClient.get('/dsa/admin/traders')).profiles || []) }
    catch (error) { setError(message(error)) }
  }, [])
  useEffect(() => { loadTraders() }, [loadTraders])
  async function decideTrader(id, decision) {
    setBusy(true); setError(''); setNotice('')
    try {
      await mutate(`/dsa/admin/traders/${encodeURIComponent(id)}/decision`, { decision, reason: traderReason[id] || '' })
      setNotice('Trader decision recorded.'); await loadTraders()
    } catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  async function act(url, body, method = 'patch') {
    setBusy(true); setNotice(''); setError('')
    try { await mutate(url, body, method); setNotice('Saved. Refresh the queue to see updated status.'); await load(page) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  const select = report => {
    setSelected(report); setNotes(report.reviewNotes || ''); setReason('')
    setCaseReference(''); setOutcome('no_violation_found')
    setListingId(report.enforcementListingId || ''); setEnforcementReason('')
  }
  return <section aria-labelledby="dsa-reports-title" className="rounded-[20px] border border-[#dce6da] bg-[#f6f8f3] p-4 sm:p-6">
    <div className="border-b border-[#d7e2d6] pb-5">
      <h2 className="text-xl font-bold text-[#173f35]">EU trader traceability</h2>
      <p className="mt-1 text-sm text-[#52675b]">Verify existing approved KYB, legal contact and accepted registration/payment documents before authorizing EU sales.</p>
      {traders.length === 0 ? <p className="mt-3 text-sm text-[#647268]">No pending trader declarations.</p> : <div className="mt-3 divide-y divide-[#dce6da]">{traders.map(trader =>
        <div key={trader.id} className="space-y-2 py-3 text-sm"><p><strong>{trader.legalName}</strong> · {trader.contactEmail}</p>
          <p className="break-words text-[#52675b]">{trader.postalAddress} · {trader.contactPhone}</p>
          <p className="text-xs">Register: {trader.businessRegister} / {trader.registrationNumber}</p>
          {canDecide && <><textarea aria-label={`Review evidence for ${trader.legalName}`} className={input} rows={2}
            placeholder="Review reason and evidence (30+ characters)" value={traderReason[trader.id] || ''}
            onChange={e => setTraderReason(old => ({ ...old, [trader.id]: e.target.value }))}/>
            <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || (traderReason[trader.id] || '').trim().length < 30}
              onClick={() => decideTrader(trader.id,'verified')}>Verify trader</button>
              <button type="button" className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50" disabled={busy || (traderReason[trader.id] || '').trim().length < 30}
                onClick={() => decideTrader(trader.id,'rejected')}>Request corrections</button></div></>}
        </div>)}</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7e2d6] pb-4">
      <div><h2 id="dsa-reports-title" className="text-xl font-bold text-[#173f35]">Public listing reports</h2><p className="text-sm text-[#52675b]">Notice, review, decision and appeal records</p></div>
      <button type="button" onClick={() => load(1)} className={button} disabled={loading}>Refresh</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-[#2a654e]">
      <Link to="/admin/host-operations" className="underline">Review existing Host KYB records</Link>
      <Link to="/admin/host-listings" className="underline">Listing governance</Link>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-2">
        {loading && <p className="text-sm">Loading reports...</p>}
        {!loading && records.length === 0 && <p className="text-sm">No public listing reports found.</p>}
        {records.map(item => <button key={item.reference} type="button" onClick={() => select(item)} className={`block w-full rounded-xl border px-4 py-3 text-left text-sm ${selected?.reference === item.reference ? 'border-[#3b8b64] bg-[#e0efdf]' : 'border-[#dce6da] bg-white hover:bg-[#eef6ee]'}`}>
          <span className="block break-all font-bold">{item.reference}</span><span className="mt-1 block text-xs">{item.reason.replaceAll('_',' ')} · {item.status.replaceAll('_',' ')}</span><span className="mt-1 block truncate text-xs text-[#607468]">{item.listingUrl}</span>
        </button>)}
        <div className="flex items-center gap-3 pt-3 text-xs"><button type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="disabled:opacity-40">Previous</button><span>{page} · {total} total</span><button type="button" disabled={page * 20 >= total || loading} onClick={() => load(page + 1)} className="disabled:opacity-40">Next</button></div>
      </div>
      <div className="min-w-0 rounded-xl bg-white p-4 sm:p-5">
        {!selected ? <p className="text-sm text-[#637368]">Select a report to review.</p> : <div className="space-y-4 text-sm">
          <div><strong className="block break-all">{selected.reference}</strong><a href={selected.listingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-[#187450] underline">{selected.listingUrl}</a></div>
          <p className="whitespace-pre-wrap break-words">{selected.explanation}</p>
          {selected.evidenceUrl && <a href={selected.evidenceUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-[#187450] underline">Review supplied evidence link</a>}
          <p className="text-[#4b6858]">Reporter: {selected.reporterContact || 'No email supplied'} · Good-faith statement: {selected.statementOfGoodFaith ? 'Yes' : 'No'}</p>
          {selected.reporterContact && selected.decisionAt && <div className="border-t border-[#dae5d9] pt-3">
            <strong>Reporter notice delivery</strong>
            <p className="mt-1 text-xs">Decision email: {selected.reporterDecisionNotice?.status?.replaceAll('_',' ') || 'not requested'}
              {selected.reporterDecisionNotice?.errorCode && ` (${selected.reporterDecisionNotice.errorCode})`}</p>
            {canDecide && selected.reporterDecisionNotice?.status !== 'provider_accepted' &&
              <button type="button" className={`${button} mt-2`} disabled={busy}
                onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/retry-notice`, { phase: 'decision' }, 'post')}>Retry decision notice</button>}
            {selected.appealDecisionReason && <><p className="mt-2 text-xs">Appeal email: {selected.reporterAppealNotice?.status?.replaceAll('_',' ') || 'not requested'}
              {selected.reporterAppealNotice?.errorCode && ` (${selected.reporterAppealNotice.errorCode})`}</p>
              {canDecide && selected.reporterAppealNotice?.status !== 'provider_accepted' &&
                <button type="button" className={`${button} mt-2`} disabled={busy}
                  onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/retry-notice`, { phase: 'appeal' }, 'post')}>Retry appeal notice</button>}</>}
          </div>}
          {selected.appealReason && <p className="rounded-xl bg-[#fff0e4] p-3"><strong>Reporter appeal:</strong> {selected.appealReason}</p>}
          {selected.sellerAppealReason && <p className="rounded-xl bg-[#fff0e4] p-3"><strong>Seller appeal:</strong> {selected.sellerAppealReason}</p>}
          {selected.enforcementStatus === 'restricted' && <p role="status" className="rounded-xl bg-red-50 p-3 text-red-900"><strong>Live restriction:</strong> Public Host listing is hidden and its selling offers are paused.</p>}
          {selected.enforcementStatus === 'lifted' && <p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-900">Restriction lifted. Paused offers require separate governance review before resuming.</p>}
          {!!selected.decisionReason && <p className="rounded-xl bg-[#edf3ec] p-3"><strong>Decision:</strong> {selected.decisionReason} {selected.enforcementReference ? `(${selected.enforcementReference})` : ''}</p>}
          {!canDecide && <p>Read-only: Trust &amp; Safety edit permission required.</p>}
          {canDecide && ['submitted','under_review'].includes(selected.status) && <div className="space-y-3 border-t pt-4">
            <label className="block font-semibold">Review notes <textarea className={`${input} mt-2 min-h-20`} value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000}/></label>
            <button className={button} type="button" disabled={busy || notes.trim().length < 12} onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/review`, { notes })}>Save review</button>
            <label className="block font-semibold">Outcome<select className={`${input} mt-2`} value={outcome} onChange={e => setOutcome(e.target.value)}><option value="no_violation_found">No violation found</option><option value="referred_for_listing_review">Escalate to listing governance</option><option value="referred_for_seller_review">Escalate to seller verification</option><option value="referred_to_authority">Refer to relevant authority</option></select></label>
            {outcome !== 'no_violation_found' && <label className="block font-semibold">Governance case / enforcement reference<input className={`${input} mt-2`} value={caseReference} onChange={e => setCaseReference(e.target.value)} maxLength={300} /></label>}
            <label className="block font-semibold">Decision reasons<textarea className={`${input} mt-2 min-h-24`} value={reason} onChange={e => setReason(e.target.value)} maxLength={2200} /></label>
            <p className="text-xs text-[#6b5f52]">Escalation alone does not restrict an item. After issuing a reasoned decision, use Actual listing enforcement below; it records a restriction and attempts an in-app seller notification.</p>
            <button className={button} type="button" disabled={busy || reason.trim().length < 30 || (outcome !== 'no_violation_found' && !caseReference.trim())} onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/decision`, { outcome, reason, enforcementReference: caseReference.trim() })}>Issue reasoned decision</button>
          </div>}
          {canDecide && ['decision_issued', 'appeal_decided'].includes(selected.status) && selected.outcome === 'referred_for_listing_review' && <div className="space-y-3 border-t pt-4">
            <h3 className="font-bold text-[#173f35]">Actual listing enforcement</h3>
            <p className="text-xs text-[#6b5f52]">Only use the precise Host listing ID whose public URL matches this report. Other catalog listings require existing catalog governance.</p>
            <label className="block font-semibold">Host listing ID <input className={`${input} mt-2`} value={listingId} onChange={e => setListingId(e.target.value.trim())} placeholder="24-character ObjectId" maxLength={24}/></label>
            <label className="block font-semibold">Reason and evidence <textarea className={`${input} mt-2 min-h-24`} value={enforcementReason} onChange={e => setEnforcementReason(e.target.value)} maxLength={2200}/></label>
            <div className="flex flex-wrap gap-2">
              {selected.enforcementStatus !== 'restricted' && selected.enforcementStatus !== 'lifted' && <button className={button} type="button" disabled={busy || !/^[0-9a-f]{24}$/i.test(listingId) || enforcementReason.trim().length < 30} onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/restrict`, { listingId, reason: enforcementReason })}>Restrict listing + pause offers</button>}
              {selected.enforcementStatus === 'restricted' && <button className={button} type="button" disabled={busy || !/^[0-9a-f]{24}$/i.test(listingId) || enforcementReason.trim().length < 30} onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/lift`, { listingId, reason: enforcementReason })}>Lift restriction (offers stay paused)</button>}
            </div>
          </div>}
          {canDecide && selected.status === 'appeal_pending' && <div className="space-y-3 border-t pt-4">
            <label className="block font-semibold">Appeal outcome<select className={`${input} mt-2`} value={appealDecision} onChange={e => setAppealDecision(e.target.value)}><option value="upheld">Uphold initial decision</option><option value="reopened">Reopen review</option></select></label>
            <label className="block font-semibold">Independent review reason<textarea className={`${input} mt-2 min-h-24`} value={reason} onChange={e => setReason(e.target.value)} maxLength={2200}/></label>
            <button className={button} type="button" disabled={busy || reason.trim().length < 30} onClick={() => act(`/dsa/admin/reports/${encodeURIComponent(selected.reference)}/appeal-decision`, { decision: appealDecision, reason })}>Record appeal outcome</button>
          </div>}
          {selected.timeline?.length > 0 && <details><summary className="cursor-pointer font-semibold">Audit timeline</summary><ol className="mt-2 space-y-2 border-l pl-3 text-xs">{selected.timeline.map((entry, i) => <li key={`${entry.event}-${i}`}><strong>{entry.event.replaceAll('_',' ')}</strong> · {entry.at && new Date(entry.at).toLocaleString()}<p>{entry.note}</p></li>)}</ol></details>}
        </div>}
      </div>
    </div>
  </section>
}
