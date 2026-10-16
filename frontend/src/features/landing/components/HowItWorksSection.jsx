import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
} from 'motion/react'

import {
  CookingPot,
  ShoppingBasket,
} from 'lucide-react'

import {
  landingBenefits,
  landingJourneySteps,
} from '../content/landingContent'

const STORY_BACKGROUND =
  '#B4485B'

const STORY_FOREGROUND =
  '#F7EACB'

const STORY_MUTED =
  'rgba(247,234,203,0.72)'

const STORY_PANEL =
  '#F1E7D3'

const STORY_INK =
  '#27232A'

const INTRO_IMAGE =
  '/exploar/One food journey.png'

const JOURNEY_IMAGE_BY_ID = {
  discover:
    '/exploar/Discover.png',
  understand:
    '/exploar/understand.png',
  'build-basket':
    '/exploar/Build your basket.png',
  cook:
    '/exploar/Buy & Cook.png',
}

const WHY_IMAGE_BY_ID = {
  search:
    '/exploar/Smart Discovery.png',
  'trusted-data':
    '/exploar/Trusted Product data.png',
  'food-intelligence':
    '/exploar/ Food Intelligence.png',
  'pantry-planning':
    '/exploar/Pantry Aware Planning.png',
  'recipe-to-basket':
    '/exploar/Recipe to basket.png',
}

const STORY_RANGES = [
  [0.16, 0.38],
  [0.36, 0.58],
  [0.56, 0.78],
  [0.76, 0.98],
]

// All pinned stories follow the actual sticky travel rather than
// the dynamically changing browser viewport height (notably on mobile).
function useStableStickyProgress(sectionRef, optimizeDesktop = false, scrollRootRef = null) {
  const progress = useMotionValue(0)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let frame = null
    let desktopCache = null
    let cacheEnabled = false
    let observer = null
    const root = scrollRootRef?.current || null
    const scrollSource = root || window
    const getOffset = (rect) => root
      ? rect.top - root.getBoundingClientRect().top
      : rect.top
    const getPosition = () => root ? root.scrollTop : window.scrollY
    let embeddedGeometry = null
    const measureEmbedded = () => {
      if (!root) return
      const section = sectionRef.current
      if (!section) return
      const sectionRect = section.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      embeddedGeometry = {
        start: root.scrollTop + sectionRect.top - rootRect.top,
        travel: Math.max(sectionRect.height - root.clientHeight, 1),
      }
    }

    // Only Why EPANTRY on desktop uses cached geometry. Avoid synchronous
    // getBoundingClientRect reads on every scroll frame; How and all mobile
    // sections continue using the original calculation unchanged.
    const measureDesktop = () => {
      cacheEnabled = optimizeDesktop &&
        window.matchMedia('(min-width: 768px)').matches
      desktopCache = null
      if (!cacheEnabled) return
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const stickyHeight =
        section.firstElementChild?.getBoundingClientRect().height ||
        rect.height
      desktopCache = {
        start: getPosition() + getOffset(rect),
        travel: Math.max(rect.height - stickyHeight, 1),
      }
    }

    const update = () => {
      frame = null
      const section = sectionRef.current
      if (!section) return

      let next
      if (root && embeddedGeometry) {
        next = (root.scrollTop - embeddedGeometry.start) /
          embeddedGeometry.travel
      } else if (cacheEnabled && desktopCache) {
        next = (getPosition() - desktopCache.start) /
          desktopCache.travel
      } else {
        const rect = section.getBoundingClientRect()
        const stickyHeight =
          section.firstElementChild?.getBoundingClientRect().height ||
          rect.height
        const travel = Math.max(rect.height - stickyHeight, 1)
        next = -getOffset(rect) / travel
      }

      next = Math.min(Math.max(next, 0), 1)
      if (Math.abs(next - progress.get()) > 0.0001) {
        progress.set(next)
      }
    }

    const schedule = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(update)
      }
    }

    const remeasure = () => {
      if (root) measureEmbedded()
      else if (optimizeDesktop) measureDesktop()
      schedule()
    }

    if (root) {
      measureEmbedded()
      // Modal CSS stage variables are set by the parent after mounting.
      // Re-measure when those values change, and when the dialog resizes.
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(remeasure)
        observer.observe(root)
        if (sectionRef.current) observer.observe(sectionRef.current)
      }
    }
    if (optimizeDesktop && !root) {
      measureDesktop()
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(remeasure)
        if (sectionRef.current) {
          observer.observe(sectionRef.current)
          if (sectionRef.current.firstElementChild) {
            observer.observe(sectionRef.current.firstElementChild)
          }
          if (root) observer.observe(root)
        }
      }
    }
    update()
    scrollSource.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', remeasure)
    window.addEventListener('pageshow', remeasure)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      scrollSource.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('pageshow', remeasure)
    }
  }, [progress, sectionRef, optimizeDesktop, scrollRootRef])

  return progress
}
function useMobileStoryIndex(progress, stops) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    if (!mobile) return undefined
    const update = (value) => {
      const next = stops.reduce((best, stop, index) =>
        Math.abs(stop - value) < Math.abs(stops[best] - value) ? index : best, 0)
      setActive((previous) => previous === next ? previous : next)
    }
    update(progress.get())
    return progress.on('change', update)
  }, [mobile, progress, stops])
  return { mobile, active }
}

const HOW_STOPS = [0.04, 0.27, 0.47, 0.67, 0.87]
const WHY_STOPS = [0.24, 0.39, 0.54, 0.69, 0.9]

function clampIndex(
  index,
  length,
) {
  if (
    !Number.isInteger(index) ||
    length <= 0
  ) {
    return 0
  }

  return Math.min(
    Math.max(index, 0),
    length - 1,
  )
}

function IntroVisual({
  progress,
  shouldReduceMotion,
  mobile = false,
}) {
  const opacity =
    useTransform(
      progress,
      [
        0,
        0.12,
        0.18,
        0.22,
      ],
      [
        1,
        1,
        0.82,
        0,
      ],
    )

  const scale =
    useTransform(
      progress,
      [
        0,
        0.075,
        0.145,
        0.21,
      ],
      (shouldReduceMotion || mobile)
        ? [
            1,
            1,
            1,
            1,
          ]
        : [
            0.62,
            0.98,
            1.34,
            0.78,
          ],
    )

  const x =
    useTransform(
      progress,
      [
        0.12,
        0.21,
      ],
      (shouldReduceMotion || mobile)
        ? [
            '0vw',
            '0vw',
          ]
        : [
            '0vw',
            '-34vw',
          ],
    )

  const y =
    useTransform(
      progress,
      [
        0,
        0.12,
        0.21,
      ],
      (shouldReduceMotion || mobile)
        ? [
            '0vh',
            '0vh',
            '0vh',
          ]
        : [
            '2vh',
            '-1vh',
            '17vh',
          ],
    )

  const titleOpacity =
    useTransform(
      progress,
      [
        0,
        0.14,
        0.19,
      ],
      [
        1,
        1,
        0,
      ],
    )

  const titleScale =
    useTransform(
      progress,
      [
        0,
        0.12,
        0.19,
      ],
      (shouldReduceMotion || mobile)
        ? [
            1,
            1,
            1,
          ]
        : [
            0.94,
            1.04,
            1.12,
          ],
    )

  return (
    <motion.div
      aria-hidden="true"
      style={{
        opacity,
        scale,
        x,
        y,
      }}
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[42svh] w-[min(68vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border border-white/20 bg-[#E9DFC9] shadow-[0_42px_90px_rgba(49,15,24,0.32)] sm:h-[48svh] lg:h-[56svh] lg:w-[min(54vw,780px)] lg:rounded-[30px]"
    >
      <img
        src={INTRO_IMAGE}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-0 h-full w-full select-none object-cover object-center"
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,35,24,0.02)_25%,rgba(18,35,24,0.12)_58%,rgba(18,35,24,0.72)_100%)]" />

      <motion.div
        style={{
          opacity:
            titleOpacity,
          scale:
            titleScale,
        }}
        className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-20 text-left sm:px-7 sm:pb-7 lg:px-8 lg:pb-8"
      >
        <div className="drop-shadow-[0_6px_18px_rgba(0,0,0,0.28)]">
          <div className="font-serif text-[clamp(25px,3.2vw,48px)] italic leading-none text-white">
            One food journey.
          </div>

          <div className="mt-1 max-w-[12ch] text-[clamp(24px,4vw,58px)] font-medium uppercase leading-[0.88] tracking-[-0.055em] text-white">
            Everything stays connected.
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function JourneyScene({
  item,
  index,
  progress,
  range,
  shouldReduceMotion,
  mobile = false,
}) {
  const [
    start,
    end,
  ] = range

  const enter =
    start +
    (end - start) * 0.2

  const exit =
    end -
    (end - start) * 0.2

  const fromLeft =
    index % 2 === 0

  const opacity =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      [
        0,
        1,
        1,
        0,
      ],
    )

  const visualX =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      (shouldReduceMotion || mobile)
        ? [
            '0vw',
            '0vw',
            '0vw',
            '0vw',
          ]
        : fromLeft
          ? [
              '-34vw',
              '0vw',
              '0vw',
              '-45vw',
            ]
          : [
              '34vw',
              '0vw',
              '0vw',
              '45vw',
            ],
    )

  const visualY =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      (shouldReduceMotion || mobile)
        ? [
            '0vh',
            '0vh',
            '0vh',
            '0vh',
          ]
        : [
            '15vh',
            '0vh',
            '0vh',
            '-10vh',
          ],
    )

  const visualRotate =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      (shouldReduceMotion || mobile)
        ? [
            0,
            0,
            0,
            0,
          ]
        : fromLeft
          ? [
              -13,
              -3,
              1.5,
              8,
            ]
          : [
              13,
              3,
              -1.5,
              -8,
            ],
    )

  const visualScale =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      (shouldReduceMotion || mobile)
        ? [
            1,
            1,
            1,
            1,
          ]
        : [
            0.72,
            1,
            1,
            0.82,
          ],
    )

  const textX =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      (shouldReduceMotion || mobile)
        ? [
            '0vw',
            '0vw',
            '0vw',
            '0vw',
          ]
        : fromLeft
          ? [
              '18vw',
              '0vw',
              '0vw',
              '12vw',
            ]
          : [
              '-18vw',
              '0vw',
              '0vw',
              '-12vw',
            ],
    )

  const textY =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      (shouldReduceMotion || mobile)
        ? [
            0,
            0,
            0,
            0,
          ]
        : [
            34,
            0,
            0,
            -24,
          ],
    )

  const imagePath =
    JOURNEY_IMAGE_BY_ID[item.id]

  return (
    <motion.div
      style={{
        opacity,
      }}
      className="pointer-events-none absolute inset-x-0 bottom-[6svh] top-[24svh] z-20 px-5 sm:px-8 lg:bottom-[4svh] lg:top-[22svh] lg:px-[8vw]"
    >
      <div
        className={`mx-auto grid h-full max-w-[1500px] items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.68fr)] lg:gap-[7vw] ${
          fromLeft
            ? ''
            : 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1'
        }`}
      >
        <motion.div
          style={{
            x:
              visualX,
            y:
              visualY,
            rotate:
              visualRotate,
            scale:
              visualScale,
          }}
          className="relative mx-auto flex h-[38svh] w-[min(82vw,520px)] items-center justify-center overflow-hidden rounded-[24px] border border-white/25 bg-[#F0E6D4] shadow-[0_30px_70px_rgba(57,12,24,0.28)] sm:h-[42svh] lg:h-[52svh] lg:w-full lg:max-w-[670px] lg:rounded-[28px]"
        >
          {imagePath ? (
            <img
              src={imagePath}
              alt=""
              aria-hidden="true"
              draggable="false"
              className="absolute inset-0 h-full w-full select-none object-cover object-center"
            />
          ) : null}

          <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(35,27,22,0.02)_28%,rgba(35,27,22,0.08)_55%,rgba(35,27,22,0.78)_100%)] md:block" />

          <div className="absolute bottom-4 left-4 right-4 z-10 hidden md:block sm:bottom-5 sm:left-5 sm:right-5 lg:bottom-6 lg:left-6 lg:right-6">
            <div className="max-w-[12ch] text-[clamp(25px,3vw,46px)] font-medium leading-[0.92] tracking-[-0.045em] text-white drop-shadow-[0_5px_16px_rgba(0,0,0,0.3)]">
              {item.title}
            </div>
          </div>
        </motion.div>

        <motion.div
          style={{
            x:
              textX,
            y:
              textY,
          }}
          className={`mx-auto w-full max-w-[540px] ${
            fromLeft
              ? 'lg:text-left'
              : 'lg:text-right'
          } text-center`}
        >
          <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#F7EACB]/85 sm:text-[13px] lg:text-sm">
            Step {item.step}
          </div>

          <h3 className="mt-2.5 text-[clamp(34px,4.2vw,68px)] font-bold leading-[0.95] tracking-[-0.045em] text-[#F7EACB]">
            {item.title}
          </h3>

        </motion.div>
      </div>
    </motion.div>
  )
}

const WHY_CUSTOMER_BENEFITS = [
  ...landingBenefits,
  {
    id: 'pantry-planning',
    title: 'Pantry-Aware Planning',
    description:
      'Keep pantry context and meal planning connected so you can see what you already have and what you may still need.',
    icon: ShoppingBasket,
  },
  {
    id: 'recipe-to-basket',
    title: 'Recipe to Basket',
    description:
      'Scale a recipe, review the ingredients you need and carry those needs into shopping without starting the journey again.',
    icon: CookingPot,
  },
]

// Scroll decides *which* benefit is visible. Motion handles the complete
// transition independently of individual wheel/trackpad deltas. All five
// scenes stay mounted and fade/slide both forward and backward; avoid
// toggling visibility during the exit transition.
const WHY_DESKTOP_TRANSITION = {
  duration: 0.68,
  ease: [0.22, 1, 0.36, 1],
  opacity: { duration: 0.58, ease: 'easeInOut' },
}

function WhyBenefitScene({
  benefit,
  index,
  active,
  previous,
  shouldReduceMotion,
}) {
  const isActive = index === active
  const isLeaving = index === previous && previous !== active
  // Even a rapidly skipped outgoing card must complete its exit.
  // Keep panels mounted while they fade out, so reverse scrolling stays fluid.
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : WHY_DESKTOP_TRANSITION
  const imagePath = WHY_IMAGE_BY_ID[benefit.id]

  return (
    <motion.article
      aria-hidden={!isActive}
      initial={false}
      animate={shouldReduceMotion
        ? {
            opacity: isActive ? 1 : 0,
            y: 0,
          }
        : {
            opacity: isActive ? 1 : 0,
            y: isActive ? '0svh' : index < active ? '-26svh' : '28svh',
          }}
      transition={transition}
      style={{ zIndex: isLeaving ? 3 : isActive ? 2 : 1 }}
      className="pointer-events-none absolute inset-x-0 bottom-[7svh] top-[25svh] z-20 px-5 sm:px-8 lg:bottom-[6svh] lg:top-[23svh] lg:px-[5vw]"
    >
      <div className="mx-auto grid h-full max-w-[1540px] items-center gap-5 sm:gap-7 lg:grid-cols-[minmax(250px,0.72fr)_minmax(420px,1.3fr)_minmax(180px,0.42fr)] lg:gap-[5vw]">
        <motion.div
          animate={shouldReduceMotion
            ? { x: 0, scale: 1 }
            : {
                x: isActive ? '0vw' : index < active ? '-3vw' : '-7vw',
                scale: isActive ? 1 : index < active ? 0.96 : 0.92,
              }}
          transition={transition}
          className="relative mx-auto h-[31svh] w-full max-w-[410px] overflow-hidden bg-[#111111] sm:h-[36svh] lg:h-[52svh]"
        >
          {imagePath ? (
            <img
              src={imagePath}
              alt=""
              aria-hidden="true"
              draggable="false"
              decoding="async"
              loading="eager"
              className="absolute inset-0 h-full w-full select-none object-cover object-center"
            />
          ) : null}

        </motion.div>

        <motion.div
          animate={shouldReduceMotion
            ? { x: 0 }
            : { x: isActive ? '0vw' : index < active ? '3vw' : '6vw' }}
          transition={transition}
          className="mx-auto w-full max-w-[650px] lg:mx-0"
        >
          <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/65 sm:text-sm">
            Why EPANTRY
          </div>

          <h3 className="mt-3 max-w-[16ch] text-[clamp(34px,3.4vw,60px)] font-medium leading-[0.98] tracking-[-0.045em] text-[#F3F1EB]">
            {benefit.title}
          </h3>

        </motion.div>

        <div className="hidden self-start pt-3 lg:block">
          <div className="w-full border-t border-white/25 pt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-white/75">
                Why EPANTRY
              </span>
              <span className="shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.12em] text-white/45">
                01 — 05
              </span>
            </div>

            <div className="mt-6 border-l border-white/20">
              {WHY_CUSTOMER_BENEFITS.map(
                (
                  item,
                  itemIndex,
                ) => (
                  <div
                    key={item.id}
                    className={`relative grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 border-b border-white/10 py-3 pl-4 pr-1 transition-colors duration-300 ${
                      itemIndex === index
                        ? 'bg-[linear-gradient(90deg,rgba(255,255,255,0.09),transparent)] text-[#F3F1EB]'
                        : 'text-white/45'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute -left-px bottom-2 top-2 w-[2px] transition-colors duration-300 ${
                        itemIndex === index
                          ? 'bg-[#CDEDDC]'
                          : 'bg-transparent'
                      }`}
                    />
                    <span className={`text-[11px] font-bold tabular-nums tracking-[0.04em] ${
                      itemIndex === index
                        ? 'text-[#CDEDDC]'
                        : 'text-white/35'
                    }`}>
                      {String(itemIndex + 1).padStart(2, '0')}
                    </span>
                    <span className={`text-[clamp(12px,0.95vw,15px)] leading-[1.4] tracking-[-0.015em] ${
                      itemIndex === index
                        ? 'font-semibold'
                        : 'font-medium'
                    }`}>
                      {item.title}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}


// Mobile How scenes stay mounted to avoid expensive image/card remounts.
// Keep the departing card above the arriving card until its slide/fade
// finishes, so changing steps is visibly smooth rather than abrupt.
// Desktop scenes and all card content/styles are left unchanged.
function MobileHowScene({ active, shouldReduceMotion }) {
  const scenes = [null, ...landingJourneySteps]
  const previousActiveRef = useRef(active)
  const leavingIndex = previousActiveRef.current === active
    ? -1
    : previousActiveRef.current

  useEffect(() => {
    previousActiveRef.current = active
  }, [active])

  return (
    <div className="absolute inset-x-0 bottom-[6svh] top-[23svh] z-20 flex items-center justify-center px-5">
      <div className="relative h-full w-full max-w-[540px]">
        {scenes.map((item, index) => {
          const isActive = index === active
          const isLeaving = index === leavingIndex
          const imagePath = item ? JOURNEY_IMAGE_BY_ID[item.id] : INTRO_IMAGE

          return (
            <motion.div
              key={item?.id || 'journey-intro'}
              aria-hidden={!isActive}
              initial={false}
              animate={shouldReduceMotion
                ? { opacity: isActive ? 1 : 0, y: 0, scale: 1 }
                : {
                    opacity: isActive ? 1 : 0,
                    y: isActive ? 0 : index < active ? -34 : 30,
                    scale: isActive ? 1 : 0.975,
                  }}
              transition={shouldReduceMotion
                ? { duration: 0 }
                : {
                    opacity: {
                      duration: isActive || isLeaving ? 0.58 : 0.22,
                      ease: 'easeInOut',
                      delay: isActive ? 0.06 : 0,
                    },
                    y: {
                      duration: isActive || isLeaving ? 0.6 : 0.22,
                      ease: [0.22, 1, 0.36, 1],
                      delay: isActive ? 0.06 : 0,
                    },
                    scale: {
                      duration: isActive || isLeaving ? 0.6 : 0.22,
                      ease: [0.22, 1, 0.36, 1],
                      delay: isActive ? 0.06 : 0,
                    },
                  }}
              style={{
                zIndex: isLeaving ? 2 : isActive ? 1 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
                willChange: isActive || isLeaving ? 'transform, opacity' : 'auto',
              }}
              className="absolute inset-0 flex w-full flex-col items-center justify-center gap-5 text-center"
            >
              <div className="relative h-[min(42svh,390px)] w-full overflow-hidden rounded-[24px] border border-white/25 bg-[#F0E6D4] shadow-[0_24px_50px_rgba(57,12,24,0.22)]">
                <img
                  src={imagePath}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              {item ? (
                <div className="w-full">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#F7EACB]/85">Step {item.step}</div>
                  <h3 className="mt-2 text-[clamp(32px,8vw,44px)] font-bold leading-[1.02] tracking-[-0.045em] text-[#F7EACB]">{item.title}</h3>
                </div>
              ) : (
                <div className="max-w-[290px]">
                  <p className="font-serif text-[28px] italic text-[#F7EACB]">One food journey.</p>
                  <p className="mt-1 text-xl font-semibold uppercase leading-tight tracking-[-0.04em] text-[#F7EACB]">Everything stays connected.</p>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// Mobile Why cards stay mounted so a step change never waits for the old
// image/card to unmount or the next image to create a new DOM tree.
// Animate only opacity and transforms; keep the desktop story untouched.
const WHY_MOBILE_TRANSITION = {
  duration: 0.64,
  ease: [0.22, 1, 0.36, 1],
  opacity: { duration: 0.58, ease: 'easeInOut' },
}

function MobileWhyScene({ active, previous, shouldReduceMotion }) {
  return (
    <div className="absolute inset-x-0 bottom-[7svh] top-[24svh] z-20 flex items-center justify-center px-5">
      <div className="relative h-full w-full max-w-[500px]">
        {WHY_CUSTOMER_BENEFITS.map((benefit, index) => {
          const isActive = index === active
          const isLeaving = index === previous && previous !== active

          return (
            <motion.div
              key={benefit.id}
              aria-hidden={!isActive}
              initial={false}
              animate={shouldReduceMotion
                ? {
                    opacity: isActive ? 1 : 0,
                    y: 0,
                    scale: 1,
                  }
                : {
                    opacity: isActive ? 1 : 0,
                    y: isActive ? 0 : index < active ? -42 : 44,
                    scale: isActive ? 1 : 0.985,
                  }}
              transition={shouldReduceMotion
                ? { duration: 0 }
                : WHY_MOBILE_TRANSITION}
              style={{
                zIndex: isLeaving ? 3 : isActive ? 2 : 1,
                pointerEvents: isActive ? 'auto' : 'none',
                willChange: isLeaving || isActive ? 'transform, opacity' : 'auto',
              }}
              className="absolute inset-0 flex w-full flex-col items-center justify-center gap-5 text-left"
            >
              <div className="h-[min(40svh,370px)] w-full max-w-[410px] overflow-hidden bg-[#111111]">
                <img
                  src={WHY_IMAGE_BY_ID[benefit.id]}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="w-full max-w-[410px]">
                <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/65">Why EPANTRY</p>
                <h3 className="mt-3 text-[clamp(34px,8vw,48px)] font-medium leading-[0.98] tracking-[-0.045em] text-[#F3F1EB]">{benefit.title}</h3>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// In the embedded popup, the Why scenes follow scroll progress directly.
// No discrete React scene swaps or long animation timers run on wheel events.
// This eliminates forward/reverse snapping and uses the modal viewport rather
// than full-window svh offsets for each image and title.
function smoothStep(value) {
  const clamped = Math.min(Math.max(value, 0), 1)
  return clamped * clamped * (3 - 2 * clamped)
}

function EmbeddedWhyBenefitScene({ benefit, index, progress, shouldReduceMotion }) {
  const previousBoundary = index > 0
    ? (WHY_STOPS[index - 1] + WHY_STOPS[index]) / 2
    : null
  const nextBoundary = index < WHY_STOPS.length - 1
    ? (WHY_STOPS[index] + WHY_STOPS[index + 1]) / 2
    : null
  const blend = 0.038

  const opacity = useTransform(progress, (value) => {
    const fadeIn = previousBoundary === null ? 1
      : smoothStep((value - (previousBoundary - blend)) / (blend * 2))
    const fadeOut = nextBoundary === null ? 1
      : 1 - smoothStep((value - (nextBoundary - blend)) / (blend * 2))
    return Math.min(fadeIn, fadeOut)
  })
  const y = useTransform(progress, (value) => {
    if (shouldReduceMotion) return 0
    if (previousBoundary !== null && value < previousBoundary + blend) {
      return (1 - smoothStep((value - (previousBoundary - blend)) / (blend * 2))) * 22
    }
    if (nextBoundary !== null && value > nextBoundary - blend) {
      return -22 * smoothStep((value - (nextBoundary - blend)) / (blend * 2))
    }
    return 0
  })

  return (
    <motion.article
      style={{ opacity, y, pointerEvents: 'none' }}
      className="absolute inset-0 flex items-center justify-center overflow-hidden px-5 py-6 sm:px-10 sm:py-8"
      role="group"
      aria-label={benefit.title}
    >
      <div className="grid h-full w-full max-w-[1000px] min-h-0 items-center gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] md:gap-9">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[410px] items-center justify-center overflow-hidden">
          <img
            src={WHY_IMAGE_BY_ID[benefit.id]}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            draggable="false"
            className="h-full max-h-[95%] w-full object-contain"
          />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#DCE0CF]">
            Why EPANTRY <span className="ml-2 text-[#DCE0CF]/65">{String(index + 1).padStart(2, '0')} / 05</span>
          </p>
          <h3 className="mt-3 text-[clamp(26px,3.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#F7F6F2]">
            {benefit.title}
          </h3>
          <p className="mt-4 max-w-[40ch] text-[14px] leading-6 text-[#DCE0CF] sm:text-[16px] sm:leading-7">
            {benefit.description}
          </p>
        </div>
      </div>
    </motion.article>
  )
}

// Keep the selected benefit and the departing benefit together in React
// state. A single update per crossed stop means quick forward/back gestures
// cannot flip the exiting card's stacking order mid-transition.
// This hook is local to Why EPANTRY; How EPANTRY's logic stays untouched.
function useWhyTransitionState(progress, skipSceneTransitions = false) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches,
  )
  const [scene, setScene] = useState({ active: 0, previous: -1 })
  const activeRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (skipSceneTransitions) return undefined
    const update = (rawValue) => {
      const value = Math.min(Math.max(rawValue, 0), 1)
      const current = activeRef.current
      const next = WHY_STOPS.reduce((best, stop, index) =>
        Math.abs(stop - value) < Math.abs(WHY_STOPS[best] - value)
          ? index
          : best, 0)
      if (next === current) return

      // Wheel momentum / touch bounce can repeatedly cross a stop midpoint.
      // A tiny hysteresis band prevents A-B-A-B flips and visible jolts,
      // while long flicks still jump directly to the correct card.
      if (Math.abs(next - current) === 1) {
        const boundary = (WHY_STOPS[next] + WHY_STOPS[current]) / 2
        const buffer = 0.012
        if (next > current && value < boundary + buffer) return
        if (next < current && value > boundary - buffer) return
      }

      activeRef.current = next
      setScene({ active: next, previous: current })
    }
    update(progress.get())
    return progress.on('change', update)
  }, [progress, skipSceneTransitions])

  return { mobile, ...scene }
}
function WhyEpantrySection({
  shouldReduceMotion,
  embedded = false,
  scrollRootRef = null,
}) {
  const sectionRef =
    useRef(null)

  const progress = useStableStickyProgress(sectionRef, true, scrollRootRef)
  const { mobile, active, previous } = useWhyTransitionState(progress, embedded)

  // Preload/decode the existing five images once so neither desktop nor
  // mobile waits for an image while a card transition is already playing.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const images = Object.values(WHY_IMAGE_BY_ID).map((src) => {
      const image = new window.Image()
      image.decoding = 'async'
      image.src = src
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {})
      }
      return image
    })
    return () => { images.length = 0 }
  }, [])

  // Why's heading still follows scroll; only the heavy cards are
  // decoupled from raw scroll delta to prevent jerky card replacement.
  const visualProgress = progress

  const titleY =
    useTransform(
      visualProgress,
      [
        0.08,
        0.17,
      ],
      shouldReduceMotion
        ? [
            0,
            0,
          ]
        : [
            18,
            0,
          ],
    )

  const titleOpacity =
    useTransform(
      visualProgress,
      [
        0.06,
        0.16,
        0.93,
        1,
      ],
      [
        0,
        1,
        1,
        0.72,
      ],
    )

  const fieldY =
    useTransform(
      visualProgress,
      [
        0,
        1,
      ],
      shouldReduceMotion
        ? [
            '0%',
            '0%',
          ]
        : [
            '4%',
            '-5%',
          ],
    )

  return (
    <section
      ref={sectionRef}
      data-landing-story="why"
      data-landing-stops="0.24,0.39,0.54,0.69,0.9"
      className="relative z-20 h-[450svh] w-full bg-[#080808]"
      style={embedded ? { height: 'var(--epantry-guide-why)' } : undefined}
    >
      <div
        data-landing-sticky
        className="sticky top-0 h-[100svh] sm:h-[100svh] w-full overflow-hidden bg-[#080808] text-[#F3F1EB]"
        style={embedded ? { height: 'var(--epantry-guide-stage)' } : undefined}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <motion.div
            style={{
              y: mobile ? fieldY : 0,
            }}
            className="absolute -inset-[8%]"
          >
            <div className="absolute left-[8%] top-[8%] hidden h-[34vw] sm:block max-h-[540px] w-[34vw] max-w-[540px] rounded-full bg-white/[0.025] blur-[120px]" />
            <div className="absolute bottom-[5%] right-[6%] hidden h-[36vw] sm:block max-h-[560px] w-[36vw] max-w-[560px] rounded-full bg-white/[0.018] blur-[120px]" />
          </motion.div>

          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />
        </div>

        <motion.header
          style={{
            opacity:
              titleOpacity,
            y:
              titleY,
          }}
          className="pointer-events-none absolute left-5 right-5 top-[max(88px,7svh)] z-30 sm:left-8 sm:right-8 lg:left-[5vw] lg:right-[5vw]"
        >
          <div className="flex items-start justify-between gap-6">
            <div className="text-[13px] font-bold uppercase tracking-[0.2em] text-white/72 sm:text-sm">
              Why EPANTRY
            </div>

          </div>
        </motion.header>

        {embedded ? (
          <div className="absolute inset-x-0 bottom-[5%] top-[12%] z-20 md:bottom-[8%] md:top-[15%]">
            {WHY_CUSTOMER_BENEFITS.map((benefit, index) => (
              <EmbeddedWhyBenefitScene
                key={benefit.id}
                benefit={benefit}
                index={index}
                progress={progress}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))}
          </div>
        ) : mobile ? (
          <MobileWhyScene active={active} previous={previous} shouldReduceMotion={shouldReduceMotion} />
        ) : WHY_CUSTOMER_BENEFITS.map((benefit, index) => (
          <WhyBenefitScene
            key={benefit.id}
            benefit={benefit}
            index={index}
            active={active}
            previous={previous}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}

      </div>
    </section>
  )
}

export default function HowItWorksSection({ embedded = false, scrollRootRef = null }) {
  const sectionRef =
    useRef(null)

  const shouldReduceMotion =
    useReducedMotion()

  const progress = useStableStickyProgress(sectionRef, false, scrollRootRef)
  const { mobile, active } = useMobileStoryIndex(progress, HOW_STOPS)

  const headerOpacity =
    useTransform(
      progress,
      [
        0.13,
        0.19,
        0.96,
        1,
      ],
      [
        0,
        1,
        1,
        0.92,
      ],
    )

  const headerY =
    useTransform(
      progress,
      [
        0.13,
        0.21,
      ],
      shouldReduceMotion
        ? [
            0,
            0,
          ]
        : [
            -22,
            0,
          ],
    )

  const atmosphereX =
    useTransform(
      progress,
      [
        0,
        1,
      ],
      shouldReduceMotion
        ? [
            '0%',
            '0%',
          ]
        : [
            '-7%',
            '7%',
          ],
    )

  const atmosphereY =
    useTransform(
      progress,
      [
        0,
        1,
      ],
      shouldReduceMotion
        ? [
            '0%',
            '0%',
          ]
        : [
            '5%',
            '-5%',
          ],
    )

  return (
    <>
      <section
        ref={sectionRef}
        data-landing-story="how"
        data-landing-stops="0.04,0.27,0.47,0.67,0.87"
        className="relative h-[400svh] w-full bg-[#B4485B]"
        style={embedded ? { height: 'var(--epantry-guide-how)' } : undefined}
      >
      <div
        data-landing-sticky
        className="sticky top-0 h-[100svh] sm:h-[100svh] w-full overflow-hidden"
        style={{
          backgroundColor: STORY_BACKGROUND,
          color: STORY_FOREGROUND,
          ...(embedded ? { height: 'var(--epantry-guide-stage)' } : {}),
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <motion.div
            style={{
              x:
                atmosphereX,
              y:
                atmosphereY,
            }}
            className="absolute -inset-[12%] opacity-60"
          >
            <div className="absolute left-[6%] top-[7%] hidden h-[38vw] sm:block max-h-[620px] w-[38vw] max-w-[620px] rounded-full bg-[#D96876]/22 blur-[110px]" />
            <div className="absolute bottom-[2%] right-[5%] hidden h-[34vw] sm:block max-h-[520px] w-[34vw] max-w-[520px] rounded-full bg-[#7D2039]/22 blur-[110px]" />
          </motion.div>

          <div className="absolute inset-0 opacity-[0.075] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:62px_62px]" />
        </div>

        <motion.header
          style={{
            opacity:
              headerOpacity,
            y:
              headerY,
          }}
          className="pointer-events-none absolute left-5 right-5 top-[max(88px,8svh)] z-30 sm:left-8 sm:right-8 lg:left-[8vw] lg:right-[8vw]"
        >
          <div className="h-px w-8 bg-[#F7EACB]/80 sm:w-10" />

          <div className="mt-3 flex flex-col gap-1 sm:mt-4">
            <div className="flex items-baseline gap-3 sm:gap-4">
              <span className="font-serif text-[clamp(28px,3.5vw,52px)] italic leading-none tracking-[-0.025em] text-[#F7EACB]">
                How EPANTRY
              </span>

              <span className="text-[clamp(28px,4vw,58px)] font-semibold uppercase leading-none tracking-[-0.035em] text-[#F7EACB]">
                Works
              </span>
            </div>

          </div>
        </motion.header>

        {mobile ? (
          <MobileHowScene active={active} shouldReduceMotion={shouldReduceMotion} />
        ) : null}
        {!mobile && <IntroVisual
          progress={progress}
          shouldReduceMotion={shouldReduceMotion}
          mobile={mobile}
        />}

        {!mobile && landingJourneySteps.map(
          (
            item,
            index,
          ) => (!mobile || index === active - 1) ? (
            <JourneyScene
              key={item.id}
              item={item}
              index={index}
              progress={progress}
              range={
                STORY_RANGES[
                  clampIndex(
                    index,
                    STORY_RANGES.length,
                  )
                ]
              }
              shouldReduceMotion={shouldReduceMotion}
              mobile={mobile}
            />
          ) : null,
        )}


        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-5 right-5 z-40 flex items-center gap-2 sm:bottom-7 sm:right-8"
        >
          <div className="h-px w-8 bg-[#F7EACB]/35" />
          <div className="text-[9px] font-black uppercase tracking-[0.28em] text-[#F7EACB]/55 sm:text-[10px]">
            Scroll
          </div>
        </div>
        </div>
      </section>

      <WhyEpantrySection
        shouldReduceMotion={shouldReduceMotion}
        embedded={embedded}
        scrollRootRef={scrollRootRef}
      />
    </>
  )
}
