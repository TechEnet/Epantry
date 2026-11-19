import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../../api/apiClient'

const unwrap = response => response?.data?.data || response?.data || {}
const errText = error => error?.response?.data?.message || error?.message || 'Something went wrong.'
const textInput = 'w-full rounded-lg border border-[#c5d5ca] bg-white p-3 text-[15px] text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#ac613f]'

export default function HostDsaNoticesPage() {
  const [reports, setReports] = useState([])
  const [traderProfile, setTraderProfile] = useState(null)
  const [documents, setDocuments] = useState([])
  const [traderError, setTraderError] = useState('')
  const [traderForm, setTraderForm] = useState({ legalName:'', postalAddress:'', contactEmail:'', contactPhone:'',
    businessRegister:'', registrationNumber:'', registrationEvidenceDocumentId:'', paymentEvidenceDocumentId:'', selfCertification:false })
  const [open, setOpen] = useState(null)
  const [appeal, setAppeal] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try { setReports(unwrap(await apiClient.get('/dsa/host/reports')).reports || []) }
    catch (e) { setError(errText(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    let live = true
    Promise.all([apiClient.get('/dsa/host/trader-profile'), apiClient.get('/host/operations/documents')])
      .then(([profile, docs]) => {
        if (!live) return
        const current = unwrap(profile).profile || null
        setTraderProfile(current)
        if (current) setTraderForm(state => ({ ...state, ...Object.fromEntries(
          Object.keys(state).filter(key => key in current).map(key => [key, current[key]])
        ) }))
        setDocuments((unwrap(docs).documents || []).filter(doc => doc.status === 'accepted' &&
          (!doc.expiresAt || new Date(doc.expiresAt) > new Date())))
      }).catch(error => { if (live) setTraderError(errText(error)) })
    return () => { live = false }
  }, [])
  const setTraderField = (key, value) => setTraderForm(old => ({ ...old, [key]: value }))
  async function submitTrader(event) {
    event.preventDefault(); setBusy(true); setTraderError(''); setMessage('')
    try {
      const csrf = unwrap(await apiClient.get('/auth/csrf')).csrfToken
      if (!csrf) throw new Error('Could not verify the secure session.')
      const response = await apiClient.post('/dsa/host/trader-profile', traderForm, { headers: { 'x-csrf-token': csrf } })
      setTraderProfile(unwrap(response).profile)
      setMessage('EU trader declaration submitted for Super Admin review.')
    } catch (error) { setTraderError(errText(error)) }
    finally { setBusy(false) }
  }
  async function submit(item) {
    if (appeal.trim().length < 30) return
    setBusy(true); setError(''); setMessage('')
    try {
      const csrf = unwrap(await apiClient.get('/auth/csrf')).csrfToken
      if (!csrf) throw new Error('Could not confirm your secure session.')
      await apiClient.post(`/dsa/host/reports/${encodeURIComponent(item.reference)}/appeal`,
        { reason: appeal.trim() }, { headers: { 'x-csrf-token': csrf } })
      setMessage('Your appeal has been submitted for an independent review.')
      setAppeal(''); setOpen(null); await refresh()
    } catch (e) { setError(errText(e)) }
    finally { setBusy(false) }
  }
  return <main className="min-w-0 bg-[#f7f6f1] text-[#173f35]">
    <header className="border-b border-[#d6dfd6] pb-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#a85f3e]">Host / Trust &amp; Safety</p>
      <h1 className="mt-2 text-3xl font-extrabold">My listing notices</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-[#53665c]">Review restrictions affecting your listings. Appeals are checked by an independent Super Admin reviewer.</p>
      <button onClick={refresh} type="button" className="mt-4 rounded-lg border border-[#173f35] px-4 py-2 text-sm font-semibold">Refresh notices</button>
    </header>
    <section className="my-6 border-b border-[#d6dfd6] pb-6" aria-labelledby="eu-trader-title">
      <h2 id="eu-trader-title" className="text-xl font-bold">EU trader verification</h2>
      <p className="mt-1 text-sm text-[#53665c]">Uses your existing approved Business KYB and reviewed documents. Never upload banking details here; select an accepted proof record.</p>
      {traderError && <p role="alert" className="my-3 bg-red-50 p-3 text-sm text-red-900">{traderError}</p>}
      {traderProfile?.status === 'verified' ? <p className="mt-3 bg-[#e4f1e6] p-3 font-semibold">Verified. Details are locked; contact Trust &amp; Safety if your trader information changes.</p>
        : <form onSubmit={submitTrader} className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
        {[['legalName','Legal business name'],['postalAddress','Registered postal address'],['contactEmail','Business email'],
          ['contactPhone','Business phone'],['businessRegister','Business register'],['registrationNumber','Registration number']].map(([key,label]) =>
          <label key={key} className="text-sm font-semibold">{label}<input required type={key === 'contactEmail' ? 'email' : 'text'}
            minLength={key === 'postalAddress' ? 15 : 2} value={traderForm[key]} onChange={e => setTraderField(key,e.target.value)} className={`${textInput} mt-1`}/></label>)}
        {[['registrationEvidenceDocumentId','Registration / identity evidence',['incorporation','tax_registration','identity']],
          ['paymentEvidenceDocumentId','Payment-account evidence',['bank_proof']]].map(([key,label,types]) =>
          <label key={key} className="text-sm font-semibold">{label}<select required className={`${textInput} mt-1`} value={traderForm[key]}
            onChange={e => setTraderField(key,e.target.value)}><option value="">Select accepted document</option>
            {documents.filter(doc => types.includes(doc.documentType)).map(doc =>
              <option value={doc.id} key={doc.id}>{doc.label || doc.documentType}</option>)}</select></label>)}
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" required className="mt-1"
          checked={traderForm.selfCertification} onChange={e => setTraderField('selfCertification',e.target.checked)}/>
          I confirm this trader information is accurate and I offer only products and services compliant with applicable law.</label>
        <div className="sm:col-span-2"><button type="submit" disabled={busy} className="rounded-lg bg-[#173f35] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Submit for verification'}</button>
          {traderProfile && <p className="mt-2 text-sm">Current status: <strong>{traderProfile.status}</strong> {traderProfile.reviewReason && `· ${traderProfile.reviewReason}`}</p>}
          <p className="mt-2 text-sm text-[#53665c]">Missing accepted documents? <Link to="/host/operations-center" className="underline">Manage business documents</Link>.</p>
        </div></form>}
    </section>
    {error && <p role="alert" className="my-3 rounded-lg bg-[#fff0ec] p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="my-3 rounded-lg bg-[#e4f1e6] p-3">{message}</p>}
    {loading ? <p className="py-8">Loading notices…</p> : reports.length === 0 ? <p className="py-8 text-[#53665c]">No listing restrictions recorded for this Host account.</p> :
      <div className="divide-y divide-[#dce5dc]">{reports.map(item => <section key={item.reference} className="py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><strong className="break-all text-lg">{item.reference}</strong>
            <p className="mt-1 text-sm text-[#526b60]">{item.enforcementStatus?.replaceAll('_', ' ')} · {item.status?.replaceAll('_', ' ')}</p></div>
          <Link className="text-sm font-semibold underline" to="/host/listings">View my listings</Link>
        </div>
        <p className="mt-3 text-sm"><strong>Decision reason:</strong> {item.decisionReason}</p>
        {item.appealDecisionReason && <p className="mt-2 text-sm"><strong>Appeal response:</strong> {item.appealDecisionReason}</p>}
        {item.enforcementStatus === 'restricted' && item.status === 'decision_issued' &&
          <div className="mt-4"><button className="rounded-lg bg-[#173f35] px-4 py-2.5 text-sm font-bold text-white" type="button" onClick={() => {setOpen(open === item.reference ? null : item.reference); setAppeal('')}}>Appeal restriction</button>
            {open === item.reference && <form className="mt-3 max-w-xl space-y-3" onSubmit={event => {event.preventDefault(); submit(item)}}>
              <label className="block text-sm font-bold">Explain why this decision should be reconsidered<textarea required minLength={30} maxLength={2200} rows={5} value={appeal} onChange={e => setAppeal(e.target.value)} className={`${textInput} mt-2`}/></label>
              <button disabled={busy || appeal.trim().length < 30} type="submit" className="rounded-lg bg-[#173f35] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit appeal'}</button>
            </form>}
          </div>}
      </section>)}</div>}
  </main>
}
