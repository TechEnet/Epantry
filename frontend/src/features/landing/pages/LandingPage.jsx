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
} from 'motion/react'

import ClosingCtaSection from '../components/ClosingCtaSection'

import FeaturedContentSection from '../components/FeaturedContentSection'

import HeroSection from '../components/HeroSection'

import HowItWorksSection from '../components/HowItWorksSection'

import {
  landingCategories,
} from '../content/landingContent'

const EXPERIENCE_INTRO_TRANSFORMS = [
  {
    x: '72%',
    y: 18,
    rotate: -9,
    scale: 0.95,
  },
  {
    x: '0%',
    y: 0,
    rotate: 2,
    scale: 0.98,
  },
  {
    x: '-72%',
    y: 18,
    rotate: 9,
    scale: 0.95,
  },
]

const EXPERIENCE_SETTLED_TRANSFORM = {
  x: '0%',
  y: 0,
  rotate: 0,
  scale: 1,
}

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

const mobileRailFrames = new WeakMap()

function updateMobileRailFocus(rail) {
  if (!rail?.children?.length) {
    return
  }

  const railRect = rail.getBoundingClientRect()
  const railCenter = railRect.left + railRect.width / 2
  const focusDistance = Math.max(railRect.width * 0.72, 1)

  Array.from(rail.children).forEach((child) => {
    const card = child.firstElementChild

    if (!card) {
      return
    }

    const childRect = child.getBoundingClientRect()
    const childCenter = childRect.left + childRect.width / 2
    const distance = Math.min(
      Math.abs(childCenter - railCenter) / focusDistance,
      1,
    )
    const scale = 1.035 - distance * 0.115
    const translateY = distance * 8
    const opacity = 1 - distance * 0.045

    card.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`
    card.style.opacity = opacity.toFixed(3)
  })
}

function handleMobileRailScroll(event) {
  const rail = event.currentTarget
  const previousFrame = mobileRailFrames.get(rail)

  if (previousFrame) {
    cancelAnimationFrame(previousFrame)
  }

  const nextFrame = requestAnimationFrame(() => {
    updateMobileRailFocus(rail)
    mobileRailFrames.delete(rail)
  })

  mobileRailFrames.set(rail, nextFrame)
}

function initializeMobileRail(rail) {
  if (!rail || typeof requestAnimationFrame === 'undefined') {
    return
  }

  requestAnimationFrame(() => {
    const startCard = rail.querySelector('[data-mobile-rail-start]')

    if (startCard) {
      const centeredScrollLeft =
        startCard.offsetLeft -
        (rail.clientWidth - startCard.offsetWidth) / 2

      rail.scrollLeft = Math.max(centeredScrollLeft, 0)
    }

    updateMobileRailFocus(rail)
  })
}

export default function LandingPage() {
  const experienceSectionRef =
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
    experienceIntroStarted,
    setExperienceIntroStarted,
  ] = useState(false)

  const [
    experienceCardsSettled,
    setExperienceCardsSettled,
  ] = useState(false)

  const [
    hoveredExperienceId,
    setHoveredExperienceId,
  ] = useState(null)

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
    if (
      shouldReduceMotion
    ) {
      setExperienceIntroStarted(
        true,
      )

      setExperienceCardsSettled(
        true,
      )
    }
  }, [
    shouldReduceMotion,
  ])

  useEffect(() => {
    const sectionNode =
      experienceSectionRef.current

    if (
      !sectionNode ||
      !isDesktopHoverDevice ||
      shouldReduceMotion
    ) {
      return undefined
    }

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          if (
            !entry.isIntersecting ||
            entry.intersectionRatio <= 0.16
          ) {
            setExperienceIntroStarted(
              false,
            )

            setExperienceCardsSettled(
              false,
            )

            setHoveredExperienceId(
              null,
            )
          }
        },
        {
          threshold: [
            0,
            0.16,
            0.42,
            0.7,
          ],
        },
      )

    observer.observe(
      sectionNode,
    )

    return () => {
      observer.disconnect()
    }
  }, [
    isDesktopHoverDevice,
    shouldReduceMotion,
  ])

  const handleExperienceStackEnter = () => {
    if (
      !isDesktopHoverDevice ||
      shouldReduceMotion ||
      experienceIntroStarted
    ) {
      return
    }

    setExperienceIntroStarted(
      true,
    )
  }

  const handleExperienceCardEnter = (
    categoryId,
  ) => {
    if (
      !isDesktopHoverDevice ||
      shouldReduceMotion ||
      !experienceCardsSettled
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
        currentId ===
        categoryId
          ? null
          : currentId,
    )
  }

  const mobileExperienceCards =
    landingCategories.map(
      (category) => ({
        category,
      }),
    )

  return (
    <main className="overflow-hidden">

      {/* =============================================================
          HERO
      ============================================================= */}

      <HeroSection />


      {/* =============================================================
          START YOUR FOOD JOURNEY
      ============================================================= */}

      <ClosingCtaSection />


      {/* =============================================================
          EXPLORE EPANTRY
      ============================================================= */}

      <section
        ref={experienceSectionRef}
        className="relative min-h-[100svh] w-full overflow-hidden bg-[#F8FAF7]"
      >

        <SectionTexture
          variant="dots"
          position="right"
        />


        <div className="page-shell relative z-10 flex min-h-[100svh] flex-col py-8 sm:py-10">

          {/* Heading */}

          <div className="max-w-3xl shrink-0">

            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#166534] sm:text-base">
              Explore EPANTRY
            </p>


            <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.04em] text-[#111827] sm:text-5xl lg:text-[56px]">

              Three experiences.

              <br />

              One connected food platform.

            </h2>


            <p className="mt-3 max-w-2xl leading-7 text-[#6B7280]">

              Start with groceries, trusted brands or a recipe
              and move naturally between each experience.

            </p>

          </div>


          {/* Cards */}

          <div className="pb-7 pt-4 sm:flex sm:flex-1 sm:items-center sm:py-6">

            {/* Mobile-only focus rail: the centered card grows while both side cards remain partially visible. */}
            <div
              ref={initializeMobileRail}
              className="-mx-4 flex snap-x snap-mandatory scroll-smooth gap-3 overflow-x-auto overscroll-x-contain pl-4 pr-[12vw] pb-5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
              onScroll={handleMobileRailScroll}
            >

              {mobileExperienceCards.map(({ category }, index) => {
                const image = EXPERIENCE_CARD_IMAGES[category.id]

                return (
                  <motion.article
                    key={`mobile-experience-${category.id}`}
                    initial={false}
                    data-mobile-rail-start={index === 0 ? 'true' : undefined}
                    className="w-[84vw] shrink-0 snap-center"
                  >
                    <Link
                      to={category.path}
                      data-mobile-focus-card
                      className="focus-ring group relative block h-[70svh] overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-[#111827] shadow-[0_18px_42px_rgba(17,24,39,0.16)] will-change-transform [backface-visibility:hidden]"
                      style={{
                        transform:
                          index === 0
                            ? 'translate3d(0, 0, 0) scale(1.025)'
                            : 'translate3d(0, 8px, 0) scale(0.92)',
                      }}
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={category.title || category.label || category.id}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-active:scale-[1.02]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#F8FAF7]" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

                      <div className="absolute inset-x-4 bottom-[30%] rounded-[22px] border border-white/25 bg-white/15 px-4 py-4 text-white shadow-[0_14px_36px_rgba(0,0,0,0.18)] backdrop-blur-md">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/65">
                          EPANTRY Experience
                        </p>
                        <h3 className="mt-2 text-[27px] font-black leading-[0.98] tracking-[-0.04em]">
                          {category.title || category.label || category.id}
                        </h3>
                        {category.description && (
                          <p className="mt-3 line-clamp-2 max-w-[235px] text-[11px] font-semibold leading-5 text-white/72">
                            {category.description}
                          </p>
                        )}
                      </div>

                      <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/35 bg-white/90 text-[#111827] shadow-sm backdrop-blur">
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </span>
                    </Link>
                  </motion.article>
                )
              })}

            </div>

            <div
              className="hidden w-full gap-5 sm:grid md:grid-cols-3"
              onMouseEnter={handleExperienceStackEnter}
            >

              {landingCategories.map(
                (
                  category,
                  index,
                ) => {
                  const Icon =
                    category.icon

                  const categoryTone =
                    category.id === 'brands'
                      ? {
                          hoverBorder:
                            'hover:border-[#2563EB]/30',

                          glow:
                            'bg-[#2563EB]/10',

                          icon:
                            'bg-[#EFF6FF]/85 text-[#2563EB]',

                          action:
                            'text-[#2563EB]',

                          frame:
                            'bg-white/95 lg:bg-[#EFF6FF]',

                          glass:
                            'bg-[#EFF6FF]/60',
                        }
                      : category.id === 'recipes'
                        ? {
                            hoverBorder:
                              'hover:border-[#EA580C]/30',

                            glow:
                              'bg-[#F59E0B]/10',

                            icon:
                              'bg-[#FFF7ED]/85 text-[#EA580C]',

                            action:
                              'text-[#EA580C]',

                            frame:
                              'bg-white/95 lg:bg-[#FFF7ED]',

                            glass:
                              'bg-[#FFF7ED]/60',
                          }
                        : {
                            hoverBorder:
                              'hover:border-[#16A34A]/30',

                            glow:
                              'bg-[#16A34A]/10',

                            icon:
                              'bg-[#F0FDF4]/85 text-[#166534]',

                            action:
                              'text-[#166534]',

                            frame:
                              'bg-white/95 lg:bg-[#F0FDF4]',

                            glass:
                              'bg-[#F0FDF4]/60',
                          }

                  const isHovered =
                    hoveredExperienceId ===
                    category.id

                  const introTransform =
                    isDesktopHoverDevice &&
                    !shouldReduceMotion &&
                    !experienceIntroStarted
                      ? EXPERIENCE_INTRO_TRANSFORMS[
                          index
                        ]
                      : EXPERIENCE_SETTLED_TRANSFORM

                  return (
                    <motion.div
                      key={
                        category.id
                      }
                      initial={false}
                      animate={
                        introTransform
                      }
                      transition={{
                        duration:
                          isDesktopHoverDevice &&
                          !shouldReduceMotion
                            ? 0.58
                            : 0,

                        delay:
                          isDesktopHoverDevice &&
                          !shouldReduceMotion
                            ? experienceIntroStarted
                              ? index * 0.07
                              : (landingCategories.length - 1 - index) * 0.05
                            : 0,

                        ease: [
                          0.22,
                          1,
                          0.36,
                          1,
                        ],
                      }}
                      onAnimationComplete={() => {
                        if (
                          experienceIntroStarted &&
                          index ===
                            landingCategories.length -
                              1
                        ) {
                          setExperienceCardsSettled(
                            true,
                          )
                        }
                      }}
                      className="relative h-full"
                      style={{
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        zIndex:
                          !experienceIntroStarted
                            ? index === 1
                              ? 3
                              : index === 2
                                ? 2
                                : 1
                            : 1,
                      }}
                    >

                      <motion.div
                        className="h-full"
                        style={{
                          willChange: 'transform',
                          transformStyle: 'preserve-3d',
                        }}
                        animate={{
                          scale:
                            isHovered
                              ? 1.05
                              : 1,
                        }}
                        transition={{
                          duration:
                            0.6,

                          ease:
                            CARD_FLIP_EASE,
                        }}
                        onMouseEnter={() =>
                          handleExperienceCardEnter(
                            category.id,
                          )
                        }
                        onMouseLeave={() =>
                          handleExperienceCardLeave(
                            category.id,
                          )
                        }
                      >

                        <Link
                          to={
                            category.path
                          }
                          className={`focus-ring group relative block h-full min-h-[260px] overflow-hidden rounded-[24px] md:min-h-[320px] md:rounded-[28px] border border-[#E5E7EB] bg-white/95 shadow-sm transition ${experienceCardsSettled ? `${categoryTone.hoverBorder} hover:shadow-xl hover:shadow-[#111827]/10` : ''} [perspective:1000px]`}
                        >

                          <motion.div
                            className={`absolute inset-0 flex h-full flex-col overflow-hidden rounded-[24px] p-5 md:rounded-[28px] md:p-7 lg:p-3 ${categoryTone.frame} [backface-visibility:hidden] [transform-origin:bottom] [will-change:transform]`}
                            animate={{
                              rotateX:
                                isHovered
                                  ? 90
                                  : 0,
                            }}
                            transition={{
                              duration:
                                0.6,

                              ease:
                                CARD_FLIP_EASE,
                            }}
                          >

                            <ExperienceCardFront
                              category={
                                category
                              }
                              categoryTone={
                                categoryTone
                              }
                              isExpanded={
                                experienceIntroStarted
                              }
                            />

                          </motion.div>


                          <motion.div
                            aria-hidden="true"
                            className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-[24px] p-5 md:rounded-[28px] md:p-7 [backface-visibility:hidden] [transform-origin:bottom] [will-change:transform]"
                            initial={false}
                            animate={{
                              rotateX:
                                isHovered
                                  ? 0
                                  : -90,
                            }}
                            transition={{
                              duration:
                                0.6,

                              ease:
                                CARD_FLIP_EASE,
                            }}
                          >

                            <ExperienceCardBack
                              category={
                                category
                              }
                              categoryTone={
                                categoryTone
                              }
                              Icon={Icon}
                            />

                          </motion.div>

                        </Link>

                      </motion.div>

                    </motion.div>
                  )
                },
              )}

            </div>

          </div>

        </div>

      </section>


      {/* =============================================================
          FEATURED SECTIONS
      ============================================================= */}

      <FeaturedContentSection />


      {/* =============================================================
          HOW EPANTRY WORKS + WHY EPANTRY
      ============================================================= */}

      <HowItWorksSection />

    </main>
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
    <div className={`relative h-full overflow-hidden rounded-[20px] md:rounded-[24px] ${categoryTone.frame}`}>

      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />


      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-black/5"
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
          className="whitespace-nowrap text-2xl font-black tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] [will-change:transform] md:text-4xl lg:rounded-2xl lg:border lg:border-white/[0.15] lg:bg-black/[0.16] lg:px-4 lg:py-2 lg:shadow-[0_8px_28px_rgba(0,0,0,0.14)] lg:backdrop-blur-[3px] lg:drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
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



/*
|--------------------------------------------------------------------------
| Section Texture
|--------------------------------------------------------------------------
*/

function SectionTexture({
  variant = 'dots',
  position = 'right',
}) {
  const shouldReduceMotion =
    useReducedMotion()

  const blobPosition =
    position === 'left'
      ? '-left-24 top-[32%]'
      : '-right-24 top-[30%]'

  const texture =
    variant === 'diagonal'
      ? {
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(22, 101, 52, 0.12) 0px, rgba(22, 101, 52, 0.12) 1px, transparent 1px, transparent 24px)',
        }
      : {
          backgroundImage:
            'radial-gradient(circle, rgba(22, 101, 52, 0.32) 1.35px, transparent 1.35px)',

          backgroundSize:
            '26px 26px',
        }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >

      <div
        className="absolute inset-0 opacity-60"
        style={texture}
      />


      <motion.div
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [
                  0,
                  30,
                  0,
                ],

                y: [
                  0,
                  -24,
                  0,
                ],
              }
        }
        transition={{
          duration: 10,

          repeat:
            Infinity,

          ease:
            'easeInOut',
        }}
        className={`absolute ${blobPosition} h-80 w-80 rounded-full bg-[#16A34A]/20 blur-3xl`}
      />

    </div>
  )
}
