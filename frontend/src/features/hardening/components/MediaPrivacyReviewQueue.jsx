import { Check, ChevronDown, ExternalLink, ImageOff, RefreshCw, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getMediaPrivacyErrorMessage,
  listAdminMediaPrivacyReviews,
  resolveAdminMediaPrivacyReview,
} from '../../mediaPrivacy/services/mediaPrivacy.service'

function words(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

const decisionsList = [
  ['safe_to_use', 'Safe to use'],
  ['redaction_required', 'Hide personal details'],
  ['reupload_required', 'Request new photo'],
  ['delete_media', 'Remove image'],
]

function EvidenceImage({ source, alt, large = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [source])
  return (
    <div className={`pp-image-frame ${large ? 'pp-image-frame-large' : ''}`}>
      {source && !failed
        ? <img src={source} alt={alt} loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
        : <span className="pp-image-missing"><ImageOff aria-hidden="true" size={large ? 36 : 24} /> <span>Preview unavailable</span></span>}
    </div>
  )
}

export default function MediaPrivacyReviewQueue() {
  const [filter, setFilter] = useState('open')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [decisions, setDecisions] = useState({})
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const sequenceRef = useRef(0)
  const listRef = useRef(null)
  const lastPageRef = useRef(1)
  const totalPagesRef = useRef(1)
  const loadingMoreRef = useRef(false)
  const detailsRef = useRef(null)

  const load = useCallback(async () => {
    const sequence = ++sequenceRef.current
    lastPageRef.current = 1
    totalPagesRef.current = 1
    loadingMoreRef.current = false
    setLoading(true)
    setLoadingMore(false)
    setMoreError('')
    setError('')
    if (listRef.current) listRef.current.scrollTop = 0
    try {
      const response = await listAdminMediaPrivacyReviews({ status: filter, page: 1, limit: 30 })
      if (!Array.isArray(response?.reviewCases)) throw new Error('The image review response was incomplete.')
      if (sequence !== sequenceRef.current) return
      const loaded = response.reviewCases
      const count = Math.max(loaded.length, Number(response?.pagination?.total) || 0)
      const pageCount = Number(response?.pagination?.totalPages)
      totalPagesRef.current = Number.isFinite(pageCount) && pageCount > 0
        ? Math.ceil(pageCount) : Math.max(1, Math.ceil(count / 30))
      setItems(loaded)
      setTotal(count)
      setSelectedId((previous) => loaded.some((entry) => entry.id === previous) ? previous : loaded[0]?.id || '')
    } catch (requestError) {
      if (sequence !== sequenceRef.current) return
      setItems([])
      setTotal(0)
      setError(getMediaPrivacyErrorMessage(requestError, 'Could not load the review queue.'))
    } finally {
      if (sequence === sequenceRef.current) setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
    return () => { sequenceRef.current += 1 }
  }, [load])

  // Load remaining review pages only when the reviewer scrolls the left queue.
  // Keeping the queue in normal browser scroll-chaining allows the page to move
  // to Customer Requests once the final image has been reached.
  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || lastPageRef.current >= totalPagesRef.current) return
    const sequence = sequenceRef.current
    const page = lastPageRef.current + 1
    loadingMoreRef.current = true
    setLoadingMore(true)
    setMoreError('')
    try {
      const response = await listAdminMediaPrivacyReviews({ status: filter, page, limit: 30 })
      if (!Array.isArray(response?.reviewCases)) throw new Error('Could not load more reviews.')
      if (sequence !== sequenceRef.current) return
      lastPageRef.current = page
      const pageCount = Number(response?.pagination?.totalPages)
      if (Number.isFinite(pageCount) && pageCount > 0) totalPagesRef.current = Math.ceil(pageCount)
      // Never append duplicates if the queue changes while a page is loading.
      setItems((previous) => {
        const ids = new Set(previous.map((item) => item.id))
        return [...previous, ...response.reviewCases.filter((item) => !ids.has(item.id))]
      })
      setTotal((previous) => Math.max(previous, Number(response?.pagination?.total) || 0))
    } catch (requestError) {
      if (sequence !== sequenceRef.current) return
      setMoreError(getMediaPrivacyErrorMessage(requestError, 'Could not load more images.'))
    } finally {
      if (sequence === sequenceRef.current) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [filter])

  function handleQueueScroll(event) {
    const element = event.currentTarget
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 140) loadNextPage()
  }

  const visible = items
  const selected = visible.find((entry) => entry.id === selectedId) || visible[0] || null
  const canDecide = selected && ['open', 'in_review'].includes(selected.status)
  const selectedDecision = selected ? decisions[selected.id] || '' : ''
  const selectedNote = selected ? notes[selected.id] ?? 'Reviewed the uploaded image and privacy evidence.' : ''

  async function saveDecision() {
    if (!selected || !canDecide || !selectedDecision || selectedNote.trim().length < 3) return
    setBusyId(selected.id)
    setError('')
    setNotice('')
    try {
      await resolveAdminMediaPrivacyReview({
        privacyReviewCaseId: selected.id,
        decision: selectedDecision,
        resolutionNote: selectedNote.trim(),
      })
      setNotice('Review saved. The decision is recorded.')
      await load()
    } catch (requestError) {
      setError(getMediaPrivacyErrorMessage(requestError, 'Could not save this decision.'))
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="pp-image-workspace" aria-label="Image privacy reviews">
      <div className="pp-image-toolbar">
        <div><strong>Flagged images</strong><span className="pp-queue-number">{!loading && !error ? `${total} ${words(filter)}` : ''}</span></div>
        <div className="pp-image-actions">
          <label className="pp-select-wrap">
            <span className="sr-only">Image review status</span>
            <select value={filter} onChange={(event) => { setFilter(event.target.value); setSelectedId(''); setNotice('') }}>
              {['open', 'in_review', 'resolved', 'cancelled', 'all'].map((value) => <option key={value} value={value}>{words(value)}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          <button type="button" className="pp-button pp-button-secondary" onClick={load} disabled={loading} aria-label="Refresh image reviews"><RefreshCw size={16} aria-hidden="true" /><span>Refresh</span></button>
        </div>
      </div>

      {notice && <p role="status" className="pp-notice pp-review-success"><Check size={16} aria-hidden="true" /> {notice}</p>}
      {error && <p role="alert" className="pp-notice pp-error">{error} <button type="button" onClick={load} className="pp-retry-inline">Try again</button></p>}
      {loading && <p className="pp-image-empty">Loading image reviews…</p>}
      {!loading && !error && !items.length && <p className="pp-image-empty">No image reviews in this status.</p>}

      {!loading && !error && Boolean(visible.length) && <div className="pp-review-layout">
        <div className="pp-review-browser-column">
          <div className="pp-review-browser" ref={listRef} role="region" aria-label="Flagged image list" tabIndex={0} onScroll={handleQueueScroll}>
          {visible.map((entry) => {
            const active = selected?.id === entry.id
            const imageType = words(entry.evidence?.purpose || 'Image evidence')
            const hostName = entry.owner?.displayName?.trim() || (entry.owner?.isHost ? 'Host account' : 'Uploader')
            return (
              <button type="button" key={entry.id} className={`pp-review-row ${active ? 'is-selected' : ''}`} aria-pressed={active}
                onClick={() => { setSelectedId(entry.id); if (window.matchMedia?.('(max-width: 760px)').matches) detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }}>
                <EvidenceImage source={entry.evidence?.previewUrl} alt={`${imageType} uploaded by ${hostName}`} />
                <span className="pp-review-row-text">
                  <span className="pp-review-item-name">{entry.item?.name || 'Item not linked'}</span>
                  <span className="pp-review-host">{hostName}</span>
                  <span className="pp-review-image-type">{imageType} <span aria-hidden="true">·</span> {formatTime(entry.createdAt)}</span>
                </span>
                <span className={`pp-review-marker ${active ? 'is-selected' : ''}`} aria-hidden="true">{active ? <Check size={16} /> : <ShieldAlert size={16} />}</span>
              </button>
            )
          })}
          {loadingMore && <div className="pp-queue-loading" role="status">Loading more images…</div>}
          {moreError && <div className="pp-queue-loading" role="alert">{moreError} <button type="button" className="pp-retry-inline" onClick={loadNextPage}>Try again</button></div>}
          </div>
        </div>
        <div className="pp-review-detail" ref={detailsRef}>
          {selected && <>
            <div className="pp-detail-heading">
              <span className="pp-kicker">Selected image</span>
              <span className={`pp-status ${canDecide ? 'pp-status-waiting' : ''}`}>{words(selected.status)}</span>
            </div>
            <EvidenceImage key={selected.evidence?.id} source={selected.evidence?.previewUrl} alt={`${words(selected.evidence?.purpose || 'Evidence')} for ${selected.item?.name || 'unlinked item'}`} large />
            <div className="pp-detail-meta">
              <h3>{selected.item?.name || 'Item not linked to a product'}</h3>
              <p><strong>{selected.owner?.displayName?.trim() || (selected.owner?.isHost ? 'Host account' : 'Uploader')}</strong> <span className="pp-meta-separator">/</span> {words(selected.evidence?.purpose || 'Image evidence')}</p>
              {selected.evidence?.width && selected.evidence?.height && <p>{selected.evidence.width} × {selected.evidence.height} px <span className="pp-meta-separator">/</span> {String(selected.evidence?.mimeType || '').replace('image/', '').toUpperCase()}</p>}
              {selected.reasonCodes?.length > 0 && <p className="pp-risk-reasons">{selected.reasonCodes.map(words).join(' · ')}</p>}
            </div>
            {selected.evidence?.previewUrl && <a href={selected.evidence.previewUrl} target="_blank" rel="noreferrer" className="pp-original-link">Open original image <ExternalLink size={15} aria-hidden="true" /></a>}
            {canDecide ? <div className="pp-decision-block">
              <h4>Review decision</h4>
              <label className="pp-field">Action
                <select className="pp-input" value={selectedDecision} onChange={(event) => setDecisions((old) => ({ ...old, [selected.id]: event.target.value }))}>
                  <option value="">Choose an action</option>
                  {decisionsList.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className="pp-field">Decision reason
                <textarea className="pp-input" rows={3} value={selectedNote} onChange={(event) => setNotes((old) => ({ ...old, [selected.id]: event.target.value }))} />
              </label>
              <button type="button" className="pp-button pp-button-primary pp-decision-save" disabled={Boolean(busyId) || !selectedDecision || selectedNote.trim().length < 3} onClick={saveDecision}>
                {busyId === selected.id ? 'Saving…' : 'Save review decision'}
              </button>
            </div> : <div className="pp-completed-decision"><Check size={18} aria-hidden="true" /> {selected.decision ? `Decision: ${words(selected.decision)}` : 'This case is not open for review.'}</div>}
          </>}
        </div>
      </div>}
    </section>
  )
}
