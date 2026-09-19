import {
  useEffect,
  useState,
} from 'react'

import {
  ArrowRight,
  CookingPot,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'

const FOOD_JOURNEY_BANNERS = [
  '/banners/1.png',
  '/banners/2.png',
  '/banners/3.png',
  '/banners/4.png',
]

export default function ClosingCtaSection() {
  const shouldReduceMotion =
    useReducedMotion()

  const [
    activeBannerIndex,
    setActiveBannerIndex,
  ] = useState(0)

  useEffect(() => {
    if (
      FOOD_JOURNEY_BANNERS.length <= 1
    ) {
      return undefined
    }

    const intervalId =
      window.setInterval(
        () => {
          setActiveBannerIndex(
            (currentIndex) =>
              (currentIndex + 1) %
              FOOD_JOURNEY_BANNERS.length,
          )
        },
        4200,
      )

    return () => {
      window.clearInterval(
        intervalId,
      )
    }
  }, [])

  const handleCardMouseMove = (
    event,
  ) => {
    if (
      typeof window ===
        'undefined' ||
      !window.matchMedia(
        '(min-width: 1024px)',
      ).matches ||
      shouldReduceMotion
    ) {
      return
    }

    const card =
      event.currentTarget

    const rect =
      card.getBoundingClientRect()

    const pointerX =
      (event.clientX -
        rect.left) /
      rect.width

    const pointerY =
      (event.clientY -
        rect.top) /
      rect.height

    const rotateY =
      (pointerX - 0.5) *
      8

    const rotateX =
      (0.5 - pointerY) *
      6

    card.style.setProperty(
      '--epantry-card-rotate-x',
      `${rotateX.toFixed(2)}deg`,
    )

    card.style.setProperty(
      '--epantry-card-rotate-y',
      `${rotateY.toFixed(2)}deg`,
    )

    card.style.setProperty(
      '--epantry-card-glow-x',
      `${(
        pointerX * 100
      ).toFixed(1)}%`,
    )

    card.style.setProperty(
      '--epantry-card-glow-y',
      `${(
        pointerY * 100
      ).toFixed(1)}%`,
    )
  }

  const handleCardMouseLeave = (
    event,
  ) => {
    const card =
      event.currentTarget

    card.style.setProperty(
      '--epantry-card-rotate-x',
      '0deg',
    )

    card.style.setProperty(
      '--epantry-card-rotate-y',
      '0deg',
    )

    card.style.setProperty(
      '--epantry-card-glow-x',
      '50%',
    )

    card.style.setProperty(
      '--epantry-card-glow-y',
      '50%',
    )
  }

  return (
    <section className="relative w-full overflow-hidden bg-[#F8FAF7] px-4 py-5 md:min-h-[100svh] md:px-6 md:py-6 lg:flex lg:items-center">

      <div className="page-shell lg:w-full">

        <motion.div
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 24,
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            amount: 0.2,
          }}
          transition={{
            duration: 0.45,
          }}
          onMouseMove={
            handleCardMouseMove
          }
          onMouseLeave={
            handleCardMouseLeave
          }
          style={{
            '--epantry-card-rotate-x':
              '0deg',
            '--epantry-card-rotate-y':
              '0deg',
            '--epantry-card-glow-x':
              '50%',
            '--epantry-card-glow-y':
              '50%',
          }}
          className="group/food-card relative w-full lg:mx-auto lg:max-w-[1180px] lg:[perspective:1400px]"
        >

          {/* =========================================================
              LAPTOP-ONLY OUTER GLOW
          ========================================================= */}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 hidden rounded-[40px] opacity-0 blur-3xl transition-opacity duration-200 lg:block lg:group-hover/food-card:opacity-80"
            style={{
              background:
                'radial-gradient(circle at var(--epantry-card-glow-x) var(--epantry-card-glow-y), rgba(245, 158, 11, 0.34) 0%, rgba(22, 163, 74, 0.34) 30%, rgba(20, 83, 45, 0.16) 56%, transparent 74%)',
            }}
          />


          {/* =========================================================
              EXISTING CARD
          ========================================================= */}

          <div
            className="relative z-10 flex w-full flex-col overflow-hidden rounded-[28px] bg-[#166534] px-5 py-7 text-white shadow-2xl shadow-[#14532D]/15 sm:px-6 md:min-h-[calc(100svh-48px)] md:rounded-[36px] md:px-10 md:py-7 lg:h-[625px] lg:min-h-[625px] lg:px-16 lg:will-change-transform lg:transition-[transform,filter] lg:duration-150 lg:ease-out lg:[transform:perspective(1400px)_rotateX(var(--epantry-card-rotate-x))_rotateY(var(--epantry-card-rotate-y))_translateZ(0)] lg:group-hover/food-card:brightness-[1.025]"
          >

            {/* =========================================================
                FULL-CARD BANNER SLIDER
            ========================================================= */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >

              <AnimatePresence
                initial={false}
                mode="sync"
              >

                <motion.img
                  key={
                    FOOD_JOURNEY_BANNERS[
                      activeBannerIndex
                    ]
                  }
                  src={
                    FOOD_JOURNEY_BANNERS[
                      activeBannerIndex
                    ]
                  }
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={
                    shouldReduceMotion
                      ? {
                          opacity: 0,
                        }
                      : {
                          opacity: 0,
                          x: '8%',
                          scale: 1.02,
                        }
                  }
                  animate={
                    shouldReduceMotion
                      ? {
                          opacity: 1,
                        }
                      : {
                          opacity: 1,
                          x: '0%',
                          scale: 1,
                        }
                  }
                  exit={
                    shouldReduceMotion
                      ? {
                          opacity: 0,
                        }
                      : {
                          opacity: 0,
                          x: '-8%',
                          scale: 1.015,
                        }
                  }
                  transition={{
                    duration:
                      shouldReduceMotion
                        ? 0.35
                        : 0.85,
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                />

              </AnimatePresence>


              <div className="absolute inset-0 bg-gradient-to-r from-[#071B10]/90 via-[#0D2E1B]/72 to-[#0D2E1B]/20" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

            </div>


            {/* Laptop-only cursor glow inside the card */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-200 lg:block lg:group-hover/food-card:opacity-100"
              style={{
                background:
                  'radial-gradient(circle at var(--epantry-card-glow-x) var(--epantry-card-glow-y), rgba(245, 158, 11, 0.16) 0%, rgba(22, 163, 74, 0.13) 20%, transparent 48%)',
              }}
            />


            {/* Heading */}

            <div className="relative z-10 shrink-0">

              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 backdrop-blur-sm">

                <Sparkles
                  size={15}
                  aria-hidden="true"
                />

                <span className="text-xs font-black uppercase tracking-[0.16em] text-white/95">
                  Start Your Food Journey
                </span>

              </div>

            </div>


            {/* Main Content */}

            <div className="relative z-10 py-7 md:flex md:flex-1 md:items-center md:py-6">

              <div className="w-full">

                <div className="max-w-3xl">

                  <h2 className="text-3xl font-black leading-tight tracking-[-0.035em] text-white drop-shadow-sm sm:text-4xl lg:text-5xl">

                    Discover food with more context,
                    confidence and convenience.

                  </h2>


                  <p className="mt-4 max-w-2xl text-base leading-7 text-white/85 drop-shadow-sm sm:mt-5 sm:text-lg sm:leading-8">

                    Explore grocery products, discover trusted brands
                    or begin with a recipe and let EPANTRY connect
                    the experience.

                  </p>


                  <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">

                    <Link
                      to="/grocery"
                      className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#14532D] transition hover:bg-[#F0FDF4] sm:px-6 sm:py-3.5"
                    >

                      <ShoppingBasket
                        size={18}
                        aria-hidden="true"
                      />

                      Explore Grocery

                      <ArrowRight
                        size={17}
                        aria-hidden="true"
                      />

                    </Link>


                    <Link
                      to="/recipes"
                      className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#F59E0B]/45 bg-[#F59E0B]/20 px-5 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-[#F59E0B]/30 sm:px-6 sm:py-3.5"
                    >

                      <CookingPot
                        size={18}
                        aria-hidden="true"
                      />

                      Discover Recipes

                    </Link>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </motion.div>

      </div>

    </section>
  )
}
