import {
  CookingPot,
  Search,
  ShoppingBasket,
  Store,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

const footerLinks = [
  {
    label:
      'Grocery',

    path:
      '/grocery',

    icon:
      ShoppingBasket,
  },

  {
    label:
      'Brands',

    path:
      '/brands',

    icon:
      Store,
  },

  {
    label:
      'Recipes',

    path:
      '/recipes',

    icon:
      CookingPot,
  },

  {
    label:
      'Search',

    path:
      '/search',

    icon:
      Search,
  },
]

export default function Footer() {
  const currentYear =
    new Date().getFullYear()

  return (
    <footer className="border-t border-[#334155] bg-[#1F2937] text-white">

      <div className="page-shell py-7 sm:py-8">

        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

          {/* Brand */}

          <Link
            to="/"
            className="focus-ring inline-flex w-fit items-center gap-3 rounded-xl"
            aria-label="EPANTRY home"
          >

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#166534] text-sm font-black text-white">
              E
            </div>


            <div>

              <p className="text-lg font-black tracking-tight">
                EPANTRY
              </p>

              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">
                Food Intelligence
              </p>

            </div>

          </Link>


          {/* Navigation */}

          <nav
            className="flex flex-wrap items-center gap-x-5 gap-y-3"
            aria-label="Footer navigation"
          >

            {footerLinks.map(
              (item) => {
                const Icon =
                  item.icon

                return (
                  <Link
                    key={
                      item.path
                    }
                    to={
                      item.path
                    }
                    className="focus-ring group inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-white/65 transition hover:text-white"
                  >

                    <Icon
                      size={14}
                      className="text-white/35 transition group-hover:text-[#16A34A]"
                      aria-hidden="true"
                    />

                    {
                      item.label
                    }

                  </Link>
                )
              },
            )}

          </nav>

        </div>


        {/* Bottom */}

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">

          <p>
            © {currentYear} EPANTRY. All rights reserved.
          </p>


          <p>
            Grocery • Brands • Recipes • Food Intelligence
          </p>

        </div>

      </div>

    </footer>
  )
}