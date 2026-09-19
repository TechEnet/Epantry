import { useEffect, useState } from 'react'

import {
  BookOpen,
  ChefHat,
  ChevronDown,
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

function activeGroupIdForPath(
  pathname,
) {
  return (
    navigationGroups.find(
      (group) =>
        group.items.some(
          (item) =>
            routeMatchesItem(
              item,
              pathname,
            ),
        ),
    )?.id ||
    'overview'
  )
}

function CustomerNavigationItem({
  item,
  nested = false,
  onNavigate,
}) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({
        isActive,
      }) => [
        'focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors duration-200',
        nested
          ? 'ml-2'
          : '',
        isActive
          ? 'bg-emerald-700 text-white shadow-sm'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950',
      ].join(' ')}
    >
      <Icon
        size={17}
        aria-hidden="true"
      />

      <span className="min-w-0 flex-1 truncate">
        {item.label}
      </span>

      {Number(item.badge || 0) > 0 ? (
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
  open,
  active,
  onToggle,
  onNavigate,
  onOpenSidebar,
}) {
  const Icon = group.icon

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          onOpenSidebar()
          if (!open) {
            onToggle()
          }
        }}
        aria-label={group.label}
        title={group.label}
        className={[
          'focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200',
          active
            ? 'bg-emerald-700 text-white shadow-sm'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950',
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
    <div className="rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={[
          'focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition-colors duration-200',
          active
            ? 'bg-emerald-50 text-emerald-900'
            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-950',
        ].join(' ')}
      >
        <Icon
          size={18}
          aria-hidden="true"
        />

        <span className="min-w-0 flex-1 truncate">
          {group.label}
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={[
            'shrink-0 transition-transform duration-200',
            open
              ? 'rotate-180'
              : '',
          ].join(' ')}
        />
      </button>

      {open ? (
        <div className="mt-1 space-y-1 border-l border-stone-200 pl-1">
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
      ) : null}
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

const CUSTOMER_SIDEBAR_HOVER_BLOCK_KEY =
  'epantry_customer_sidebar_hover_block_until'

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
    hostEnabled,
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

  const [openGroupId, setOpenGroupId] =
    useState(() =>
      activeGroupIdForPath(
        location.pathname,
      ),
    )

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

  useEffect(
    () => {
      setOpenGroupId(
        activeGroupIdForPath(
          location.pathname,
        ),
      )
    },
    [
      location.pathname,
    ],
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
      window.sessionStorage.setItem(
        CUSTOMER_SIDEBAR_HOVER_BLOCK_KEY,
        String(Date.now() + 700),
      )
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f7f5ef] pb-20 lg:pb-0">
      <div className={`page-shell ${isDashboard ? 'py-0' : isPantry || isMealPlan || isNextBasket || isWasteReduction || isCookToday || isHousehold || isAccountSettings || isPrivacy || isOrders || isOrderDetail || isScan || isPurchaseIntelligence || isLearning ? 'pt-0 pb-5 sm:pb-7' : 'py-5 sm:py-7'}`}>
        <div className="overflow-visible rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div
            className={[
              'grid min-h-[760px] lg:transition-[grid-template-columns] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
              sidebarOpen
                ? 'lg:grid-cols-[220px_minmax(0,1fr)]'
                : 'lg:grid-cols-[70px_minmax(0,1fr)]',
            ].join(' ')}
          >
            <aside
              className={[
                'relative border-b border-stone-200 bg-stone-50/80 lg:sticky lg:self-start lg:border-b-0 lg:bg-transparent',
                isDashboard
                  ? 'lg:top-[72px] lg:h-[calc(100svh-72px)]'
                  : 'lg:top-[88px] lg:h-[calc(100svh-104px)]',
              ].join(' ')}
            >
              <div
                onMouseEnter={() => {
                  if (!sidebarCollapsed) {
                    return
                  }

                  const blockedUntil = typeof window !== 'undefined'
                    ? Number(window.sessionStorage.getItem(CUSTOMER_SIDEBAR_HOVER_BLOCK_KEY) || 0)
                    : 0

                  if (Date.now() >= blockedUntil) {
                    setSidebarHovered(true)
                  }
                }}
                onMouseLeave={() => {
                  if (sidebarCollapsed) {
                    setSidebarHovered(false)
                  }

                  if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem(
                      CUSTOMER_SIDEBAR_HOVER_BLOCK_KEY,
                    )
                  }
                }}
                className={[
                  'p-4 sm:p-5',
                  'lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-full lg:flex-col lg:overflow-visible lg:transform-gpu lg:will-change-[width,padding] lg:transition-[width,padding] lg:duration-[560ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                  sidebarOpen
                    ? [
                        'lg:w-[330px] lg:bg-transparent lg:border-r-0 lg:shadow-none lg:px-5 lg:pr-[110px]',
                        isDashboard ? 'lg:py-0' : 'lg:py-5',
                      ].join(' ')
                    : 'lg:w-[70px] lg:rounded-r-[32px] lg:border-r lg:border-stone-200 lg:bg-stone-50/95 lg:px-3 lg:py-4 lg:shadow-[8px_0_22px_rgba(15,23,42,0.07)]',
                ].join(' ')}
              >

                {sidebarOpen ? (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-[220px] bg-stone-50/95 lg:block" />
                    <div className="pointer-events-none absolute inset-y-0 left-[170px] z-0 hidden w-[160px] rounded-r-[999px] border-r border-stone-200 bg-stone-50/95 shadow-[12px_0_30px_rgba(15,23,42,0.08)] lg:block" />
                  </>
                ) : null}
                <div
                  className={[
                    'rounded-[22px] bg-stone-950 p-5 text-white transition-[opacity,transform] duration-200 ease-out lg:relative lg:z-10 lg:w-full lg:max-w-[190px] lg:self-start',
                    !sidebarOpen
                      ? 'lg:hidden'
                      : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-lg font-black">
                      E
                    </div>

                    <div
                      className={[
                        'min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out',
                        !sidebarOpen
                          ? 'lg:max-w-0 lg:-translate-x-1 lg:opacity-0'
                          : 'lg:max-w-[190px] lg:translate-x-0 lg:opacity-100',
                      ].join(' ')}
                    >
                      <p className="text-base font-black">EPANTRY</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                        Customer workspace
                      </p>
                    </div>
                  </div>

                  <div
                    className={[
                      'mt-5 border-t border-stone-800 pt-4',
                      !sidebarOpen
                        ? 'lg:hidden'
                        : '',
                    ].join(' ')}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">
                      Current experience
                    </p>
                    <p className="mt-1.5 text-sm font-bold">
                      {activeMode === 'customer' ? 'Customer mode' : 'Customer access'}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-400">
                      {identityLabel}
                    </p>
                  </div>
                </div>

                <nav
                  className={[
                    'lg:relative lg:z-10',
                    sidebarOpen
                      ? 'mt-5 hidden space-y-1.5 lg:block'
                      : 'mt-2 hidden space-y-1.5 lg:block',
                    sidebarOpen
                      ? 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1'
                      : 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-0',
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
                        open={openGroupId === group.id}
                        active={active}
                        onToggle={() =>
                          setOpenGroupId(
                            (current) =>
                              current === group.id
                                ? ''
                                : group.id,
                          )
                        }
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
                            : 'border border-stone-200 bg-white text-stone-600',
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

                {hostEnabled ? (
                  <div
                    className={[
                      'mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 lg:relative lg:z-10 lg:w-full lg:max-w-[190px] lg:self-start',
                      !sidebarOpen
                        ? 'lg:hidden'
                        : '',
                    ].join(' ')}
                  >
                    <p className="text-[11px] font-bold leading-5 text-emerald-900">
                      This identity also has Host access. Use the switch control in the top navbar to move between Customer and Host experiences.
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>

            <section
              className={[
                'min-w-0 lg:transition-[padding-left] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                isDashboard
                  ? 'bg-[#173f35]'
                  : 'bg-[#f7f5ef]',
                sidebarOpen
                  ? 'lg:pl-[110px]'
                  : 'lg:pl-0',
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
