import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  BookOpenText,
  Check,
  ChevronDown,
  Database,
  Leaf,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import AdminShell from '../components/AdminShell'
import { getAdminIngredients } from '../services/catalogAdmin.service'

const PAGE_SIZE = 40
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All records' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'retired', label: 'Retired' },
]

function ingredientName(item) {
  return String(item?.canonicalName || item?.name || 'Unnamed ingredient').trim()
}

function ingredientReference(item) {
  return String(item?.normalizedKey || item?.key || item?.slug || 'Not available').trim()
}

function ingredientId(item) {
  return String(item?.id || item?._id || ingredientReference(item))
}

function ingredientStatus(item) {
  const value = String(item?.status || 'active').toLowerCase().trim()
  return value === 'retired' ? 'Retired' : value === 'disabled' ? 'Disabled' : 'Active'
}

function getGroupLetter(item) {
  const letter = ingredientName(item).charAt(0).toUpperCase()
  return /^[A-Z]$/.test(letter) ? letter : '#'
}

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Unable to load ingredients.'
}

export default function AdminIngredientsPage() {
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const requestId = useRef(0)
  const directoryRef = useRef(null)
  const groupRefs = useRef({})

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    const token = ++requestId.current
    setLoading(true)
    setLoadingMore(false)
    setError('')
    setExpandedId(null)

    getAdminIngredients({ page: 1, limit: PAGE_SIZE, search, status })
      .then((response) => {
        if (cancelled || token !== requestId.current) return
        setRecords(Array.isArray(response?.ingredients) ? response.ingredients : [])
        setPagination(response?.pagination || null)
      })
      .catch((requestError) => {
        if (cancelled || token !== requestId.current) return
        setRecords([])
        setPagination(null)
        setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!cancelled && token === requestId.current) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [search, status, refreshToken])

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => ingredientName(a).localeCompare(ingredientName(b), undefined, { sensitivity: 'base' })),
    [records],
  )

  const groups = useMemo(() => {
    const map = new Map()
    sortedRecords.forEach((item) => {
      const letter = getGroupLetter(item)
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter).push(item)
    })
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
  }, [sortedRecords])

  const letters = groups.map(([letter]) => letter)
  const total = Number.isFinite(Number(pagination?.total)) ? Number(pagination.total) : sortedRecords.length
  const page = Number(pagination?.page || 1)
  const totalPages = Number(pagination?.pages || 0)
  const hasMore = totalPages > page
  const activeRecordCount = sortedRecords.filter((item) => ingredientStatus(item) === 'Active').length

  async function loadMore() {
    if (loading || loadingMore || !hasMore) return
    const token = requestId.current
    setLoadingMore(true)
    setError('')
    try {
      const response = await getAdminIngredients({ page: page + 1, limit: PAGE_SIZE, search, status })
      if (token !== requestId.current) return
      const nextItems = Array.isArray(response?.ingredients) ? response.ingredients : []
      setRecords((current) => {
        const known = new Set(current.map(ingredientId))
        return [...current, ...nextItems.filter((item) => !known.has(ingredientId(item)))]
      })
      setPagination(response?.pagination || null)
    } catch (requestError) {
      if (token === requestId.current) setError(getErrorMessage(requestError))
    } finally {
      if (token === requestId.current) setLoadingMore(false)
    }
  }

  function refresh() {
    setRefreshToken((current) => current + 1)
  }

  function jumpToLetter(letter) {
    const target = groupRefs.current[letter]
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setStatus('active')
  }

  return (
    <AdminShell
      title="Ingredient Library"
      description="Standard ingredient names used across EPANTRY."
      actions={
        <button className="ing-refresh" type="button" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'ing-spin' : ''} aria-hidden="true" />
          Refresh list
        </button>
      }
    >
      <div className="ing-page">
        <section className="ing-feature" aria-label="Ingredient library overview">
          <div className="ing-feature-main">
            <span className="ing-eyebrow"><Leaf size={15} aria-hidden="true" /> INGREDIENT STANDARDS</span>
            <h2>One name. Every recipe.</h2>
            <p>Find the approved ingredient record before using it in products or recipes.</p>
          </div>
          <div className="ing-feature-count">
            <span className="ing-count-label"><Database size={17} aria-hidden="true" /> CURRENT VIEW</span>
            <strong>{loading && !pagination ? '...' : total}</strong>
            <span>ingredient {total === 1 ? 'record' : 'records'}</span>
          </div>
        </section>

        <section className="ing-directory" ref={directoryRef} aria-label="Ingredient directory">
          <header className="ing-directory-header">
            <div>
              <span className="ing-section-label">01 / INGREDIENT DIRECTORY</span>
              <h2>Find an ingredient</h2>
            </div>
            <div className="ing-directory-meta">
              <span className="ing-meta-dot" />
              {loading ? 'Loading records' : `${sortedRecords.length} shown of ${total}`}
            </div>
          </header>

          <div className="ing-toolbar">
            <label className="ing-searchbox">
              <Search size={19} aria-hidden="true" />
              <span className="ing-sr-only">Search ingredients</span>
              <input
                type="search"
                placeholder="Search name, alias or reference"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput && (
                <button type="button" className="ing-clear" onClick={() => setSearchInput('')} aria-label="Clear search">
                  <X size={17} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="ing-filter-wrap">
              <SlidersHorizontal size={16} aria-hidden="true" />
              <label htmlFor="ing-status-filter">Status</label>
              <select id="ing-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown size={15} className="ing-select-chevron" aria-hidden="true" />
            </div>
          </div>

          <div className="ing-results">
            <aside className="ing-alphabet" aria-label="Jump to available letters">
              <span className="ing-alpha-title">BROWSE A-Z</span>
              <div className="ing-letter-buttons">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    disabled={!letters.includes(letter)}
                    onClick={() => jumpToLetter(letter)}
                    title={letters.includes(letter) ? `Jump to ${letter}` : `No ${letter} records loaded`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <span className="ing-alpha-note">Available letters in loaded results</span>
            </aside>

            <div className="ing-list-col">
              {!loading && !error && sortedRecords.length > 0 && (
                <div className="ing-table-head" aria-hidden="true">
                  <span>Ingredient</span>
                  <span>Reference</span>
                  <span>Status</span>
                  <span />
                </div>
              )}

              {loading ? (
                <div className="ing-skeleton" aria-label="Loading ingredients" aria-busy="true">
                  {Array.from({ length: 7 }, (_, index) => <div key={index}><span /><span /><span /></div>)}
                </div>
              ) : sortedRecords.length === 0 && !error ? (
                <div className="ing-empty">
                  <BookOpenText size={27} aria-hidden="true" />
                  <h3>{searchInput || status !== 'active' ? 'No matching ingredients' : 'No ingredients yet'}</h3>
                  <p>Try another name or status.</p>
                  {(searchInput || status !== 'active') && <button type="button" onClick={resetFilters}>Clear filters</button>}
                </div>
              ) : (
                <div className="ing-letter-groups">
                  {groups.map(([letter, items]) => (
                    <section
                      className="ing-letter-section"
                      key={letter}
                      ref={(element) => { groupRefs.current[letter] = element }}
                      aria-label={`Ingredients beginning with ${letter}`}
                    >
                      <div className="ing-group-marker"><span>{letter}</span><small>{items.length}</small></div>
                      <div className="ing-group-rows">
                        {items.map((item) => {
                          const id = ingredientId(item)
                          const selected = expandedId === id
                          const aliases = Array.isArray(item.aliases) ? item.aliases.filter(Boolean) : []
                          const currentStatus = ingredientStatus(item)
                          return (
                            <div key={id} className={`ing-record ${selected ? 'is-open' : ''}`}>
                              <button
                                type="button"
                                className="ing-record-button"
                                aria-expanded={selected}
                                onClick={() => setExpandedId(selected ? null : id)}
                              >
                                <span className="ing-record-name"><span className="ing-name-icon"><Leaf size={15} aria-hidden="true" /></span><strong>{ingredientName(item)}</strong></span>
                                <span className="ing-record-ref">{ingredientReference(item)}</span>
                                <span className={`ing-status ing-status-${currentStatus.toLowerCase()}`}>
                                  {currentStatus === 'Active' && <Check size={13} aria-hidden="true" />}
                                  {currentStatus}
                                </span>
                                <ChevronDown size={17} className="ing-record-chevron" aria-hidden="true" />
                              </button>
                              {selected && (
                                <div className="ing-record-details">
                                  <div><small>Standard name</small><strong>{ingredientName(item)}</strong></div>
                                  <div><small>Reference key</small><span>{ingredientReference(item)}</span></div>
                                  {aliases.length > 0 && <div className="ing-aliases"><small>Also known as</small><span>{aliases.join(', ')}</span></div>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {error && (
                <div className="ing-error" role="alert">
                  <strong>Ingredient list could not load.</strong>
                  <span>{error}</span>
                  <button type="button" onClick={refresh}>Try again</button>
                </div>
              )}

              {!loading && sortedRecords.length > 0 && (
                <div className="ing-list-footer">
                  <span>{sortedRecords.length} of {total} ingredient records</span>
                  {hasMore ? (
                    <button type="button" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? 'Loading...' : 'Load more ingredients'}
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="ing-all-loaded"><Check size={15} aria-hidden="true" /> All loaded</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .ing-page { --ing-forest:#173F35; --ing-sage:#DCE0CF; --ing-clay:#C86C42; --ing-porcelain:#F7F6F2; --ing-ink:#202421; --ing-line:#D7DED4; --ing-blue:#DDEEFF; --ing-lavender:#E9E1FF; --ing-peach:#FFE0CF; --ing-mint:#DDF3E7; --ing-cyan:#DDF3F5; color:var(--ing-ink); font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif; padding-bottom:18px; }
        .ing-page *, .ing-page *::before, .ing-page *::after { box-sizing:border-box; }
        .ing-refresh { display:inline-flex; gap:9px; align-items:center; justify-content:center; padding:10px 15px; border:1px solid #B8C9BF; border-radius:11px; background:var(--ing-porcelain); color:var(--ing-forest); font-size:14px; font-weight:700; min-height:42px; cursor:pointer; }
        .ing-refresh:hover { background:#FFEDE1; border-color:#D5A28C; }
        .ing-refresh:disabled { opacity:.65; cursor:wait; }
        .ing-spin { animation:ing-spin .8s linear infinite; }
        @keyframes ing-spin { to { transform:rotate(360deg); } }
        .ing-feature { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(190px,.55fr); border:1px solid #DECCB6; overflow:hidden; border-radius:15px; margin:4px 0 28px; }
        .ing-feature-main { background:var(--ing-forest) !important; color:#FFFDF9 !important; padding:28px 32px 30px; }
        .ing-eyebrow { color:#DCE0CF !important; font-size:12px; font-weight:750; letter-spacing:.055em; display:flex; gap:10px; align-items:center; }
        .ing-feature-main h2 { color:#FFFDF9 !important; font-size:clamp(25px,2.5vw,35px); line-height:1.15; font-weight:800; letter-spacing:-.04em; margin:13px 0 9px; }
        .ing-feature-main p { color:#E1E9E1 !important; font-size:14px; font-weight:500; line-height:1.6; max-width:490px; margin:0; }
        .ing-feature-count { background:var(--ing-peach) !important; color:var(--ing-forest) !important; display:flex; flex-direction:column; justify-content:center; padding:23px 27px; border-left:3px solid var(--ing-clay); }
        .ing-count-label { display:flex; align-items:center; gap:9px; font-size:11px; font-weight:800; letter-spacing:.05em; color:#9F4E31 !important; }
        .ing-feature-count strong { color:var(--ing-forest) !important; font-size:52px; line-height:1.05; font-weight:800; letter-spacing:-.07em; margin-top:7px; }
        .ing-feature-count > span:last-child { color:#405F52 !important; font-size:14px; font-weight:600; margin-top:2px; }
        .ing-directory { padding:0; }
        .ing-directory-header { display:flex; align-items:end; justify-content:space-between; gap:16px; padding:19px 23px 20px; background:var(--ing-blue) !important; border-top:2px solid #7FA9B9; }
        .ing-section-label { font-size:12px; font-weight:800; color:var(--ing-clay); letter-spacing:.02em; }
        .ing-directory-header h2 { color:var(--ing-forest); font-size:clamp(23px,2.3vw,30px); line-height:1.16; margin:6px 0 0; font-weight:800; letter-spacing:-.037em; }
        .ing-directory-meta { display:flex; gap:8px; align-items:center; color:#315B70; font-size:13px; font-weight:650; white-space:nowrap; }
        .ing-meta-dot { width:7px; height:7px; background:var(--ing-clay); border-radius:50%; }
        .ing-toolbar { background:#FFF0E5 !important; border:1px solid #EBCDBB; border-bottom:none; display:flex; gap:12px; align-items:center; padding:16px; }
        .ing-searchbox { flex:1; min-width:0; background:#FFFEFC !important; border:1px solid #C9D5CB; border-radius:9px; min-height:48px; display:flex; align-items:center; gap:11px; padding:0 13px; color:var(--ing-forest); }
        .ing-searchbox:focus-within { outline:2px solid rgba(200,108,66,.3); border-color:var(--ing-clay); }
        .ing-searchbox input { width:100%; min-width:0; background:transparent; border:0; outline:none; font-size:15px; font-weight:500; color:var(--ing-ink); }
        .ing-searchbox input::placeholder { color:#77857C; opacity:1; }
        .ing-searchbox input::-webkit-search-cancel-button { display:none; }
        .ing-clear { display:grid; place-items:center; background:transparent; color:#537064; border:0; cursor:pointer; padding:5px; }
        .ing-filter-wrap { flex:none; display:flex; align-items:center; position:relative; gap:10px; background:#FFFEFC !important; border:1px solid #DCC1AF; padding:0 12px; min-height:48px; border-radius:9px; color:var(--ing-forest); }
        .ing-filter-wrap label { font-size:13px; font-weight:700; }
        .ing-filter-wrap select { color:var(--ing-forest); font-size:14px; font-weight:750; appearance:none; border:0; outline:none; background:transparent; padding-right:22px; cursor:pointer; }
        .ing-select-chevron { position:absolute; right:11px; pointer-events:none; }
        .ing-results { display:grid; grid-template-columns:170px minmax(0,1fr); border:1px solid var(--ing-line); background:#FFFEFC !important; }
        .ing-alphabet { background:var(--ing-lavender) !important; border-right:1px solid #D6CBEA; padding:22px 17px; }
        .ing-alpha-title { display:block; color:var(--ing-forest); font-weight:800; font-size:12px; letter-spacing:.06em; margin-bottom:15px; }
        .ing-letter-buttons { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
        .ing-letter-buttons button { border:1px solid transparent; background:transparent; color:var(--ing-forest); font-size:14px; font-weight:750; border-radius:6px; height:35px; cursor:pointer; }
        .ing-letter-buttons button:hover:not(:disabled), .ing-letter-buttons button:focus-visible { background:#FFFEFC !important; border-color:#C86C42; color:#8C3F25; outline:none; }
        .ing-letter-buttons button:disabled { color:#9FAC9D; opacity:.55; cursor:default; }
        .ing-alpha-note { display:block; margin-top:17px; color:#625774; font-size:11px; line-height:1.5; }
        .ing-list-col { min-width:0; background:#FFFEFC !important; }
        .ing-table-head { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(140px,.8fr) 90px 26px; align-items:center; gap:16px; background:#EAF4F2 !important; color:#405E59; padding:13px 22px; border-bottom:1px solid var(--ing-line); text-transform:uppercase; letter-spacing:.04em; font-size:11px; font-weight:800; }
        .ing-letter-section { scroll-margin-top:92px; display:grid; grid-template-columns:55px minmax(0,1fr); border-bottom:1px solid var(--ing-line); }
        .ing-letter-section:last-child { border-bottom:0; }
        .ing-group-marker { background:var(--ing-mint) !important; display:flex; align-items:center; flex-direction:column; padding-top:17px; color:var(--ing-forest); border-right:1px solid #D2E2D8; border-left:3px solid #AFCAB7; }
        .ing-group-marker span { font-size:22px; font-weight:850; line-height:1; }
        .ing-group-marker small { font-size:11px; margin-top:4px; font-weight:700; color:#708C77; }
        .ing-group-rows { min-width:0; }
        .ing-record { border-bottom:1px solid #E7EAE4; }
        .ing-record:last-child { border:0; }
        .ing-record-button { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(140px,.8fr) 90px 26px; width:100%; min-height:64px; padding:9px 22px; gap:16px; align-items:center; border:0; background:#FFFEFC !important; color:var(--ing-ink) !important; text-align:left; cursor:pointer; }
        .ing-record-button:hover { background:#F0F7F5 !important; }
        .ing-record.is-open .ing-record-button { background:#E7F0FA !important; }
        .ing-record-button:focus-visible { outline:2px solid var(--ing-clay); outline-offset:-3px; }
        .ing-record-name { display:flex; min-width:0; align-items:center; gap:12px; }
        .ing-record-name strong { font-size:15px; line-height:1.4; font-weight:750; color:var(--ing-ink); overflow-wrap:anywhere; }
        .ing-name-icon { display:grid; place-items:center; width:32px; height:32px; flex:none; border-radius:8px; background:#E4EBDB !important; color:var(--ing-forest); }
        .ing-record-ref { font-size:13px; font-weight:500; color:#5C6D64; overflow-wrap:anywhere; }
        .ing-status { justify-self:start; display:inline-flex; align-items:center; gap:4px; padding:6px 9px; font-size:12px; font-weight:750; border-radius:6px; white-space:nowrap; }
        .ing-status-active { background:#DFEBE0 !important; color:#1A6544 !important; }
        .ing-status-disabled { background:#FFF0D5 !important; color:#89551E !important; }
        .ing-status-retired { background:#FCE5E2 !important; color:#A23F35 !important; }
        .ing-record-chevron { color:#58776A; transition:transform .2s; }
        .ing-record.is-open .ing-record-chevron { transform:rotate(180deg); }
        .ing-record-details { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:15px 25px; background:#EFF7FC !important; border-top:1px solid #CDDCE7; padding:16px 23px 18px; }
        .ing-record-details > div { display:flex; flex-direction:column; min-width:0; gap:5px; }
        .ing-record-details small { font-size:11px; font-weight:750; color:#6B8172; text-transform:uppercase; letter-spacing:.03em; }
        .ing-record-details strong, .ing-record-details span { font-size:14px; color:var(--ing-forest); font-weight:650; overflow-wrap:anywhere; }
        .ing-record-details .ing-aliases { grid-column:1/-1; }
        .ing-list-footer { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:17px 22px; background:var(--ing-cyan) !important; border-top:1px solid #B8D8D8; color:#355D5C; font-size:13px; font-weight:650; }
        .ing-list-footer button { display:flex; align-items:center; gap:10px; border:0; border-radius:8px; background:var(--ing-forest) !important; color:#FFFDF9 !important; padding:12px 17px; cursor:pointer; font-size:13px; font-weight:750; }
        .ing-list-footer button:disabled { opacity:.55; cursor:wait; }
        .ing-all-loaded { display:flex; align-items:center; gap:6px; font-weight:750; color:var(--ing-forest); }
        .ing-skeleton { padding:6px 18px; }
        .ing-skeleton > div { display:flex; align-items:center; gap:20px; min-height:67px; border-bottom:1px solid #E2E9E1; }
        .ing-skeleton span { height:15px; border-radius:5px; background:#DBE7ED; animation:ing-pulse 1.2s ease-in-out infinite alternate; }
        .ing-skeleton span:nth-child(1) { width:35%; }.ing-skeleton span:nth-child(2) { width:23%; }.ing-skeleton span:nth-child(3) { width:60px; margin-left:auto; }
        @keyframes ing-pulse { to { opacity:.5; } }
        .ing-empty { text-align:center; padding:62px 22px; color:var(--ing-forest); }
        .ing-empty svg { margin:auto; color:#6E9A9A; }
        .ing-empty h3 { font-size:19px; font-weight:800; margin:14px 0 5px; }
        .ing-empty p { font-size:14px; color:#718073; }
        .ing-empty button { margin-top:17px; background:var(--ing-forest); color:#FFFEFB; padding:10px 16px; border:0; border-radius:8px; cursor:pointer; font-weight:750; }
        .ing-error { display:flex; gap:9px; flex-wrap:wrap; align-items:center; padding:15px 20px; border-top:1px solid #F0CAC5; background:#FFF0EB !important; color:#AA3E35; font-size:13px; }
        .ing-error strong { font-weight:800; }.ing-error span { flex:1; min-width:160px; }.ing-error button { background:#AA3E35; border:0; border-radius:6px; color:#fff; font-weight:700; padding:8px 12px; cursor:pointer; }
        .ing-sr-only { position:absolute; height:1px; width:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
        @media(max-width:900px) {
          .ing-feature { grid-template-columns:minmax(0,1.5fr) minmax(150px,.5fr); }
          .ing-feature-main { padding:24px; }
          .ing-feature-count { padding:18px; }
          .ing-results { grid-template-columns:110px minmax(0,1fr); }
          .ing-alphabet { padding:16px 9px; }
          .ing-letter-buttons { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ing-table-head,.ing-record-button { grid-template-columns:minmax(0,1fr) minmax(90px,.7fr) 80px 18px; gap:9px; padding-left:13px; padding-right:13px; }
        }
        @media(max-width:650px) {
          /* Mobile-only: preserve desktop styles and the existing colour tokens. */
          .ing-page { width:100%; min-width:0; padding-bottom:7px; }
          .ing-refresh { min-height:36px; padding:8px 11px; font-size:12.5px; border-radius:8px; }
          .ing-refresh svg { width:14px; height:14px; }
          .ing-feature { grid-template-columns:minmax(0,1fr) 86px; margin:0 0 12px; border-radius:10px; }
          .ing-feature-main { padding:15px 12px 16px; }
          .ing-eyebrow { font-size:9px; gap:6px; }
          .ing-eyebrow svg { width:13px; height:13px; }
          .ing-feature-main h2 { font-size:20px; line-height:1.15; margin:7px 0 5px; letter-spacing:-.03em; }
          .ing-feature-main p { font-size:12px; line-height:1.4; max-width:230px; }
          .ing-feature-count { padding:10px 7px; text-align:center; align-items:center; }
          .ing-count-label { font-size:9px; line-height:1.2; gap:3px; letter-spacing:0; text-align:center; }
          .ing-count-label svg { width:11px; height:11px; }
          .ing-feature-count strong { font-size:31px; margin-top:6px; }
          .ing-feature-count > span:last-child { font-size:10px; line-height:1.25; }
          .ing-directory-header { padding:12px 13px 11px; align-items:center; gap:7px; }
          .ing-section-label { font-size:10px; }
          .ing-directory-header h2 { font-size:21px; margin:3px 0 0; }
          .ing-directory-meta { font-size:10px; line-height:1.35; white-space:normal; max-width:100px; justify-content:flex-end; text-align:right; gap:5px; }
          .ing-meta-dot { width:5px; height:5px; flex:none; }
          .ing-toolbar { padding:9px; display:grid; grid-template-columns:minmax(0,1fr) 110px; gap:7px; align-items:stretch; }
          .ing-searchbox { min-height:44px; gap:6px; padding:0 9px; }
          .ing-searchbox > svg { width:16px; height:16px; flex:none; }
          .ing-searchbox input { font-size:13px; }
          .ing-filter-wrap { width:auto; min-width:0; min-height:44px; padding:0 8px; gap:6px; }
          .ing-filter-wrap > svg:first-child { width:14px; height:14px; flex:none; }
          .ing-filter-wrap label { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
          .ing-filter-wrap select { width:100%; font-size:12px; min-width:0; padding-right:15px; }
          .ing-select-chevron { right:7px; width:12px; height:12px; }
          .ing-results { display:flex; flex-direction:column; }
          .ing-alphabet { padding:8px 10px; border-right:0; border-bottom:1px solid #D6CBEA; display:flex; align-items:center; gap:8px; min-width:0; }
          .ing-alpha-title { white-space:nowrap; margin:0; font-size:10px; letter-spacing:0; }
          .ing-letter-buttons { display:flex; flex:1; min-width:0; gap:4px; overflow-x:auto; overscroll-behavior-inline:contain; scrollbar-width:thin; padding:1px 0 2px; }
          .ing-letter-buttons button { width:32px; min-width:32px; height:31px; font-size:12px; border-radius:5px; background:rgba(255,255,255,.6); }
          .ing-letter-buttons button:disabled { display:none; }
          .ing-alpha-note,.ing-table-head { display:none; }
          .ing-letter-section { scroll-margin-top:84px; grid-template-columns:32px minmax(0,1fr); }
          .ing-group-marker { padding:11px 2px; }
          .ing-group-marker span { font-size:17px; }
          .ing-group-marker small { font-size:9px; }
          .ing-group-rows { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ing-record { min-width:0; border-right:0; border-bottom:1px solid #E7EAE4; }
          .ing-record:nth-child(odd) { border-right:1px solid #E7EAE4; }
          .ing-record.is-open { grid-column:1/-1; border-right:0; }
          .ing-record-button { width:100%; min-height:77px; display:grid; grid-template-columns:minmax(0,1fr) 13px; grid-template-rows:auto auto auto; align-content:center; align-items:center; gap:3px 2px; padding:9px 7px; }
          .ing-record-name { grid-column:1; grid-row:1; align-items:center; gap:5px; }
          .ing-name-icon { width:22px; height:22px; border-radius:6px; }
          .ing-name-icon svg { width:12px; height:12px; }
          .ing-record-name strong { font-size:12.5px; line-height:1.25; font-weight:750; overflow-wrap:anywhere; }
          .ing-record-ref { grid-column:1; grid-row:2; margin-left:0; min-width:0; font-size:10.5px; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .ing-status { grid-column:1; grid-row:3; justify-self:start; padding:0; font-size:10px; line-height:1.15; background:transparent !important; }
          .ing-status svg { width:11px; height:11px; }
          .ing-record-chevron { grid-column:2; grid-row:1 / span 3; width:13px; height:13px; align-self:center; }
          .ing-record-details { grid-template-columns:repeat(2,minmax(0,1fr)); padding:10px 11px 12px; gap:10px; }
          .ing-record-details small { font-size:10px; }
          .ing-record-details strong,.ing-record-details span { font-size:12px; }
          .ing-list-footer { padding:11px; gap:9px; flex-wrap:wrap; font-size:11.5px; }
          .ing-list-footer button { min-height:44px; flex:1 1 100%; justify-content:center; padding:10px; }
          .ing-empty { padding:35px 14px; }
          .ing-skeleton { padding:6px 10px; }
        }
        @media(max-width:360px) {
          .ing-feature { grid-template-columns:minmax(0,1fr) 76px; }
          .ing-feature-main h2 { font-size:19px; }
          .ing-feature-main p { font-size:11.5px; }
          .ing-feature-count strong { font-size:28px; }
          .ing-directory-header h2 { font-size:19px; }
          .ing-directory-meta { max-width:78px; }
          .ing-toolbar { grid-template-columns:minmax(0,1fr) 102px; }
          .ing-letter-section { grid-template-columns:28px minmax(0,1fr); }
          .ing-group-rows { display:block; }
          .ing-record:nth-child(odd) { border-right:0; }
          .ing-record-button { min-height:56px; grid-template-columns:minmax(0,1fr) auto 13px; grid-template-rows:auto auto; gap:3px 7px; padding:7px 9px; }
          .ing-record-name { grid-column:1; grid-row:1; }
          .ing-record-name strong { font-size:13px; }
          .ing-record-ref { grid-column:1; grid-row:2; font-size:11px; }
          .ing-status { grid-column:2; grid-row:1 / span 2; font-size:10px; }
          .ing-record-chevron { grid-column:3; grid-row:1 / span 2; }
        }
        @media(prefers-reduced-motion:reduce) { .ing-spin,.ing-skeleton span { animation:none; } }
      `}</style>
    </AdminShell>
  )
}
