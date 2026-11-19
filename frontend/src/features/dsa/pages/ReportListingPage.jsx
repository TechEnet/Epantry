import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCopy, ShieldAlert } from 'lucide-react'
import { apiClient } from '../../../api/apiClient'

const REASONS = [
  ['illegal_product', 'Illegal or prohibited product'], ['unsafe_food', 'Food safety or allergen concern'],
  ['misleading_claim', 'False or misleading claim'], ['counterfeit', 'Counterfeit or unauthorized item'],
  ['fraud', 'Fraud or impersonation'], ['privacy_concern', 'Privacy concern'], ['other', 'Other legal concern'],
]
const unwrap = response => response?.data?.data || response?.data || {}
const field = 'w-full rounded-xl border border-[#ced9cd] bg-white px-4 py-3 text-[15px] text-[#193c31] outline-none focus:border-[#0f5132] focus:ring-2 focus:ring-[#b7dec5]'
const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#173f35] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#235847] disabled:cursor-not-allowed disabled:opacity-50'

export default function ReportListingPage() {
  const [params] = useSearchParams()
  const [view, setView] = useState('report')
  const [url, setUrl] = useState(params.get('listingUrl') || '')
  const [reason, setReason] = useState('unsafe_food')
  const [description, setDescription] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [email, setEmail] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [reference, setReference] = useState('')
  const [key, setKey] = useState('')
  const [appeal, setAppeal] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const message = err => err?.response?.data?.message || err?.message || 'Unable to complete the request.'
  const task = async (handler) => { setError(''); setBusy(true); try { await handler() } catch (err) { setError(message(err)) } finally { setBusy(false) } }
  const submit = event => { event.preventDefault(); task(async () => {
    const result = unwrap(await apiClient.post('/dsa/reports', {
      listingUrl: url.trim(), reason, explanation: description.trim(), evidenceUrl: evidenceUrl.trim(),
      reporterContact: email.trim(), statementOfGoodFaith: goodFaith,
    }))
    setReceipt(result); setReference(result.reference); setKey(result.accessToken); setStatus(result)
  }) }
  const check = event => { event.preventDefault(); task(async () => {
    const result = unwrap(await apiClient.post('/dsa/reports/status', { reference: reference.trim(), accessToken: key.trim() }))
    setStatus(result)
  }) }
  const submitAppeal = event => { event.preventDefault(); task(async () => {
    const result = unwrap(await apiClient.post('/dsa/reports/appeals', {
      reference: reference.trim(), accessToken: key.trim(), reason: appeal.trim(),
    }))
    setStatus(result); setAppeal('')
  }) }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 pb-20 pt-8 text-[#193c31] sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-[1120px]">
        <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3c6555] hover:underline"><ArrowLeft size={16}/> About EPANTRY</Link>
        <div className="mt-7 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <header className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b35e38]">Marketplace safety</p>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-.045em] sm:text-5xl">Report a concern.</h1>
            <p className="max-w-md text-base leading-7 text-[#4c6358]">Flag a listing or claim for review. No account required.</p>
            <div className="rounded-[18px] bg-[#e7f0e7] p-5 text-sm leading-6">
              <ShieldAlert size={23} className="mb-3" aria-hidden="true" />
              <strong>What happens next?</strong>
              <p className="mt-1 text-[#49685a]">Our review team checks the report and records its decision. A report alone does not remove a listing. Keep your private access key to check progress.</p>
            </div>
            <Link to="/grocery" className="inline-flex items-center gap-2 text-sm font-bold hover:underline">Browse grocery <ArrowRight size={16}/></Link>
          </header>
          <section className="overflow-hidden rounded-[22px] border border-[#dce5da] bg-white shadow-[0_16px_35px_rgba(20,50,30,.06)]">
            <div className="flex gap-1 border-b border-[#e2e8df] p-3" aria-label="Report tools">
              {[['report','New report'],['track','Track / appeal']].map(([id,label]) => (
                <button key={id} type="button" onClick={() => { setView(id); setError('') }} aria-pressed={view === id} className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold ${view === id ? 'bg-[#173f35] text-white' : 'hover:bg-[#eff4ee]'}`}>{label}</button>
              ))}
            </div>
            <div className="p-5 sm:p-8">
              {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              {view === 'report' && (receipt ? (
                <div className="space-y-5">
                  <CheckCircle2 className="text-[#14754c]" size={34} aria-hidden="true"/>
                  <h2 className="text-2xl font-bold">Report received</h2>
                  <p className="text-sm text-[#52675a]">Save both values now. The private access key will not be displayed again after you leave.</p>
                  {[["Reference",receipt.reference],["Private access key",receipt.accessToken]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#edf4ec] p-3"><p className="text-xs font-bold uppercase tracking-wide">{label}</p><div className="mt-2 flex items-center gap-3"><code className="min-w-0 flex-1 break-all text-sm">{value}</code><button type="button" aria-label={`Copy ${label}`} onClick={() => navigator.clipboard?.writeText(value)} className="rounded-lg p-2 hover:bg-white"><ClipboardCopy size={18}/></button></div></div>)}
                  <button type="button" className={btn} onClick={() => { setView('track'); setReceipt(null) }}>Track your report <ArrowRight size={16}/></button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <h2 className="text-xl font-bold">New report</h2>
                  <label className="block text-sm font-semibold">Listing URL or product path <input className={`${field} mt-2`} value={url} onChange={e => setUrl(e.target.value)} required maxLength={1000} placeholder="/grocery/product/..." /></label>
                  <label className="block text-sm font-semibold">Reason <select className={`${field} mt-2`} value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="block text-sm font-semibold">What is wrong? <textarea className={`${field} mt-2 min-h-[116px] resize-y`} minLength={25} maxLength={3000} required value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the claim, product or concern and why it may be unlawful." /></label>
                  <label className="block text-sm font-semibold">Evidence URL <span className="font-normal text-[#5a7062]">(optional)</span><input type="url" className={`${field} mt-2`} value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="https://..." /></label>
                  <label className="block text-sm font-semibold">Contact email <span className="font-normal text-[#5a7062]">(optional)</span><input type="email" className={`${field} mt-2`} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
                  <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={goodFaith} onChange={e => setGoodFaith(e.target.checked)} required className="mt-1.5 accent-[#0f5132]"/><span>I believe this report is accurate and submitted in good faith.</span></label>
                  <button type="submit" disabled={busy} className={`${btn} w-full`}>{busy ? 'Sending...' : 'Submit report'} <ArrowRight size={16}/></button>
                </form>
              ))}
              {view === 'track' && <div className="space-y-5">
                <h2 className="text-xl font-bold">Track a report</h2>
                <form onSubmit={check} className="space-y-4">
                  <label className="block text-sm font-semibold">Reference<input className={`${field} mt-2`} value={reference} onChange={e => setReference(e.target.value)} required placeholder="DSA-..." /></label>
                  <label className="block text-sm font-semibold">Private access key<input className={`${field} mt-2`} value={key} onChange={e => setKey(e.target.value)} type="password" required autoComplete="off" /></label>
                  <button className={btn} disabled={busy} type="submit">Check status</button>
                </form>
                {status && <div className="space-y-3 border-t border-[#dce5da] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><strong>{status.reference}</strong><span className="rounded-full bg-[#e3eee4] px-3 py-1 text-xs font-bold">{String(status.status || '').replaceAll('_',' ')}</span></div>
                  {status.decisionReason && <p className="text-sm leading-6">Decision: {status.decisionReason}</p>}
                  {status.appealDecisionReason && <p className="text-sm leading-6">Appeal response: {status.appealDecisionReason}</p>}
                  {status.status === 'decision_issued' && <form onSubmit={submitAppeal} className="space-y-3 rounded-xl bg-[#f5f0eb] p-4">
                    <h3 className="font-bold">Appeal this decision</h3><textarea className={`${field} min-h-[100px]`} value={appeal} minLength={25} maxLength={2200} required onChange={e => setAppeal(e.target.value)} placeholder="Explain why the decision should be reconsidered." />
                    <button className={btn} disabled={busy} type="submit">Submit appeal</button>
                  </form>}
                </div>}
              </div>}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
