import {
  Bell,
  Building2,
  LayoutDashboard,
  PackageSearch,
  ScanLine,
  ShoppingBag,
  ShoppingBasket,
  Truck,
} from 'lucide-react'

import {
  NavLink,
} from 'react-router-dom'

const CUSTOMER_ITEMS = Object.freeze([
  {
    label: 'Home',
    to: '/dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Pantry',
    to: '/pantry',
    icon: PackageSearch,
  },
  {
    label: 'Scan',
    to: '/scan',
    icon: ScanLine,
  },
  {
    label: 'Basket',
    to: '/next-basket',
    icon: ShoppingBasket,
  },
  {
    label: 'Alerts',
    to: '/notifications',
    icon: Bell,
  },
])

const HOST_ITEMS = Object.freeze([
  {
    label: 'Home',
    to: '/host/operations',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Scan',
    to: '/host/scan',
    icon: ScanLine,
  },
  {
    label: 'NPI',
    to: '/host/product-intelligence',
    icon: PackageSearch,
  },
  {
    label: 'Orders',
    to: '/host/orders',
    icon: ShoppingBag,
  },
  {
    label: 'Fulfill',
    to: '/host/fulfillment',
    icon: Truck,
  },
  {
    label: 'Business',
    to: '/host/business-profile',
    icon: Building2,
  },
])

export default function MobileWorkspaceNav({
  workspace,
}) {
  const items =
    workspace === 'host'
      ? HOST_ITEMS
      : CUSTOMER_ITEMS

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(28,25,23,0.08)] backdrop-blur lg:hidden"
      style={{
        paddingBottom:
          'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label={`${workspace === 'host' ? 'Host' : 'Customer'} mobile navigation`}
    >
      <div
        className={[
          'mx-auto grid max-w-lg gap-1',
          items.length === 6
            ? 'grid-cols-6'
            : 'grid-cols-5',
        ].join(' ')}
      >
        {items.map((item) => {
          const Icon =
            item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({
                isActive,
              }) => [
                'focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[10px] font-black transition',
                isActive
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900',
              ].join(' ')}
            >
              <Icon
                size={18}
                aria-hidden="true"
              />

              <span className="max-w-full truncate">
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
