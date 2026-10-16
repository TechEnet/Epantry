import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import {
  ArrowRight,
  ChefHat,
  CookingPot,
  Search,
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

const WORD_REVEAL_INTERVAL_MS =
  125

const WORD_REVEAL_TRANSITION = Object.freeze({
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1],
})

const MESSAGE_HOLD_MS =
  2600

const INTERACTIVE_MESSAGE_HOLD_MS =
  9000

const LANDING_COOK_QUERY_KEY =
  'epantry-cook-today-landing-input'

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

const heroMessages = [
  {
    id:
      'connected-food',
    lead:
      'From food discovery',
    accent:
      'to cooking,',
    tail:
      'everything stays connected.',
  },
  {
    id:
      'understand-before-buying',
    lead:
      'Know what you are choosing',
    accent:
      'before it reaches your basket.',
    tail:
      '',
  },
  {
    id:
      'ingredients-to-dinner',
    lead:
      'Turn what you have',
    accent:
      'into something worth cooking.',
    tail:
      '',
  },
  {
    id:
      'cook-today',
    lead:
      'What do you want',
    accent:
      'to cook today?',
    tail:
      '',
    interactive:
      true,
  },
]

function splitWords(value) {
  return String(
    value ||
      '',
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function messageWordCount(
  message,
) {
  return (
    splitWords(
      message?.lead,
    ).length +
    splitWords(
      message?.accent,
    ).length +
    splitWords(
      message?.tail,
    ).length
  )
}

function WordSequence({
  text,
  startIndex,
  revealedWordCount,
  shouldReduceMotion,
}) {
  const words =
    splitWords(
      text,
    )

  return (
    <>
      {words.map(
        (word, index) => {
          const wordIndex =
            startIndex +
            index

          const isVisible =
            shouldReduceMotion ||
            revealedWordCount >
              wordIndex

          return (
            <motion.span
              key={`${word}-${wordIndex}`}
              aria-hidden="true"
              initial={false}
              animate={
                isVisible
                  ? {
                      opacity: 1,
                      y: 0,
                      filter:
                        'blur(0px)',
                    }
                  : {
                      opacity: 0,
                      y: 3,
                      filter:
                        'blur(2px)',
                    }
              }
              transition={
                shouldReduceMotion
                  ? {
                      duration: 0,
                    }
                  : WORD_REVEAL_TRANSITION
              }
              className={[
                'inline-block will-change-[opacity,transform,filter]',
                index <
                words.length - 1
                  ? 'mr-[0.24em]'
                  : '',
              ].join(' ')}
            >
              <span className="inline-block whitespace-nowrap">{word}</span>
            </motion.span>
          )
        },
      )}
    </>
  )
}

export default function HeroSection() {
  const shouldReduceMotion =
    useReducedMotion()

  const navigate =
    useNavigate()

  const [
    activeSlide,
    setActiveSlide,
  ] = useState(0)

  const [
    activeMessage,
    setActiveMessage,
  ] = useState(0)

  const [
    revealedWordCount,
    setRevealedWordCount,
  ] = useState(0)

  const [
    cookInput,
    setCookInput,
  ] = useState('')

  const [
    cookInputFocused,
    setCookInputFocused,
  ] = useState(false)

  const [
    cookInputError,
    setCookInputError,
  ] = useState('')

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
  | Background Slider
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

  /*
  |--------------------------------------------------------------------------
  | Hero Message Word Reveal
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const message =
      heroMessages[
        activeMessage %
          heroMessages.length
      ]

    const totalWords =
      messageWordCount(
        message,
      )

    if (
      shouldReduceMotion ||
      totalWords ===
        0
    ) {
      setRevealedWordCount(
        totalWords,
      )
      return undefined
    }

    let visibleWordCount =
      1

    setRevealedWordCount(
      visibleWordCount,
    )

    const intervalId =
      window.setInterval(
        () => {
          visibleWordCount +=
            1

          setRevealedWordCount(
            Math.min(
              visibleWordCount,
              totalWords,
            ),
          )

          if (
            visibleWordCount >=
            totalWords
          ) {
            window.clearInterval(
              intervalId,
            )
          }
        },
        WORD_REVEAL_INTERVAL_MS,
      )

    return () =>
      window.clearInterval(
        intervalId,
      )
  }, [
    activeMessage,
    shouldReduceMotion,
  ])

  /*
  |--------------------------------------------------------------------------
  | Hero Message Rotation
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const message =
      heroMessages[
        activeMessage %
          heroMessages.length
      ]

    const totalWords =
      messageWordCount(
        message,
      )

    if (
      shouldReduceMotion ||
      revealedWordCount <
        totalWords ||
      (
        message?.interactive &&
        cookInputFocused
      )
    ) {
      return undefined
    }

    const timeoutId =
      window.setTimeout(
        () => {
          setActiveMessage(
            (currentMessage) =>
              (
                currentMessage +
                1
              ) %
              heroMessages.length,
          )
        },
        message?.interactive
          ? INTERACTIVE_MESSAGE_HOLD_MS
          : MESSAGE_HOLD_MS,
      )

    return () =>
      window.clearTimeout(
        timeoutId,
      )
  }, [
    activeMessage,
    cookInputFocused,
    revealedWordCount,
    shouldReduceMotion,
  ])

  const currentSlide =
    heroSlides[
      activeSlide %
        heroSlides.length
    ]

  const currentMessage =
    heroMessages[
      activeMessage %
        heroMessages.length
    ]

  const leadWords =
    splitWords(
      currentMessage.lead,
    )

  const accentWords =
    splitWords(
      currentMessage.accent,
    )

  const tailWords =
    splitWords(
      currentMessage.tail,
    )

  const headlineWordCount =
    leadWords.length +
    accentWords.length +
    tailWords.length

  const totalCurrentMessageWords =
    headlineWordCount

  const messageComplete =
    revealedWordCount >=
    totalCurrentMessageWords

  function handleCookTodaySubmit(
    event,
  ) {
    event.preventDefault()

    const normalizedInput =
      cookInput.trim()

    if (!normalizedInput) {
      setCookInputError(
        'Tell EPANTRY what you have or what you want to make.',
      )
      return
    }

    setCookInputError('')

    try {
      window.sessionStorage.setItem(
        LANDING_COOK_QUERY_KEY,
        normalizedInput,
      )
    } catch {
      // Navigation state still carries the input if session storage is unavailable.
    }

    navigate(
      '/cook-today',
      {
        state: {
          landingCookQuery:
            normalizedInput,
        },
      },
    )
  }



  return (
    <section
      className="hero-section-stable relative isolate m-0 flex min-h-[100svh] w-full items-center overflow-hidden p-0"
    >

      {/* Keep the Hero title slightly larger than the shared type ramp.
          Scoped !important rules are necessary because the approved
          universal stylesheet sets h1 sizes with !important. */}
      <style>{`
        .hero-section-stable .epantry-hero-headline {
          font-size: 40px !important;
          line-height: 1.1 !important;
        }
        @media (min-width: 640px) {
          .hero-section-stable .epantry-hero-headline {
            font-size: 48px !important;
            line-height: 1.1 !important;
          }
        }
        @media (min-width: 1024px) {
          .hero-section-stable .epantry-hero-headline {
            font-size: 68px !important;
            line-height: 1.08 !important;
          }
        }
      `}</style>

      {/* =============================================================
          HERO BACKGROUND
      ============================================================= */}

      <div
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >

        <div
          className="absolute inset-0"
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



      </div>


      {/* =============================================================
          HERO CONTENT
      ============================================================= */}

      <div className="page-shell relative z-10 flex min-h-[100svh] w-full items-center py-6 sm:py-8 lg:py-10">

        <div className="w-full max-w-3xl lg:w-[70%] lg:max-w-none">

          {/* =========================================================
              ROTATING HERO MESSAGE
          ========================================================= */}

          <div
            className="relative mt-7 max-w-3xl overflow-hidden rounded-[24px] border border-white/20 bg-white/10 p-4 shadow-md shadow-[#111827]/5 backdrop-blur-[2px] md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none lg:max-w-none">

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-white/[0.03] to-transparent md:hidden"
            />

            <motion.div
              key={
                currentMessage.id
              }
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
              transition={{
                duration: 0.18,
                ease: 'easeOut',
              }}
              className="relative z-10"
            >
              <h1
                aria-label={[
                  currentMessage.lead,
                  currentMessage.accent,
                  currentMessage.tail,
                ]
                  .filter(Boolean)
                  .join(' ')}
                className="epantry-hero-headline max-w-3xl font-semibold uppercase tracking-[0.045em] text-[#202421] lg:max-w-none"
                style={{
                  color: '#202421',
                  textShadow: '0 1px 3px #F7F6F2',
                }}
              >
                <WordSequence
                  text={
                    currentMessage.lead
                  }
                  startIndex={0}
                  revealedWordCount={
                    revealedWordCount
                  }
                  shouldReduceMotion={
                    shouldReduceMotion
                  }
                />

                {currentMessage.accent ? (
                  <span className="text-[#173F35]" style={{ color: '#173F35' }}>
                    {' '}
                    <WordSequence
                      text={
                        currentMessage.accent
                      }
                      startIndex={
                        leadWords.length
                      }
                      revealedWordCount={
                        revealedWordCount
                      }
                      shouldReduceMotion={
                        shouldReduceMotion
                      }
                    />
                  </span>
                ) : null}

                {currentMessage.tail ? (
                  <>
                    <br />
                    <WordSequence
                      text={
                        currentMessage.tail
                      }
                      startIndex={
                        leadWords.length +
                        accentWords.length
                      }
                      revealedWordCount={
                        revealedWordCount
                      }
                      shouldReduceMotion={
                        shouldReduceMotion
                      }
                    />
                  </>
                ) : null}
              </h1>

              {currentMessage.interactive ? (
                <div className="min-h-[86px] sm:min-h-[68px]">
                  {messageComplete ? (
                    <motion.form
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 4,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onSubmit={
                    handleCookTodaySubmit
                  }
                  className="mt-5 max-w-2xl"
                >
                  <label
                    htmlFor="landing-cook-today-input"
                    className="sr-only"
                  >
                    What do you want to cook today?
                  </label>

                  <div className="flex flex-col gap-2 rounded-[22px] border border-[#173F35] bg-[#F7F6F2] p-2.5 shadow-[0_14px_35px_rgba(32,36,33,0.12)] backdrop-blur sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-2.5">
                      <ChefHat
                        size={19}
                        className="shrink-0 text-[#173F35]"
                        aria-hidden="true"
                      />

                      <input
                        id="landing-cook-today-input"
                        type="text"
                        value={
                          cookInput
                        }
                        onFocus={() =>
                          setCookInputFocused(
                            true,
                          )
                        }
                        onBlur={() =>
                          setCookInputFocused(
                            false,
                          )
                        }
                        onChange={(event) => {
                          setCookInput(
                            event.target.value,
                          )
                          if (
                            cookInputError
                          ) {
                            setCookInputError(
                              '',
                            )
                          }
                        }}
                        placeholder="Paneer, tomato, rice... or a dish idea"
                        autoComplete="off"
                        className="min-h-11 w-full min-w-0 bg-transparent text-sm font-bold text-[#202421] outline-none placeholder:font-semibold placeholder:text-[#202421]/75 sm:text-base"
                        style={{ backgroundColor: '#F7F6F2', color: '#202421' }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[#173F35] px-5 text-sm font-black text-[#F7F6F2] shadow-sm transition hover:bg-[#202421]"
                    >
                      <Search
                        size={16}
                        aria-hidden="true"
                      />
                      Cook with EPANTRY
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {cookInputError ? (
                    <p
                      role="alert"
                      className="mt-2 text-xs font-bold text-red-700 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]"
                    >
                      {
                        cookInputError
                      }
                    </p>
                  ) : null}
                    </motion.form>
                  ) : null}
                </div>
              ) : null}
            </motion.div>

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
            className="mt-10 flex flex-wrap gap-3 sm:mt-12"
          >

            <Link
              to={
                landingHero
                  .primaryAction
                  .path
              }
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#173F35] px-6 py-3.5 text-sm font-bold text-[#F7F6F2] shadow-lg shadow-[#202421]/15 transition hover:bg-[#202421]"
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
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#202421] bg-[#F7F6F2] px-6 py-3.5 text-sm font-bold text-[#202421] shadow-sm transition hover:border-[#173F35] hover:bg-[#DCE0CF]"
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
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#173F35] bg-[#DCE0CF] px-6 py-3.5 text-sm font-bold text-[#173F35] shadow-sm backdrop-blur transition hover:border-[#202421] hover:bg-[#F7F6F2]"
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
