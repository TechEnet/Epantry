import {
  ArrowRight,
} from 'lucide-react'

import {
  motion,
  useReducedMotion,
} from 'motion/react'

import {
  landingBenefits,
  landingJourneySteps,
} from '../content/landingContent'

export default function HowItWorksSection() {
  const shouldReduceMotion =
    useReducedMotion()

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#F8FAF7]">

      {/* =============================================================
          BACKGROUND TEXTURE
      ============================================================= */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >

        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage:
              'linear-gradient(rgba(22, 101, 52, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(22, 101, 52, 0.14) 1px, transparent 1px)',

            backgroundSize:
              '40px 40px',
          }}
        />


        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [
                    0,
                    34,
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
            duration: 12,

            repeat:
              Infinity,

            ease:
              'easeInOut',
          }}
          className="absolute -right-28 top-[24%] h-96 w-96 rounded-full bg-[#16A34A]/25 blur-3xl"
        />


        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [
                    0,
                    -24,
                    0,
                  ],

                  y: [
                    0,
                    18,
                    0,
                  ],
                }
          }
          transition={{
            duration: 14,

            repeat:
              Infinity,

            ease:
              'easeInOut',
          }}
          className="absolute -left-24 bottom-[8%] h-72 w-72 rounded-full bg-[#16A34A]/20 blur-3xl"
        />

      </div>


      {/* =============================================================
          SECTION CONTENT
      ============================================================= */}

      <div className="page-shell relative z-10 flex min-h-[100svh] flex-col py-8 sm:py-10">

        {/* =========================================================
            HEADING
        ========================================================= */}

        <div className="shrink-0">

          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#166534] sm:text-base">
            How EPANTRY Works
          </p>


          <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

            <div className="max-w-3xl">

              <h2 className="text-4xl font-black leading-[1.02] tracking-[-0.04em] text-[#111827] sm:text-5xl lg:text-[58px]">

                One food journey.

                <br />

                Everything stays connected.

              </h2>

            </div>


            <p className="max-w-xl leading-7 text-[#6B7280]">

              From discovering food to understanding products,
              building a basket and cooking with confidence.

            </p>

          </div>

        </div>


        {/* =========================================================
            MAIN CONTENT
        ========================================================= */}

        <div className="flex flex-1 flex-col justify-between gap-10 py-8 lg:gap-12 lg:py-10">

          {/* =======================================================
              HOW EPANTRY WORKS
          ======================================================= */}

          <div className="relative">

            {/* Desktop Connector */}

            <div
              aria-hidden="true"
              className="absolute left-[8%] right-[8%] top-8 hidden h-px bg-gradient-to-r from-transparent via-[#16A34A]/60 to-transparent lg:block"
            />


            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              {landingJourneySteps.map(
                (
                  item,
                  index,
                ) => {
                  const Icon =
                    item.icon

                  return (
                    <motion.article
                      key={
                        item.id
                      }
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 22,
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
                        duration: 0.4,

                        delay:
                          shouldReduceMotion
                            ? 0
                            : index *
                              0.07,
                      }}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : {
                              y: -6,
                            }
                      }
                      className="group relative pt-8"
                    >

                      {/* Icon */}

                      <div className="relative z-20 ml-6 grid h-16 w-16 place-items-center rounded-2xl border-[5px] border-[#F8FAF7] bg-[#166534] text-white shadow-[0_14px_32px_rgba(20,83,45,0.22)] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-3deg]">

                        <Icon
                          size={23}
                          aria-hidden="true"
                        />

                      </div>


                      {/* Card */}

                      <div className="relative -mt-5 flex min-h-[248px] flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-gradient-to-br from-white via-white to-[#F0FDF4] px-6 pb-6 pt-12 text-left shadow-[0_14px_42px_rgba(17,24,39,0.07)] transition duration-300 group-hover:border-[#16A34A]/35 group-hover:shadow-[0_22px_55px_rgba(22,101,52,0.13)]">

                        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#166534] via-[#16A34A] to-[#86EFAC] opacity-80" />

                        <div className="pointer-events-none absolute -right-2 top-3 text-[76px] font-black leading-none tracking-[-0.08em] text-[#166534]/[0.045]">
                          0{item.step}
                        </div>

                        <p className="relative z-10 w-fit rounded-full border border-[#16A34A]/15 bg-[#F0FDF4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#166534]">
                          Step {item.step}
                        </p>


                        <h3 className="relative z-10 mt-4 text-xl font-black tracking-[-0.02em] text-[#111827]">
                          {item.title}
                        </h3>


                        <p className="relative z-10 mt-3 text-[15px] leading-7 text-[#6B7280]">
                          {item.description}
                        </p>


                        <div className="relative z-10 mt-auto flex justify-end pt-5">

                          <div className="grid h-9 w-9 place-items-center rounded-full border border-[#166534]/10 bg-white text-[#166534] shadow-sm transition duration-300 group-hover:translate-x-1 group-hover:bg-[#166534] group-hover:text-white">

                            <ArrowRight
                              size={16}
                              aria-hidden="true"
                            />

                          </div>

                        </div>

                      </div>

                    </motion.article>
                  )
                },
              )}

            </div>

          </div>


          {/* =======================================================
              WHY EPANTRY
          ======================================================= */}

          <div className="rounded-[32px] border border-[#166534]/10 bg-white/50 p-5 shadow-[0_18px_60px_rgba(22,101,52,0.07)] backdrop-blur-[2px] sm:p-6">

            <div className="mb-6 flex items-end justify-between gap-4">

              <div>

                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#166534] sm:text-base">
                  Why EPANTRY
                </p>


                <h3 className="mt-3 text-3xl font-black leading-[1.05] tracking-[-0.035em] text-[#111827] sm:text-4xl lg:text-[44px]">
                  More intelligence behind every food decision.
                </h3>

              </div>

            </div>


            <div className="grid gap-4 md:grid-cols-3">

              {landingBenefits.map(
                (
                  benefit,
                  index,
                ) => {
                  const Icon =
                    benefit.icon

                  return (
                    <motion.article
                      key={
                        benefit.id
                      }
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 18,
                            }
                      }
                      whileInView={{
                        opacity: 1,
                        y: 0,
                      }}
                      viewport={{
                        once: true,
                      }}
                      transition={{
                        duration: 0.35,

                        delay:
                          shouldReduceMotion
                            ? 0
                            : index *
                              0.06,
                      }}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : {
                              y: -5,
                            }
                      }
                      className="group relative min-h-[170px] overflow-hidden rounded-[26px] border border-[#E5E7EB] bg-gradient-to-br from-white via-white to-[#F8FAF7] p-6 shadow-[0_10px_34px_rgba(17,24,39,0.06)] transition duration-300 hover:border-[#16A34A]/30 hover:shadow-[0_18px_44px_rgba(22,101,52,0.11)]"
                    >

                      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#16A34A]/[0.06] transition duration-300 group-hover:scale-125 group-hover:bg-[#16A34A]/[0.10]" />

                      <div className="relative z-10 flex items-start gap-5">

                        <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl border border-[#16A34A]/10 bg-[#F0FDF4] text-[#166534] shadow-sm transition duration-300 group-hover:bg-[#166534] group-hover:text-white">

                          <Icon
                            size={22}
                            aria-hidden="true"
                          />

                        </div>


                        <div>

                          <h4 className="text-lg font-black tracking-[-0.015em] text-[#111827]">

                            {
                              benefit.title
                            }

                          </h4>


                          <p className="mt-2 text-[15px] leading-7 text-[#6B7280]">

                            {
                              benefit.description
                            }

                          </p>

                        </div>

                      </div>

                      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-[#16A34A]/35 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

                    </motion.article>
                  )
                },
              )}

            </div>

          </div>

        </div>

      </div>

    </section>
  )
}
