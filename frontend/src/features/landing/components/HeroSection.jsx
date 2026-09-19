import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  ArrowRight,
  ChefHat,
  CookingPot,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react'

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'

import {
  landingHero,
} from '../content/landingContent'

const SLIDE_INTERVAL_MS =
  5000

/*
|--------------------------------------------------------------------------
| Desktop Hero Images
|--------------------------------------------------------------------------
*/

const desktopHeroSlides = [
  '/hero/1.png',
  '/hero/2.png',
  '/hero/3.png',
  '/hero/4.png',
  '/hero/5.png',
  '/hero/6.png',
  '/hero/7.png',
  '/hero/8.png',
  '/hero/9.png',
]

/*
|--------------------------------------------------------------------------
| Mobile Hero Images
|--------------------------------------------------------------------------
*/

const mobileHeroSlides = [
  '/hero/1.1.png',
  '/hero/1.2.png',
  '/hero/1.3.png',
  '/hero/1.4.png',
  '/hero/1.5.png',
  '/hero/1.6.png',
]

export default function HeroSection() {
  const shouldReduceMotion =
    useReducedMotion()

  const [
    activeSlide,
    setActiveSlide,
  ] = useState(0)

  const [
    isMobileView,
    setIsMobileView,
  ] = useState(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return false
    }

    return window.matchMedia(
      '(max-width: 767px)',
    ).matches
  })

  /*
  |--------------------------------------------------------------------------
  | Mobile / Desktop Images
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        '(max-width: 767px)',
      )

    const handleChange = (
      event,
    ) => {
      setIsMobileView(
        event.matches,
      )
    }

    setIsMobileView(
      mediaQuery.matches,
    )

    mediaQuery.addEventListener(
      'change',
      handleChange,
    )

    return () => {
      mediaQuery.removeEventListener(
        'change',
        handleChange,
      )
    }
  }, [])

  const heroSlides =
    isMobileView
      ? mobileHeroSlides
      : desktopHeroSlides

  /*
  |--------------------------------------------------------------------------
  | Slider
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (shouldReduceMotion) {
      return undefined
    }

    const intervalId =
      window.setInterval(
        () => {
          setActiveSlide(
            (currentSlide) =>
              (
                currentSlide +
                1
              ) %
              heroSlides.length,
          )
        },

        SLIDE_INTERVAL_MS,
      )

    return () =>
      window.clearInterval(
        intervalId,
      )
  }, [
    shouldReduceMotion,
    heroSlides.length,
  ])

  const currentSlide =
    heroSlides[
      activeSlide %
        heroSlides.length
    ]

  return (
    <section className="hero-section-stable relative isolate m-0 flex min-h-[100svh] w-full items-center overflow-hidden p-0">

      {/* =============================================================
          HERO BACKGROUND
      ============================================================= */}

      <div
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >

        <AnimatePresence
          mode="sync"
          initial={false}
        >

          <motion.img
            key={
              currentSlide
            }
            src={
              currentSlide
            }
            alt=""
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                  }
            }
            animate={{
              opacity: 1,
            }}
            exit={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 0,
                  }
            }
            transition={{
              duration: 0.8,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 block h-full w-full object-cover object-center"
            draggable="false"
          />

        </AnimatePresence>

      </div>


      {/* =============================================================
          HERO CONTENT
      ============================================================= */}

      <div className="page-shell relative z-10 flex min-h-[100svh] w-full items-center py-6 sm:py-8 lg:py-10">

        <div className="w-full max-w-3xl">

          {/* Eyebrow */}

          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 14,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.4,
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#166534]/10 bg-white/80 px-4 py-2 shadow-sm backdrop-blur"
          >

            <Sparkles
              size={15}
              className="text-[#166534]"
              aria-hidden="true"
            />


            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#14532D]">

              {
                landingHero.eyebrow
              }

            </span>

          </motion.div>


          {/* =========================================================
              MOBILE ULTRA-LIGHT GLASS
          ========================================================= */}

          <div className="relative mt-6 max-w-3xl overflow-hidden rounded-[24px] border border-white/20 bg-white/10 p-4 shadow-md shadow-[#111827]/5 backdrop-blur-[2px] md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">

            {/* Minimal mobile-only readability layer */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-white/[0.03] to-transparent md:hidden"
            />


            <div className="relative z-10">

              {/* Heading */}

              <motion.h1
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 20,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.08,
                }}
                className="max-w-3xl text-[2.45rem] font-black leading-[1.03] tracking-[-0.045em] text-[#111827] drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)] sm:text-5xl md:drop-shadow-none lg:text-[4.2rem]"
              >

                From food discovery

                <span className="text-[#166534]">
                  {' '}
                  to cooking,
                </span>

                <br />

                everything stays connected.

              </motion.h1>


              {/* Description */}

              <motion.p
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 16,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.16,
                }}
                className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#1F2937] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] sm:text-lg md:font-normal md:text-[#6B7280] md:drop-shadow-none"
              >

                Discover groceries, trusted brands and recipes in one connected food experience.

              </motion.p>

            </div>

          </div>


          {/* =========================================================
              CTA
          ========================================================= */}

          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 16,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.22,
            }}
            className="mt-7 flex flex-wrap gap-3"
          >

            <Link
              to={
                landingHero
                  .primaryAction
                  .path
              }
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#166534] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#14532D]/15 transition hover:bg-[#14532D]"
            >

              <ShoppingBasket
                size={18}
                aria-hidden="true"
              />


              {
                landingHero
                  .primaryAction
                  .label
              }


              <ArrowRight
                size={17}
                aria-hidden="true"
              />

            </Link>


            <Link
              to={
                landingHero
                  .secondaryAction
                  .path
              }
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-6 py-3.5 text-sm font-bold text-[#1F2937] shadow-sm transition hover:border-[#D1D5DB] hover:bg-[#F8FAF7]"
            >

              <CookingPot
                size={18}
                aria-hidden="true"
              />


              {
                landingHero
                  .secondaryAction
                  .label
              }

            </Link>


            <Link
              to="/cook-today"
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/85 px-6 py-3.5 text-sm font-bold text-[#14532D] shadow-sm backdrop-blur transition hover:border-emerald-300 hover:bg-white"
            >

              <ChefHat
                size={18}
                aria-hidden="true"
              />

              I want to cook today

              <Sparkles
                size={16}
                aria-hidden="true"
              />

            </Link>

          </motion.div>

        </div>

      </div>

    </section>
  )
}