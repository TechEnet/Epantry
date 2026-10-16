import {
  useRef,
} from 'react'

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

const publicPages = [
  { label: 'Home', path: '/' },
  { label: 'Grocery', path: '/grocery' },
  { label: 'Brands', path: '/brands' },
  { label: 'Recipes', path: '/recipes' },
  { label: 'Community', path: '/community' },
  { label: 'Learn', path: '/learn' },
  { label: 'About', path: '/about' },
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

  return (
    <footer
      ref={footerRef}
      className="relative w-full overflow-x-hidden bg-[#202421] text-[#F7F6F2] sm:h-[100svh]"
    >
      {/* =========================================================
          MOBILE FOOTER — NORMAL FLOW, NO STICKY/ABSOLUTE OVERLAP
      ========================================================= */}
      <div className="w-full px-4 pb-3 pt-5 sm:hidden">
        <div className="border-t border-white/20 pt-4">
          <Link
            to="/"
            className="focus-ring inline-flex w-fit items-start gap-2.5 rounded-xl"
            aria-label="EPANTRY home"
          >
            <div className="grid h-8 w-8 place-items-center rounded-full border border-white/25 text-[14px] font-semibold tracking-[-0.03em] text-[#F7F6F2]">
              E
            </div>

            <div>
              <p className="text-[14px] font-semibold uppercase tracking-[0.15em] text-[#F7F6F2]">
                EPANTRY
              </p>
              <p className="mt-0.5 text-[14px] font-semibold uppercase tracking-[0.2em] text-[#F7F6F2]/65">
                Food Intelligence
              </p>
            </div>
          </Link>
        </div>


        <div className="mt-4 grid grid-cols-2 gap-x-4">
          {publicPages.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="focus-ring group flex min-w-0 items-center justify-between gap-2 border-b border-white/20 py-2 text-[15px] font-medium tracking-[-0.02em] text-[#F7F6F2]/85 transition-colors duration-300 hover:text-[#DCE0CF] last:col-span-2 last:w-1/2 last:justify-self-center"
            >
              <span className="truncate">
                {item.label}
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-[14px] text-[#F7F6F2]/45 transition-colors duration-300 group-hover:text-[#DCE0CF]"
              >
                ↗
              </span>
            </Link>
          ))}
        </div>


        <div
          aria-hidden="true"
          className="mt-5 w-full select-none overflow-hidden  text-center text-[clamp(54px,17vw,76px)] font-light leading-[0.82] tracking-[-0.075em] text-[#F7F6F2]/90"
        >
          EPANTRY
        </div>

        <div className="mt-3 flex flex-col gap-1 border-t border-white/20 pt-2.5 text-[14px] uppercase tracking-[0.1em] text-[#F7F6F2]/65">
          <p>
            © {currentYear} EPANTRY. All rights reserved.
          </p>
        </div>
      </div>

      {/* =========================================================
          TABLET / DESKTOP FOOTER — EXISTING REVEAL DESIGN
      ========================================================= */}
      <div className="hidden h-[100svh] w-full overflow-hidden sm:sticky sm:top-0 sm:block">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            style={{
              y: footerContentY,
            }}
            className="absolute left-0 right-0 top-[15svh] z-10 px-8 lg:px-[4vw]"
          >
            <div className="mx-auto flex max-w-[1600px] items-start justify-start gap-8 border-t border-white/20 pt-7">
              <Link
                to="/"
                className="focus-ring inline-flex w-fit shrink-0 items-center gap-3 rounded-xl"
                aria-label="EPANTRY home"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-[15px] font-semibold tracking-[-0.03em] text-[#F7F6F2]">
                  E
                </div>

                <div>
                  <p className="text-[15px] font-semibold uppercase tracking-[0.16em] text-[#F7F6F2]">
                    EPANTRY
                  </p>
                  <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.22em] text-[#F7F6F2]/65">
                    Food Intelligence
                  </p>
                </div>
              </Link>

            </div>
          </motion.div>

          <motion.div
            style={{
              y: footerContentY,
            }}
            className="absolute left-0 right-0 top-[27svh] z-10 px-8 lg:px-[4vw]"
          >
            <div className="mx-auto max-w-[1600px]">

              <nav aria-label="Footer navigation" className="grid grid-cols-4 border-y border-white/25 lg:grid-cols-7">
                {publicPages.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="focus-ring group relative flex min-h-[76px] min-w-0 items-center justify-center gap-2 px-2 py-4 text-center text-[15px] font-semibold tracking-[-0.025em] text-[#F7F6F2]/90 transition-colors duration-300 hover:bg-white/[0.07] hover:text-[#DCE0CF] lg:border-r lg:border-white/20 lg:last:border-r-0"
                  >
                    <span>
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[14px] font-medium text-[#F7F6F2]/55 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#DCE0CF]"
                    >
                      ↗
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </motion.div>


          <motion.div
            aria-hidden="true"
            style={{
              y: giantBrandY,
            }}
            className="absolute bottom-[9svh] left-0 right-0 z-10 px-[2.2vw]"
          >
            <div className="mx-auto flex w-full max-w-[1680px] select-none items-end justify-between overflow-visible">
              {'EPANTRY'.split('').map((letter, index) => (
                <motion.span
                  key={`${letter}-${index}`}
                  className="inline-flex min-w-0 flex-1 cursor-default origin-bottom justify-center  font-light leading-[0.86] tracking-[-0.075em] text-[#F7F6F2]/90"
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
            className="absolute bottom-0 left-8 right-8 z-20 flex flex-row items-center justify-center gap-2 border-t border-white/20 py-3 text-[14px] uppercase tracking-[0.12em] text-[#F7F6F2]/65 lg:left-[4vw] lg:right-[4vw]"
          >
            <p>
              © {currentYear} EPANTRY. All rights reserved.
            </p>
          </motion.div>
        </div>
      </div>
    </footer>
  )
}
