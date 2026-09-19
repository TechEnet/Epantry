import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../auth/context/AuthContext'
import { listBrandWorlds } from '../services/brandAuthority.service'

// First nine positions follow the reference's staggered 2 / 1 / 2 / 2 / 2
// sequence. Each item travels bottom -> centre -> top on its own vertical lane.
// These are scroll distances, NOT timers or video playback timestamps.
const FLIGHT_PATHS = [
  { lane: 0.125, mobileLane: 0.25, start: -0.60 },
  { lane: 0.625, mobileLane: 0.75, start: -0.60 },
  { lane: 0.375, mobileLane: 0.50, start: 1.04 },
  { lane: 0.125, mobileLane: 0.25, start: 1.92 },
  { lane: 0.875, mobileLane: 0.75, start: 1.92 },
  { lane: 0.375, mobileLane: 0.25, start: 2.80 },
  { lane: 0.625, mobileLane: 0.75, start: 2.80 },
  { lane: 0.125, mobileLane: 0.25, start: 3.68 },
  { lane: 0.875, mobileLane: 0.75, start: 3.68 },
]
const FLIGHT_LENGTH = 2.30
const PREVIEW_LIMIT = 9
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Unable to load brands. Please try again.'
}

function getBrandName(brand) {
  return String(brand?.displayName || brand?.name || 'Brand').trim()
}

function getBrandKey(brand) {
  return String(brand?.slug || brand?.id || brand?._id || '')
}

function getProductCount(brand) {
  const value = Number(brand?.productCount)
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

function formatProductCount(brand) {
  const count = getProductCount(brand)
  return `${count} ${count === 1 ? 'product' : 'products'} listed`
}

function getBrandLetter(brand) {
  const first = Array.from(getBrandName(brand).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))[0]?.toUpperCase() || '#'
  return /^[A-Z]$/.test(first) ? first : '#'
}

function matchesSearch(brand, search) {
  const query = search.trim().toLowerCase()
  return !query || [brand.name, brand.displayName, brand.description, brand.slug]
    .filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
}

function getPublicDescription(brand) {
  const description = String(brand?.description || '').trim()
  return /\bM\d+\b|\bNPI\b|canonical|governed|handoff|product graph/i.test(description) ? '' : description
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

// Read the existing navbar's height without modifying its DOM or styling.
function useNavbarClearance(pageRef) {
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header || !pageRef.current) return undefined
    const update = () => {
      const height = Math.ceil(header.getBoundingClientRect().height)
      pageRef.current?.style.setProperty('--brand-nav-height', `${height}px`)
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(header)
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [pageRef])
}

function getSceneLength(count) {
  if (!count) return 1
  return FLIGHT_PATHS[count - 1].start + FLIGHT_LENGTH + 0.80
}

function useScrollScene({ trackRef, stageRef, signature, count, reducedMotion, paused }) {
  useEffect(() => {
    const track = trackRef.current
    const stage = stageRef.current
    if (!track || !stage || !count || reducedMotion || paused) return undefined

    const cards = Array.from(stage.querySelectorAll('[data-brand-flight]'))
    const end = stage.querySelector('[data-brand-ending]')
    const hint = stage.querySelector('[data-brand-scene-hint]')
    const meter = stage.querySelector('[data-brand-progress]')
    const counter = stage.querySelector('[data-brand-counter]')
    const word = stage.querySelector('[data-brand-word]')
    const lastExit = FLIGHT_PATHS[count - 1].start + FLIGHT_LENGTH
    const travelLength = getSceneLength(count)
    let frame = null
    let introStartedAt = null
    let introComplete = false

    const update = () => {
      frame = null
      const rect = track.getBoundingClientRect()
      const height = stage.clientHeight
      const width = stage.clientWidth
      if (!height || !width) return
      const distance = clamp(-rect.top / height, 0, travelLength)
      const smallScreen = width < 640
      const now = performance.now()
      let brandWordRect = null
      if (word) {
        const textNode = word.firstChild
        if (textNode) {
          const range = document.createRange()
          range.selectNodeContents(word)
          brandWordRect = range.getBoundingClientRect()
          range.detach?.()
        }
      }
      let enteredCount = 0

      // All transforms are a pure function of current document scroll position.
      // No autoplay, wheel interception, permanent listeners or per-frame React renders.
      cards.forEach((card, index) => {
        const path = FLIGHT_PATHS[index]
        const raw = (distance - path.start) / FLIGHT_LENGTH
        const t = clamp(raw)
        const scale = 0.64 + 0.36 * Math.sin(Math.PI * t)
        const cardWidth = card.offsetWidth
        const cardHeight = card.offsetHeight
        const margin = smallScreen ? 10 : 24
        const lane = smallScreen ? path.mobileLane : path.lane
        const centre = clamp(width * lane, margin + cardWidth / 2, width - margin - cardWidth / 2)
        const x = centre - cardWidth / 2
        const y = height + cardHeight * 0.28 - t * (height + cardHeight * 1.45)
        const visible = raw > 0 && raw < 1
        let opacity = clamp(t / 0.07) * clamp((1 - t) / 0.08)
        let entranceOffset = 0
        let entranceScale = 1
        if (index < 2 && introStartedAt !== null && !introComplete) {
          const delay = index * 95
          const intro = clamp((now - introStartedAt - delay) / 620)
          const eased = 1 - Math.pow(1 - intro, 3)
          opacity *= eased
          entranceOffset = 54 * (1 - eased)
          entranceScale = 0.93 + 0.07 * eased
          if (index === 1 && intro >= 1) introComplete = true
        }
        if (raw > 0.15) enteredCount += 1
        card.style.transform = `translate3d(${x.toFixed(2)}px, ${(y + entranceOffset).toFixed(2)}px, 0) scale(${(scale * entranceScale).toFixed(4)})`
        card.style.opacity = visible ? opacity.toFixed(3) : '0'
        card.style.visibility = visible ? 'visible' : 'hidden'
        if (brandWordRect && visible) {
          const stageRect = stage.getBoundingClientRect()
          const cardLeft = stageRect.left + x
          const cardTop = stageRect.top + y + entranceOffset
          const cardRight = cardLeft + cardWidth
          const cardBottom = cardTop + cardHeight
          const overlapsWord = cardRight > brandWordRect.left && cardLeft < brandWordRect.right && cardBottom > brandWordRect.top && cardTop < brandWordRect.bottom
          card.dataset.water = overlapsWord ? 'true' : 'false'
        } else {
          card.dataset.water = 'false'
        }
        card.style.pointerEvents = visible ? 'auto' : 'none'
        card.inert = !visible
        card.setAttribute('aria-hidden', String(!visible))
        const link = card.querySelector('a')
        if (link) link.tabIndex = visible ? 0 : -1
      })

      const endProgress = clamp((distance - lastExit + 0.10) / 0.38)
      if (end) {
        end.style.opacity = endProgress.toFixed(3)
        end.style.transform = `translateY(${(18 * (1 - endProgress)).toFixed(2)}px)`
        end.style.visibility = endProgress > 0 ? 'visible' : 'hidden'
        const endVisible = endProgress > 0.01
        end.style.pointerEvents = endVisible ? 'auto' : 'none'
        end.inert = !endVisible
        end.setAttribute('aria-hidden', String(!endVisible))
      }
      if (hint) hint.style.opacity = (1 - endProgress).toFixed(3)
      if (meter) meter.style.transform = `scaleX(${clamp(distance / lastExit).toFixed(4)})`
      if (counter) counter.textContent = `${String(Math.min(enteredCount, count)).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
      if (introStartedAt !== null && !introComplete) frame = window.requestAnimationFrame(update)
    }

    const sceneObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting) && introStartedAt === null) {
            introStartedAt = performance.now()
            schedule()
          }
        }, { threshold: 0.12 })
      : null
    sceneObserver?.observe(stage)

    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update)
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    observer?.observe(stage)
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('pageshow', schedule)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      sceneObserver?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pageshow', schedule)
    }
  }, [trackRef, stageRef, signature, count, reducedMotion, paused])
}

function BrandIdentityCard({ brand, index, compact = false, onNavigate }) {
  const name = getBrandName(brand)
  const description = compact ? getPublicDescription(brand) : ''
  const fittedNameSize = compact
    ? Math.max(13, Math.min(26, 330 / Math.max(name.length * 0.58, 7)))
    : Math.max(14, Math.min(46, 540 / Math.max(name.length * 0.58, 7)))
  const nameStyle = { fontSize: `${fittedNameSize.toFixed(1)}px`, whiteSpace: 'nowrap' }
  const tones = ['ivory', 'blue', 'midnight', 'blue', 'ivory', 'midnight', 'ivory', 'blue', 'midnight']
  return (
    <Link
      to={`/brands/${encodeURIComponent(getBrandKey(brand))}`}
      onClick={onNavigate}
      aria-label={`Explore ${name} Brand World, ${formatProductCount(brand)}`}
      className={`ep-brand-pass ep-brand-pass--${tones[index % tones.length]} ${compact ? 'ep-brand-pass--compact' : ''}`}
    >
      <div className="ep-brand-pass__top">
        <span>Brand World</span>
        <span className="ep-brand-pass__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="ep-brand-pass__identity">
        <h3 style={nameStyle}>{name}</h3>
        {brand.verified === true && <span className="ep-brand-pass__verified"><BadgeCheck size={13} aria-hidden="true" /> Verified</span>}
        {description && <p className="ep-brand-pass__description">{description}</p>}
        {Array.isArray(brand.verifiedMarkets) && brand.verifiedMarkets.length > 0 && (
          <p className="ep-brand-pass__markets">Verified markets: {brand.verifiedMarkets.join(', ')}</p>
        )}
      </div>
      <div className="ep-brand-pass__bottom">
        <div><p>{formatProductCount(brand)}</p><span>Explore brand</span></div>
        <span className="ep-brand-pass__arrow" aria-hidden="true"><ArrowUpRight size={20} strokeWidth={1.5} /></span>
      </div>
    </Link>
  )
}

function BrandDirectory({ brands, initialQuery, onClose, onNavigate }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const scrollRef = useRef(null)
  const backdropPress = useRef(false)
  const [query, setQuery] = useState(initialQuery)
  const [letter, setLetter] = useState('All')
  const letters = useMemo(() => [...new Set(brands.map(getBrandLetter))].sort(), [brands])
  const searchMatches = useMemo(() => brands.filter((brand) => matchesSearch(brand, query)), [brands, query])
  const availableLetters = useMemo(() => new Set(searchMatches.map(getBrandLetter)), [searchMatches])
  const matches = useMemo(() => letter === 'All' ? searchMatches : searchMatches.filter((brand) => getBrandLetter(brand) === letter), [searchMatches, letter])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const returnFocus = document.activeElement
    const root = document.documentElement
    const body = document.body
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const bodyProperties = ['padding-right']
    const savedBody = bodyProperties.map((key) => [key, body.style.getPropertyValue(key), body.style.getPropertyPriority(key)])
    const savedRootOverflow = root.style.getPropertyValue('overflow')
    const savedRootOverflowPriority = root.style.getPropertyPriority('overflow')
    const savedScrollBehavior = root.style.getPropertyValue('scroll-behavior')
    const savedScrollPriority = root.style.getPropertyPriority('scroll-behavior')
    const scrollbar = window.innerWidth - root.clientWidth
    const existingPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0

    // Keep the document in normal flow so its pinned BRAND scene stays visible.
    // Lock the root viewport, not body: a new body scroll container would unpin
    // the sticky scene. The native modal also makes the background inert.
    // Every changed property and the exact scroll position is restored on close.
    if (scrollbar > 0) body.style.setProperty('padding-right', `${existingPadding + scrollbar}px`)
    root.style.setProperty('overflow', 'hidden')
    dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })

    return () => {
      if (dialog.open) dialog.close()
      savedBody.forEach(([key, value, priority]) => {
        if (value) body.style.setProperty(key, value, priority)
        else body.style.removeProperty(key)
      })
      if (savedRootOverflow) root.style.setProperty('overflow', savedRootOverflow, savedRootOverflowPriority)
      else root.style.removeProperty('overflow')
      root.style.setProperty('scroll-behavior', 'auto', 'important')
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
      if (savedScrollBehavior) root.style.setProperty('scroll-behavior', savedScrollBehavior, savedScrollPriority)
      else root.style.removeProperty('scroll-behavior')
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [query, letter])

  function isOutside(event) {
    const rect = dialogRef.current?.getBoundingClientRect()
    return rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
  }

  return (
    <dialog
      ref={dialogRef}
      className="ep-brands-directory"
      aria-labelledby="brand-directory-title"
      aria-describedby="brand-directory-description"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget && isOutside(event) }}
      onClick={(event) => { if (backdropPress.current && event.target === event.currentTarget && isOutside(event)) onClose(); backdropPress.current = false }}
    >
      <div className="ep-brands-directory__body">
        <header className="ep-brands-directory__heading">
          <div><p className="ep-brands-eyebrow">The full collection</p><h2 id="brand-directory-title">All brands.</h2><p id="brand-directory-description">Find a name. Open its Brand World.</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="ep-brands-close" aria-label="Close brand directory"><X size={21} aria-hidden="true" /></button>
        </header>
        <div className="ep-brands-directory__controls">
          <div role="search" aria-label="Search all brands" className="ep-brands-directory__search">
            <Search size={18} aria-hidden="true" />
            <label htmlFor="all-brands-search" className="sr-only">Search all brands</label>
            <input id="all-brands-search" type="search" autoComplete="off" placeholder="Search by brand name" value={query} onChange={(event) => { setQuery(event.target.value); setLetter('All') }} aria-controls="all-brands-grid" />
            {query && <button type="button" aria-label="Clear directory search" onClick={() => { setQuery(''); setLetter('All') }}><X size={16} aria-hidden="true" /></button>}
          </div>
          <div className="ep-brands-directory__filter-line">
            <div role="group" aria-label="Filter brands by first letter" className="ep-brands-letters">
              {['All', ...letters].map((value) => <button key={value} type="button" aria-pressed={letter === value} disabled={value !== 'All' && !availableLetters.has(value)} onClick={() => setLetter(value)}>{value === 'All' ? 'All' : value}</button>)}
            </div>
            <p role="status" aria-live="polite">{matches.length} {matches.length === 1 ? 'brand' : 'brands'}</p>
          </div>
        </div>
        <div ref={scrollRef} className="ep-brands-directory__scroll" tabIndex={0} role="region" aria-label="Scrollable brand directory">
          {matches.length ? (
            <div id="all-brands-grid" className="ep-brands-directory__grid">
              {matches.map((brand) => <BrandIdentityCard key={getBrandKey(brand)} brand={brand} index={brands.indexOf(brand)} compact onNavigate={onNavigate} />)}
            </div>
          ) : (
            <div id="all-brands-grid" className="ep-brands-directory__empty">
              <Search size={28} aria-hidden="true" /><h3>No matching brands</h3><p>Try another name or choose All.</p>
              <button type="button" onClick={() => { setQuery(''); setLetter('All') }}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}

const PAGE_STYLES = `
.ep-brand-journey { --brand-nav-height: 80px; color: #172e43; background: #f5f4ef; }
.ep-brand-journey button, .ep-brands-directory button { cursor: pointer; }
.ep-brand-journey button:disabled, .ep-brands-directory button:disabled { cursor: not-allowed; opacity: .4; }
.ep-brand-journey a:focus-visible, .ep-brand-journey button:focus-visible, .ep-brands-directory a:focus-visible, .ep-brands-directory button:focus-visible { outline: 2px solid #83bce4; outline-offset: 5px; }
.ep-brand-journey .ep-brands-hero { height: 100vh; height: 100svh; min-height: 0; position: relative; display: flex; align-items: center; isolation: isolate; }
.ep-brands-hero__photo, .ep-brands-hero__shade { position: absolute; inset: 0; pointer-events: none; z-index: -1; }
.ep-brands-hero__photo { background: #18304a url('/hero/brand.png') no-repeat 66% center / cover; }
.ep-brands-hero__shade { background: linear-gradient(90deg,rgba(11,30,47,.96) 0%,rgba(19,43,65,.83) 31%,rgba(29,48,60,.34) 58%,rgba(15,31,40,.04) 100%); }
.ep-brands-hero__content { padding: calc(var(--brand-nav-height) + 28px) clamp(24px,5.5vw,100px) 126px; width: 100%; max-width: 1680px; margin: 0 auto; }
.ep-brands-eyebrow { margin: 0; font-size: 10px; font-weight: 700; line-height: 1.6; letter-spacing: .20em; text-transform: uppercase; }
.ep-brands-hero .ep-brands-eyebrow { display: flex; align-items: center; gap: 12px; color: #d5e0e6; }
.ep-brands-hero .ep-brands-eyebrow::before { content: ''; width: 26px; height: 1px; background: #d5c3a4; }
.ep-brands-hero h1 { margin: 22px 0 18px; max-width: 780px; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(60px,7vw,112px); line-height: .96; font-weight: 500; letter-spacing: -.05em; color: #fffaf0; }
.ep-brands-hero__copy { max-width: 365px; margin: 0; color: #d9e2e8; font-size: 15px; line-height: 1.75; }
.ep-brands-hero__search { width: min(100%,450px); display: flex; align-items: center; gap: 12px; margin-top: 30px; padding: 7px 8px 7px 17px; border: 1px solid rgba(255,255,255,.42); border-radius: 13px; color: #34566d; background: rgba(255,255,255,.94); box-shadow: 0 12px 36px #06162414; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.ep-brands-hero__search:focus-within { outline: 2px solid #a6c7e2; outline-offset: 4px; }
.ep-brands-hero__search input { height: 40px; min-width: 0; flex: 1; background: transparent; outline: none; border: 0; color: #17344a; font-size: 14px; }
.ep-brands-hero__search input::placeholder { color: #566e80; }
.ep-brands-hero__search input::-webkit-search-cancel-button, .ep-brands-directory__search input::-webkit-search-cancel-button { appearance: none; }
.ep-brands-hero__search button { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: 9px; background: #1e4461; color: white; border: 0; }
.ep-brands-hero__search .ep-brands-clear-search { width: 28px; background: transparent; color: #566e80; }
.ep-brands-host-link { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; margin-top: 14px; font-size: 11px; color: #d0dde8; text-decoration: none; }
.ep-brands-host-link:hover { color: white; text-decoration: underline; text-underline-offset: 5px; }
.ep-brands-scroll-cue { position: absolute; bottom: 28px; left: clamp(24px,5.5vw,100px); right: clamp(24px,5.5vw,100px); display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid #ffffff30; padding-top: 20px; }
.ep-brands-scroll-cue button { border: 0; background: transparent; color: #f9f7f1; display: flex; align-items: center; gap: 13px; font-size: 12px; font-weight: 600; }
.ep-brands-scroll-cue button span { display: grid; place-items: center; height: 40px; width: 40px; border: 1px solid #ffffff6b; border-radius: 50%; transition: transform .2s, background .2s; }
.ep-brands-scroll-cue button:hover span { transform: translateY(3px); background: #ffffff15; }
.ep-brands-scroll-cue > p { font-size: 10px; letter-spacing: .17em; text-transform: uppercase; color: #cad5df; }
.ep-brands-track { position: relative; background: #101f30; }
.ep-brands-stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: clip; isolation: isolate; background: radial-gradient(ellipse at 13% 8%,#61788a70 0%,transparent 49%),radial-gradient(ellipse at 90% 95%,#9ea9a470 0%,transparent 54%),linear-gradient(125deg,#263e53 0%,#112639 42%,#0a1827 73%,#344756 100%); }
.ep-brands-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0; background: linear-gradient(0deg,#07142130,transparent 23%,transparent 80%,#07142120); }
.ep-brands-stage__top { position: absolute; z-index: 12; top: calc(var(--brand-nav-height) + 24px); left: clamp(20px,4vw,64px); right: clamp(20px,4vw,64px); display: flex; align-items: center; justify-content: space-between; gap: 16px; pointer-events: none; color: #d5e1e8; }
.ep-brands-stage__top > span { font-size: 11px; letter-spacing: .06em; }
.ep-brands-stage__title { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; z-index: 7; pointer-events: none; }
.ep-brands-stage__title h2 { margin: 0; font-family: var(--font-sans,Arial,sans-serif); font-size: clamp(90px,20vw,300px); font-weight: 650; letter-spacing: -.075em; line-height: .9; color: rgba(242,242,235,.82); text-shadow: 0 5px 80px #0715231a; mix-blend-mode: screen; }
.ep-brands-stage__title p { margin: 24px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: .25em; color: #c5d2dd; }
.ep-brands-stage__hint { position: absolute; top: 84%; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 15px; border: 1px solid rgba(224,236,244,.22); border-radius: 999px; color: #dbe6ed; background: rgba(8,24,38,.30); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); font-size: 11px; white-space: nowrap; z-index: 9; pointer-events: none; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
.ep-brands-stage__bottom { position: absolute; left: clamp(20px,4vw,64px); right: clamp(20px,4vw,64px); bottom: 24px; z-index: 12; color: #d5e0e8; pointer-events: none; }
.ep-brands-stage__meter { height: 1px; margin-bottom: 14px; overflow: hidden; background: #ffffff24; }
.ep-brands-stage__meter > span { display: block; width: 100%; height: 100%; background: #c5d7e5; transform: scaleX(0); transform-origin: left center; }
.ep-brands-stage__bottom > div:last-child { display: flex; align-items: center; justify-content: space-between; font-size: 10px; letter-spacing: .08em; }
.ep-brand-flight { position: absolute; top: 0; left: 0; z-index: 4; width: clamp(168px,21.5vw,310px); height: clamp(238px,22vw,315px); transform-origin: center center; will-change: transform,opacity; visibility: hidden; }
.ep-brand-flight:hover, .ep-brand-flight:focus-within { z-index: 8; }
.ep-brand-pass { position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; overflow: hidden; border: 1px solid #cbd6df; border-radius: 14px; padding: clamp(18px,1.8vw,26px); background: rgba(241,240,233,.91); color: #172e43; text-decoration: none; box-shadow: 0 22px 55px -22px #020c1dd9,inset 0 1px #ffffffc9; backdrop-filter: blur(8px) saturate(118%); -webkit-backdrop-filter: blur(8px) saturate(118%); transition: border-color .2s,box-shadow .2s,background .25s; }
.ep-brand-pass::before { content: ''; position: absolute; top: 9px; left: 18px; right: 18px; height: 1px; background: linear-gradient(90deg,transparent,currentColor,transparent); opacity: .13; }
.ep-brand-pass::after { content: ''; position: absolute; inset: -18%; pointer-events: none; opacity: 0; background: radial-gradient(circle at 28% 26%,rgba(255,255,255,.42),transparent 20%),radial-gradient(circle at 72% 70%,rgba(155,207,232,.24),transparent 25%),linear-gradient(115deg,transparent 28%,rgba(255,255,255,.20) 42%,transparent 58%); filter: blur(5px); transform: translate3d(-3%,2%,0) scale(1.04); transition: opacity .28s ease; mix-blend-mode: screen; }
.ep-brand-flight[data-water='true'] .ep-brand-pass { backdrop-filter: blur(15px) saturate(138%); -webkit-backdrop-filter: blur(15px) saturate(138%); box-shadow: 0 28px 64px -22px #020c1df2,inset 0 1px #ffffffe8,inset 0 0 30px rgba(196,225,239,.17); }
.ep-brand-flight[data-water='true'] .ep-brand-pass::after { opacity: .78; }
.ep-brand-pass:hover { border-color: #9cafbd; box-shadow: 0 26px 60px -20px #020c1df2,inset 0 1px #ffffffe0; }
.ep-brand-pass--ivory { background: linear-gradient(135deg,rgba(255,253,246,.94),rgba(232,231,221,.88)); color: #253e4b; }
.ep-brand-pass--blue { background: linear-gradient(135deg,rgba(240,246,251,.94),rgba(199,217,232,.88)); color: #143b59; }
.ep-brand-pass--midnight { background: linear-gradient(135deg,rgba(48,81,110,.93),rgba(20,45,67,.90) 90%); color: #fffaf0; border-color: #879baa7d; box-shadow: 0 22px 55px -22px #020c1dd9,inset 0 1px #ffffff26; }
.ep-brand-pass__top { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 9px; font-weight: 650; line-height: 1.4; letter-spacing: .17em; text-transform: uppercase; opacity: .75; }
.ep-brand-pass__number { font-variant-numeric: tabular-nums; font-size: 12px; font-weight: 400; letter-spacing: .03em; }
.ep-brand-pass__identity { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 18px 0; min-height: 0; }
.ep-brand-pass__identity h3 { max-width: 100%; font-family: Georgia,'Times New Roman',serif; line-height: 1.02; font-weight: 500; letter-spacing: -.05em; margin: 0; }
.ep-brand-pass__verified { margin-top: 12px; display: flex; align-items: center; gap: 5px; font-size: 10px; }
.ep-brand-pass__markets { margin: 7px 0 0; font-size: 10px; line-height: 1.45; opacity: .75; }
.ep-brand-pass__bottom { border-top: 1px solid #869ba647; padding-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ep-brand-pass--midnight .ep-brand-pass__bottom { border-color: #b7cad03d; }
.ep-brand-pass__bottom p { margin: 0 0 4px; font-size: 10px; opacity: .75; }
.ep-brand-pass__bottom div > span { font-size: 11px; font-weight: 650; }
.ep-brand-pass__arrow { border-radius: 50%; border: 1px solid #8ba0af70; width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center; transition: transform .2s, background .2s; }
.ep-brand-pass:hover .ep-brand-pass__arrow { transform: translate(2px,-2px); background: #ffffff30; }
.ep-brands-ending { position: absolute; top: 70%; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 15px; color: #d3e0e8; z-index: 10; opacity: 0; visibility: hidden; }
.ep-brands-ending > p { font-size: 12px; margin: 0; }
.ep-brands-view-all { display: inline-flex; align-items: center; justify-content: center; gap: 20px; min-height: 52px; padding: 0 27px; border-radius: 99px; border: 1px solid #dce8ef; background: #f1f4f3; box-shadow: 0 8px 26px #05152720; font-size: 13px; font-weight: 650; color: #163751; transition: background .2s,transform .2s; }
.ep-brands-view-all:hover { background: white; transform: translateY(-2px); }
.ep-brands-view-all > span { font-weight: 400; border-left: 1px solid #b9cbd5; padding-left: 15px; }
.ep-brands-keyboard-shortcut { position: absolute; top: calc(var(--brand-nav-height) + 60px); left: 20px; z-index: 20; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); }
.ep-brands-keyboard-shortcut:focus { width: auto; height: auto; padding: 12px 18px; clip-path: none; background: white; color: #142d43; border-radius: 8px; }
.ep-brands-static { position: relative; padding: calc(var(--brand-nav-height) + 42px) clamp(20px,5vw,80px) 60px; background: linear-gradient(120deg,#354f65,#102739 60%,#4a5d6a); }
.ep-brands-static h2 { font-size: clamp(50px,10vw,120px); line-height: 1; letter-spacing: -.065em; color: #f5f4ed; text-align: center; margin: 0 0 36px; }
.ep-brands-static__grid { max-width: 1280px; margin: auto; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 20px; }
.ep-brands-static .ep-brand-pass { min-height: 270px; }
.ep-brands-static__end { text-align: center; margin-top: 32px; }
.ep-brands-status { background: linear-gradient(135deg,#233d54,#102333); padding: 100px 24px; color: #e9f0f5; text-align: center; }
.ep-brands-status h2 { margin: 12px 0; font-size: 24px; font-weight: 600; }
.ep-brands-status p { max-width: 480px; margin: 10px auto 24px; font-size: 14px; line-height: 1.7; color: #bfced9; }
.ep-brands-status > svg { margin: 0 auto; }
.ep-brands-status__skeletons { max-width: 740px; display: flex; gap: 18px; margin: 24px auto; }
.ep-brands-status__skeletons > div { height: 180px; flex: 1; border: 1px solid #ffffff20; background: #ffffff08; border-radius: 14px; }
.ep-brands-directory { --directory-width: min(1180px,calc(100vw - 56px)); --directory-height: min(700px,calc(100svh - 64px)); position: fixed; inset: 0; margin: auto; padding: 0; width: var(--directory-width); height: var(--directory-height); max-width: none; max-height: none; border: 1px solid rgba(255,255,255,.62); border-radius: 26px; background: rgba(229,239,245,.76); color: #172e43; box-shadow: 0 38px 140px #00000060,inset 0 1px 0 #ffffffd9; backdrop-filter: blur(30px) saturate(115%); -webkit-backdrop-filter: blur(30px) saturate(115%); overflow: hidden; }
.ep-brands-directory::backdrop { background: rgba(7,18,32,.38); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.ep-brands-directory__body { height: 100%; display: flex; flex-direction: column; }
.ep-brands-directory__heading { flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding: 27px 28px 17px; background: transparent; }
.ep-brands-directory__heading .ep-brands-eyebrow { color: #506e85; font-size: 9px; }
.ep-brands-directory__heading h2 { font-family: Georgia,'Times New Roman',serif; font-size: 36px; letter-spacing: -.04em; line-height: 1.1; margin: 5px 0 7px; color: #17374e; }
.ep-brands-directory__heading p:last-child { margin: 0; font-size: 12px; color: #405c72; }
.ep-brands-close { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; border: 1px solid #ffffffb0; background: #ffffff8f; color: #244963; }
.ep-brands-close:hover { background: white; }
.ep-brands-directory__controls { flex-shrink: 0; padding: 0 28px 14px; border-bottom: 1px solid #8cabb438; }
.ep-brands-directory__search { display: flex; align-items: center; gap: 10px; background: #ffffffb8; border: 1px solid #ffffffde; border-radius: 12px; padding: 0 13px; color: #52718a; }
.ep-brands-directory__search:focus-within { outline: 2px solid #7fabc9; }
.ep-brands-directory__search input { flex: 1; width: 100%; min-width: 0; height: 43px; background: transparent; border: 0; outline: none; font-size: 13px; color: #18374d; }
.ep-brands-directory__search button { display: grid; place-items: center; min-width: 32px; min-height: 36px; background: transparent; border: 0; }
.ep-brands-directory__filter-line { display: flex; align-items: center; gap: 14px; justify-content: space-between; margin-top: 10px; }
.ep-brands-directory__filter-line > p { margin: 0; font-size: 11px; white-space: nowrap; color: #365770; }
.ep-brands-letters { display: flex; min-width: 0; overflow-x: auto; gap: 4px; scrollbar-width: thin; }
.ep-brands-letters button { flex-shrink: 0; min-width: 32px; height: 32px; border: 0; padding: 0 9px; border-radius: 7px; background: transparent; font-size: 11px; font-weight: 600; color: #3a576f; }
.ep-brands-letters button[aria-pressed='true'] { background: #214961; color: white; }
.ep-brands-letters button:hover:not(:disabled):not([aria-pressed='true']) { background: #ffffff7f; }
.ep-brands-directory__scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #8fa9ba transparent; padding: 18px 28px 28px; outline-offset: -3px; }
.ep-brands-directory__grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 13px; }
.ep-brand-pass--compact { min-height: 212px; padding: 18px; border-radius: 13px; box-shadow: 0 5px 18px #102c4110,inset 0 1px #ffffff91; }
.ep-brand-pass--compact .ep-brand-pass__identity { padding: 14px 0; }
.ep-brand-pass--compact .ep-brand-pass__identity h3, .ep-brand-pass--compact .ep-brand-pass__identity h3.ep-brand-pass__long-name { font-size: 26px; line-height: 1.12; }
.ep-brand-pass--compact .ep-brand-pass__top { font-size: 8px; letter-spacing: .12em; }
.ep-brand-pass__description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 10px; line-height: 1.65; margin: 9px 0 0; opacity: .8; }
.ep-brand-pass--compact .ep-brand-pass__bottom { padding-top: 12px; }
.ep-brand-pass--compact .ep-brand-pass__arrow { width: 30px; height: 30px; }
.ep-brands-directory__empty { padding: 35px 12px; text-align: center; }
.ep-brands-directory__empty svg { margin: auto; color: #55758c; }
.ep-brands-directory__empty h3 { font-size: 19px; margin-top: 15px; }
.ep-brands-directory__empty p, .ep-brands-directory__empty button { font-size: 12px; }
.ep-brands-directory__empty button { background: #214961; color: white; border: 0; padding: 12px 18px; border-radius: 8px; margin-top: 15px; }
@media (max-width: 767px) {
  .ep-brands-hero__shade { background: linear-gradient(90deg,#102b42e8 0%,#142f47cf 42%,#1b334680 100%); }
  .ep-brands-directory__grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .ep-brands-static__grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 639px) {
  .ep-brand-journey .ep-brands-hero { min-height: 0; }
  .ep-brands-hero__photo { background-position: 72% center; }
  .ep-brands-hero__content { padding-left: 24px; padding-right: 24px; }
  .ep-brands-hero h1 { font-size: clamp(52px,13vw,74px); margin-top: 17px; }
  .ep-brands-hero__copy { max-width: 300px; font-size: 14px; }
  .ep-brands-hero__search { margin-top: 22px; gap: 8px; }
  .ep-brands-scroll-cue > p { max-width: 84px; text-align: right; font-size: 8px; line-height: 1.8; }
  .ep-brands-stage__top { top: calc(var(--brand-nav-height) + 18px); }
  .ep-brands-stage__top .ep-brands-eyebrow { font-size: 8px; letter-spacing: .13em; }
  .ep-brands-stage__top > span { font-size: 9px; }
  .ep-brands-stage__title h2 { font-size: 24vw; }
  .ep-brands-stage__title p { font-size: 8px; margin-top: 18px; letter-spacing: .18em; }
  .ep-brand-flight { width: 42vw; height: 214px; }
  .ep-brand-flight .ep-brand-pass { border-radius: 12px; padding: 16px 13px; }
  .ep-brand-flight .ep-brand-pass__identity h3, .ep-brand-flight .ep-brand-pass__identity h3.ep-brand-pass__long-name { font-size: clamp(22px,6vw,29px); }
  .ep-brand-flight .ep-brand-pass__top { font-size: 7px; letter-spacing: .12em; }
  .ep-brand-flight .ep-brand-pass__number { font-size: 10px; }
  .ep-brand-flight .ep-brand-pass__bottom p { font-size: 9px; }
  .ep-brand-flight .ep-brand-pass__bottom div > span { font-size: 10px; }
  .ep-brand-flight .ep-brand-pass__arrow { width: 26px; height: 26px; }
  .ep-brand-flight .ep-brand-pass__arrow svg { width: 16px; }
  .ep-brands-stage__hint { top: 86%; min-height: 34px; font-size: 10px; }
  .ep-brands-ending { top: 66%; }
  .ep-brands-ending > p { font-size: 11px; }
  .ep-brands-directory { --directory-width: calc(100vw - 24px); --directory-height: min(720px,calc(100svh - 32px)); border-radius: 20px; }
  .ep-brands-directory__heading { padding: 17px 16px 12px; gap: 12px; }
  .ep-brands-directory__heading h2 { font-size: 27px; margin-bottom: 0; }
  .ep-brands-directory__heading p:last-child { display: none; }
  .ep-brands-directory__heading .ep-brands-eyebrow { font-size: 8px; }
  .ep-brands-directory__controls { padding: 0 16px 10px; }
  .ep-brands-directory__search input { height: 38px; font-size: 12px; }
  .ep-brands-directory__scroll { padding: 12px 16px 20px; }
  .ep-brands-directory__grid { gap: 10px; }
  .ep-brand-pass--compact { padding: 13px; min-height: 190px; }
  .ep-brand-pass--compact .ep-brand-pass__identity h3, .ep-brand-pass--compact .ep-brand-pass__identity h3.ep-brand-pass__long-name { font-size: 22px; }
  .ep-brand-pass--compact .ep-brand-pass__top { font-size: 7px; }
  .ep-brand-pass--compact .ep-brand-pass__arrow { width: 25px; height: 25px; }
  .ep-brand-pass--compact .ep-brand-pass__bottom div > span, .ep-brand-pass--compact .ep-brand-pass__bottom p { font-size: 9px; }
  .ep-brand-pass__description { display: none; }
  .ep-brands-static__grid { grid-template-columns: 1fr; }
}
@media (min-width: 640px) and (max-height: 600px) {
  .ep-brand-journey .ep-brands-hero { min-height: 100svh; }
  .ep-brands-hero__content { padding-top: calc(var(--brand-nav-height) + 18px); padding-bottom: 80px; }
  .ep-brands-hero h1 { font-size: 48px; margin: 10px 0; }
  .ep-brands-hero__copy { font-size: 12px; }
  .ep-brands-hero__search { margin-top: 12px; }
  .ep-brands-host-link { margin-top: 0; }
  .ep-brands-scroll-cue { bottom: 14px; padding-top: 12px; }
  .ep-brands-directory__heading { padding: 18px 22px 12px; }
  .ep-brands-directory__heading h2 { font-size: 28px; }
}
@media (max-height: 540px) {
  .ep-brands-hero__content { padding-top: calc(var(--brand-nav-height) + 8px); padding-bottom: 66px; }
  .ep-brands-hero h1 { font-size: clamp(28px,5vw,40px); line-height: 1; margin: 10px 0; }
  .ep-brands-hero__copy { font-size: 11px; line-height: 1.5; max-width: 330px; }
  .ep-brands-hero__search { margin-top: 12px; padding-top: 3px; padding-bottom: 3px; }
  .ep-brands-hero__search input, .ep-brands-hero__search button { height: 34px; }
  .ep-brands-host-link { margin-top: 0; min-height: 30px; font-size: 10px; }
  .ep-brands-scroll-cue { bottom: 12px; padding-top: 10px; }
  .ep-brands-scroll-cue button span { height: 28px; width: 28px; }
  .ep-brands-stage__title h2 { font-size: min(19vw,160px); }
  .ep-brands-stage__title p { margin-top: 14px; font-size: 8px; }
  .ep-brands-stage__hint { top: 82%; }
  .ep-brands-ending { top: 74%; gap: 6px; }
  .ep-brands-ending > p { display: none; }
  .ep-brands-view-all { min-height: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .ep-brand-journey *, .ep-brands-directory * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`

export default function BrandsPage() {
  const { hostEnabled } = useAuth()
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [reload, setReload] = useState(0)
  const [directory, setDirectory] = useState(null)
  const pageRef = useRef(null)
  const trackRef = useRef(null)
  const stageRef = useRef(null)
  const reducedMotion = useReducedMotion()
  useNavbarClearance(pageRef)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const collected = []
        const seen = new Set()
        let page = 1
        let pages = 1
        do {
          const result = await listBrandWorlds({ page, limit: 100 })
          if (!active) return
          const batch = Array.isArray(result?.brands) ? result.brands : []
          let added = 0
          for (const brand of batch) {
            const key = getBrandKey(brand)
            if (key && !seen.has(key)) { seen.add(key); collected.push(brand); added += 1 }
          }
          const totalPages = Number(result?.pagination?.pages)
          pages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1
          // Avoid an infinite loop if an upstream server ignores pagination.
          if (!added || !batch.length) break
          page += 1
        } while (active && page <= pages)
        if (active) setBrands(collected)
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reload])

  const matchingBrands = useMemo(() => (
    brands
      .filter((brand) => matchesSearch(brand, search))
      .slice()
      .sort((a, b) => {
        const productDifference = getProductCount(b) - getProductCount(a)
        if (productDifference !== 0) return productDifference
        return getBrandName(a).localeCompare(getBrandName(b))
      })
  ), [brands, search])
  const featuredBrands = useMemo(() => matchingBrands.slice(0, PREVIEW_LIMIT), [matchingBrands])
  const signature = featuredBrands.map(getBrandKey).join('|')
  const count = featuredBrands.length
  const showScene = !loading && !error && count > 0

  useScrollScene({ trackRef, stageRef, signature, count: showScene ? count : 0, reducedMotion, paused: directory !== null })

  function scrollToBrands() {
    trackRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
  }

  function openDirectory(query = '') {
    setDirectory({ query })
  }

  function closeDirectory() {
    setDirectory(null)
  }

  function onBrandNavigate(event) {
    // Modified clicks keep normal browser new-tab behavior without closing this tab.
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) closeDirectory()
  }

  return (
    <main ref={pageRef} className="ep-brand-journey min-w-0">
      <style>{PAGE_STYLES}</style>
      <section className="ep-brands-hero" aria-labelledby="brands-page-title">
        <div className="ep-brands-hero__photo" aria-hidden="true" />
        <div className="ep-brands-hero__shade" aria-hidden="true" />
        <div className="ep-brands-hero__content">
          <p className="ep-brands-eyebrow">Brands at EPANTRY</p>
          <h1 id="brands-page-title">A world of<br />your favourites.</h1>
          <p className="ep-brands-hero__copy">Discover the names behind your everyday pantry. Find a favourite. Explore something new.</p>
          <form role="search" aria-label="Find a brand" className="ep-brands-hero__search" onSubmit={(event) => { event.preventDefault(); if (!loading && !error) openDirectory(search) }}>
            <Search size={19} strokeWidth={1.6} aria-hidden="true" />
            <label className="sr-only" htmlFor="brands-search">Search brands</label>
            <input id="brands-search" type="search" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a brand by name" aria-controls="brand-journey" />
            {search && <button type="button" className="ep-brands-clear-search" aria-label="Clear brand search" onClick={() => setSearch('')}><X size={16} aria-hidden="true" /></button>}
            <button type="submit" aria-label="See matching brands" disabled={loading || Boolean(error)}><ArrowRight size={19} aria-hidden="true" /></button>
          </form>
          {hostEnabled && <Link to="/host/brands" className="ep-brands-host-link"><ShieldCheck size={13} aria-hidden="true" /> Brand Authority Workspace <ArrowUpRight size={13} aria-hidden="true" /></Link>}
        </div>
        <div className="ep-brands-scroll-cue">
          <button type="button" onClick={scrollToBrands}><span><ArrowDown size={18} aria-hidden="true" /></span> Scroll to discover</button>
          <p>{!loading && !error ? `${brands.length} brand worlds` : 'Discover the collection'}</p>
        </div>
      </section>

      {!showScene ? (
        <section id="brand-journey" ref={trackRef} className="ep-brands-status" aria-label="Brand directory status">
          {loading ? <div role="status"><p className="ep-brands-eyebrow">Loading the brand collection</p><div className="ep-brands-status__skeletons" aria-hidden="true"><div /><div /><div /></div></div> : error ? <div role="alert"><CircleAlert size={28} className="mx-auto" aria-hidden="true" /><h2>We couldn't load the brands</h2><p>{error}</p><button type="button" className="ep-brands-view-all" onClick={() => setReload((value) => value + 1)}><RotateCcw size={15} aria-hidden="true" /> Try again</button></div> : <><Search size={28} aria-hidden="true" /><h2>{search.trim() ? 'No matching brands' : 'No brands to show yet'}</h2><p>{search.trim() ? 'Try a different name or browse the full collection.' : 'Brand Worlds will appear here when they are available.'}</p>{search.trim() && <button type="button" className="ep-brands-view-all" onClick={() => setSearch('')}>Clear search <X size={15} aria-hidden="true" /></button>}</>}
        </section>
      ) : reducedMotion ? (
        <section id="brand-journey" ref={trackRef} className="ep-brands-static" aria-labelledby="brand-scene-title">
          <h2 id="brand-scene-title">BRAND</h2>
          <div className="ep-brands-static__grid">{featuredBrands.map((brand, index) => <BrandIdentityCard key={getBrandKey(brand)} brand={brand} index={index} />)}</div>
          <div className="ep-brands-static__end"><button type="button" className="ep-brands-view-all" onClick={() => openDirectory()}>View all brands <span>{brands.length}</span><ArrowUpRight size={17} aria-hidden="true" /></button></div>
        </section>
      ) : (
        <section id="brand-journey" ref={trackRef} className="ep-brands-track" aria-labelledby="brand-scene-title" style={{ height: `${(getSceneLength(count) + 1) * 100}svh` }}>
          <div ref={stageRef} className="ep-brands-stage">
            <button type="button" className="ep-brands-keyboard-shortcut" onClick={() => openDirectory()}>Skip animation and browse all brands</button>
            <div className="ep-brands-stage__top"><p className="ep-brands-eyebrow">EPANTRY / Brand collection</p><span>Explore at your own pace</span></div>
            <div className="ep-brands-stage__title"><h2 id="brand-scene-title" data-brand-word>BRAND</h2><p>A name worth discovering</p></div>
            <div data-brand-scene-hint className="ep-brands-stage__hint"><ArrowDown size={14} aria-hidden="true" /> Scroll to meet the brands</div>
            {featuredBrands.map((brand, index) => (
              <div key={getBrandKey(brand)} data-brand-flight={index} className="ep-brand-flight" aria-hidden="true"><BrandIdentityCard brand={brand} index={index} /></div>
            ))}
            <div data-brand-ending className="ep-brands-ending" aria-hidden="true">
              <p>There's more to explore.</p>
              <button type="button" className="ep-brands-view-all" onClick={() => openDirectory()} aria-haspopup="dialog">View all brands <span>{brands.length}</span><ArrowUpRight size={17} aria-hidden="true" /></button>
            </div>
            <div className="ep-brands-stage__bottom" aria-hidden="true"><div className="ep-brands-stage__meter"><span data-brand-progress /></div><div><span>Scroll down to explore. Scroll up to revisit.</span><span data-brand-counter>00 / {String(count).padStart(2, '0')}</span></div></div>
          </div>
        </section>
      )}
      {directory !== null && <BrandDirectory brands={brands} initialQuery={directory.query} onClose={closeDirectory} onNavigate={onBrandNavigate} />}
    </main>
  )
}
