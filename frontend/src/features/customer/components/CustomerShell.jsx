import { useEffect, useState } from 'react'

import {
  BookOpen,
  ChefHat,
  Home,
  LayoutDashboard,
  ListChecks,
  PackageSearch,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  UsersRound,
} from 'lucide-react'

import {
  NavLink,
  useLocation,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import MobileWorkspaceNav from '../../pwa/components/MobileWorkspaceNav'

const navigationGroups = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      {
        label: 'Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    id: 'food-at-home',
    label: 'Food at Home',
    icon: PackageSearch,
    items: [
      {
        label: 'My Pantry',
        to: '/pantry',
        icon: PackageSearch,
      },
      {
        label: 'Scan Product',
        to: '/scan',
        icon: ScanLine,
      },
      {
        label: 'Cook Today',
        to: '/cook-today',
        icon: ChefHat,
      },
      {
        label: 'Use Soon & Save Food',
        to: '/waste-reduction',
        icon: Sparkles,
      },
    ],
  },
  {
    id: 'plan-shop',
    label: 'Plan & Shop',
    icon: ShoppingBasket,
    items: [
      {
        label: 'Meal Planner',
        to: '/meal-plan',
        icon: ListChecks,
      },
      {
        label: 'Next Basket',
        to: '/next-basket',
        icon: ShoppingBasket,
      },
    ],
  },
  {
    id: 'orders-money',
    label: 'Orders & Money',
    icon: ShoppingBag,
    items: [
      {
        label: 'Cart',
        to: '/cart/recipe',
        icon: ShoppingCart,
        cart: true,
      },
      {
        label: 'Orders',
        to: '/orders',
        icon: ShoppingBag,
      },
      {
        label: 'Spending',
        to: '/account/spending',
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 'household-connections',
    label: 'Household & Connections',
    icon: UsersRound,
    items: [
      {
        label: 'Household',
        to: '/account/household',
        icon: UsersRound,
      },
      {
        label: 'Connected Purchases',
        to: '/account/purchase-intelligence',
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 'account-learning',
    label: 'Account & Learning',
    icon: Settings,
    items: [
      {
        label: 'My Learning',
        to: '/account/learning',
        icon: BookOpen,
      },
      {
        label: 'Profile & Preferences',
        to: '/account/settings',
        icon: Settings,
      },
      {
        label: 'Privacy Rights',
        to: '/account/privacy',
        icon: ShieldCheck,
      },
    ],
  },
]

function routeMatchesItem(
  item,
  pathname,
) {
  if (item.cart) {
    return pathname.startsWith('/cart/')
  }

  if (item.end) {
    return pathname === item.to
  }

  return (
    pathname === item.to ||
    pathname.startsWith(
      `${item.to}/`,
    )
  )
}

function CustomerNavigationItem({
  item,
  collapsed = false,
  nested = false,
  onNavigate,
}) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={({
        isActive,
      }) => [
        collapsed
          ? 'focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#c4a77c] bg-[#fff8ec] text-sm font-bold text-[#5c4936] shadow-[0_4px_0_#b28f62,0_8px_14px_rgba(83,58,33,0.15)] transition duration-200 hover:-translate-y-0.5'
          : 'focus-ring flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition duration-200',
        nested && !collapsed
          ? ''
          : '',
        isActive
          ? 'border-[#1f5b49] bg-[#1f5b49] text-white shadow-[0_4px_0_#123c30,0_8px_16px_rgba(25,68,55,0.22)]'
          : 'border-[#d9c7aa] bg-[#fff8ec] text-[#5c4936] shadow-[0_3px_0_#c4aa83,0_7px_14px_rgba(83,58,33,0.12)] hover:-translate-y-0.5 hover:border-[#b89a6c] hover:bg-[#fffdf7] hover:text-[#173f35]',
      ].join(' ')}
    >
      <Icon
        size={18}
        aria-hidden="true"
      />

      <span
        className={[
          'min-w-0 flex-1 overflow-hidden whitespace-normal leading-5 transition-[max-width,opacity,transform] duration-200 ease-out',
          collapsed
            ? 'max-w-0 -translate-x-1 opacity-0'
            : 'max-w-[240px] translate-x-0 opacity-100',
        ].join(' ')}
      >
        {item.label}
      </span>

      {Number(item.badge || 0) > 0 && !collapsed ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  )
}

function CustomerNavigationGroup({
  group,
  collapsed,
  active,
  onNavigate,
  onOpenSidebar,
}) {
  const Icon = group.icon

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={group.label}
        title={group.label}
        className={[
          'focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-xl border transition duration-200',
          active
            ? 'border-[#1f5b49] bg-[#1f5b49] text-white shadow-[0_4px_0_#123c30,0_8px_16px_rgba(25,68,55,0.2)]'
            : 'border-[#c4a77c] bg-[#fff8ec] text-[#5c4936] shadow-[0_4px_0_#b28f62,0_8px_14px_rgba(83,58,33,0.14)] hover:-translate-y-0.5 hover:text-[#173f35]',
        ].join(' ')}
      >
        <Icon
          size={18}
          aria-hidden="true"
        />
      </button>
    )
  }

  return (
    <div className="relative rounded-[18px] border border-[#c4a77c] bg-[#dec39d] p-2.5 pb-3 shadow-[0_7px_0_#ae895b,0_13px_24px_rgba(78,54,31,0.16)]">
      <div className="pointer-events-none absolute inset-x-3 bottom-[-6px] h-[7px] rounded-b-xl bg-[#9d7447] shadow-[0_4px_7px_rgba(70,45,22,0.2)]" />

      <div
        className={[
          'relative z-10 flex items-center gap-2 rounded-xl border border-[#b99668] bg-[#173f35] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#f4e5c9] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_3px_7px_rgba(35,52,44,0.18)]',
          active
            ? 'ring-2 ring-emerald-300/50'
            : '',
        ].join(' ')}
      >
        <Icon
          size={14}
          aria-hidden="true"
          className="shrink-0"
        />
        <span className="min-w-0 flex-1 whitespace-normal leading-4">
          {group.label}
        </span>
      </div>

      <div className="relative z-10 mt-2 space-y-1.5">
        {group.items.map(
          (item) => (
            <CustomerNavigationItem
              key={item.to}
              item={item}
              nested
              onNavigate={onNavigate}
            />
          ),
        )}
      </div>
    </div>
  )
}


const RECIPE_CART_PENDING_KEY =
  'epantry-pending-recipe-cart'

const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

const FLOATING_CART_UPDATE_EVENT =
  'epantry-cart-updated'

function readSessionJson(key) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw =
      window.sessionStorage.getItem(key)

    return raw
      ? JSON.parse(raw)
      : null
  } catch {
    return null
  }
}

function readCustomerCartNavigation() {
  const recipeCart =
    readSessionJson(
      RECIPE_CART_PENDING_KEY,
    )

  const marketplaceCart =
    readSessionJson(
      FLOATING_MARKETPLACE_CART_KEY,
    )

  const recipeItems =
    Array.isArray(
      recipeCart?.items,
    )
      ? recipeCart.items
      : []

  const marketplaceItems =
    Array.isArray(
      marketplaceCart?.items,
    )
      ? marketplaceCart.items
      : []

  if (recipeItems.length > 0) {
    return {
      href: '/cart/recipe',
      count: recipeItems.length,
    }
  }

  if (
    marketplaceItems.length > 0 &&
    marketplaceCart?.cartId
  ) {
    return {
      href: `/cart/${marketplaceCart.cartId}`,
      count: marketplaceItems.length,
    }
  }

  return {
    href: '/grocery',
    count: 0,
  }
}

const CUSTOMER_SIDEBAR_STORAGE_KEY =
  'epantry_customer_sidebar_collapsed'

function readCustomerSidebarCollapsed() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.sessionStorage.getItem(
    CUSTOMER_SIDEBAR_STORAGE_KEY,
  ) === '1'
}

export default function CustomerShell({
  children,
}) {
  const {
    currentUser,
    activeMode,
  } = useAuth()

  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'
  const isPantry = location.pathname === '/pantry'
  const isMealPlan = location.pathname === '/meal-plan'
  const isNextBasket = location.pathname === '/next-basket'
  const isWasteReduction = location.pathname === '/waste-reduction'
  const isCookToday = location.pathname === '/cook-today'
  const isHousehold = location.pathname === '/account/household'
  const isAccountSettings = location.pathname === '/account/settings'
  const isPrivacy = location.pathname === '/account/privacy'
  const isOrders = location.pathname === '/orders'
  const isOrderDetail = location.pathname.startsWith('/orders/')
  const isScan = location.pathname === '/scan'
  const isPurchaseIntelligence = location.pathname === '/account/purchase-intelligence'
  const isLearning = location.pathname === '/account/learning'

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(readCustomerSidebarCollapsed)

  const [sidebarHovered, setSidebarHovered] =
    useState(false)

  const [cartNavigation, setCartNavigation] =
    useState(readCustomerCartNavigation)

  useEffect(
    () => {
      function refreshCartNavigation() {
        setCartNavigation(
          readCustomerCartNavigation(),
        )
      }

      function handleStorage(event) {
        if (
          event.key === RECIPE_CART_PENDING_KEY ||
          event.key === FLOATING_MARKETPLACE_CART_KEY
        ) {
          refreshCartNavigation()
        }
      }

      window.addEventListener(
        FLOATING_CART_UPDATE_EVENT,
        refreshCartNavigation,
      )
      window.addEventListener(
        'storage',
        handleStorage,
      )

      refreshCartNavigation()

      return () => {
        window.removeEventListener(
          FLOATING_CART_UPDATE_EVENT,
          refreshCartNavigation,
        )
        window.removeEventListener(
          'storage',
          handleStorage,
        )
      }
    },
    [],
  )

  const resolvedNavigationGroups =
    navigationGroups.map(
      (group) => ({
        ...group,
        items: group.items.map(
          (item) =>
            item.cart
              ? {
                  ...item,
                  to: cartNavigation.href,
                  badge: cartNavigation.count,
                }
              : item,
        ),
      }),
    )

  const resolvedNavigationItems = [
    ...resolvedNavigationGroups.flatMap(
      (group) => group.items,
    ),
    {
      label: 'EPANTRY Home',
      to: '/',
      icon: Home,
    },
  ]

  const sidebarOpen =
    !sidebarCollapsed || sidebarHovered

  const identityLabel =
    currentUser?.displayName ||
    currentUser?.name ||
    currentUser?.email ||
    'Customer account'

  function collapseSidebarAfterNavigation() {
    setSidebarCollapsed(true)
    setSidebarHovered(false)

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        CUSTOMER_SIDEBAR_STORAGE_KEY,
        '1',
      )
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f7f5ef] pb-20 lg:pb-0">
      <div className={`page-shell ${isDashboard ? 'py-5 sm:py-7' : isPantry || isMealPlan || isNextBasket || isWasteReduction || isCookToday || isHousehold || isAccountSettings || isPrivacy || isOrders || isOrderDetail || isScan || isPurchaseIntelligence || isLearning ? 'pt-0 pb-5 sm:pb-7' : 'py-5 sm:py-7'}`}>
        <div className={`${isDashboard ? 'overflow-hidden' : 'overflow-visible'} rounded-[28px] border border-stone-200 bg-white shadow-sm`}>
          <div
            className={[
              'grid min-h-[760px] lg:transition-[grid-template-columns] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
              sidebarOpen
                ? 'lg:grid-cols-[260px_minmax(0,1fr)]'
                : 'lg:grid-cols-[70px_minmax(0,1fr)]',
            ].join(' ')}
          >
            <aside
              className={[
                'relative border-b border-[#c9ad84] bg-[#e8d7bd]',
                isDashboard
                  ? 'lg:border-b-0 lg:bg-[#e8d7bd]'
                  : 'lg:sticky lg:self-start lg:border-b-0 lg:bg-[#e8d7bd] lg:top-[88px] lg:h-[calc(100svh-104px)]',
              ].join(' ')}
            >
              <div
                onMouseEnter={() => {
                  if (sidebarCollapsed) {
                    setSidebarHovered(true)
                  }
                }}
                onMouseLeave={() => {
                  if (sidebarCollapsed) {
                    setSidebarHovered(false)
                  }
                }}
                className={[
                  'p-4 sm:p-5',
                  'lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-full lg:flex-col lg:overflow-visible lg:transform-gpu lg:will-change-[width,padding] lg:transition-[width,padding] lg:duration-[560ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                  sidebarOpen
                    ? 'lg:w-[260px] lg:border-r lg:border-[#c4a77c] lg:bg-[linear-gradient(180deg,#efe3d0_0%,#e3cfaf_48%,#d9bc91_100%)] lg:px-5 lg:py-5 lg:shadow-[inset_-12px_0_22px_rgba(96,66,36,0.08)]'
                    : 'lg:w-[70px] lg:rounded-r-[28px] lg:border-r lg:border-[#c4a77c] lg:bg-[linear-gradient(180deg,#efe3d0_0%,#dcc097_100%)] lg:px-3 lg:py-4 lg:shadow-[8px_0_22px_rgba(83,58,33,0.12)]',
                ].join(' ')}
              >
                <div
                  className={[
                    'rounded-[18px] border border-[#315f50] bg-[#123c31] px-3.5 py-3.5 text-white shadow-[0_6px_0_#0b2b23,0_12px_22px_rgba(31,63,53,0.22)] transition-[opacity,transform] duration-200 ease-out lg:relative lg:z-10 lg:w-full lg:self-start',
                    !sidebarOpen
                      ? 'lg:hidden'
                      : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                      <Home
                        size={17}
                        aria-hidden="true"
                      />
                    </div>

                    <div
                      className={[
                        'min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out',
                        !sidebarOpen
                          ? 'lg:max-w-0 lg:-translate-x-1 lg:opacity-0'
                          : 'lg:max-w-[190px] lg:translate-x-0 lg:opacity-100',
                      ].join(' ')}
                    >
                      <p className="text-[13px] font-black leading-4 text-[#fff7e8]">
                        EPANTRY Customer
                      </p>

                      <p className="mt-1 whitespace-normal text-[10px] font-semibold leading-4 text-[#d7c7aa]">
                        {activeMode === 'customer' ? 'Customer mode' : 'Customer access'} · {identityLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <nav
                  className={[
                    'lg:relative lg:z-10',
                    sidebarOpen
                      ? 'mt-4 hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4 lg:overflow-y-auto lg:pb-5 lg:pr-1'
                      : 'mt-2 hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:pb-2 lg:pr-0',
                  ].join(' ')}
                  aria-label="Customer workspace"
                >
                  {resolvedNavigationGroups.map((group) => {
                    const active =
                      group.items.some(
                        (item) =>
                          routeMatchesItem(
                            item,
                            location.pathname,
                          ),
                      )

                    return (
                      <CustomerNavigationGroup
                        key={group.id}
                        group={group}
                        collapsed={!sidebarOpen}
                        active={active}
                        onNavigate={collapseSidebarAfterNavigation}
                        onOpenSidebar={() => {
                          setSidebarCollapsed(false)
                          setSidebarHovered(false)

                          if (typeof window !== 'undefined') {
                            window.sessionStorage.setItem(
                              CUSTOMER_SIDEBAR_STORAGE_KEY,
                              '0',
                            )
                          }
                        }}
                      />
                    )
                  })}
                </nav>

                <nav
                  className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
                  aria-label="Customer workspace"
                >
                  {resolvedNavigationItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({
                          isActive,
                        }) => [
                          'focus-ring inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black transition',
                          isActive
                            ? 'bg-emerald-700 text-white'
                            : 'border border-[#d7c3a5] bg-[#fff8ec] text-[#5c4936]',
                        ].join(' ')}
                      >
                        <Icon
                          size={15}
                          aria-hidden="true"
                        />
                        {item.label}
                      </NavLink>
                    )
                  })}
                </nav>
              </div>
            </aside>

            <section
              className={[
                'min-w-0 lg:transition-[padding-left] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                'bg-[#f7f5ef]',
                'lg:pl-0',
              ].join(' ')}
            >
              <div className="epantry-workspace-canvas">
                {children}
              </div>
            </section>
          </div>
        </div>
      </div>

      <MobileWorkspaceNav workspace="customer" />
    </main>
  )
}
