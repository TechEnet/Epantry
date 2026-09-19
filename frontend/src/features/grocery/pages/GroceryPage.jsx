import {
  ArrowDown,
  ArrowRight,
  CircleAlert,
  Grid3X3,
  Leaf,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import EmptyState from '../../../components/common/EmptyState'
import useGroceryCatalog from '../hooks/useGroceryCatalog'

const PREVIEW_PRODUCT_COUNT = 6
const DEFAULT_PRODUCT_LIMIT = 24
const CARD_TRAVEL = 1.72
const CARD_GAP = 0.92
const FIRST_CARD_OFFSET = -0.24
const ENDING_REVEAL_DISTANCE = 0.58
const ENDING_HOLD_DISTANCE = 0.32

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function getProductKey(product) {
  return String(product?.productVersionId || product?.id || product?._id || product?.slug || '')
}

function getProductName(product) {
  return String(product?.displayName || 'Grocery product').trim()
}

function getProductImage(product) {
  return product?.image?.url || ''
}

function getProductPath(product) {
  return `/grocery/product/${encodeURIComponent(product?.slug || '')}`
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

function useNavbarClearance(pageRef) {
  useEffect(() => {
    const header = document.querySelector('header')
    const page = pageRef.current

    if (!header || !page) return undefined

    const update = () => {
      const height = Math.ceil(header.getBoundingClientRect().height)
      page.style.setProperty('--grocery-nav-height', `${height}px`)
    }

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(update)
      : null

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
  const lastStart = FIRST_CARD_OFFSET + (count - 1) * CARD_GAP
  const lastExit = lastStart + CARD_TRAVEL

  // One viewport is consumed by the sticky stage itself. Keep an additional
  // distance after the ending has fully appeared so the final Grocery scene
  // settles before normal page scrolling resumes.
  return lastExit + ENDING_REVEAL_DISTANCE + ENDING_HOLD_DISTANCE + 1
}

function useGroceryScrollScene({
  trackRef,
  stageRef,
  count,
  signature,
  reducedMotion,
  paused,
}) {
  useEffect(() => {
    const track = trackRef.current
    const stage = stageRef.current

    if (!track || !stage || !count || reducedMotion || paused) return undefined

    const cards = Array.from(stage.querySelectorAll('[data-grocery-flight]'))
    const names = Array.from(stage.querySelectorAll('[data-grocery-name]'))
    const ending = stage.querySelector('[data-grocery-ending]')
    const hint = stage.querySelector('[data-grocery-hint]')
    const progressBar = stage.querySelector('[data-grocery-progress]')
    const counter = stage.querySelector('[data-grocery-counter]')

    const lastStart = FIRST_CARD_OFFSET + (count - 1) * CARD_GAP
    const lastExit = lastStart + CARD_TRAVEL
    const travelLength = getSceneLength(count)
    let frame = null
    let currentDistance = null
    let targetDistance = 0
    let lastTime = 0
    let stageHeight = 1
    let stageWidth = 1
    let cardWidth = 1
    let cardHeight = 1
    let smallScreen = false
    let cardX = 0

    const smoothstep = (value) => {
      const t = clamp(value)
      return t * t * (3 - 2 * t)
    }

    const readLayout = () => {
      stageHeight = stage.clientHeight || 1
      stageWidth = stage.clientWidth || 1
      cardWidth = cards[0]?.offsetWidth || 1
      cardHeight = cards[0]?.offsetHeight || 1
      smallScreen = stageWidth < 700

      const cardCenterX = smallScreen
        ? stageWidth * 0.5
        : stageWidth * 0.675

      cardX = cardCenterX - cardWidth / 2
    }

    const readTargetDistance = () => {
      const rect = track.getBoundingClientRect()
      targetDistance = clamp(-rect.top / stageHeight, 0, travelLength)

      if (currentDistance === null) currentDistance = targetDistance
    }

    const render = (distance) => {
      if (!stageHeight || !stageWidth) return

      let activeIndex = 0
      let activeStrength = -1

      cards.forEach((card, index) => {
        const start = FIRST_CARD_OFFSET + index * CARD_GAP
        const raw = (distance - start) / CARD_TRAVEL
        const t = clamp(raw)
        const visible = raw > -0.035 && raw < 1.025

        const entranceEnd = 0.34
        const holdEnd = 0.61
        let y
        let scale

        if (t < entranceEnd) {
          const p = smoothstep(t / entranceEnd)
          y = stageHeight * 1.08 + (stageHeight * 0.50 - cardHeight / 2 - stageHeight * 1.08) * p
          scale = 0.80 + 0.20 * p
        } else if (t < holdEnd) {
          const p = smoothstep((t - entranceEnd) / (holdEnd - entranceEnd))
          y = stageHeight * 0.50 - cardHeight / 2 - p * 10
          scale = 1
        } else {
          const p = smoothstep((t - holdEnd) / (1 - holdEnd))
          const restingY = stageHeight * 0.50 - cardHeight / 2 - 10
          const exitTravel = Math.min(stageHeight * 0.44, cardHeight * 0.72)
          y = restingY - p * exitTravel
          scale = 1 - 0.07 * p
        }

        const fadeIn = smoothstep(t / 0.12)
        const fadeOut = 1 - smoothstep((t - 0.68) / 0.25)
        const opacity = visible ? Math.min(fadeIn, fadeOut) : 0
        const centreStrength = visible ? 1 - Math.min(1, Math.abs(t - 0.47) / 0.47) : 0

        if (centreStrength > activeStrength) {
          activeStrength = centreStrength
          activeIndex = index
        }

        card.style.transform = `translate3d(${cardX.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`
        card.style.opacity = opacity.toFixed(3)
        card.style.visibility = opacity > 0.004 ? 'visible' : 'hidden'
        card.style.pointerEvents = opacity > 0.38 && centreStrength > 0.38 ? 'auto' : 'none'
        card.style.zIndex = String(10 + index)
        card.inert = !(opacity > 0.38 && centreStrength > 0.38)
        card.setAttribute('aria-hidden', String(opacity <= 0.004))

        const link = card.querySelector('a')
        if (link) link.tabIndex = opacity > 0.38 && centreStrength > 0.38 ? 0 : -1

        const name = names[index]
        if (name) {
          const nameOpacity = smoothstep((centreStrength - 0.18) / 0.60)
          const offset = 30 * (1 - nameOpacity)
          name.style.opacity = nameOpacity.toFixed(3)
          name.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
          name.style.visibility = nameOpacity > 0.02 ? 'visible' : 'hidden'
        }
      })

      const endProgress = smoothstep((distance - lastExit + 0.06) / ENDING_REVEAL_DISTANCE)

      if (ending) {
        ending.style.opacity = endProgress.toFixed(3)
        ending.style.transform = `translate3d(0, ${(26 * (1 - endProgress)).toFixed(2)}px, 0) scale(${(0.985 + endProgress * 0.015).toFixed(4)})`
        ending.style.visibility = endProgress > 0.01 ? 'visible' : 'hidden'
        ending.style.pointerEvents = endProgress > 0.06 ? 'auto' : 'none'
        ending.inert = endProgress <= 0.06
        ending.setAttribute('aria-hidden', String(endProgress <= 0.01))
      }

      if (hint) {
        const hintOpacity = distance < lastExit
          ? clamp(1 - distance / Math.max(lastExit, 1) * 0.42)
          : 1 - endProgress
        hint.style.opacity = hintOpacity.toFixed(3)
      }

      if (progressBar) {
        progressBar.style.transform = `scaleX(${clamp(distance / Math.max(lastExit, 1)).toFixed(4)})`
      }

      if (counter) {
        counter.textContent = `${String(Math.min(activeIndex + 1, count)).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
      }
    }

    const animate = (time) => {
      frame = null

      if (currentDistance === null) currentDistance = targetDistance
      const deltaMs = lastTime ? Math.min(48, time - lastTime) : 16.7
      lastTime = time

      const smoothing = 1 - Math.exp(-20 * deltaMs / 1000)
      currentDistance += (targetDistance - currentDistance) * smoothing

      if (Math.abs(targetDistance - currentDistance) < 0.0002) {
        currentDistance = targetDistance
      }

      render(currentDistance)

      if (Math.abs(targetDistance - currentDistance) >= 0.0002) {
        frame = window.requestAnimationFrame(animate)
      }
    }

    const schedule = () => {
      readTargetDistance()
      if (frame === null) frame = window.requestAnimationFrame(animate)
    }

    const handleResize = () => {
      readLayout()
      schedule()
    }

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(handleResize)
      : null

    observer?.observe(stage)
    readLayout()
    readTargetDistance()
    render(currentDistance ?? targetDistance)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })
    window.addEventListener('pageshow', schedule)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pageshow', schedule)
    }
  }, [trackRef, stageRef, count, signature, reducedMotion, paused])
}

function ProductImageCard({ product, compact = false, onNavigate }) {
  const imageUrl = getProductImage(product)
  const productName = getProductName(product)

  return (
    <Link
      to={getProductPath(product)}
      onClick={onNavigate}
      aria-label={`View ${productName}`}
      className={`ep-grocery-image-card ${compact ? 'ep-grocery-image-card--compact' : ''}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={product?.image?.alt || productName}
          loading={compact ? 'lazy' : 'eager'}
        />
      ) : (
        <div className="ep-grocery-image-card__empty" aria-hidden="true">
          <Grid3X3 size={38} strokeWidth={1.25} />
        </div>
      )}
    </Link>
  )
}

function lockDialogViewport(dialog, closeRef) {
  if (!dialog) return () => {}

  const returnFocus = document.activeElement
  const root = document.documentElement
  const body = document.body
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const savedRootOverflow = root.style.getPropertyValue('overflow')
  const savedRootOverflowPriority = root.style.getPropertyPriority('overflow')
  const savedScrollBehavior = root.style.getPropertyValue('scroll-behavior')
  const savedScrollPriority = root.style.getPropertyPriority('scroll-behavior')
  const savedBodyPadding = body.style.getPropertyValue('padding-right')
  const savedBodyPaddingPriority = body.style.getPropertyPriority('padding-right')
  const scrollbar = window.innerWidth - root.clientWidth
  const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0

  if (scrollbar > 0) body.style.setProperty('padding-right', `${currentPadding + scrollbar}px`)
  root.style.setProperty('overflow', 'hidden')
  dialog.showModal()
  closeRef.current?.focus({ preventScroll: true })

  return () => {
    if (dialog.open) dialog.close()

    if (savedBodyPadding) body.style.setProperty('padding-right', savedBodyPadding, savedBodyPaddingPriority)
    else body.style.removeProperty('padding-right')

    if (savedRootOverflow) root.style.setProperty('overflow', savedRootOverflow, savedRootOverflowPriority)
    else root.style.removeProperty('overflow')

    root.style.setProperty('scroll-behavior', 'auto', 'important')
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })

    if (savedScrollBehavior) root.style.setProperty('scroll-behavior', savedScrollBehavior, savedScrollPriority)
    else root.style.removeProperty('scroll-behavior')

    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  }
}

function ProductDirectory({ products, loading, onClose }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const backdropPress = useRef(false)

  useEffect(() => lockDialogViewport(dialogRef.current, closeRef), [])

  function isOutside(event) {
    const rect = dialogRef.current?.getBoundingClientRect()
    return rect && (
      event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="ep-grocery-modal"
      aria-labelledby="all-groceries-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget && isOutside(event)
      }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget && isOutside(event)) onClose()
        backdropPress.current = false
      }}
    >
      <div className="ep-grocery-modal__body">
        <header className="ep-grocery-modal__header">
          <div>
            <p>EPANTRY Grocery</p>
            <h2 id="all-groceries-title">All groceries</h2>
            <span>{products.length} products available in this view</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close all groceries">
            <X size={21} aria-hidden="true" />
          </button>
        </header>

        <div className="ep-grocery-modal__scroll">
          {loading ? (
            <div className="ep-grocery-modal__loading" role="status">Loading groceries…</div>
          ) : (
            <div className="ep-grocery-modal__product-grid">
              {products.map((product) => (
                <div
                  key={getProductKey(product)}
                  className="ep-grocery-modal__product-item"
                >
                  <ProductImageCard
                    product={product}
                    compact
                    onNavigate={onClose}
                  />
                  <div className="ep-grocery-modal__product-name">
                    {getProductName(product)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}

function CategoryDirectory({ categories, onClose, onSelect }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const backdropPress = useRef(false)

  useEffect(() => lockDialogViewport(dialogRef.current, closeRef), [])

  function isOutside(event) {
    const rect = dialogRef.current?.getBoundingClientRect()
    return rect && (
      event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="ep-grocery-modal ep-grocery-modal--categories"
      aria-labelledby="all-categories-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget && isOutside(event)
      }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget && isOutside(event)) onClose()
        backdropPress.current = false
      }}
    >
      <div className="ep-grocery-modal__body">
        <header className="ep-grocery-modal__header">
          <div>
            <p>Browse by category</p>
            <h2 id="all-categories-title">All categories</h2>
            <span>Choose a category to narrow the grocery collection.</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close categories">
            <X size={21} aria-hidden="true" />
          </button>
        </header>

        <div className="ep-grocery-modal__scroll">
          <div className="ep-grocery-modal__category-grid">
            {categories.map((category, index) => (
              <button
                key={category.id || category.slug || category.name}
                type="button"
                onClick={() => onSelect(category.slug)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{category.name}</strong>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </dialog>
  )
}

const PAGE_STYLES = `
.ep-grocery-journey { --grocery-nav-height: 0px; background: #f5f4ef; color: #103b2e; }
.ep-grocery-hero { height: 100vh; height: 100svh; min-height: 0; position: relative; display: flex; align-items: center; overflow: hidden; isolation: isolate; background: #0b3f30; }
.ep-grocery-hero__photo,.ep-grocery-hero__shade { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.ep-grocery-hero__photo { background: #123e30 url('/hero/grocery.png') no-repeat 61% center / cover; transform: scale(1.002); }
.ep-grocery-hero__shade { background: linear-gradient(90deg,rgba(5,45,34,.97) 0%,rgba(8,56,42,.94) 28%,rgba(10,55,41,.75) 40%,rgba(10,55,41,.26) 55%,rgba(8,35,27,.03) 72%); }
.ep-grocery-hero__content { width: 100%; max-width: 1680px; margin: 0 auto; padding: calc(var(--grocery-nav-height) + 28px) clamp(24px,5vw,88px) 128px; }
.ep-grocery-hero__eyebrow { display: inline-flex; align-items: center; gap: 10px; border: 1px solid #e2c98b80; border-radius: 999px; padding: 8px 13px; color: #f5e8c7; background: #0a3b2da8; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); font-size: 10px; line-height: 1; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
.ep-grocery-hero h1 { max-width: 760px; margin: 22px 0 16px; font-family: Georgia,'Times New Roman',serif; font-size: clamp(62px,6.7vw,108px); line-height: .95; font-weight: 500; letter-spacing: -.055em; color: #fffaf0; }
.ep-grocery-hero__copy { max-width: 390px; margin: 0; font-size: 15px; line-height: 1.75; color: #e0ece4; }
.ep-grocery-hero__filters { width: min(100%,560px); margin-top: 30px; padding: 10px; border: 1px solid #ffffff80; border-radius: 18px; background: #f8fbf7ed; box-shadow: 0 18px 48px #021c151f; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
.ep-grocery-hero__search { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 7px 0 14px; border: 1px solid #d7e2d9; border-radius: 12px; background: white; color: #667c70; }
.ep-grocery-hero__search:focus-within { outline: 2px solid #80a790; outline-offset: 2px; }
.ep-grocery-hero__search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; font-size: 14px; color: #153f31; }
.ep-grocery-hero__search button { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border: 0; border-radius: 9px; background: #155941; color: white; }
.ep-grocery-hero__selects { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-top: 8px; }
.ep-grocery-hero__selects select { min-width: 0; height: 40px; appearance: none; border: 1px solid #dbe5dd; border-radius: 10px; background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23566f62' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat calc(100% - 11px) center; padding: 0 30px 0 12px; color: #365246; font-size: 12px; font-weight: 700; outline: 0; }
.ep-grocery-hero__reset { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border: 1px solid transparent; border-radius: 10px; background: transparent; padding: 0 10px; color: #52695d; font-size: 12px; font-weight: 700; }
.ep-grocery-scroll-cue { position: absolute; z-index: 2; left: clamp(24px,5vw,88px); right: clamp(24px,5vw,88px); bottom: 27px; display: flex; align-items: end; justify-content: space-between; gap: 20px; color: #f4f8f3; }
.ep-grocery-scroll-cue button { display: inline-flex; align-items: center; gap: 10px; border: 0; background: transparent; color: inherit; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.ep-grocery-scroll-cue button span { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #ffffff66; border-radius: 50%; background: #ffffff14; backdrop-filter: blur(10px); animation: ep-grocery-cue 1.9s ease-in-out infinite; }
.ep-grocery-scroll-cue p { margin: 0; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #dae7de; }
@keyframes ep-grocery-cue { 0%,100% { transform: translateY(0); } 50% { transform: translateY(5px); } }

.ep-grocery-track { position: relative; background: #081f19; }
.ep-grocery-stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; isolation: isolate; background: linear-gradient(118deg,#061b16 0%,#0c3327 42%,#335847 66%,#d7e3d9 100%); }
.ep-grocery-stage::before { content: ''; position: absolute; inset: 0; z-index: -2; background: radial-gradient(circle at 67% 48%,#ffffff2c 0%,#ffffff10 26%,transparent 47%),linear-gradient(90deg,rgba(3,19,15,.36),transparent 58%); }
.ep-grocery-stage::after { content: ''; position: absolute; top: 0; bottom: 0; left: 31%; width: 1px; background: linear-gradient(180deg,transparent,#d5e6da55 15%,#d5e6da72 50%,#d5e6da55 85%,transparent); }
.ep-grocery-stage__meta { position: absolute; top: calc(var(--grocery-nav-height) + 28px); left: clamp(24px,4.4vw,78px); right: clamp(24px,4.4vw,78px); display: flex; justify-content: space-between; gap: 18px; color: #f2f7f3; font-size: 10px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; text-shadow: 0 2px 14px rgba(0,0,0,.48); }
.ep-grocery-stage__left { position: absolute; left: clamp(28px,5.2vw,92px); top: 50%; width: min(24vw,360px); transform: translateY(-50%); color: white; padding: 30px 18px 30px 0; text-shadow: 0 3px 26px rgba(0,0,0,.58); }
.ep-grocery-stage__left::before { content: ''; position: absolute; z-index: -1; inset: -28px -24px -28px -34px; border: 1px solid rgba(231,241,234,.10); border-radius: 28px; background: linear-gradient(100deg,rgba(1,22,16,.94) 0%,rgba(3,31,23,.88) 62%,rgba(3,31,23,.50) 86%,transparent 100%); box-shadow: 0 24px 60px rgba(0,12,8,.24),inset 0 1px 0 rgba(255,255,255,.04); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); pointer-events: none; }
.ep-grocery-stage__label { display: inline-flex; align-items: center; min-height: 48px; border: 1px solid rgba(238,213,151,.72); border-radius: 12px; padding: 0 18px; background: rgba(2,30,22,.94); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); color: #fff9e9; box-shadow: 0 12px 30px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08); font-size: 13px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
.ep-grocery-stage__names { position: relative; width: 100%; min-height: 300px; margin-top: 24px; overflow: visible; }
.ep-grocery-stage__name { position: absolute; inset: 0; width: 100%; max-width: 100%; visibility: hidden; will-change: transform,opacity; }
.ep-grocery-stage__name span { display: block; margin-bottom: 12px; color: #f1e3bc; font-size: 12px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
.ep-grocery-stage__name h2 { margin: 0; width: 100%; max-width: 100%; overflow-wrap: normal; word-break: normal; hyphens: none; font-family: Georgia,'Times New Roman',serif; font-size: clamp(34px,3.35vw,54px); line-height: .96; font-weight: 600; letter-spacing: -.042em; color: #fffdf4; text-wrap: balance; text-shadow: 0 3px 24px rgba(0,0,0,.72); }
.ep-grocery-stage__name p { margin: 17px 0 0; color: #f0f6f1; font-size: 15px; line-height: 1.55; font-weight: 750; text-shadow: 0 2px 15px rgba(0,0,0,.56); }
.ep-grocery-flight { position: absolute; top: 0; left: 0; width: min(42vw,570px); aspect-ratio: 1 / 1; opacity: 0; visibility: hidden; will-change: transform,opacity; backface-visibility: hidden; transform-style: preserve-3d; }
.ep-grocery-image-card { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; border: 1px solid #ffffffb8; border-radius: 28px; background: rgba(250,252,248,.94); box-shadow: 0 34px 90px #00120d47,inset 0 1px 0 #ffffff; outline: none; }
.ep-grocery-image-card::before { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; border-radius: inherit; background: linear-gradient(135deg,#ffffff55,transparent 28%,transparent 72%,#0c3b2b12); }
.ep-grocery-image-card img { width: 100%; height: 100%; object-fit: contain; padding: clamp(22px,3vw,54px); background: linear-gradient(145deg,#f8faf6,#eef3eb); transition: transform .35s ease; }
.ep-grocery-image-card:hover img { transform: scale(1.035); }
.ep-grocery-image-card:focus-visible { outline: 3px solid #f2ddb0; outline-offset: 5px; }
.ep-grocery-image-card__empty { display: grid; place-items: center; width: 100%; height: 100%; color: #739181; background: linear-gradient(145deg,#f8faf6,#eef3eb); }
.ep-grocery-stage__hint { position: absolute; left: clamp(24px,4.4vw,78px); bottom: 92px; display: inline-flex; align-items: center; gap: 8px; color: #edf5ef; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-shadow: 0 2px 14px rgba(0,0,0,.58); transition: opacity .15s linear; }
.ep-grocery-stage__bottom { position: absolute; left: clamp(24px,4.4vw,78px); right: clamp(24px,4.4vw,78px); bottom: 26px; color: #e4eee7; font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; text-shadow: 0 2px 12px rgba(0,0,0,.48); }
.ep-grocery-stage__meter { height: 1px; overflow: hidden; background: #d9eadf2c; }
.ep-grocery-stage__meter span { display: block; width: 100%; height: 100%; transform: scaleX(0); transform-origin: left; background: #d7e6dc; }
.ep-grocery-stage__bottom > div:last-child { display: flex; justify-content: space-between; gap: 16px; margin-top: 10px; }

.ep-grocery-ending { position: absolute; inset: 0; opacity: 0; visibility: hidden; will-change: transform,opacity; }
.ep-grocery-ending__view { position: absolute; left: 57%; top: 17%; width: min(31vw,420px); height: min(29vw,350px); max-height: 42svh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; border: 1px solid #ffffff96; border-radius: 24px; background: linear-gradient(145deg,#f8fcf6ed,#dce9dfed); color: #123c2e; box-shadow: 0 26px 70px #00150e35,inset 0 1px 0 #ffffffdf; backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); }
.ep-grocery-ending__view > span { font-size: 9px; font-weight: 900; letter-spacing: .17em; text-transform: uppercase; color: #587869; }
.ep-grocery-ending__view h3 { max-width: 300px; margin: 0; text-align: center; font-family: Georgia,'Times New Roman',serif; font-size: clamp(30px,3.25vw,46px); line-height: 1; font-weight: 500; letter-spacing: -.045em; }
.ep-grocery-ending__view button { display: inline-flex; align-items: center; gap: 10px; min-height: 46px; border: 1px solid #164c39; border-radius: 999px; background: #123f30; padding: 0 20px; color: white; font-size: 12px; font-weight: 800; }
.ep-grocery-ending__categories { position: absolute; left: calc(31% + 28px); right: clamp(24px,4.4vw,78px); bottom: 64px; min-height: 184px; padding: 20px 22px 22px; border: 1px solid rgba(255,255,255,.28); border-radius: 22px; background: linear-gradient(135deg,rgba(3,30,22,.82),rgba(25,73,54,.62)); box-shadow: 0 24px 64px rgba(0,18,12,.30),inset 0 1px 0 rgba(255,255,255,.06); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
.ep-grocery-ending__categories-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; color: #fffdf6; }
.ep-grocery-ending__categories-head p { margin: 0; font-size: 12px; font-weight: 900; letter-spacing: .17em; text-transform: uppercase; }
.ep-grocery-ending__categories-head button { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; border: 1px solid rgba(255,255,255,.28); border-radius: 999px; background: rgba(255,255,255,.08); padding: 0 12px; color: #fffaf0; font-size: 11px; font-weight: 850; }
.ep-grocery-ending__category-row { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 11px; }
.ep-grocery-ending__category-row button { min-width: 0; min-height: 104px; border: 1px solid rgba(255,255,255,.42); border-radius: 16px; background: rgba(255,255,255,.17); padding: 16px; text-align: left; color: #fffdf7; box-shadow: inset 0 1px 0 rgba(255,255,255,.10); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transition: background .2s ease,border-color .2s ease,transform .2s ease; }
.ep-grocery-ending__category-row button:hover { transform: translateY(-2px); border-color: #ffffff85; background: #ffffff22; }
.ep-grocery-ending__category-row button span { display: block; margin-bottom: 12px; color: #d7e7dd; font-size: 9px; font-weight: 850; letter-spacing: .13em; }
.ep-grocery-ending__category-row button strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 850; }

.ep-grocery-static { padding: 60px 24px 90px; background: linear-gradient(135deg,#09251d,#456754); color: white; }
.ep-grocery-static h2 { max-width: 1300px; margin: 0 auto 26px; font-family: Georgia,'Times New Roman',serif; font-size: 42px; }
.ep-grocery-static__grid { max-width: 1300px; margin: 0 auto; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; }
.ep-grocery-static__grid .ep-grocery-image-card { aspect-ratio: 1 / 1; }
.ep-grocery-static__end { display: flex; justify-content: center; margin-top: 30px; }
.ep-grocery-static__end button { min-height: 44px; border: 0; border-radius: 999px; background: white; padding: 0 20px; color: #123f30; font-weight: 800; }

.ep-grocery-status { min-height: 56svh; display: grid; place-items: center; background: linear-gradient(135deg,#0a2d23,#345746); padding: 60px 24px; color: white; }
.ep-grocery-status > div { width: min(620px,100%); text-align: center; }
.ep-grocery-status h2 { margin: 12px 0 8px; font-family: Georgia,'Times New Roman',serif; font-size: 31px; font-weight: 500; }
.ep-grocery-status p { margin: 0 auto 20px; max-width: 460px; color: #cbdad0; font-size: 13px; line-height: 1.7; }
.ep-grocery-status button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; border: 1px solid #ffffff60; border-radius: 999px; background: #ffffff14; padding: 0 17px; color: white; font-weight: 800; }

.ep-grocery-modal { position: fixed; inset: 0; margin: auto; width: min(1180px,calc(100vw - 56px)); height: min(760px,calc(100svh - 58px)); max-width: none; max-height: none; padding: 0; overflow: hidden; border: 1px solid #ffffffc7; border-radius: 28px; background: rgba(229,239,232,.80); color: #123d2f; box-shadow: 0 40px 150px #00150f70,inset 0 1px 0 #ffffff; backdrop-filter: blur(32px) saturate(118%); -webkit-backdrop-filter: blur(32px) saturate(118%); }
.ep-grocery-modal::backdrop { background: rgba(3,19,14,.48); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.ep-grocery-modal__body { height: 100%; display: flex; flex-direction: column; }
.ep-grocery-modal__header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding: 26px 28px 17px; border-bottom: 1px solid #315b4930; }
.ep-grocery-modal__header p { margin: 0; color: #57776a; font-size: 9px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
.ep-grocery-modal__header h2 { margin: 5px 0 5px; font-family: Georgia,'Times New Roman',serif; font-size: 38px; line-height: 1; font-weight: 500; letter-spacing: -.04em; }
.ep-grocery-modal__header span { color: #577066; font-size: 11px; }
.ep-grocery-modal__header > button { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border: 1px solid #ffffffc9; border-radius: 50%; background: #ffffff9e; color: #244f3e; }
.ep-grocery-modal__scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 20px 28px 28px; scrollbar-width: thin; scrollbar-color: #7f9c8d transparent; }
.ep-grocery-modal__product-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; }
.ep-grocery-modal__product-item { min-width: 0; display: flex; flex-direction: column; }
.ep-grocery-image-card--compact { height: auto; flex: 0 0 auto; aspect-ratio: 1 / 1; border-radius: 18px; box-shadow: 0 8px 28px #0a2d2116,inset 0 1px 0 #ffffff; }
.ep-grocery-image-card--compact img { padding: 24px; }
.ep-grocery-modal__product-name { min-height: 44px; padding: 10px 4px 2px; overflow: visible; white-space: normal; color: #173f31; font-size: 13px; font-weight: 850; line-height: 1.35; overflow-wrap: anywhere; }
.ep-grocery-modal__loading { display: grid; place-items: center; min-height: 300px; color: #557568; font-size: 13px; }
.ep-grocery-modal--categories { width: min(980px,calc(100vw - 56px)); height: min(650px,calc(100svh - 64px)); }
.ep-grocery-modal__category-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.ep-grocery-modal__category-grid button { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; min-height: 86px; border: 1px solid #ffffffb3; border-radius: 16px; background: #ffffff88; padding: 14px 16px; text-align: left; color: #173f31; box-shadow: 0 6px 22px #113b2b0d; }
.ep-grocery-modal__category-grid button:hover { background: #ffffffc7; }
.ep-grocery-modal__category-grid button span { font-size: 9px; font-weight: 900; color: #739184; letter-spacing: .1em; }
.ep-grocery-modal__category-grid button strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }

@media (max-width: 900px) {
  .ep-grocery-stage::after { left: 34%; }
  .ep-grocery-stage__left { width: min(27vw,340px); }
  .ep-grocery-flight { width: min(48vw,470px); }
  .ep-grocery-ending__view { left: 53%; width: min(36vw,410px); }
  .ep-grocery-ending__categories { left: calc(34% + 18px); }
  .ep-grocery-modal__product-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
}

@media (max-width: 699px) {
  .ep-grocery-hero__photo { background-position: 69% center; }
  .ep-grocery-hero__shade { background: linear-gradient(90deg,rgba(5,45,34,.95),rgba(5,45,34,.74) 58%,rgba(5,45,34,.42)); }
  .ep-grocery-hero__content { padding-left: 22px; padding-right: 22px; padding-bottom: 112px; }
  .ep-grocery-hero h1 { max-width: 330px; font-size: clamp(50px,13vw,72px); }
  .ep-grocery-hero__copy { max-width: 320px; font-size: 13px; }
  .ep-grocery-hero__filters { width: 100%; max-width: 430px; margin-top: 22px; }
  .ep-grocery-hero__selects { grid-template-columns: 1fr 1fr; }
  .ep-grocery-hero__reset { grid-column: span 2; }
  .ep-grocery-scroll-cue { left: 22px; right: 22px; }
  .ep-grocery-scroll-cue p { display: none; }
  .ep-grocery-stage::after { display: none; }
  .ep-grocery-stage__meta { top: calc(var(--grocery-nav-height) + 18px); left: 18px; right: 18px; }
  .ep-grocery-stage__left { z-index: 40; top: calc(var(--grocery-nav-height) + 72px); left: 18px; width: calc(100% - 36px); transform: none; padding: 0; pointer-events: none; }
  .ep-grocery-stage__left::before { inset: -12px -18px; }
  .ep-grocery-stage__label { min-height: 34px; font-size: 8px; }
  .ep-grocery-stage__names { min-height: 90px; margin-top: 10px; }
  .ep-grocery-stage__name h2 { max-width: 330px; font-size: clamp(34px,9vw,48px); }
  .ep-grocery-stage__name p { display: none; }
  .ep-grocery-flight { width: min(76vw,430px); }
  .ep-grocery-image-card { border-radius: 22px; }
  .ep-grocery-stage__hint { left: 18px; bottom: 70px; }
  .ep-grocery-stage__bottom { left: 18px; right: 18px; bottom: 20px; }
  .ep-grocery-ending__view { left: 50%; top: 27%; width: min(72vw,360px); height: min(66vw,320px); transform: translateX(-50%); }
  .ep-grocery-ending__categories { left: 18px; right: 18px; bottom: 60px; padding: 14px; }
  .ep-grocery-ending__category-row { grid-template-columns: repeat(3,minmax(0,1fr)); }
  .ep-grocery-ending__category-row button:nth-child(n+4) { display: none; }
  .ep-grocery-ending__category-row button { min-height: 82px; }
  .ep-grocery-modal { width: calc(100vw - 22px); height: calc(100svh - 28px); border-radius: 20px; }
  .ep-grocery-modal__header { padding: 18px 16px 13px; }
  .ep-grocery-modal__header h2 { font-size: 29px; }
  .ep-grocery-modal__scroll { padding: 14px 16px 20px; }
  .ep-grocery-modal__product-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .ep-grocery-image-card--compact img { padding: 15px; }
  .ep-grocery-modal__category-grid { grid-template-columns: 1fr; }
  .ep-grocery-static__grid { grid-template-columns: 1fr 1fr; }
}

@media (max-height: 590px) and (min-width: 700px) {
  .ep-grocery-hero__content { padding-top: calc(var(--grocery-nav-height) + 14px); padding-bottom: 72px; }
  .ep-grocery-hero h1 { font-size: 50px; margin: 12px 0 10px; }
  .ep-grocery-hero__copy { font-size: 12px; }
  .ep-grocery-hero__filters { margin-top: 14px; }
  .ep-grocery-scroll-cue { bottom: 14px; }
  .ep-grocery-flight { width: min(36vw,390px); }
  .ep-grocery-ending__view { top: 13%; height: min(29vw,300px); }
  .ep-grocery-ending__categories { bottom: 48px; }
}

@media (prefers-reduced-motion: reduce) {
  .ep-grocery-journey *, .ep-grocery-modal * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`

export default function GroceryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    products,
    categories,
    brands,
    search,
    categorySlug,
    brandSlug,
    limit,
    pagination,
    loading,
    filtersLoading,
    error,
    setSearch,
    setCategorySlug,
    setBrandSlug,
    setLimit,
    resetFilters,
  } = useGroceryCatalog({
    initialSearch: searchParams.get('q') || '',
    initialCategorySlug: searchParams.get('category') || '',
    initialBrandSlug: searchParams.get('brand') || '',
  })

  const [searchDraft, setSearchDraft] = useState(search)
  const [productDirectoryOpen, setProductDirectoryOpen] = useState(false)
  const [categoryDirectoryOpen, setCategoryDirectoryOpen] = useState(false)
  const pageRef = useRef(null)
  const trackRef = useRef(null)
  const stageRef = useRef(null)
  const reducedMotion = useReducedMotion()

  useNavbarClearance(pageRef)

  const featuredProducts = useMemo(
    () => products.slice(0, PREVIEW_PRODUCT_COUNT),
    [products],
  )
  const featuredCategories = useMemo(
    () => categories.slice(0, 5),
    [categories],
  )
  const signature = featuredProducts.map(getProductKey).join('|')
  const showScene = !loading && !error && featuredProducts.length > 0
  const scenePaused = productDirectoryOpen || categoryDirectoryOpen

  useGroceryScrollScene({
    trackRef,
    stageRef,
    count: showScene ? featuredProducts.length : 0,
    signature,
    reducedMotion,
    paused: scenePaused,
  })

  useEffect(() => {
    if (!productDirectoryOpen) return

    const total = Number(pagination?.total) || 0
    if (total > limit) setLimit(total)
  }, [productDirectoryOpen, pagination?.total, limit, setLimit])

  function handleSearchSubmit(event) {
    event.preventDefault()

    if (limit !== DEFAULT_PRODUCT_LIMIT) setLimit(DEFAULT_PRODUCT_LIMIT)
    setSearch(searchDraft)
  }

  function handleReset() {
    setSearchDraft('')
    if (limit !== DEFAULT_PRODUCT_LIMIT) setLimit(DEFAULT_PRODUCT_LIMIT)
    resetFilters()
  }

  function scrollToProducts() {
    trackRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'instant' : 'smooth',
      block: 'start',
    })
  }

  function handleCategorySelect(slug) {
    const normalizedSlug = String(slug || '').trim()
    if (!normalizedSlug) return

    setCategoryDirectoryOpen(false)
    navigate(`/grocery/category/${encodeURIComponent(normalizedSlug)}`)
  }

  return (
    <main ref={pageRef} className="ep-grocery-journey min-w-0">
      <style>{PAGE_STYLES}</style>

      <section className="ep-grocery-hero" aria-labelledby="grocery-page-title">
        <div className="ep-grocery-hero__photo" aria-hidden="true" />
        <div className="ep-grocery-hero__shade" aria-hidden="true" />

        <div className="ep-grocery-hero__content">
          <div className="ep-grocery-hero__eyebrow">
            <Leaf size={13} strokeWidth={1.8} aria-hidden="true" />
            EPANTRY Grocery
          </div>

          <h1 id="grocery-page-title">Groceries made easier to discover.</h1>
          <p className="ep-grocery-hero__copy">Fresh groceries, easier to find.</p>

          <div className="ep-grocery-hero__filters">
            <form
              role="search"
              aria-label="Search groceries"
              className="ep-grocery-hero__search"
              onSubmit={handleSearchSubmit}
            >
              <Search size={18} strokeWidth={1.7} aria-hidden="true" />
              <label htmlFor="grocery-search" className="sr-only">Search groceries, products or brands</label>
              <input
                id="grocery-search"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search groceries, products or brands"
              />
              <button type="submit" aria-label="Search groceries">
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>

            <div className="ep-grocery-hero__selects">
              <label className="sr-only" htmlFor="grocery-category">Category</label>
              <select
                id="grocery-category"
                value={categorySlug}
                disabled={filtersLoading}
                onChange={(event) => {
                  if (limit !== DEFAULT_PRODUCT_LIMIT) setLimit(DEFAULT_PRODUCT_LIMIT)
                  setCategorySlug(event.target.value)
                }}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id || category.slug} value={category.slug}>{category.name}</option>
                ))}
              </select>

              <label className="sr-only" htmlFor="grocery-brand">Brand</label>
              <select
                id="grocery-brand"
                value={brandSlug}
                disabled={filtersLoading}
                onChange={(event) => {
                  if (limit !== DEFAULT_PRODUCT_LIMIT) setLimit(DEFAULT_PRODUCT_LIMIT)
                  setBrandSlug(event.target.value)
                }}
              >
                <option value="">All brands</option>
                {brands.map((brand) => (
                  <option key={brand.id || brand.slug} value={brand.slug}>{brand.name}</option>
                ))}
              </select>

              <button type="button" className="ep-grocery-hero__reset" onClick={handleReset}>
                <RotateCcw size={13} aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="ep-grocery-scroll-cue">
          <button type="button" onClick={scrollToProducts}>
            <span><ArrowDown size={17} aria-hidden="true" /></span>
            Scroll to discover
          </button>
          <p>{Number(pagination?.total) || 0} published products</p>
        </div>
      </section>

      {!showScene ? (
        <section ref={trackRef} className="ep-grocery-status" aria-label="Grocery catalog status">
          {loading ? (
            <div role="status">
              <Grid3X3 size={28} className="mx-auto" aria-hidden="true" />
              <h2>Loading groceries</h2>
              <p>Preparing the published grocery collection.</p>
            </div>
          ) : error ? (
            <div role="alert">
              <CircleAlert size={30} className="mx-auto" aria-hidden="true" />
              <h2>We couldn't load groceries</h2>
              <p>{error}</p>
            </div>
          ) : (
            <div>
              <EmptyState
                title="No published products found"
                description="Try changing the current search or catalog filters."
              />
              {(search || categorySlug || brandSlug) && (
                <button type="button" onClick={handleReset}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Reset filters
                </button>
              )}
            </div>
          )}
        </section>
      ) : reducedMotion ? (
        <section ref={trackRef} className="ep-grocery-static" aria-labelledby="published-products-static-title">
          <h2 id="published-products-static-title">Published products</h2>
          <div className="ep-grocery-static__grid">
            {featuredProducts.map((product) => (
              <ProductImageCard key={getProductKey(product)} product={product} />
            ))}
          </div>
          <div className="ep-grocery-static__end">
            <button type="button" onClick={() => setProductDirectoryOpen(true)}>View all Grocery</button>
          </div>
        </section>
      ) : (
        <section
          ref={trackRef}
          className="ep-grocery-track"
          aria-labelledby="published-products-title"
          style={{ height: `${getSceneLength(featuredProducts.length) * 100}svh` }}
        >
          <div ref={stageRef} className="ep-grocery-stage">
            <div className="ep-grocery-stage__meta">
              <span>EPANTRY / Grocery collection</span>
              <span>Scroll-controlled</span>
            </div>

            <div className="ep-grocery-stage__left">
              <div className="ep-grocery-stage__label" id="published-products-title">Published products</div>
              <div className="ep-grocery-stage__names" aria-live="polite">
                {featuredProducts.map((product, index) => (
                  <div key={getProductKey(product)} data-grocery-name={index} className="ep-grocery-stage__name">
                    <span>Product {String(index + 1).padStart(2, '0')}</span>
                    <h2>{getProductName(product)}</h2>
                    <p>{product?.brand?.name || product?.category?.name || 'Published grocery'}</p>
                  </div>
                ))}
              </div>
            </div>

            {featuredProducts.map((product, index) => (
              <div
                key={getProductKey(product)}
                data-grocery-flight={index}
                className="ep-grocery-flight"
                aria-hidden="true"
              >
                <ProductImageCard product={product} />
              </div>
            ))}

            <div data-grocery-hint className="ep-grocery-stage__hint">
              <ArrowDown size={14} aria-hidden="true" />
              Keep scrolling to explore the collection
            </div>

            <div data-grocery-ending className="ep-grocery-ending" aria-hidden="true">
              <div className="ep-grocery-ending__view">
                <span>Complete grocery collection</span>
                <h3>See every published grocery.</h3>
                <button
                  type="button"
                  onClick={() => setProductDirectoryOpen(true)}
                  aria-haspopup="dialog"
                >
                  View all Grocery
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>

              {featuredCategories.length > 0 && (
                <div className="ep-grocery-ending__categories">
                  <div className="ep-grocery-ending__categories-head">
                    <p>Browse categories</p>
                    <button
                      type="button"
                      onClick={() => setCategoryDirectoryOpen(true)}
                      aria-haspopup="dialog"
                    >
                      View all categories
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="ep-grocery-ending__category-row">
                    {featuredCategories.map((category, index) => (
                      <button
                        key={category.id || category.slug || category.name}
                        type="button"
                        onClick={() => handleCategorySelect(category.slug)}
                      >
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{category.name}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ep-grocery-stage__bottom" aria-hidden="true">
              <div className="ep-grocery-stage__meter"><span data-grocery-progress /></div>
              <div>
                <span>Scroll down to explore. Scroll up to revisit.</span>
                <span data-grocery-counter>01 / {String(featuredProducts.length).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {productDirectoryOpen && (
        <ProductDirectory
          products={products}
          loading={loading}
          onClose={() => setProductDirectoryOpen(false)}
        />
      )}

      {categoryDirectoryOpen && (
        <CategoryDirectory
          categories={categories}
          onClose={() => setCategoryDirectoryOpen(false)}
          onSelect={handleCategorySelect}
        />
      )}
    </main>
  )
}
