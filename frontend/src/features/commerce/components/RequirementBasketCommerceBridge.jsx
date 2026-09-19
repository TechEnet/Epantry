import {
  ArrowRight,
  Scale,
  ShoppingBasket,
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

export default function RequirementBasketCommerceBridge() {
  const {
    planId,
  } =
    useParams()

  if (
    !planId
  ) {
    return null
  }

  return (
    <section className="bg-[#f7f5ef] pb-10">
      <div className="page-shell">
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-300">
                <Scale
                  size={18}
                  aria-hidden="true"
                />

                <p className="text-xs font-black uppercase tracking-[0.14em]">
                  M11 · Fulfillment Compare
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Match genuine shortages to serviceable Marketplace offers
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100/80">
                Compare deterministic pack coverage, known item price, waste and
                seller splits. EPANTRY will not call an item subtotal a total
                landed cost while delivery fees are still unknown.
              </p>
            </div>

            <Link
              to={`/outcome-plans/${planId}/compare`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-300"
            >
              <ShoppingBasket
                size={17}
                aria-hidden="true"
              />

              Compare fulfillment

              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}