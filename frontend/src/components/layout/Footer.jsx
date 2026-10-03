import {
  useRef,
} from 'react'

import {
  BookOpen,
  CookingPot,
  ShoppingBasket,
  Store,
  UsersRound,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'

const footerLinks = [
  {
    label: 'Grocery',
    path: '/grocery',
    icon: ShoppingBasket,
  },
  {
    label: 'Brands',
    path: '/brands',
    icon: Store,
  },
  {
    label: 'Recipes',
    path: '/recipes',
    icon: CookingPot,
  },
]

const publicPages = [
  { label: 'Home', path: '/' },
  { label: 'Grocery', path: '/grocery' },
  { label: 'Brands', path: '/brands' },
  { label: 'Recipes', path: '/recipes' },
  { label: 'Community', path: '/community' },
  { label: 'Learn', path: '/learn' },
  { label: 'About', path: '/about' },
]

const footerPills = [
  {
    label: 'Grocery discovery',
    icon: ShoppingBasket,
  },
  {
    label: 'Brand browsing',
    icon: Store,
  },
  {
    label: 'Recipe exploration',
    icon: CookingPot,
  },
  {
    label: 'Community access',
    icon: UsersRound,
  },
  {
    label: 'Learn / Pro',
    icon: BookOpen,
  },
]

export default function Footer() {
  const footerRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const currentYear = new Date().getFullYear()

  const {
    scrollYProgress,
  } = useScroll({
    target: footerRef,
    offset: [
      'start start',
      'end end',
    ],
  })

  const progress = useSpring(
    scrollYProgress,
    {
      stiffness: shouldReduceMotion ? 1000 : 92,
      damping: shouldReduceMotion ? 100 : 27,
      mass: shouldReduceMotion ? 0.01 : 0.4,
    },
  )

  const footerContentOpacity = useTransform(
    progress,
    [0, 0.14],
    [0.86, 1],
  )

  const footerContentY = useTransform(
    progress,
    [0, 0.18],
    shouldReduceMotion
      ? [0, 0]
      : [12, 0],
  )

  const giantBrandY = useTransform(
    progress,
    [0, 0.5, 1],
    shouldReduceMotion
      ? ['0%', '0%', '0%']
      : ['10%', '3%', '0%'],
  )

  const giantBrandOpacity = useTransform(
    progress,
    [0, 0.18],
    [0.72, 1],
  )

  return (
    <footer
      ref={footerRef}
      className="relative w-full overflow-x-hidden bg-[#F4F4EF] text-[#111111] sm:h-[100svh]"
    >
      {/* =========================================================
          MOBILE FOOTER — NORMAL FLOW, NO STICKY/ABSOLUTE OVERLAP
      ========================================================= */}
      <div className="w-full px-4 pb-3 pt-5 sm:hidden">
        <div className="border-t border-black/10 pt-4">
          <Link
            to="/"
            className="focus-ring inline-flex w-fit items-start gap-2.5 rounded-xl"
            aria-label="EPANTRY home"
          >
            <div className="grid h-8 w-8 place-items-center rounded-full border border-black/15 text-[10px] font-black tracking-[-0.03em] text-black">
              E
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black">
                EPANTRY
              </p>
              <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.2em] text-black/45">
                Food Intelligence
              </p>
            </div>
          </Link>
        </div>

        <div className="mt-4 border-b border-black/10 pb-2">
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-black/38">
            Browse without login
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          {publicPages.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="focus-ring group flex min-w-0 items-center justify-between gap-2 border-b border-black/10 py-2 text-[13px] font-medium uppercase tracking-[-0.02em] text-black/72 transition-colors duration-300 hover:text-[#166534]"
            >
              <span className="truncate">
                {item.label}
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-[10px] text-black/25 transition-colors duration-300 group-hover:text-[#166534]"
              >
                ↗
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {footerPills.map((item) => {
            const Icon = item.icon

            return (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2 py-1 text-[7px] font-medium uppercase tracking-[0.1em] text-black/40"
              >
                <Icon size={10} aria-hidden="true" className="text-black/35" />
                {item.label}
              </span>
            )
          })}
        </div>

        <div
          aria-hidden="true"
          className="mt-5 w-full select-none overflow-hidden bg-[linear-gradient(110deg,#166534_0%,#1f8a59_40%,#6aa67d_64%,#0f5132_100%)] bg-clip-text text-center text-[clamp(54px,17vw,76px)] font-light leading-[0.82] tracking-[-0.075em] text-transparent"
        >
          EPANTRY
        </div>

        <div className="mt-3 flex flex-col gap-1 border-t border-black/10 pt-2.5 text-[7px] uppercase tracking-[0.1em] text-black/42">
          <p>
            © {currentYear} EPANTRY. All rights reserved.
          </p>
          <p>
            Grocery • Brands • Recipes • Food Intelligence
          </p>
        </div>
      </div>

      {/* =========================================================
          TABLET / DESKTOP FOOTER — EXISTING REVEAL DESIGN
      ========================================================= */}
      <div className="hidden h-[100svh] w-full overflow-hidden bg-[#F4F4EF] sm:sticky sm:top-0 sm:block">
        <div className="absolute inset-0 overflow-hidden bg-[#F4F4EF]">
          <motion.div
            style={{
              opacity: footerContentOpacity,
              y: footerContentY,
            }}
            className="absolute left-0 right-0 top-[15svh] z-10 px-8 lg:px-[4vw]"
          >
            <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-8 border-t border-black/10 pt-7">
              <Link
                to="/"
                className="focus-ring inline-flex w-fit shrink-0 items-start gap-3 rounded-xl"
                aria-label="EPANTRY home"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full border border-black/15 text-[11px] font-black tracking-[-0.03em] text-black">
                  E
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black">
                    EPANTRY
                  </p>
                  <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.22em] text-black/45">
                    Food Intelligence
                  </p>
                </div>
              </Link>

              <div className="hidden grid-cols-4 gap-x-[5vw] lg:grid">
                {footerLinks.map((item) => {
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="focus-ring group flex w-fit flex-col gap-2 rounded-lg"
                    >
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-black/35">
                        Explore
                      </span>

                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-black/72 transition-colors duration-300 group-hover:text-[#166534]">
                        <Icon
                          size={13}
                          aria-hidden="true"
                          className="text-black/35 transition-colors duration-300 group-hover:text-[#166534]"
                        />
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </motion.div>

          <motion.div
            style={{
              opacity: footerContentOpacity,
              y: footerContentY,
            }}
            className="absolute left-0 right-0 top-[27svh] z-10 px-8 lg:px-[4vw]"
          >
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/38">
                  Browse without login
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/28">
                  Public EPANTRY pages
                </p>
              </div>

              <div className="grid grid-cols-4 gap-x-7 lg:gap-x-[3vw]">
                {publicPages.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="focus-ring group flex items-center justify-between gap-3 border-b border-black/10 py-3 text-[clamp(16px,1.5vw,24px)] font-medium uppercase tracking-[-0.025em] text-black/72 transition-colors duration-300 hover:text-[#166534]"
                  >
                    <span>
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[12px] font-medium text-black/25 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#166534]"
                    >
                      ↗
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            style={{
              opacity: footerContentOpacity,
              y: footerContentY,
            }}
            className="absolute left-0 right-0 top-[50svh] z-10 px-8 lg:px-[4vw]"
          >
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-black/38">
              {footerPills.map((item) => {
                const Icon = item.icon

                return (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5"
                  >
                    <Icon size={13} aria-hidden="true" className="text-black/35" />
                    {item.label}
                  </span>
                )
              })}
            </div>
          </motion.div>

          <motion.div
            aria-hidden="true"
            style={{
              opacity: giantBrandOpacity,
              y: giantBrandY,
            }}
            className="absolute bottom-[9svh] left-0 right-0 z-10 px-[2.2vw]"
          >
            <div className="mx-auto flex w-full max-w-[1680px] select-none items-end justify-between overflow-visible">
              {'EPANTRY'.split('').map((letter, index) => (
                <motion.span
                  key={`${letter}-${index}`}
                  className="inline-flex min-w-0 flex-1 cursor-default origin-bottom justify-center bg-[linear-gradient(110deg,#166534_0%,#1f8a59_40%,#6aa67d_64%,#0f5132_100%)] bg-clip-text font-light leading-[0.86] tracking-[-0.075em] text-transparent"
                  style={{
                    fontSize: 'clamp(72px, 16.2vw, 292px)',
                  }}
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : {
                          scaleX: 1.08,
                          scaleY: 1.22,
                          y: -8,
                          zIndex: 20,
                        }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 18,
                    mass: 0.52,
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.div
            style={{
              opacity: footerContentOpacity,
            }}
            className="absolute bottom-0 left-8 right-8 z-20 flex flex-row items-center justify-between gap-2 border-t border-black/10 py-3 text-[9px] uppercase tracking-[0.12em] text-black/42 lg:left-[4vw] lg:right-[4vw]"
          >
            <p>
              © {currentYear} EPANTRY. All rights reserved.
            </p>
            <p>
              Grocery • Brands • Recipes • Food Intelligence
            </p>
          </motion.div>
        </div>
      </div>
    </footer>
  )
}
