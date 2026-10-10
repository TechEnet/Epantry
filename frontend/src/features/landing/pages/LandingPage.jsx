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

  const {
    scrollYProgress:
      experienceScrollProgress,
  } = useScroll({
    target:
      experienceSectionRef,

    offset: [
      'start start',
      'end end',
    ],
  })

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
      shouldReduceMotion
        ? [1, 1, 1]
        : [1, 0.955, 0.91],
    )

  const exploreSceneRotateX =
    useTransform(
      featuredDepthProgress,
      [0, 1],
      shouldReduceMotion
        ? [0, 0]
        : [0, -3],
    )

  const exploreSceneY =
    useTransform(
      featuredDepthProgress,
      [0, 1],
      shouldReduceMotion
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
      shouldReduceMotion
        ? [1, 1, 1]
        : [0.90, 0.96, 1],
    )

  const groceryEntranceLift =
    useTransform(
      featuredDepthProgress,
      [0, 1],
      shouldReduceMotion
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
      shouldReduceMotion
        ? ['0svh', '0svh']
        : ['0svh', '-56svh'],
    )

  const backdropDepthScale =
    useTransform(
      experienceScrollProgress,
      [0, 0.5, 1],
      shouldReduceMotion
        ? [1, 1, 1]
        : [1.025, 1, 1.035],
    )

  const backdropDepthRotateX =
    useTransform(
      experienceScrollProgress,
      [0, 0.5, 1],
      shouldReduceMotion
        ? [0, 0, 0]
        : [0.8, -0.65, 0.9],
    )

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
    }
  }, [])

  useEffect(() => {
    const updateStage = (
      value,
    ) => {
      let nextIndex = -1

      if (value >= 0.13 && value < 0.36) {
        nextIndex = 0
      } else if (value >= 0.36 && value < 0.59) {
        nextIndex = 1
      } else if (value >= 0.59 && value < 0.86) {
        nextIndex = 2
      } else if (value >= 0.86) {
        nextIndex = 2
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
    shouldReduceMotion,
  ])

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
    activeExperience
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

      <div className="relative z-10 h-[440svh] w-full bg-[#1A1A1A] sm:h-[460svh]">
        <div
          ref={experienceSectionRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[340svh] sm:h-[360svh]"
        />
        <section
          className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#1A1A1A] text-white [perspective:1400px]"
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
            className="absolute -inset-x-[8%] -inset-y-[14%] [transform-style:preserve-3d] [will-change:transform]"
          >
            {EXPERIENCE_BACKDROP_ROWS.map(
              (row, rowIndex) => (
                <ExperienceBackdropRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  shouldReduceMotion={shouldReduceMotion}
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
                  y: '0svh',
                }}
                transition={{
                  duration:
                    shouldReduceMotion
                      ? 0
                      : 0.78,
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

                    <motion.div
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
                    </motion.div>

                    {!shouldReduceMotion ? (
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
                    className="pointer-events-none absolute left-[6%] right-[6%] top-[calc(100%+10px)] h-[22%] overflow-hidden opacity-[0.12] [mask-image:linear-gradient(to_bottom,black,transparent)]"
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
            className="pointer-events-none absolute inset-0 z-50 bg-[#080808]/30 backdrop-blur-[5px]"
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
        className="relative z-30 -mt-[100svh]"
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
}) {
  const repeatedGroups = [
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
          shouldReduceMotion
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


