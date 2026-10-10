import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  ArrowUpRight,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  motion,
  useReducedMotion,
  useScroll,
  useMotionValue,
  useTransform,
} from 'motion/react'

// import ClosingCtaSection from '../components/ClosingCtaSection' // Temporarily hidden; keep component for future re-enable

import FeaturedContentSection from '../components/FeaturedContentSection'

import HeroSection from '../components/HeroSection'

import HowItWorksSection from '../components/HowItWorksSection'

import {
  landingCategories,
} from '../content/landingContent'

import SponsoredCampaignSlot from '../../retailMedia/components/SponsoredCampaignSlot'

const EXPERIENCE_CARD_IMAGES = {
  grocery: '/exploar/Exploar_G.png',
  brands: '/exploar/Exploar_B.png',
  recipes: '/exploar/Exploar_R.png',
}

const EXPERIENCE_TRUST_COPY = {
  grocery:
    'Fresh grocery choices with clear product information and trusted listings, so everyday essentials feel easier to choose with confidence.',

  brands:
    'Discover authentic brands and approved product listings with clearer identity, reliable context and trust built into the experience.',

  recipes:
    'Explore practical recipes built around real ingredients, then move naturally from food inspiration to the products you actually need.',
}

const CARD_FLIP_EASE = [
  0.175,
  0.885,
  0.32,
  1.275,
]

const EXPERIENCE_BACKDROP_ROWS = [
  {
    id: 'row-01',
    top: '-8%',
    direction: 'left',
    duration: 28,
    cardWidth: 'clamp(82px, 8.8vw, 142px)',
    opacity: 0.58,
    sequence: [
      'grocery',
      'brands',
      'recipes',
      'grocery',
      'brands',
      'recipes',
    ],
  },
  {
    id: 'row-02',
    top: '38%',
    direction: 'right',
    duration: 32,
    cardWidth: 'clamp(76px, 8.2vw, 132px)',
    opacity: 0.46,
    sequence: [
      'recipes',
      'grocery',
      'brands',
      'recipes',
      'grocery',
      'brands',
    ],
  },
  {
    id: 'row-03',
    top: '82%',
    direction: 'left',
    duration: 30,
    cardWidth: 'clamp(80px, 8.5vw, 138px)',
    opacity: 0.52,
    sequence: [
      'brands',
      'recipes',
      'grocery',
      'brands',
      'recipes',
      'grocery',
    ],
  },
]

function getExperienceTone(categoryId) {
  if (categoryId === 'brands') {
    return {
      glow: 'bg-[#2563EB]/10',
      icon: 'bg-[#EFF6FF]/85 text-[#2563EB]',
      action: 'text-[#2563EB]',
      frame: 'bg-[#EFF6FF]',
      glass: 'bg-[#EFF6FF]/60',
    }
  }

  if (categoryId === 'recipes') {
    return {
      glow: 'bg-[#F59E0B]/10',
      icon: 'bg-[#FFF7ED]/85 text-[#EA580C]',
      action: 'text-[#EA580C]',
      frame: 'bg-[#FFF7ED]',
      glass: 'bg-[#FFF7ED]/60',
    }
  }

  return {
    glow: 'bg-[#16A34A]/10',
    icon: 'bg-[#F0FDF4]/85 text-[#166534]',
    action: 'text-[#166534]',
    frame: 'bg-[#F0FDF4]',
    glass: 'bg-[#F0FDF4]/60',
  }
}

export default function LandingPage() {

  // Landing-only, one-gesture/one-stop navigation for pinned stories.
  // No global smooth scrolling or wheel changes outside these sections.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let wheelTotal = 0
    let lastWheelAt = 0
    let settlingUntil = 0
    let heldStop = null
    let touchStart = null
    let pendingTouchTimer = null
    let lastDirection = 0

    const stories = () => Array.from(
      document.querySelectorAll('[data-landing-story]'),
    ).map((node) => {
      const stops = (node.dataset.landingStops || '')
        .split(',').map(Number).filter(Number.isFinite)
      const rect = node.getBoundingClientRect()
      const start = window.scrollY + rect.top
      const sticky = node.querySelector('[data-landing-sticky]')
      const stickyHeight = sticky?.getBoundingClientRect().height || window.innerHeight
      const travel = node.dataset.landingStatic === 'true'
        ? rect.height
        : Math.max(rect.height - stickyHeight, 1)
      return { node, start, end: start + rect.height, travel, stops }
    }).filter((item) => item.stops.length > 0)
      .sort((a, b) => a.start - b.start)

    const currentStory = (y) => {
      const all = stories()
      const active = all.find((item) =>
        y >= item.start - 12 && y < item.start + item.travel - 8,
      )
      return active ? { ...active, all } : null
    }

    const ignoreGesture = (target) => {
      if (!(target instanceof Element)) return false
      if (target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[data-landing-scroll-ignore]')) return true
      for (let el = target; el && el !== document.body; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 4) {
          const overflow = window.getComputedStyle(el).overflowY
          if (overflow === 'auto' || overflow === 'scroll') return true
        }
      }
      return false
    }

    const step = (direction, queueTouch = false) => {
      const current = currentStory(window.scrollY)
      if (!current) return false
      const { all, start, travel, stops, node, end } = current
      const now = performance.now()
      // Wheel inertia is absorbed. A separate mobile swipe is queued, not lost.
      if (now < settlingUntil) {
        if (queueTouch) {
          if (pendingTouchTimer !== null) window.clearTimeout(pendingTouchTimer)
          pendingTouchTimer = window.setTimeout(() => {
            pendingTouchTimer = null
            if (currentStory(window.scrollY)) step(direction)
          }, settlingUntil - now + 25)
        }
        return true
      }

      const y = window.scrollY
      const positions = stops.map((progress) => start + progress * travel)
      const distanceToNearest = positions.map((pos) => Math.abs(pos - y))
      const nearest = distanceToNearest.indexOf(Math.min(...distanceToNearest))
      const atBeginning = direction > 0 && y < positions[0] - 16
      const atEnd = direction < 0 && y > positions[positions.length - 1] + 16
      let destination
      if (heldStop && heldStop.node === node && Math.abs(heldStop.y - y) < 45) {
        destination = heldStop.index + direction
      } else {
        destination = atBeginning ? 0 : atEnd ? positions.length - 1 : nearest + direction
      }

      let target
      if (destination < 0) {
        // Revisit the preceding pinned story without getting trapped at the boundary.
        const previous = [...all].reverse().find((story) => story.start < start - 10)
        target = previous
          ? previous.start + previous.stops[previous.stops.length - 1] * previous.travel
          : start - Math.max(48, Math.min(window.innerHeight * 0.55, 320))
        heldStop = null
      } else if (destination >= stops.length) {
        // Always leave the current pinned travel when the final stop is passed.
        // Landing's overlapping panels otherwise trap the wheel on the same card.
        const next = all.find((story) => story.start > start + 10)
        target = next
          ? next.start + next.stops[0] * next.travel
          : start + travel + Math.max(48, Math.min(window.innerHeight * 0.2, 140))
        heldStop = null
      } else {
        target = positions[destination]
        heldStop = { node, y: target, index: destination }
      }
      settlingUntil = now + (window.matchMedia('(max-width: 767px)').matches ? 530 : 570)
      lastDirection = direction
      wheelTotal = 0
      // Mobile recipe transitions animate once at the target instead of
      // re-rendering the entire 3D gallery on every scroll frame.
      if (node.dataset.landingStory === 'recipes' && destination >= 0 && destination < stops.length) {
        window.dispatchEvent(new CustomEvent('epantry:recipe-stage', {
          detail: { progress: stops[destination] * Number(node.dataset.landingRecipeScale || 7) },
        }))
      }
      window.scrollTo({
        top: Math.max(0, Math.round(target)),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant' : 'smooth',
      })
      return true
    }

    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey || ignoreGesture(event.target)) return
      const story = currentStory(window.scrollY)
      if (!story) { wheelTotal = 0; heldStop = null; lastDirection = 0; return }
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      const now = performance.now()
      const continuousWheel = now - lastWheelAt < 145
      lastWheelAt = now
      if (now < settlingUntil || (continuousWheel && lastDirection !== 0 && wheelTotal === 0)) return
      if (!continuousWheel) wheelTotal = 0
      wheelTotal += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
      // Small trackpad movements are accumulated, mouse-wheel ticks advance immediately.
      if (Math.abs(wheelTotal) >= 14) step(Math.sign(wheelTotal))
    }

    const onTouchStart = (event) => {
      if (event.touches.length !== 1 || ignoreGesture(event.target)) {
        touchStart = null
        return
      }
      const story = currentStory(window.scrollY)
      touchStart = story && window.matchMedia('(max-width: 767px)').matches ? {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      } : null
      if (touchStart) window.addEventListener('touchmove', onTouchMove, { passive: false })
    }
    const onTouchMove = (event) => {
      if (!touchStart || event.touches.length !== 1) return
      const dx = event.touches[0].clientX - touchStart.x
      const dy = event.touches[0].clientY - touchStart.y
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        // Prevent native fling from advancing two or three cards at once.
        event.preventDefault()
      }
    }
    const onTouchEnd = (event) => {
      window.removeEventListener('touchmove', onTouchMove)
      if (!touchStart || !event.changedTouches.length) return
      const dx = event.changedTouches[0].clientX - touchStart.x
      const dy = event.changedTouches[0].clientY - touchStart.y
      touchStart = null
      if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
        step(dy < 0 ? 1 : -1, true)
      }
    }
    const onTouchCancel = () => {
      touchStart = null
      window.removeEventListener('touchmove', onTouchMove)
    }
    const onKeyDown = (event) => {
      if (event.target instanceof Element && event.target.closest('a,button,[role="button"]')) return
      if (event.defaultPrevented || ignoreGesture(event.target) || event.altKey || event.metaKey || event.ctrlKey) return
      const direction = ['ArrowDown', 'PageDown', ' '].includes(event.key) ? 1
        : ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0
      if (!direction || !currentStory(window.scrollY)) return
      event.preventDefault()
      step(direction)
    }

    // Activate wheel interception only while a pinned scene is on screen.
    // This keeps ordinary page scrolling native and still works when the
    // pointer is over the navbar instead of over a story card.
    const supportsWheel = window.matchMedia('(pointer: fine)').matches
    let wheelAttached = false
    const syncWheel = () => {
      if (!supportsWheel) return
      const active = Boolean(currentStory(window.scrollY))
      if (active && !wheelAttached) {
        window.addEventListener('wheel', onWheel, { passive: false })
        wheelAttached = true
      } else if (!active && wheelAttached) {
        window.removeEventListener('wheel', onWheel)
        wheelAttached = false
      }
    }
    const observer = new MutationObserver(syncWheel)
    const root = document.querySelector('main')
    if (root) observer.observe(root, { childList: true, subtree: true })
    syncWheel()
    window.addEventListener('scroll', syncWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      observer.disconnect()
      if (pendingTouchTimer !== null) window.clearTimeout(pendingTouchTimer)
      window.removeEventListener('scroll', syncWheel)
      if (wheelAttached) window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchCancel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const experienceSectionRef =
    useRef(null)

  const featuredEntranceRef =
    useRef(null)

  const shouldReduceMotion =
    useReducedMotion()

  const [
    isDesktopHoverDevice,
    setIsDesktopHoverDevice,
  ] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(
          '(min-width: 1024px) and (hover: hover) and (pointer: fine)',
        ).matches
      : false,
  )

  const [
    isSmallViewport,
    setIsSmallViewport,
  ] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  )

  const [
    activeExperienceIndex,
    setActiveExperienceIndex,
  ] = useState(-1)

  const [
    hoveredExperienceId,
    setHoveredExperienceId,
  ] = useState(null)

  const [
    autoRevealExperienceId,
    setAutoRevealExperienceId,
  ] = useState(null)

  const [mobileRevealExperienceId, setMobileRevealExperienceId] = useState(null)

  const experienceScrollProgress = useMotionValue(0)

  // Follow the scroll exactly, with a smooth easing curve and no lagging
  // spring. Both planes share this progress so they cannot drift apart.
  const {
    scrollYProgress:
      featuredEntranceProgress,
  } = useScroll({
    target:
      featuredEntranceRef,
    offset: [
      'start end',
      'start start',
    ],
  })

  const featuredDepthProgress =
    useTransform(
      featuredEntranceProgress,
      (progress) => {
        const clamped =
          Math.min(
            Math.max(progress, 0),
            1,
          )

        return (
          clamped *
          clamped *
          (3 - 2 * clamped)
        )
      },
    )

  // The outgoing Explore scene retreats on a separate visual plane.
  // Its sticky container and all existing interactive elements stay put.
  const exploreSceneScale =
    useTransform(
      featuredDepthProgress,
      [0, 0.5, 1],
      shouldReduceMotion || isSmallViewport
        ? [1, 1, 1]
        : [1, 0.955, 0.91],
    )

  const exploreSceneRotateX =
    useTransform(
      featuredDepthProgress,
      [0, 1],
      shouldReduceMotion || isSmallViewport
        ? [0, 0]
        : [0, -3],
    )

  const exploreSceneY =
    useTransform(
      featuredDepthProgress,
      [0, 1],
      shouldReduceMotion || isSmallViewport
        ? [0, 0]
        : [0, -18],
    )

  const exploreDefocusOpacity =
    useTransform(
      featuredDepthProgress,
      [0, 0.2, 0.7, 1],
      shouldReduceMotion
        ? [0, 0, 0, 0]
        : [0, 0, 0.82, 1],
    )

  // The incoming Grocery sheet grows into the viewport instead of
  // rotating the sticky element (which can cause scroll judder).
  const groceryEntranceScale =
    useTransform(
      featuredDepthProgress,
      [0, 0.55, 1],
      shouldReduceMotion || isSmallViewport
        ? [1, 1, 1]
        : [0.90, 0.96, 1],
    )

  const groceryEntranceLift =
    useTransform(
      featuredDepthProgress,
      [0, 1],
      shouldReduceMotion || isSmallViewport
        ? [0, 0]
        : [16, 0],
    )

  const groceryEdgeOpacity =
    useTransform(
      featuredDepthProgress,
      [0, 0.22, 0.7, 1],
      shouldReduceMotion
        ? [0, 0, 0, 0]
        : [0.65, 0.85, 0.3, 0],
    )

  const backdropVerticalY =
    useTransform(
      experienceScrollProgress,
      [0, 1],
      shouldReduceMotion || isSmallViewport
        ? ['0svh', '0svh']
        : ['0svh', '-56svh'],
    )

  const backdropDepthScale =
    useTransform(
      experienceScrollProgress,
      [0, 0.5, 1],
      shouldReduceMotion || isSmallViewport
        ? [1, 1, 1]
        : [1.025, 1, 1.035],
    )

  const backdropDepthRotateX =
    useTransform(
      experienceScrollProgress,
      [0, 0.5, 1],
      shouldReduceMotion || isSmallViewport
        ? [0, 0, 0]
        : [0.8, -0.65, 0.9],
    )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let frame = null
    const syncExperienceProgress = () => {
      frame = null
      const target = experienceSectionRef.current
      if (!target) return

      const rect = target.getBoundingClientRect()
      const stickyHeight =
        target.parentElement?.querySelector('section')
          ?.getBoundingClientRect().height || rect.height
      const travel = Math.max(rect.height - stickyHeight, 1)
      const next = Math.min(Math.max(-rect.top / travel, 0), 1)
      if (Math.abs(next - experienceScrollProgress.get()) > 0.0001) {
        experienceScrollProgress.set(next)
      }
    }
    const schedule = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(syncExperienceProgress)
      }
    }

    syncExperienceProgress()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('pageshow', schedule)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pageshow', schedule)
    }
  }, [experienceScrollProgress])

  useEffect(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return undefined
    }

    const mediaQuery =
      window.matchMedia(
        '(min-width: 1024px) and (hover: hover) and (pointer: fine)',
      )

    const smallViewportMediaQuery = window.matchMedia(
      '(max-width: 767px)',
    )

    const handleSmallViewportChange = (event) => {
      setIsSmallViewport(event.matches)
    }

    setIsSmallViewport(smallViewportMediaQuery.matches)
    smallViewportMediaQuery.addEventListener?.(
      'change',
      handleSmallViewportChange,
    )

    const handleChange = (
      event,
    ) => {
      setIsDesktopHoverDevice(
        event.matches,
      )

      if (!event.matches) {
        setHoveredExperienceId(
          null,
        )
      }
    }

    setIsDesktopHoverDevice(
      mediaQuery.matches,
    )

    mediaQuery.addEventListener?.(
      'change',
      handleChange,
    )

    return () => {
      mediaQuery.removeEventListener?.(
        'change',
        handleChange,
      )
      smallViewportMediaQuery.removeEventListener?.(
        'change',
        handleSmallViewportChange,
      )
    }
  }, [])

  useEffect(() => {
    const updateStage = (
      value,
    ) => {
      let nextIndex = -1

      // The intro owns 12% of the available travel; each of the three
      // experiences owns an equal share of the remaining travel.
      if (value >= 0.12) {
        nextIndex = Math.min(
          2,
          Math.floor((value - 0.12) / ((1 - 0.12) / 3)),
        )
      }

      setActiveExperienceIndex(
        (currentIndex) =>
          currentIndex === nextIndex
            ? currentIndex
            : nextIndex,
      )
    }

    updateStage(
      experienceScrollProgress.get(),
    )

    const unsubscribe =
      experienceScrollProgress.on(
        'change',
        updateStage,
      )

    return unsubscribe
  }, [
    experienceScrollProgress,
  ])

  useEffect(() => {
    if (
      isDesktopHoverDevice ||
      isSmallViewport ||
      activeExperienceIndex < 0 ||
      shouldReduceMotion
    ) {
      setAutoRevealExperienceId(
        null,
      )

      return undefined
    }

    const category =
      landingCategories[
        activeExperienceIndex
      ]

    if (!category) {
      return undefined
    }

    setAutoRevealExperienceId(
      null,
    )

    const revealTimeoutId =
      window.setTimeout(
        () => {
          setAutoRevealExperienceId(
            category.id,
          )
        },
        520,
      )

    const resetTimeoutId =
      window.setTimeout(
        () => {
          setAutoRevealExperienceId(
            null,
          )
        },
        1420,
      )

    return () => {
      window.clearTimeout(
        revealTimeoutId,
      )

      window.clearTimeout(
        resetTimeoutId,
      )
    }
  }, [
    activeExperienceIndex,
    isDesktopHoverDevice,
    isSmallViewport,
    shouldReduceMotion,
  ])

  // Mobile: let the new card land, briefly reveal its information face,
  // then return to the image. No large 3D rotations or background blur.
  useEffect(() => {
    if (!isSmallViewport || activeExperienceIndex < 0 || shouldReduceMotion) {
      setMobileRevealExperienceId(null)
      return undefined
    }
    const item = landingCategories[activeExperienceIndex]
    if (!item) return undefined
    setMobileRevealExperienceId(null)
    const openId = window.setTimeout(() => setMobileRevealExperienceId(item.id), 530)
    const closeId = window.setTimeout(() => setMobileRevealExperienceId(null), 1550)
    return () => {
      window.clearTimeout(openId)
      window.clearTimeout(closeId)
    }
  }, [activeExperienceIndex, isSmallViewport, shouldReduceMotion])

  const handleExperienceCardEnter = (
    categoryId,
  ) => {
    if (
      !isDesktopHoverDevice ||
      shouldReduceMotion
    ) {
      return
    }

    setHoveredExperienceId(
      categoryId,
    )
  }

  const handleExperienceCardLeave = (
    categoryId,
  ) => {
    setHoveredExperienceId(
      (currentId) =>
        currentId === categoryId
          ? null
          : currentId,
    )
  }

  const activeExperience =
    activeExperienceIndex >= 0
      ? landingCategories[
          activeExperienceIndex
        ]
      : null

  const activeExperienceTone =
    activeExperience
      ? getExperienceTone(
          activeExperience.id,
        )
      : null

  const activeExperienceIsRevealed =
    activeExperience && !isSmallViewport
      ? hoveredExperienceId ===
          activeExperience.id ||
        autoRevealExperienceId ===
          activeExperience.id
      : false

  return (
    <main className="overflow-x-clip">

      {/* =============================================================
          HERO
      ============================================================= */}

      <div className="relative">
        <HeroSection />

        <SponsoredCampaignSlot
          placement="home"
          slotKey="hero"
          overlay
          previewLabel="Hero section"
        />
      </div>


      {/* =============================================================
          START YOUR FOOD JOURNEY
      ============================================================= */}

      {/* <ClosingCtaSection /> */}


      {/* =============================================================
          EXPLORE EPANTRY
      ============================================================= */}

      <div data-landing-story="explore" data-landing-stops="0.015,0.28,0.555,0.83" className="relative z-10 h-[440svh] w-full bg-[#1A1A1A] sm:h-[460svh]">
        <div
          ref={experienceSectionRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[440svh] sm:h-[360svh]"
        />
        <section
          data-landing-sticky
          className="sticky top-0 h-[100dvh] sm:h-[100svh] w-full overflow-hidden bg-[#1A1A1A] text-white [perspective:1400px]"
        >
          <SponsoredCampaignSlot
            placement="home"
            slotKey="explore_epantry"
            overlay
            previewLabel="Explore EPANTRY"
          />


          <motion.div
            className="absolute inset-0 [transform-style:flat] [backface-visibility:hidden]"
            style={{
              scale:
                exploreSceneScale,
              rotateX:
                exploreSceneRotateX,
              y:
                exploreSceneY,
              transformOrigin:
                '50% 45%',
            }}
          >
          {/* Dark gallery background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.055),transparent_32%),radial-gradient(circle_at_18%_72%,rgba(22,101,52,0.11),transparent_27%),radial-gradient(circle_at_82%_28%,rgba(37,99,235,0.08),transparent_26%),#1A1A1A]"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px]"
          />

          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.018)_38%,rgba(0,0,0,0.72)_100%)]"
          />

          {/* Continuous background rows: alternate directions + scroll-linked vertical drift */}
          <motion.div
            aria-hidden="true"
            style={{
              y:
                backdropVerticalY,
              scale:
                backdropDepthScale,
              rotateX:
                backdropDepthRotateX,
              transformOrigin:
                '50% 50%',
            }}
            className="absolute -inset-x-[8%] -inset-y-[14%] [transform-style:flat] sm:[transform-style:preserve-3d] sm:[will-change:transform]"
          >
            {EXPERIENCE_BACKDROP_ROWS.map(
              (row, rowIndex) => (
                <ExperienceBackdropRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  lowPower={isSmallViewport}
                  shouldReduceMotion={shouldReduceMotion || isSmallViewport}
                />
              ),
            )}
          </motion.div>

          {/* Intro stage */}
          <motion.div
            animate={{
              opacity:
                activeExperienceIndex === -1
                  ? 1
                  : 0,
              y:
                activeExperienceIndex === -1
                  ? 0
                  : -24,
              scale:
                activeExperienceIndex === -1
                  ? 1
                  : 0.98,
            }}
            transition={{
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-5 text-center sm:px-8"
          >
            <div className="max-w-[760px]">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/50 sm:text-sm">
                Explore EPANTRY
              </p>

              <h2 className="mt-5 text-[clamp(40px,7vw,92px)] font-black leading-[0.9] tracking-[-0.055em] text-white">
                Three experiences.
                <span className="mt-1 block text-white/42">
                  One connected food platform.
                </span>
              </h2>

              <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-6 text-white/48 sm:text-base sm:leading-7">
                Scroll to move through Grocery, Brands and Recipes.
              </p>

              <div className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/45 backdrop-blur-md sm:text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                Scroll to explore
              </div>
            </div>
          </motion.div>

          {/* Current experience card */}
          <div className="absolute inset-0 z-30 flex items-center justify-center px-4 pt-8 sm:px-8 sm:pt-10">
            {activeExperience && activeExperienceTone ? (
              <motion.div
                key={`active-experience-${activeExperience.id}`}
                initial={
                  shouldReduceMotion
                    ? false
                    : isSmallViewport
                      ? { opacity: 0, scale: 0.98, y: 18 }
                      : {
                          opacity: 0,
                          rotateX: 8,
                          rotateY: -8,
                          rotateZ: -2.5,
                          scale: 0.84,
                          y: '58svh',
                        }
                }
                animate={{
                  opacity: 1,
                  rotateX: 0,
                  rotateY: 0,
                  rotateZ: 0,
                  scale: 1,
                  y: isSmallViewport ? 0 : '0svh',
                }}
                transition={{
                  duration:
                    shouldReduceMotion
                      ? 0
                      : isSmallViewport ? 0.34 : 0.78,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative h-[56svh] min-h-[360px] max-h-[610px] w-[78vw] max-w-[350px] sm:h-[62svh] sm:w-[48vw] sm:max-w-[470px] lg:w-[31vw] lg:max-w-[500px] [transform-style:preserve-3d]"
              >
                <motion.div
                  className="relative h-full w-full [transform-style:preserve-3d]"
                  onMouseEnter={() =>
                    handleExperienceCardEnter(
                      activeExperience.id,
                    )
                  }
                  onMouseLeave={() =>
                    handleExperienceCardLeave(
                      activeExperience.id,
                    )
                  }
                >
                  <Link
                    to={activeExperience.path}
                    className="focus-ring relative block h-full w-full overflow-hidden rounded-[30px] border-0 bg-transparent outline-none ring-0 shadow-[0_44px_120px_rgba(0,0,0,0.48),0_10px_34px_rgba(0,0,0,0.22)] sm:rounded-[36px] [perspective:1200px]"
                  >
                    <motion.div
                      className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-[30px] sm:rounded-[36px] [backface-visibility:hidden] [transform-origin:bottom] [will-change:transform]"
                      animate={{
                        rotateX:
                          activeExperienceIsRevealed
                            ? 90
                            : 0,
                      }}
                      transition={{
                        duration: 0.6,
                        ease: CARD_FLIP_EASE,
                      }}
                    >
                      <ExperienceCardFront
                        category={activeExperience}
                        categoryTone={activeExperienceTone}
                        isExpanded
                      />
                    </motion.div>

                    {isSmallViewport && (
                      <motion.div
                        aria-hidden="true"
                        initial={false}
                        animate={{ opacity: mobileRevealExperienceId === activeExperience.id ? 1 : 0 }}
                        transition={{ duration: 0.36, ease: 'easeInOut' }}
                        className="pointer-events-none absolute inset-0 z-10 flex flex-col overflow-hidden rounded-[30px] bg-[#f3f7ee]/95 p-5"
                      >
                        <div className="mt-auto rounded-2xl bg-white/90 p-5 text-left shadow-sm">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#166534]">{activeExperience.title}</p>
                          <p className="mt-2 text-sm font-medium leading-6 text-[#25362D]">{EXPERIENCE_TRUST_COPY[activeExperience.id]}</p>
                        </div>
                      </motion.div>
                    )}

                    {!isSmallViewport && <motion.div
                      aria-hidden="true"
                      className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-[30px] p-5 sm:rounded-[36px] sm:p-7 [backface-visibility:hidden] [transform-origin:bottom] [will-change:transform]"
                      initial={false}
                      animate={{
                        rotateX:
                          activeExperienceIsRevealed
                            ? 0
                            : -90,
                      }}
                      transition={{
                        duration: 0.6,
                        ease: CARD_FLIP_EASE,
                      }}
                    >
                      <ExperienceCardBack
                        category={activeExperience}
                        categoryTone={activeExperienceTone}
                        Icon={activeExperience.icon}
                      />
                    </motion.div>}

                    {!shouldReduceMotion && !isSmallViewport ? (
                      <motion.div
                        key={`shine-${activeExperience.id}`}
                        aria-hidden="true"
                        initial={{
                          x: '-230%',
                          y: '150%',
                          opacity: 0,
                        }}
                        animate={{
                          x: '255%',
                          y: '-145%',
                          opacity: [0, 0.9, 0],
                        }}
                        transition={{
                          duration: 1.05,
                          delay: 0.22,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="pointer-events-none absolute -bottom-[58%] -left-[34%] z-40 h-[180%] w-[32%] -rotate-[34deg] bg-gradient-to-r from-transparent via-white/50 to-transparent blur-[7px]"
                      />
                    ) : null}
                  </Link>

                  {/* Soft reflection like the reference */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[6%] right-[6%] top-[calc(100%+10px)] hidden h-[22%] overflow-hidden opacity-[0.12] [mask-image:linear-gradient(to_bottom,black,transparent)] md:block"
                  >
                    <img
                      src={EXPERIENCE_CARD_IMAGES[activeExperience.id]}
                      alt=""
                      className="h-full w-full origin-top scale-y-[-1] rounded-[30px] object-cover blur-[1px] sm:rounded-[36px]"
                    />
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </div>

          {/* Minimal sequence cue */}
          <div className="pointer-events-none absolute right-3 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
            <div className="flex flex-col items-center gap-3 text-white/35">
              <span className="text-[11px] font-black tracking-[0.22em] [writing-mode:vertical-rl] sm:text-xs">
                EPANTRY EXPERIENCE
              </span>
              <span className="h-9 w-px bg-white/20" />
              <span className="text-xs font-black tabular-nums sm:text-sm">
                {activeExperienceIndex >= 0
                  ? `0${activeExperienceIndex + 1} / 03`
                  : '00 / 03'}
              </span>
            </div>
          </div>

          </motion.div>

          {/* Static translucent glass behind the incoming Grocery surface.
              Only its opacity changes; no expensive animated blur radius. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-50 bg-[#080808]/30 sm:backdrop-blur-[5px]"
            style={{
              opacity:
                exploreDefocusOpacity,
            }}
          />

        </section>
      </div>


      {/* =============================================================
          FEATURED SECTIONS
      ============================================================= */}

      <div
        ref={featuredEntranceRef}
        className="relative z-30 mt-0 sm:-mt-[100svh]"
      >
        <FeaturedContentSection
          groceryEntranceEdgeOpacity={groceryEdgeOpacity}
          groceryEntranceScale={groceryEntranceScale}
          groceryEntranceLift={groceryEntranceLift}
        />

        <SponsoredCampaignSlot
          placement="home"
          slotKey="featured_content"
          overlay
          previewLabel="Featured content"
        />
      </div>


      {/* =============================================================
          HOW EPANTRY WORKS + WHY EPANTRY
      ============================================================= */}

      <HowItWorksSection />

    </main>
  )
}


function ExperienceBackdropRow({
  row,
  rowIndex,
  shouldReduceMotion,
  lowPower = false,
}) {
  const repeatedGroups = lowPower ? ['copy-a'] : [
    'copy-a',
    'copy-b',
    'copy-c',
  ]

  const startsLeft =
    row.direction === 'left'

  return (
    <div
      className="absolute left-0 right-0 overflow-visible [transform-style:preserve-3d]"
      style={{
        top: row.top,
        opacity: row.opacity,
      }}
    >
      <motion.div
        animate={
          shouldReduceMotion || lowPower
            ? undefined
            : {
                x: startsLeft
                  ? ['0%', '-33.333333%']
                  : ['-33.333333%', '0%'],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: row.duration,
                ease: 'linear',
                repeat: Infinity,
              }
        }
        className="flex w-max items-center [will-change:transform]"
      >
        {repeatedGroups.map(
          (groupId) => (
            <div
              key={`${row.id}-${groupId}`}
              className="flex shrink-0 items-center gap-[clamp(46px,7vw,112px)] pr-[clamp(46px,7vw,112px)]"
            >
              {row.sequence.map(
                (categoryId, itemIndex) => (
                  <ExperienceBackdropTile
                    key={`${row.id}-${groupId}-${categoryId}-${itemIndex}`}
                    categoryId={categoryId}
                    rowIndex={rowIndex}
                    itemIndex={itemIndex}
                    width={row.cardWidth}
                    direction={row.direction}
                  />
                ),
              )}
            </div>
          ),
        )}
      </motion.div>
    </div>
  )
}


function ExperienceBackdropTile({
  categoryId,
  rowIndex,
  itemIndex,
  width,
  direction,
}) {
  const imageSrc =
    EXPERIENCE_CARD_IMAGES[
      categoryId
    ]

  const alternatingTilt =
    ((rowIndex + itemIndex) % 2 === 0
      ? -1
      : 1) *
    (3.5 + (itemIndex % 3) * 1.2)

  const depthOffset =
    ((itemIndex % 3) - 1) * 16

  return (
    <div
      className="relative aspect-[4/5] shrink-0 overflow-hidden rounded-[9px] border border-white/[0.07] bg-white/[0.025] shadow-[0_18px_52px_rgba(0,0,0,0.48)] [transform-style:preserve-3d] sm:rounded-[11px]"
      style={{
        width,
        transform: `translateZ(${depthOffset}px) rotateZ(${direction === 'left' ? alternatingTilt : -alternatingTilt}deg)`,
      }}
    >
      <img
        src={imageSrc}
        alt=""
        className="h-full w-full object-cover brightness-[0.50] saturate-[0.72] contrast-[1.04]"
      />

      <div className="absolute inset-0 bg-black/10" />

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/42 to-transparent" />
    </div>
  )
}


function ExperienceCardFront({
  category,
  categoryTone,
  isExpanded,
}) {
  const collapsedLabelAlignment =
    category.id === 'grocery'
      ? 'justify-start'
      : category.id === 'recipes'
        ? 'justify-end'
        : 'justify-center'

  const labelAlignment =
    isExpanded
      ? 'justify-center'
      : collapsedLabelAlignment

  const imageSrc =
    EXPERIENCE_CARD_IMAGES[
      category.id
    ]

  return (
    <div className="relative h-full overflow-hidden rounded-[30px] bg-[#111111] sm:rounded-[36px]">

      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-[1.015] object-cover transition-transform duration-700 ease-out lg:group-hover:scale-[1.035]"
      />

      <div
        aria-hidden="true"
        className="absolute left-[8%] top-[3%] h-[22%] w-[48%] rounded-full bg-white/[0.055] blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute -left-[14%] top-[8%] h-[36%] w-[54%] rounded-full bg-white/[0.065] blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.16)_70%,rgba(0,0,0,0.52)_100%)]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-[8%] top-0 h-[28%] rounded-b-[50%] bg-white/[0.055] blur-2xl"
      />

      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-[38%] bg-[radial-gradient(circle_at_50%_110%,rgba(255,255,255,0.10),transparent_58%)]"
      />


      <div
        className={`absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 px-5 md:px-7 ${labelAlignment}`}
      >
        <motion.h3
          layout="position"
          initial={false}
          transition={{
            layout: {
              duration: 0.58,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            },
          }}
          className="whitespace-nowrap text-2xl font-black tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] [will-change:transform] md:text-4xl lg:rounded-[18px] lg:bg-black/[0.24] lg:px-5 lg:py-2.5 lg:shadow-[0_12px_34px_rgba(0,0,0,0.22)] lg:backdrop-blur-[7px] lg:drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
        >
          {
            category.title
          }
        </motion.h3>
      </div>

    </div>
  )
}


function ExperienceCardBack({
  category,
  categoryTone,
  Icon,
}) {
  const imageSrc =
    EXPERIENCE_CARD_IMAGES[
      category.id
    ]

  return (
    <>

      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-[1.03] object-cover"
      />


      <div
        aria-hidden="true"
        className={`absolute inset-0 ${categoryTone.glass} backdrop-blur-[9px]`}
      />


      <div
        aria-hidden="true"
        className="absolute inset-0 bg-white/10"
      />


      <div
        aria-hidden="true"
        className={`absolute -right-16 -top-16 h-40 w-40 rounded-full ${categoryTone.glow} blur-3xl`}
      />


      <div className={`relative z-10 grid h-13 w-13 place-items-center self-start rounded-2xl border border-white/[0.35] shadow-sm backdrop-blur-md ${categoryTone.icon}`}>

        <Icon
          size={24}
          aria-hidden="true"
        />

      </div>


      <div className="relative z-10 mt-auto max-w-md rounded-[22px] border border-white/[0.35] bg-white/[0.48] p-5 shadow-[0_18px_45px_rgba(17,24,39,0.10)] backdrop-blur-md">

        <p className="text-base font-semibold leading-7 text-[#1F2937]">

          {
            EXPERIENCE_TRUST_COPY[
              category.id
            ]
          }

        </p>


        <div className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${categoryTone.action}`}>

          {
            category.buttonText
          }


          <ArrowUpRight
            size={17}
            aria-hidden="true"
          />

        </div>

      </div>

    </>
  )
}


