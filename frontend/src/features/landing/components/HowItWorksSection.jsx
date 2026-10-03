import {
  useRef,
} from 'react'

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
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
  [
    0.18,
    0.35,
  ],
  [
    0.33,
    0.50,
  ],
  [
    0.48,
    0.65,
  ],
  [
    0.63,
    0.98,
  ],
]

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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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
      shouldReduceMotion
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

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,27,22,0.02)_28%,rgba(35,27,22,0.08)_55%,rgba(35,27,22,0.78)_100%)]" />

          <div className="absolute left-4 top-4 z-10 rounded-full border border-white/30 bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-white backdrop-blur-md sm:left-5 sm:top-5 sm:text-[10px]">
            Step {item.step}
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10 sm:bottom-5 sm:left-5 sm:right-5 lg:bottom-6 lg:left-6 lg:right-6">
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
          <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#F7EACB]/55 sm:text-xs">
            Step {item.step}
          </div>

          <h3 className="mt-3 text-[clamp(28px,3.3vw,52px)] font-medium leading-[0.96] tracking-[-0.045em] text-[#F7EACB]">
            {item.title}
          </h3>

          <div className="mx-auto mt-4 h-px w-20 bg-[#F7EACB]/30 lg:mx-0 lg:w-28" />

          <p className="mt-4 text-[13px] leading-6 text-[#F7EACB]/72 sm:text-[15px] sm:leading-7 lg:text-base">
            {item.description}
          </p>
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

const WHY_SCENE_RANGES = [
  [
    0.16,
    0.35,
  ],
  [
    0.31,
    0.50,
  ],
  [
    0.46,
    0.65,
  ],
  [
    0.61,
    0.80,
  ],
  [
    0.76,
    1,
  ],
]

function WhyBenefitScene({
  benefit,
  index,
  progress,
  range,
  shouldReduceMotion,
}) {
  const [
    start,
    end,
  ] = range

  const enter =
    start +
    (end - start) * 0.18

  const exit =
    end -
    (end - start) * 0.2

  const opacity =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      index === 0
        ? [
            1,
            1,
            1,
            0,
          ]
        : index === WHY_CUSTOMER_BENEFITS.length - 1
          ? [
              0,
              1,
              1,
              1,
            ]
          : [
              0,
              1,
              1,
              0,
            ],
    )

  const sceneY =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      shouldReduceMotion
        ? [
            '0svh',
            '0svh',
            '0svh',
            '0svh',
          ]
        : index === 0
          ? [
              '0svh',
              '0svh',
              '0svh',
              '-26svh',
            ]
          : index === WHY_CUSTOMER_BENEFITS.length - 1
            ? [
                '28svh',
                '0svh',
                '0svh',
                '0svh',
              ]
            : [
                '28svh',
                '0svh',
                '0svh',
                '-26svh',
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
      shouldReduceMotion
        ? [
            '0vw',
            '0vw',
            '0vw',
            '0vw',
          ]
        : index === WHY_CUSTOMER_BENEFITS.length - 1
          ? [
              '-7vw',
              '0vw',
              '0vw',
              '0vw',
            ]
          : [
              '-7vw',
              '0vw',
              '0vw',
              '-3vw',
            ],
    )

  const copyX =
    useTransform(
      progress,
      [
        start,
        enter,
        exit,
        end,
      ],
      shouldReduceMotion
        ? [
            '0vw',
            '0vw',
            '0vw',
            '0vw',
          ]
        : index === WHY_CUSTOMER_BENEFITS.length - 1
          ? [
              '6vw',
              '0vw',
              '0vw',
              '0vw',
            ]
          : [
              '6vw',
              '0vw',
              '0vw',
              '3vw',
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
      shouldReduceMotion
        ? [
            1,
            1,
            1,
            1,
          ]
        : index === WHY_CUSTOMER_BENEFITS.length - 1
          ? [
              0.92,
              1,
              1,
              1,
            ]
          : [
              0.92,
              1,
              1,
              0.96,
            ],
    )

  const imagePath =
    WHY_IMAGE_BY_ID[benefit.id]

  return (
    <motion.article
      style={{
        opacity,
        y:
          sceneY,
      }}
      className="pointer-events-none absolute inset-x-0 bottom-[7svh] top-[25svh] z-20 px-5 sm:px-8 lg:bottom-[6svh] lg:top-[23svh] lg:px-[5vw]"
    >
      <div className="mx-auto grid h-full max-w-[1540px] items-center gap-5 sm:gap-7 lg:grid-cols-[minmax(250px,0.72fr)_minmax(420px,1.3fr)_minmax(180px,0.42fr)] lg:gap-[5vw]">
        <motion.div
          style={{
            x:
              visualX,
            scale:
              visualScale,
          }}
          className="relative mx-auto h-[31svh] w-full max-w-[410px] overflow-hidden bg-[#111111] sm:h-[36svh] lg:h-[52svh]"
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

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_30%,rgba(0,0,0,0.12)_58%,rgba(0,0,0,0.82)_100%)]" />

          <div className="absolute left-4 top-4 z-10 rounded-full border border-white/25 bg-black/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/82 backdrop-blur-md sm:left-5 sm:top-5 sm:text-[10px]">
            0{index + 1}
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10 max-w-[82%] text-[clamp(22px,2.1vw,36px)] font-semibold uppercase leading-[0.9] tracking-[-0.045em] text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)] sm:bottom-5 sm:left-5 sm:right-5">
            {benefit.title}
          </div>
        </motion.div>

        <motion.div
          style={{
            x:
              copyX,
          }}
          className="mx-auto w-full max-w-[650px] lg:mx-0"
        >
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:text-[10px]">
            Why EPANTRY
          </div>

          <h3 className="mt-3 max-w-[16ch] text-[clamp(24px,2.7vw,44px)] font-medium leading-[1.02] tracking-[-0.045em] text-[#F3F1EB]">
            {benefit.title}
          </h3>

          <p className="mt-4 max-w-[58ch] text-[12px] leading-5 text-white/48 sm:text-[13px] sm:leading-6 lg:text-sm lg:leading-6">
            {benefit.description}
          </p>
        </motion.div>

        <div className="hidden self-start pt-3 lg:block">
          <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/28">
            Why EPANTRY
          </div>

          <div className="mt-4 space-y-2.5">
            {WHY_CUSTOMER_BENEFITS.map(
              (
                item,
                itemIndex,
              ) => (
                <div
                  key={item.id}
                  className={`text-[10px] leading-4 transition-opacity duration-300 ${
                    itemIndex ===
                    index
                      ? 'text-white/75'
                      : 'text-white/24'
                  }`}
                >
                  {item.title}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function WhyEpantrySection({
  shouldReduceMotion,
}) {
  const sectionRef =
    useRef(null)

  const {
    scrollYProgress,
  } = useScroll({
    target:
      sectionRef,

    offset: [
      'start start',
      'end end',
    ],
  })

  const progress =
    useSpring(
      scrollYProgress,
      {
        stiffness:
          shouldReduceMotion
            ? 1000
            : 72,

        damping:
          shouldReduceMotion
            ? 100
            : 25,

        mass:
          shouldReduceMotion
            ? 0.01
            : 0.42,
      },
    )

  const titleY =
    useTransform(
      progress,
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
      progress,
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
            '4%',
            '-5%',
          ],
    )

  return (
    <section
      ref={sectionRef}
      className="relative z-20 h-[700svh] w-full bg-[#080808]"
    >
      <div
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#080808] text-[#F3F1EB]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <motion.div
            style={{
              y:
                fieldY,
            }}
            className="absolute -inset-[8%]"
          >
            <div className="absolute left-[8%] top-[8%] h-[34vw] max-h-[540px] w-[34vw] max-w-[540px] rounded-full bg-white/[0.025] blur-[120px]" />
            <div className="absolute bottom-[5%] right-[6%] h-[36vw] max-h-[560px] w-[36vw] max-w-[560px] rounded-full bg-white/[0.018] blur-[120px]" />
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
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(160px,0.46fr)_minmax(520px,1.55fr)_minmax(180px,0.42fr)] lg:gap-[5vw]">
            <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/58 sm:text-[10px]">
              Why EPANTRY
            </div>

            <h2 className="max-w-[19ch] text-[clamp(26px,3vw,48px)] font-medium leading-[0.98] tracking-[-0.045em] text-[#F3F1EB]">
              More intelligence behind every food decision.
            </h2>

            <div className="hidden text-[8px] font-semibold uppercase tracking-[0.2em] text-white/25 lg:block">
              01 — 05
            </div>
          </div>
        </motion.header>

        {WHY_CUSTOMER_BENEFITS.map(
          (
            benefit,
            index,
          ) => (
            <WhyBenefitScene
              key={benefit.id}
              benefit={benefit}
              index={index}
              progress={progress}
              range={
                WHY_SCENE_RANGES[
                  clampIndex(
                    index,
                    WHY_SCENE_RANGES.length,
                  )
                ]
              }
              shouldReduceMotion={shouldReduceMotion}
            />
          ),
        )}

      </div>
    </section>
  )
}

export default function HowItWorksSection() {
  const sectionRef =
    useRef(null)

  const shouldReduceMotion =
    useReducedMotion()

  const {
    scrollYProgress,
  } = useScroll({
    target:
      sectionRef,

    offset: [
      'start start',
      'end end',
    ],
  })

  const progress =
    useSpring(
      scrollYProgress,
      {
        stiffness:
          shouldReduceMotion
            ? 1000
            : 82,

        damping:
          shouldReduceMotion
            ? 100
            : 26,

        mass:
          shouldReduceMotion
            ? 0.01
            : 0.34,
      },
    )

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
        className="relative h-[600svh] w-full bg-[#B4485B]"
      >
      <div
        className="sticky top-0 h-[100svh] w-full overflow-hidden"
        style={{
          backgroundColor:
            STORY_BACKGROUND,
          color:
            STORY_FOREGROUND,
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
            <div className="absolute left-[6%] top-[7%] h-[38vw] max-h-[620px] w-[38vw] max-w-[620px] rounded-full bg-[#D96876]/22 blur-[110px]" />
            <div className="absolute bottom-[2%] right-[5%] h-[34vw] max-h-[520px] w-[34vw] max-w-[520px] rounded-full bg-[#7D2039]/22 blur-[110px]" />
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
            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="font-serif text-[clamp(28px,3.5vw,52px)] italic leading-none text-[#F7EACB]">
                How EPANTRY
              </span>

              <span className="text-[clamp(28px,4vw,58px)] font-medium uppercase leading-none tracking-[-0.045em] text-[#F7EACB]">
                Works
              </span>
            </div>

            <p className="max-w-xl text-[11px] leading-5 text-[#F7EACB]/70 sm:text-sm sm:leading-6">
              One food journey. Everything stays connected.
            </p>

            <p className="hidden max-w-2xl text-[11px] leading-5 text-[#F7EACB]/58 sm:block sm:text-xs sm:leading-5 lg:text-sm">
              From discovering food to understanding products, building a basket and cooking with confidence.
            </p>
          </div>
        </motion.header>

        <IntroVisual
          progress={progress}
          shouldReduceMotion={shouldReduceMotion}
        />

        {landingJourneySteps.map(
          (
            item,
            index,
          ) => (
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
            />
          ),
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
      />
    </>
  )
}
