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
          ? 'focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-[18px] border text-sm font-bold transition duration-200'
          : 'focus-ring flex min-h-[44px] items-center gap-3 rounded-[17px] border px-3 py-2.5 text-sm font-bold transition duration-200',
        nested && !collapsed
          ? ''
          : '',
        isActive
          ? 'border-[#d6ad78] bg-[linear-gradient(145deg,#f5ddb9_0%,#e8c48f_100%)] text-[#3f3124] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_5px_12px_rgba(118,83,47,0.14)]'
          : 'border-[#dfd0bb] bg-[linear-gradient(145deg,rgba(255,254,250,0.96)_0%,rgba(248,239,226,0.96)_100%)] text-[#5a4938] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_8px_rgba(92,65,37,0.07)] hover:-translate-y-px hover:border-[#ccb590] hover:bg-[#fffdf8] hover:text-[#17483b] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_5px_12px_rgba(92,65,37,0.10)]',
      ].join(' ')}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className="shrink-0"
      />

      <span
        className={[
          'min-w-0 flex-1 whitespace-normal leading-5 transition-[max-width,opacity,transform] duration-200 ease-out',
          collapsed
            ? 'max-w-0 -translate-x-1 overflow-hidden opacity-0'
            : 'max-w-[240px] translate-x-0 opacity-100',
        ].join(' ')}
      >
        {item.label}
      </span>

      {Number(item.badge || 0) > 0 && !collapsed ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-[#17483b] px-1.5 py-0.5 text-[10px] font-black text-white">
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
          'focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-[18px] border transition duration-200',
          active
            ? 'border-[#d6ad78] bg-[linear-gradient(145deg,#f5ddb9_0%,#e8c48f_100%)] text-[#3f3124] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_5px_12px_rgba(118,83,47,0.14)]'
            : 'border-[#dfd0bb] bg-[linear-gradient(145deg,#fffdf8_0%,#f3e8d7_100%)] text-[#5a4938] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_3px_8px_rgba(92,65,37,0.08)] hover:-translate-y-px hover:text-[#17483b]',
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
    <div className="group/customer-section relative shrink-0 pb-3.5 pr-3.5 pt-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-4 right-0 top-0 h-4 rounded-t-[24px] border border-[#dac7aa]/75 bg-[linear-gradient(180deg,#f2e7d6_0%,#dfc9aa_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] [clip-path:polygon(5%_100%,92%_100%,100%_28%,12%_28%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 right-0 top-5 w-4 rounded-r-[24px] border-y border-r border-[#cdb38e]/80 bg-[linear-gradient(90deg,#e3cfb2_0%,#c9aa80_100%)] shadow-[inset_1px_0_0_rgba(255,255,255,0.34),5px_4px_12px_rgba(92,65,37,0.09)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-5 right-2 h-4 rounded-b-[22px] border-x border-b border-[#c6a77b]/75 bg-[linear-gradient(180deg,#d8bd96_0%,#c4a072_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_5px_10px_rgba(92,65,37,0.08)]"
      />

      <div className="relative z-10 rounded-[24px] border border-[#decfb9] bg-[linear-gradient(145deg,#fffdf9_0%,#f5ecdf_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_8px_16px_rgba(92,65,37,0.08)]">
        <div
          className={[
            'flex min-h-[36px] items-center gap-2 rounded-[15px] border border-[#315f50]/80 bg-[linear-gradient(145deg,#1c4b3f_0%,#153d33_100%)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#f5ead8] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_4px_10px_rgba(35,52,44,0.10)]',
            active
              ? 'ring-1 ring-[#d9b36f]/60'
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

        <div className="mt-2 space-y-1.5">
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
  const isSpending = location.pathname === '/account/spending'

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
      <div className={`page-shell ${isDashboard ? 'py-5 sm:py-7' : isPantry || isMealPlan || isNextBasket || isWasteReduction || isCookToday || isHousehold || isAccountSettings || isPrivacy || isOrders || isOrderDetail || isScan || isPurchaseIntelligence || isLearning || isSpending ? 'pt-0 pb-5 sm:pb-7' : 'py-5 sm:py-7'}`}>
        <div className={`${isDashboard ? 'overflow-hidden' : 'overflow-visible'} rounded-[28px] border border-stone-200 bg-white shadow-sm`}>
          <div
            className={[
              'grid min-h-[760px] lg:transition-[grid-template-columns] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
              sidebarOpen
                ? 'lg:grid-cols-[248px_minmax(0,1fr)]'
                : 'lg:grid-cols-[70px_minmax(0,1fr)]',
            ].join(' ')}
          >
            <aside
              className={[
                'relative border-b border-stone-200 bg-[#faf8f4] lg:border-r lg:border-stone-200 lg:bg-[#faf8f4]',
                isDashboard
                  ? 'lg:border-b-0'
                  : 'lg:sticky lg:self-start lg:border-b-0 lg:top-[88px] lg:h-[calc(100svh-104px)]',
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
                    ? 'lg:w-[248px] lg:bg-[#faf8f4] lg:px-4 lg:py-5 lg:shadow-none'
                    : 'lg:w-[70px] lg:rounded-r-[26px] lg:border-r lg:border-stone-200 lg:bg-[#faf8f4] lg:px-3 lg:py-4 lg:shadow-[5px_0_16px_rgba(83,58,33,0.06)]',
                ].join(' ')}
              >
                <div
                  className={[
                    'shrink-0 rounded-[22px] border border-[#315f50] bg-[linear-gradient(145deg,#17483b_0%,#11382f_100%)] px-3.5 py-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_7px_16px_rgba(31,63,53,0.16)] transition-[opacity,transform] duration-200 ease-out lg:relative lg:z-10 lg:w-full lg:max-w-[220px] lg:self-start',
                    !sidebarOpen
                      ? 'lg:hidden'
                      : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_8px_rgba(4,120,87,0.22)]">
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
                      ? 'mt-4 hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-3.5 lg:overflow-y-auto lg:overflow-x-visible lg:pb-6 lg:pr-1'
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
