import {
  useEffect,
  useRef,
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

const WATER_TEXT_RADIUS_PX =
  250

const WATER_TEXT_DISPLACEMENT_PX =
  15


const WATER_POINTER_FOLLOW =
  0.24

const WATER_POINTER_RETURN =
  0.12

const WATER_MOVING_ENERGY =
  1

const WATER_RESTING_ENERGY =
  0.14

const WATER_MOVE_WINDOW_MS =
  105

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
              <span className="inline-block whitespace-nowrap">
                {[...word].map(
                  (character, characterIndex) => (
                    <span
                      key={`${wordIndex}-${characterIndex}-${character}`}
                      data-hero-water-char="true"
                      className="inline-block will-change-transform [transform:translate3d(0,0,0)]"
                    >
                      {character}
                    </span>
                  ),
                )}
              </span>
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

  const heroSectionRef =
    useRef(null)

  const heroMessageRef =
    useRef(null)

  const heroImageStageRef =
    useRef(null)


  const pointerFrameRef =
    useRef(null)

  const characterOriginsRef =
    useRef(new WeakMap())

  const pointerStateRef =
    useRef({
      active: false,
      initialized: false,
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
      previousX: 0,
      previousY: 0,
      velocityX: 0,
      velocityY: 0,
      targetVelocityX: 0,
      targetVelocityY: 0,
      energy: 0,
      phase: 0,
      lastMoveAt: 0,
    })

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

  useEffect(() => {
    characterOriginsRef.current =
      new WeakMap()
  }, [
    activeMessage,
    isMobileView,
  ])

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



  function resetHeroInteractionStyles() {
    const characters =
      heroMessageRef.current
        ?.querySelectorAll(
          '[data-hero-water-char="true"]',
        ) || []

    characters.forEach(
      (character) => {
        character.style.transform =
          'translate3d(0px, 0px, 0px) rotate(0deg) scale3d(1, 1, 1)'
      },
    )

    if (
      heroImageStageRef.current
    ) {
      heroImageStageRef.current.style.transform =
        'translate3d(0px, 0px, 0px) scale(1.018) rotate(0deg)'
    }
  }

  function runHeroInteractionFrame(
    timestamp,
  ) {
    const section =
      heroSectionRef.current

    if (!section) {
      pointerFrameRef.current =
        null
      return
    }

    const state =
      pointerStateRef.current

    const rect =
      section.getBoundingClientRect()

    const restingX =
      rect.width / 2
    const restingY =
      rect.height / 2

    if (!state.initialized) {
      state.currentX =
        restingX
      state.currentY =
        restingY
      state.previousX =
        restingX
      state.previousY =
        restingY
      state.targetX =
        restingX
      state.targetY =
        restingY
      state.initialized =
        true
    }

    const targetX =
      state.active
        ? state.targetX
        : restingX
    const targetY =
      state.active
        ? state.targetY
        : restingY

    const follow =
      state.active
        ? WATER_POINTER_FOLLOW
        : WATER_POINTER_RETURN

    state.previousX =
      state.currentX
    state.previousY =
      state.currentY

    state.currentX +=
      (
        targetX -
        state.currentX
      ) *
      follow

    state.currentY +=
      (
        targetY -
        state.currentY
      ) *
      follow

    const frameVelocityX =
      state.currentX -
      state.previousX
    const frameVelocityY =
      state.currentY -
      state.previousY

    state.velocityX +=
      (
        frameVelocityX -
        state.velocityX
      ) *
      0.28

    state.velocityY +=
      (
        frameVelocityY -
        state.velocityY
      ) *
      0.28

    const now =
      Number.isFinite(
        timestamp,
      )
        ? timestamp
        : performance.now()

    const pointerIsMoving =
      state.active &&
      now -
        state.lastMoveAt <
        WATER_MOVE_WINDOW_MS

    const speed =
      Math.min(
        24,
        Math.hypot(
          state.targetVelocityX,
          state.targetVelocityY,
        ),
      )

    const movingEnergy =
      WATER_MOVING_ENERGY *
      Math.min(
        1,
        0.42 +
          speed /
            12,
      )

    const targetEnergy =
      state.active
        ? pointerIsMoving
          ? movingEnergy
          : WATER_RESTING_ENERGY
        : 0

    const energyFollow =
      targetEnergy >
      state.energy
        ? 0.22
        : state.active
          ? 0.055
          : 0.075

    state.energy +=
      (
        targetEnergy -
        state.energy
      ) *
      energyFollow

    state.targetVelocityX *=
      pointerIsMoving
        ? 0.82
        : 0.68
    state.targetVelocityY *=
      pointerIsMoving
        ? 0.82
        : 0.68

    state.phase +=
      pointerIsMoving
        ? 0.24 +
          speed *
            0.009
        : state.active
          ? 0.075
          : 0.045

    const phaseWave =
      Math.sin(
        state.phase,
      )

    const pointerClientX =
      rect.left +
      state.currentX
    const pointerClientY =
      rect.top +
      state.currentY

    const normalizedX =
      Math.max(
        -1,
        Math.min(
          1,
          (
            state.currentX -
            restingX
          ) /
            Math.max(
              restingX,
              1,
            ),
        ),
      )

    const normalizedY =
      Math.max(
        -1,
        Math.min(
          1,
          (
            state.currentY -
            restingY
          ) /
            Math.max(
              restingY,
              1,
            ),
        ),
      )

    if (
      heroImageStageRef.current
    ) {
      const motionStrength =
        state.energy

      const surfaceShiftX =
        -normalizedX *
          8.5 *
          motionStrength -
        state.velocityX *
          0.2

      const surfaceShiftY =
        -normalizedY *
          5.5 *
          motionStrength -
        state.velocityY *
          0.2

      const settleWaveX =
        Math.sin(
          state.phase *
            0.72,
        ) *
        1.15 *
        motionStrength

      const settleWaveY =
        Math.cos(
          state.phase *
            0.64,
        ) *
        0.8 *
        motionStrength

      const surfaceRotation =
        (
          normalizedX *
            0.12 +
          state.velocityX *
            0.012
        ) *
        motionStrength

      const surfaceScale =
        1.018 +
        0.004 *
          motionStrength +
        Math.sin(
          state.phase *
            0.52,
        ) *
          0.0007 *
          motionStrength

      heroImageStageRef.current.style.transform =
        `translate3d(${(surfaceShiftX + settleWaveX).toFixed(2)}px, ${(surfaceShiftY + settleWaveY).toFixed(2)}px, 0px) scale(${surfaceScale.toFixed(4)}) rotate(${surfaceRotation.toFixed(3)}deg)`
    }

    const characters =
      heroMessageRef.current
        ?.querySelectorAll(
          '[data-hero-water-char="true"]',
        ) || []

    characters.forEach(
      (character) => {
        let origin =
          characterOriginsRef.current.get(
            character,
          )

        if (!origin) {
          const characterRect =
            character.getBoundingClientRect()

          origin = {
            centerX:
              characterRect.left +
              characterRect.width / 2,
            centerY:
              characterRect.top +
              characterRect.height / 2,
          }

          characterOriginsRef.current.set(
            character,
            origin,
          )
        }

        const deltaX =
          origin.centerX -
          pointerClientX
        const deltaY =
          origin.centerY -
          pointerClientY

        const distance =
          Math.hypot(
            deltaX,
            deltaY,
          )

        if (
          distance >=
            WATER_TEXT_RADIUS_PX ||
          state.energy <
            0.008
        ) {
          character.style.transform =
            'translate3d(0px, 0px, 0px) rotate(0deg) scale3d(1, 1, 1)'
          return
        }

        const safeDistance =
          Math.max(
            distance,
            1,
          )

        const directionX =
          deltaX /
          safeDistance
        const directionY =
          deltaY /
          safeDistance

        const tangentX =
          -directionY
        const tangentY =
          directionX

        const falloff =
          Math.pow(
            1 -
              distance /
                WATER_TEXT_RADIUS_PX,
            1.7,
          )

        const ripple =
          Math.sin(
            distance *
              0.057 -
              state.phase *
                1.72,
          )

        const secondaryRipple =
          Math.cos(
            distance *
              0.031 -
              state.phase *
                1.08,
          )

        const radialAmount =
          ripple *
          WATER_TEXT_DISPLACEMENT_PX *
          falloff *
          state.energy

        const tangentAmount =
          secondaryRipple *
          5.4 *
          falloff *
          state.energy

        const dragX =
          state.velocityX *
          0.36 *
          falloff
        const dragY =
          state.velocityY *
          0.36 *
          falloff

        const translateX =
          directionX *
            radialAmount +
          tangentX *
            tangentAmount +
          dragX

        const translateY =
          directionY *
            radialAmount +
          tangentY *
            tangentAmount +
          dragY

        const rotate =
          (
            ripple *
              4.2 +
            state.velocityX *
              0.14
          ) *
          falloff *
          state.energy

        const stretch =
          ripple *
          0.055 *
          falloff *
          state.energy

        const squash =
          secondaryRipple *
          0.032 *
          falloff *
          state.energy

        character.style.transform =
          `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0px) rotate(${rotate.toFixed(2)}deg) scale3d(${(1 + stretch).toFixed(4)}, ${(1 - squash).toFixed(4)}, 1)`
      },
    )

    const pointerDelta =
      Math.abs(
        targetX -
        state.currentX,
      ) +
      Math.abs(
        targetY -
        state.currentY,
      )

    const shouldContinue =
      state.active ||
      state.energy >
        0.006 ||
      pointerDelta >
        0.2

    if (shouldContinue) {
      pointerFrameRef.current =
        window.requestAnimationFrame(
          runHeroInteractionFrame,
        )
    } else {
      resetHeroInteractionStyles()
      pointerFrameRef.current =
        null
    }
  }

  function ensureHeroInteractionFrame() {
    if (
      pointerFrameRef.current
    ) {
      return
    }

    pointerFrameRef.current =
      window.requestAnimationFrame(
        runHeroInteractionFrame,
      )
  }

  function handleHeroPointerMove(
    event,
  ) {
    if (
      shouldReduceMotion ||
      event.pointerType ===
        'touch'
    ) {
      return
    }

    const section =
      heroSectionRef.current

    if (!section) {
      return
    }

    const rect =
      section.getBoundingClientRect()

    const state =
      pointerStateRef.current

    const nextX =
      Math.max(
        0,
        Math.min(
          rect.width,
          event.clientX -
            rect.left,
        ),
      )

    const nextY =
      Math.max(
        0,
        Math.min(
          rect.height,
          event.clientY -
            rect.top,
        ),
      )

    if (
      state.initialized
    ) {
      state.targetVelocityX =
        nextX -
        state.targetX
      state.targetVelocityY =
        nextY -
        state.targetY
    } else {
      state.currentX =
        nextX
      state.currentY =
        nextY
      state.previousX =
        nextX
      state.previousY =
        nextY
      state.initialized =
        true
    }

    state.targetX =
      nextX
    state.targetY =
      nextY
    state.lastMoveAt =
      performance.now()
    state.active =
      true

    ensureHeroInteractionFrame()
  }

  function handleHeroPointerLeave() {
    const state =
      pointerStateRef.current

    state.active =
      false
    state.lastMoveAt =
      performance.now()

    ensureHeroInteractionFrame()
  }

  useEffect(
    () =>
      () => {
        if (
          pointerFrameRef.current
        ) {
          window.cancelAnimationFrame(
            pointerFrameRef.current,
          )
        }
      },
    [],
  )

  return (
    <section
      ref={heroSectionRef}
      className="hero-section-stable relative isolate m-0 flex min-h-[100svh] w-full items-center overflow-hidden p-0"
      onPointerMove={
        handleHeroPointerMove
      }
      onPointerLeave={
        handleHeroPointerLeave
      }
    >

      {/* =============================================================
          HERO BACKGROUND
      ============================================================= */}

      <div
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >

        <div
          ref={heroImageStageRef}
          className="absolute inset-0 will-change-transform"
          style={{
            transform:
              'translate3d(0px, 0px, 0px) scale(1.018) rotate(0deg)',
          }}
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
              ROTATING HERO MESSAGE
          ========================================================= */}

          <div
            ref={heroMessageRef}
            className="relative mt-7 min-h-[265px] max-w-3xl overflow-hidden rounded-[24px] border border-white/20 bg-white/10 p-4 shadow-md shadow-[#111827]/5 backdrop-blur-[2px] sm:min-h-[255px] md:min-h-[235px] md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none lg:min-h-[285px] lg:max-w-none">

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
                className="max-w-3xl text-[2.2rem] font-semibold uppercase leading-[1.08] tracking-[0.045em] text-[#111827] drop-shadow-[0_1px_1px_rgba(255,255,255,0.72)] sm:text-[2.9rem] md:drop-shadow-none lg:max-w-none lg:text-[3.95rem]"
                style={{
                  fontFamily:
                    '"Avenir Next", "Helvetica Neue", Arial, sans-serif',
                  textRendering:
                    'geometricPrecision',
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
                  <span className="text-[#166534]">
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

                  <div className="flex flex-col gap-2 rounded-[22px] border border-emerald-200/80 bg-white/90 p-2.5 shadow-[0_14px_35px_rgba(20,83,45,0.12)] backdrop-blur sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-2.5">
                      <ChefHat
                        size={19}
                        className="shrink-0 text-[#166534]"
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
                        className="min-h-11 w-full min-w-0 bg-transparent text-sm font-bold text-[#17352C] outline-none placeholder:font-semibold placeholder:text-[#7A8E86] sm:text-base"
                      />
                    </div>

                    <button
                      type="submit"
                      className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[#166534] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#14532D]"
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
