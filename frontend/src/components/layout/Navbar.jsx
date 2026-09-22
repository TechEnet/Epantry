import {
    useEffect,
    useMemo,
    useRef,
    useState,
  } from 'react';
  
  import {
    ArrowLeft,
    Bell,
    BookOpen,
    ChevronDown,
    CircleAlert,
    Info,
    LayoutDashboard,
    LoaderCircle,
    LogOut,
    MapPin,
    Menu,
    Search,
    ScanLine,
    Settings,
    ShoppingCart,
    Truck,
    UserRound,
    UsersRound,
    X,
  } from 'lucide-react';
  
  import {
    AnimatePresence,
    motion,
  } from 'motion/react';
  
  import {
    Link,
    useLocation,
    useNavigate,
  } from 'react-router-dom';
  
  import SearchBar from '../common/SearchBar';
  
  import {
    useAdmin,
  } from '../../features/admin/context/AdminContext';
  
  import {
    useAuth,
  } from '../../features/auth/context/AuthContext';
  
  import NavbarLocationStatus from '../../features/location/components/NavbarLocationStatus';
  import ModeSwitcher from '../../features/auth/components/ModeSwitcher';
  import NotificationBell from '../../features/notifications/components/NotificationBell';

  import {
    listOrders,
  } from '../../features/commerce/services/commerce.service';

  import {
    listNotifications,
  } from '../../features/analytics/services/analytics.service';
  
  const RECIPE_CART_PENDING_KEY =
    'epantry-pending-recipe-cart';

  const FLOATING_MARKETPLACE_CART_KEY =
    'epantry-floating-marketplace-cart';

  const FLOATING_CART_UPDATE_EVENT =
    'epantry-cart-updated';

  const UNREAD_NOTIFICATION_STATUSES =
    new Set([
      'pending',
      'delivered',
      'action_required_domain',
    ]);

  const NON_TRACKABLE_ORDER_STATUSES =
    new Set([
      'draft',
      'delivered',
      'customer_cancelled',
      'seller_cancelled',
      'returned',
      'refunded',
    ]);

  function readSessionJson(
    key,
  ) {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw =
            window.sessionStorage.getItem(
                key,
            );

        return raw
            ? JSON.parse(
                raw,
            )
            : null;
    } catch {
        return null;
    }
  }

  function readNavbarCartNavigation() {
    const recipeCart =
        readSessionJson(
            RECIPE_CART_PENDING_KEY,
        );

    const marketplaceCart =
        readSessionJson(
            FLOATING_MARKETPLACE_CART_KEY,
        );

    const recipeItems =
        Array.isArray(
            recipeCart?.items,
        )
            ? recipeCart.items
            : [];

    const marketplaceItems =
        Array.isArray(
            marketplaceCart?.items,
        )
            ? marketplaceCart.items
            : [];

    if (recipeItems.length > 0) {
        return {
            href: '/cart/recipe',
            count: recipeItems.length,
        };
    }

    if (
        marketplaceItems.length > 0 &&
        marketplaceCart?.cartId
    ) {
        return {
            href: `/cart/${marketplaceCart.cartId}`,
            count: marketplaceItems.length,
        };
    }

    return {
        href: '/grocery',
        count: 0,
    };
  }

  const BASE_NAV_ITEMS = [
    {
        label:
            'Home',
  
        to:
            '/',
    },
  
    {
        label:
            'Grocery',
  
        to:
            '/grocery',
    },
  
    {
        label:
            'Brands',
  
        to:
            '/brands',
    },
  
    {
        label:
            'Recipes',
  
        to:
            '/recipes',
    },
  
    {
        label:
            'Community',
  
        to:
            '/community',
    },
  
    {
        label:
            'Learn',
  
        to:
            '/learn',
    },
  ];
  
  const MOBILE_COMPACT_SCROLL_Y =
    40;
  
  function getFirstName(
    name,
  ) {
    const normalized =
        String(
            name ||
                '',
        ).trim();
  
    if (!normalized) {
        return 'Account';
    }
  
    return normalized.split(
        /\s+/,
    )[0];
  }

  function getInitials(
    name,
  ) {
    const parts =
        String(
            name ||
                '',
        )
            .trim()
            .split(
                /\s+/,
            )
            .filter(Boolean);

    if (
        parts.length ===
        0
    ) {
        return 'EP';
    }

    return parts
        .slice(
            0,
            2,
        )
        .map(
            (part) =>
                part.charAt(
                    0,
                ),
        )
        .join(
            '',
        )
        .toUpperCase();
  }
  
  export default function Navbar() {
    const [
        menuOpen,
        setMenuOpen,
    ] =
        useState(false);

    const [
        mobileLocationOpen,
        setMobileLocationOpen,
    ] =
        useState(false);

    const [
        mobileSearchOpen,
        setMobileSearchOpen,
    ] =
        useState(false);

    const mobileUtilityRef =
        useRef(null);
  
    const [
        mobileCompact,
        setMobileCompact,
    ] =
        useState(false);
  
    const [
        logoutError,
        setLogoutError,
    ] =
        useState('');

    const [
        accountMenuOpen,
        setAccountMenuOpen,
    ] =
        useState(false);

    const accountMenuRef =
        useRef(null);

    const [
        cartNavigation,
        setCartNavigation,
    ] =
        useState(
            readNavbarCartNavigation,
        );

    const [
        activeTrackingOrder,
        setActiveTrackingOrder,
    ] =
        useState(null);

    const [
        unreadNotificationCount,
        setUnreadNotificationCount,
    ] =
        useState(0);
  
    const location =
        useLocation();
  
    const navigate =
        useNavigate();
  
    const {
        user,
        isAuthenticated,
        isBootstrapping,
        isLoggingOut,
        customerEnabled,
        hostEnabled,
        superAdminEnabled,
        activeMode,
        logout,
    } =
        useAuth();
  
    const navItems =
        useMemo(
            () => [
                ...BASE_NAV_ITEMS,
                {
                    label:
                        'Scan',
  
                    to:
                        activeMode === 'host' && hostEnabled
                            ? '/host/scan'
                            : '/scan',
                },
            ],
            [
                activeMode,
                hostEnabled,
            ],
        );
  
    const {
        hasAdminAccess,
    } =
        useAdmin();
  
    const isHomePage =
        location.pathname ===
        '/';

    const isGroceryPage =
        location.pathname ===
        '/grocery';

    const isGroceryCategoryPage =
        location.pathname.startsWith(
            '/grocery/category/',
        );

    const isMobileCompactPage =
        isHomePage ||
        isGroceryPage ||
        isGroceryCategoryPage;

    const workspacePath =
        location.pathname;

    const isCustomerWorkspaceRoute =
        workspacePath === '/dashboard' ||
        workspacePath === '/scan' ||
        workspacePath === '/cook-today' ||
        workspacePath === '/meal-plan' ||
        workspacePath === '/next-basket' ||
        workspacePath === '/waste-reduction' ||
        workspacePath === '/account/spending' ||
        workspacePath === '/account/profile' ||
        workspacePath === '/account/household' ||
        workspacePath === '/account/purchase-intelligence' ||
        workspacePath === '/account/learning' ||
        workspacePath === '/pantry' ||
        workspacePath.startsWith('/pantry/') ||
        workspacePath === '/orders' ||
        workspacePath.startsWith('/orders/') ||
        workspacePath.startsWith('/household-invitations/') ||
        (
            workspacePath === '/account/settings' &&
            customerEnabled === true &&
            superAdminEnabled !== true &&
            activeMode !== 'host'
        );

    const isHostWorkspaceRoute =
        workspacePath.startsWith('/host/') &&
        !workspacePath.startsWith('/host/hospitality');

    const isAdminWorkspaceRoute =
        (
            workspacePath === '/admin' ||
            workspacePath.startsWith('/admin/')
        ) &&
        workspacePath !== '/admin/privacy' &&
        workspacePath !== '/admin/observability';

    const isWorkspaceShellRoute =
        isCustomerWorkspaceRoute ||
        isHostWorkspaceRoute ||
        isAdminWorkspaceRoute;

    const isHeroGlassPage =
        [
            '/',
            '/grocery',
            '/brands',
            '/recipes',
        ].includes(
            location.pathname,
        );
  
    const searchParams =
        new URLSearchParams(
            location.search,
        );
  
    const currentQuery =
        searchParams.get(
            'q',
        ) ??
        '';
  
    const firstName =
        useMemo(
            () =>
                getFirstName(
                    user?.name,
                ),
            [
                user?.name,
            ],
        );

    const accountInitials =
        useMemo(
            () =>
                getInitials(
                    user?.name,
                ),
            [
                user?.name,
            ],
        );
  
    /*
    |--------------------------------------------------------------------------
    | Dashboard Destination
    |--------------------------------------------------------------------------
    |
    | Admin authority wins when a user also has another application capability.
    |
    | Admin authority wins for the dashboard shortcut. For Customer + Host
    | identities, activeMode only selects the dashboard experience; protected
    | routes still enforce the real backend capability independently.
    |--------------------------------------------------------------------------
    */
  
    const dashboardDestination =
        hasAdminAccess ||
        superAdminEnabled
            ? '/admin'
            : activeMode === 'host' && hostEnabled
                ? '/host/operations'
                : customerEnabled
                    ? '/dashboard'
                    : hostEnabled
                        ? '/host/operations'
                        : null;
  
    const dashboardTitle =
        hasAdminAccess ||
        superAdminEnabled
            ? 'Open administration dashboard'
            : dashboardDestination === '/host/operations'
                ? 'Open Host dashboard'
                : dashboardDestination === '/dashboard'
                    ? 'Open Customer dashboard'
                    : 'Signed in';

    const showUniversalBackButton =
        isAuthenticated &&
        ![
            '/',
            '/login',
            '/register',
        ].includes(
            location.pathname,
        );

    const accountRoleLabel =
        hasAdminAccess ||
        superAdminEnabled
            ? 'Super Admin'
            : activeMode === 'host' && hostEnabled
                ? 'Host'
                : 'Customer';

    const scanDestination =
        activeMode === 'host' && hostEnabled
            ? '/host/scan'
            : '/scan';

    const showCustomerCart =
        isAuthenticated &&
        customerEnabled &&
        !(activeMode === 'host' && hostEnabled) &&
        !hasAdminAccess &&
        !superAdminEnabled;

    const activeTrackingOrderId =
        activeTrackingOrder?.id ||
        activeTrackingOrder?._id ||
        null;

    const showMobileCartIcon =
        showCustomerCart &&
        cartNavigation.count > 0;

    const hasTrackableOrder =
        showCustomerCart &&
        Boolean(
            activeTrackingOrderId,
        );

    const showMobileTrackIcon =
        hasTrackableOrder &&
        !showMobileCartIcon;

    const showMobileNotificationIcon =
        isAuthenticated &&
        unreadNotificationCount > 0;

    useEffect(
        () => {
            function refreshCartNavigation() {
                setCartNavigation(
                    readNavbarCartNavigation(),
                );
            }

            function handleStorage(
                event,
            ) {
                if (
                    event.key === RECIPE_CART_PENDING_KEY ||
                    event.key === FLOATING_MARKETPLACE_CART_KEY
                ) {
                    refreshCartNavigation();
                }
            }

            window.addEventListener(
                FLOATING_CART_UPDATE_EVENT,
                refreshCartNavigation,
            );
            window.addEventListener(
                'storage',
                handleStorage,
            );

            refreshCartNavigation();

            return () => {
                window.removeEventListener(
                    FLOATING_CART_UPDATE_EVENT,
                    refreshCartNavigation,
                );
                window.removeEventListener(
                    'storage',
                    handleStorage,
                );
            };
        },
        [],
    );

    useEffect(
        () => {
            let cancelled =
                false;

            if (
                !isAuthenticated ||
                isBootstrapping
            ) {
                setActiveTrackingOrder(
                    null,
                );
                setUnreadNotificationCount(
                    0,
                );

                return undefined;
            }

            const refreshContextualActions =
                async () => {
                    const requests =
                        await Promise.allSettled([
                            showCustomerCart
                                ? listOrders({
                                      page: 1,
                                      limit: 10,
                                  })
                                : Promise.resolve({
                                      orders: [],
                                  }),
                            listNotifications({
                                limit: 100,
                            }),
                        ]);

                    if (cancelled) {
                        return;
                    }

                    const [
                        ordersResult,
                        notificationsResult,
                    ] =
                        requests;

                    if (
                        ordersResult.status ===
                        'fulfilled'
                    ) {
                        const orders =
                            Array.isArray(
                                ordersResult.value?.orders,
                            )
                                ? ordersResult.value.orders
                                : [];

                        const activeOrder =
                            orders.find(
                                (order) => {
                                    const status =
                                        String(
                                            order?.status ||
                                                '',
                                        )
                                            .trim()
                                            .toLowerCase();

                                    return (
                                        status &&
                                        !NON_TRACKABLE_ORDER_STATUSES.has(
                                            status,
                                        )
                                    );
                                },
                            ) || null;

                        setActiveTrackingOrder(
                            activeOrder,
                        );
                    } else if (
                        !showCustomerCart
                    ) {
                        setActiveTrackingOrder(
                            null,
                        );
                    }

                    if (
                        notificationsResult.status ===
                        'fulfilled'
                    ) {
                        const notifications =
                            Array.isArray(
                                notificationsResult.value
                                    ?.notifications,
                            )
                                ? notificationsResult.value
                                      .notifications
                                : [];

                        setUnreadNotificationCount(
                            notifications.filter(
                                (item) =>
                                    !item?.readAt &&
                                    UNREAD_NOTIFICATION_STATUSES.has(
                                        String(
                                            item?.status ||
                                                '',
                                        ).toLowerCase(),
                                    ),
                            ).length,
                        );
                    }
                };

            const handleVisibility =
                () => {
                    if (
                        document.visibilityState ===
                        'visible'
                    ) {
                        refreshContextualActions();
                    }
                };

            refreshContextualActions();

            const intervalId =
                window.setInterval(
                    refreshContextualActions,
                    45000,
                );

            window.addEventListener(
                'epantry:notifications-changed',
                refreshContextualActions,
            );
            window.addEventListener(
                FLOATING_CART_UPDATE_EVENT,
                refreshContextualActions,
            );
            document.addEventListener(
                'visibilitychange',
                handleVisibility,
            );

            return () => {
                cancelled =
                    true;

                window.clearInterval(
                    intervalId,
                );
                window.removeEventListener(
                    'epantry:notifications-changed',
                    refreshContextualActions,
                );
                window.removeEventListener(
                    FLOATING_CART_UPDATE_EVENT,
                    refreshContextualActions,
                );
                document.removeEventListener(
                    'visibilitychange',
                    handleVisibility,
                );
            };
        },
        [
            isAuthenticated,
            isBootstrapping,
            showCustomerCart,
            location.pathname,
        ],
    );
  
    useEffect(
        () => {
            setMenuOpen(
                false,
            );

            setAccountMenuOpen(
                false,
            );

            setMobileLocationOpen(
                false,
            );

            setMobileSearchOpen(
                false,
            );
        },
        [
            location.pathname,
            location.search,
        ],
    );

    useEffect(
        () => {
            if (!accountMenuOpen) {
                return undefined;
            }

            const handlePointerDown =
                (event) => {
                    if (
                        accountMenuRef.current &&
                        !accountMenuRef.current.contains(
                            event.target,
                        )
                    ) {
                        setAccountMenuOpen(
                            false,
                        );
                    }
                };

            const handleKeyDown =
                (event) => {
                    if (
                        event.key ===
                        'Escape'
                    ) {
                        setAccountMenuOpen(
                            false,
                        );
                    }
                };

            document.addEventListener(
                'pointerdown',
                handlePointerDown,
            );

            document.addEventListener(
                'keydown',
                handleKeyDown,
            );

            return () => {
                document.removeEventListener(
                    'pointerdown',
                    handlePointerDown,
                );

                document.removeEventListener(
                    'keydown',
                    handleKeyDown,
                );
            };
        },
        [
            accountMenuOpen,
        ],
    );
  
    useEffect(
        () => {
            if (
                !mobileLocationOpen &&
                !mobileSearchOpen
            ) {
                return undefined;
            }

            const handlePointerDown =
                (event) => {
                    if (
                        mobileUtilityRef.current &&
                        !mobileUtilityRef.current.contains(
                            event.target,
                        )
                    ) {
                        setMobileLocationOpen(
                            false,
                        );

                        setMobileSearchOpen(
                            false,
                        );
                    }
                };

            const handleKeyDown =
                (event) => {
                    if (
                        event.key ===
                        'Escape'
                    ) {
                        setMobileLocationOpen(
                            false,
                        );

                        setMobileSearchOpen(
                            false,
                        );
                    }
                };

            document.addEventListener(
                'pointerdown',
                handlePointerDown,
            );

            document.addEventListener(
                'keydown',
                handleKeyDown,
            );

            return () => {
                document.removeEventListener(
                    'pointerdown',
                    handlePointerDown,
                );

                document.removeEventListener(
                    'keydown',
                    handleKeyDown,
                );
            };
        },
        [
            mobileLocationOpen,
            mobileSearchOpen,
        ],
    );
  
    useEffect(
        () => {
            if (isAuthenticated) {
                setLogoutError(
                    '',
                );
            }
        },
        [
            isAuthenticated,
        ],
    );
  
    useEffect(
        () => {
            if (!isMobileCompactPage) {
                setMobileCompact(
                    false,
                );
  
                return undefined;
            }
  
            let frameId =
                null;

            const updateCompactState =
                () => {
                    frameId =
                        null;

                    if (isGroceryCategoryPage) {
                        const scrollY =
                            window.scrollY;

                        setMobileCompact(
                            (current) => {
                                const next =
                                    current
                                        ? scrollY > 28
                                        : scrollY > 72;

                                return next === current
                                    ? current
                                    : next;
                            },
                        );

                        return;
                    }

                    setMobileCompact(
                        window.scrollY >
                            MOBILE_COMPACT_SCROLL_Y,
                    );
                };

            const handleScroll =
                () => {
                    if (frameId !== null) {
                        return;
                    }

                    frameId =
                        window.requestAnimationFrame(
                            updateCompactState,
                        );
                };
  
            updateCompactState();
  
            window.addEventListener(
                'scroll',
                handleScroll,
                {
                    passive:
                        true,
                },
            );
  
            return () => {
                window.removeEventListener(
                    'scroll',
                    handleScroll,
                );

                if (frameId !== null) {
                    window.cancelAnimationFrame(
                        frameId,
                    );
                }
            };
        },
        [
            isMobileCompactPage,
            isGroceryCategoryPage,
        ],
    );
  
    const handleUniversalBack =
        () => {
            if (
                typeof window !== 'undefined' &&
                window.history.length > 1
            ) {
                navigate(
                    -1,
                );

                return;
            }

            navigate(
                dashboardDestination || '/',
                {
                    replace:
                        true,
                },
            );
        };

    const handleSearch =
        (
            query,
        ) => {
            const normalized =
                query.trim();
  
            if (!normalized) {
                return;
            }
  
            navigate(
                `/search?q=${encodeURIComponent(
                    normalized,
                )}`,
            );
  
            setMenuOpen(
                false,
            );
        };
  
    const handleLogout =
        async () => {
            if (isLoggingOut) {
                return;
            }
  
            setLogoutError(
                '',
            );
  
            try {
                await logout();
  
                setMenuOpen(
                    false,
                );

                setAccountMenuOpen(
                    false,
                );
  
                navigate(
                    '/',
                    {
                        replace:
                            true,
                    },
                );
            } catch (
                error
            ) {
                if (
                    error?.status ===
                    401
                ) {
                    setMenuOpen(
                        false,
                    );
  
                    navigate(
                        '/',
                        {
                            replace:
                                true,
                        },
                    );
  
                    return;
                }
  
                setLogoutError(
                    error?.message ||
                        'Unable to sign out. Please try again.',
                );
            }
        };
  
    const isActive =
        (
            path,
        ) => {
            if (
                path ===
                '/'
            ) {
                return (
                    location.pathname ===
                    '/'
                );
            }
  
            return location.pathname.startsWith(
                path,
            );
        };
  
    const getNavClasses =
        (
            path,
        ) => [
            'focus-ring',
            'flex',
            'h-9',
            'items-center',
            'justify-center',
            'rounded-full',
            'px-2.5',
            'text-xs',
            'font-bold',
            'transition',
  
            isActive(
                path,
            )
                ? 'bg-emerald-700 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950',
        ].join(
            ' ',
        );
  
    const brand = (
        <Link
            to="/"
            onClick={() =>
                setMenuOpen(
                    false,
                )
            }
            className="focus-ring inline-flex min-w-0 items-center gap-3 rounded-xl"
            aria-label="EPANTRY home"
        >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-sm font-black text-white shadow-sm">
                E
            </div>
  
            <div className="min-w-0">
                <p className="truncate text-lg font-black leading-none tracking-tight text-stone-950">
                    EPANTRY
                </p>
  
                <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">
                    Food Intelligence
                </p>
            </div>
        </Link>
    );
  
    const universalBackButton =
        showUniversalBackButton ? (
            <button
                type="button"
                onClick={
                    handleUniversalBack
                }
                className="focus-ring grid size-10 shrink-0 place-items-center rounded-full border border-stone-200 bg-white/90 text-stone-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                aria-label="Go to previous page"
                title="Previous page"
            >
                <ArrowLeft
                    size={18}
                    aria-hidden="true"
                />
            </button>
        ) : null;

    const brandCluster = (
        <div className="flex min-w-0 items-center gap-2">
            {universalBackButton}
            {brand}
        </div>
    );

    const customerCartButton =
        showCustomerCart ? (
            <Link
                to={cartNavigation.href}
                className="focus-ring relative grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                aria-label={
                    cartNavigation.count > 0
                        ? `Open cart with ${cartNavigation.count} item${cartNavigation.count === 1 ? '' : 's'}`
                        : 'Open cart'
                }
                title="Cart"
            >
                <ShoppingCart
                    size={16}
                    aria-hidden="true"
                />

                {cartNavigation.count > 0 ? (
                    <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-emerald-700 px-1 text-[9px] font-black leading-none text-white shadow-sm">
                        {cartNavigation.count > 99
                            ? '99+'
                            : cartNavigation.count}
                    </span>
                ) : null}
            </Link>
        ) : null;

    const desktopAccount =
        dashboardDestination ? (
            <Link
                to={
                    dashboardDestination
                }
                className="focus-ring flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100"
                title={
                    user?.email ||
                    dashboardTitle
                }
            >
                <UserRound
                    size={15}
                    className="shrink-0"
                    aria-hidden="true"
                />
  
                <span className="truncate">
                    Hi, {firstName}
                </span>
  
                <span
                    className="h-4 w-px shrink-0 bg-emerald-300"
                    aria-hidden="true"
                />
  
                <LayoutDashboard
                    size={14}
                    className="shrink-0"
                    aria-hidden="true"
                />
  
                <span className="shrink-0">
                    Dashboard
                </span>
            </Link>
        ) : (
            <div
                className="flex h-9 max-w-[140px] items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-900"
                title={
                    user?.email ||
                    'Signed in'
                }
            >
                <UserRound
                    size={15}
                    className="shrink-0"
                    aria-hidden="true"
                />
  
                <span className="truncate">
                    Hi, {firstName}
                </span>
            </div>
        );
  
    const desktopAuth =
        isBootstrapping ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-stone-200" />
        ) : isAuthenticated ? (
            <div className="flex items-center gap-1.5">
                <ModeSwitcher compact />
                {customerCartButton}
                <NotificationBell compact />
                {desktopAccount}
  
                <button
                    type="button"
                    onClick={
                        handleLogout
                    }
                    disabled={
                        isLoggingOut
                    }
                    className="focus-ring flex h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-black text-stone-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Sign out"
                >
                    {isLoggingOut ? (
                        <LoaderCircle
                            size={15}
                            className="animate-spin"
                            aria-hidden="true"
                        />
                    ) : (
                        <LogOut
                            size={15}
                            aria-hidden="true"
                        />
                    )}
  
                    <span>
                        {isLoggingOut
                            ? 'Signing out'
                            : 'Logout'}
                    </span>
                </button>
            </div>
        ) : (
            <div className="flex items-center gap-1.5">
                <Link
                    to="/login"
                    className="focus-ring flex h-9 items-center justify-center rounded-full px-3 text-xs font-black text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 xl:border xl:border-stone-300 xl:bg-white xl:px-3.5 xl:shadow-sm xl:hover:border-stone-400"
                >
                    Login
                </Link>
  
                <Link
                    to="/register"
                    className="focus-ring flex h-9 items-center justify-center rounded-full bg-stone-950 px-3.5 text-xs font-black text-white transition hover:bg-stone-800"
                >
                    Register
                </Link>
            </div>
        );
  
    const wideDesktopAuth =
        isBootstrapping ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-stone-200" />
        ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
                {customerCartButton}
                <NotificationBell compact />

                <div
                    ref={accountMenuRef}
                    className="relative"
                >
                    <button
                        type="button"
                        onClick={() =>
                            setAccountMenuOpen(
                                (value) =>
                                    !value,
                            )
                        }
                        className={[
                            'focus-ring',
                            'flex',
                            'h-10',
                            'items-center',
                            'gap-2',
                            'rounded-full',
                            'border',
                            'px-2',
                            'pr-3',
                            'text-left',
                            'transition',
                            accountMenuOpen
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-stone-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/60',
                        ].join(
                            ' ',
                        )}
                        aria-haspopup="menu"
                        aria-expanded={accountMenuOpen}
                        aria-label="Open account menu"
                    >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-[11px] font-black text-white shadow-sm">
                            {accountInitials}
                        </span>

                        <span className="min-w-0">
                            <span className="block max-w-[92px] truncate text-xs font-black leading-none text-stone-950">
                                {firstName}
                            </span>

                            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-stone-500">
                                {accountRoleLabel}
                            </span>
                        </span>

                        <ChevronDown
                            size={14}
                            className={[
                                'shrink-0',
                                'text-stone-400',
                                'transition-transform',
                                accountMenuOpen
                                    ? 'rotate-180'
                                    : '',
                            ].join(
                                ' ',
                            )}
                            aria-hidden="true"
                        />
                    </button>

                    <AnimatePresence>
                        {accountMenuOpen && (
                            <motion.div
                                initial={{
                                    opacity:
                                        0,

                                    y:
                                        -6,

                                    scale:
                                        0.98,
                                }}
                                animate={{
                                    opacity:
                                        1,

                                    y:
                                        0,

                                    scale:
                                        1,
                                }}
                                exit={{
                                    opacity:
                                        0,

                                    y:
                                        -6,

                                    scale:
                                        0.98,
                                }}
                                transition={{
                                    duration:
                                        0.15,
                                }}
                                className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[300px] overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-2xl"
                                role="menu"
                                aria-label="Account navigation"
                            >
                                <div className="border-b border-stone-100 bg-[#F8FAF7] p-4">
                                    <div className="flex items-center gap-3">
                                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-black text-white">
                                            {accountInitials}
                                        </span>

                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-stone-950">
                                                {user?.name || 'EPANTRY Account'}
                                            </p>

                                            <p className="mt-1 truncate text-[11px] font-medium text-stone-500">
                                                {user?.email || accountRoleLabel}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-800 ring-1 ring-emerald-100">
                                        {accountRoleLabel}
                                    </div>
                                </div>

                                <div className="p-2">
                                    {dashboardDestination ? (
                                        <Link
                                            to={dashboardDestination}
                                            onClick={() =>
                                                setAccountMenuOpen(
                                                    false,
                                                )
                                            }
                                            className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                                            role="menuitem"
                                        >
                                            <LayoutDashboard
                                                size={17}
                                                className="text-emerald-700"
                                                aria-hidden="true"
                                            />
                                            Dashboard
                                        </Link>
                                    ) : null}

                                    <Link
                                        to="/community"
                                        onClick={() =>
                                            setAccountMenuOpen(
                                                false,
                                            )
                                        }
                                        className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                                        role="menuitem"
                                    >
                                        <UsersRound
                                            size={17}
                                            className="text-stone-500"
                                            aria-hidden="true"
                                        />
                                        Community
                                    </Link>

                                    <Link
                                        to="/learn"
                                        onClick={() =>
                                            setAccountMenuOpen(
                                                false,
                                            )
                                        }
                                        className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                                        role="menuitem"
                                    >
                                        <BookOpen
                                            size={17}
                                            className="text-stone-500"
                                            aria-hidden="true"
                                        />
                                        Learn
                                    </Link>

                                    {!hasAdminAccess && !superAdminEnabled ? (
                                        <Link
                                            to={scanDestination}
                                            onClick={() =>
                                                setAccountMenuOpen(
                                                    false,
                                                )
                                            }
                                            className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                                            role="menuitem"
                                        >
                                            <ScanLine
                                                size={17}
                                                className="text-stone-500"
                                                aria-hidden="true"
                                            />
                                            Scan
                                        </Link>
                                    ) : null}

                                    <Link
                                        to="/about"
                                        onClick={() =>
                                            setAccountMenuOpen(
                                                false,
                                            )
                                        }
                                        className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                                        role="menuitem"
                                    >
                                        <Info
                                            size={17}
                                            className="text-stone-500"
                                            aria-hidden="true"
                                        />
                                        About EPANTRY
                                    </Link>

                                    <Link
                                        to="/account/settings"
                                        onClick={() =>
                                            setAccountMenuOpen(
                                                false,
                                            )
                                        }
                                        className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
                                        role="menuitem"
                                    >
                                        <Settings
                                            size={17}
                                            className="text-stone-500"
                                            aria-hidden="true"
                                        />
                                        Account Settings
                                    </Link>
                                </div>

                                {!hasAdminAccess && !superAdminEnabled ? (
                                    <div className="border-t border-stone-100 px-3 py-3">
                                        <ModeSwitcher compact />
                                    </div>
                                ) : null}

                                <div className="border-t border-stone-100 p-2">
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        disabled={isLoggingOut}
                                        className="focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        role="menuitem"
                                    >
                                        {isLoggingOut ? (
                                            <LoaderCircle
                                                size={17}
                                                className="animate-spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <LogOut
                                                size={17}
                                                aria-hidden="true"
                                            />
                                        )}

                                        {isLoggingOut
                                            ? 'Signing out'
                                            : 'Logout'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        ) : (
            desktopAuth
        );

    const mobileAccount =
        dashboardDestination ? (
            <Link
                to={
                    dashboardDestination
                }
                className="focus-ring flex min-h-9 w-full items-center gap-2 border-b border-stone-300/35 px-1 text-[10px] font-black text-stone-800 transition hover:text-emerald-800 md:min-h-11 md:justify-center md:rounded-2xl md:border md:border-white/85 md:bg-white/58 md:px-3 md:text-xs md:text-emerald-950 md:shadow-sm md:backdrop-blur-xl md:hover:bg-white/78"
                title={
                    user?.email ||
                    dashboardTitle
                }
            >
                <UserRound
                    size={14}
                    className="shrink-0"
                    aria-hidden="true"
                />
  
                <span className="min-w-0 flex-1 truncate md:flex-none">
                    Dashboard
                </span>
  
                <LayoutDashboard
                    size={13}
                    className="shrink-0"
                    aria-hidden="true"
                />
            </Link>
        ) : (
            <div
                className="flex min-h-9 w-full items-center gap-2 border-b border-stone-300/35 px-1 text-[10px] font-black text-stone-800 md:min-h-11 md:justify-center md:rounded-2xl md:border md:border-white/85 md:bg-white/58 md:px-3 md:text-xs md:text-emerald-950 md:shadow-sm md:backdrop-blur-xl"
                title={
                    user?.email ||
                    'Signed in'
                }
            >
                <UserRound
                    size={14}
                    aria-hidden="true"
                />
  
                <span className="min-w-0 flex-1 truncate md:flex-none">
                    Hi, {firstName}
                </span>
            </div>
        );

    const mobileUtilityIconClass =
        'focus-ring relative grid size-8 shrink-0 place-items-center rounded-[11px] border border-white/95 bg-white/72 text-stone-700 shadow-[0_7px_18px_rgba(28,25,23,0.12)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/95 hover:text-stone-950';

    const mobileMenuUtilities =
        isAuthenticated ? (
            <div className="flex min-h-10 w-full items-center justify-between gap-1.5 border-b border-stone-300/35 px-0.5 py-1.5">
                <button
                    type="button"
                    onClick={() => {
                        setMenuOpen(false);
                        setMobileSearchOpen(false);
                        setMobileLocationOpen(true);
                    }}
                    className={mobileUtilityIconClass}
                    aria-label="Choose location"
                    title="Location"
                >
                    <MapPin
                        size={15}
                        strokeWidth={2.1}
                        aria-hidden="true"
                    />
                </button>

                <Link
                    to={cartNavigation.href}
                    onClick={() => {
                        setMenuOpen(false);
                        setMobileLocationOpen(false);
                        setMobileSearchOpen(false);
                    }}
                    className={mobileUtilityIconClass}
                    aria-label={
                        cartNavigation.count > 0
                            ? `Open cart with ${cartNavigation.count} item${cartNavigation.count === 1 ? '' : 's'}`
                            : 'Open cart'
                    }
                    title="Cart"
                >
                    <ShoppingCart
                        size={15}
                        strokeWidth={2.1}
                        aria-hidden="true"
                    />

                    {cartNavigation.count > 0 ? (
                        <span className="absolute -right-1 -top-1 grid min-h-3.5 min-w-3.5 place-items-center rounded-full bg-emerald-700 px-0.5 text-[7px] font-black leading-none text-white shadow-sm">
                            {cartNavigation.count > 99
                                ? '99+'
                                : cartNavigation.count}
                        </span>
                    ) : null}
                </Link>

                <Link
                    to="/notifications"
                    onClick={() => {
                        setMenuOpen(false);
                        setMobileLocationOpen(false);
                        setMobileSearchOpen(false);
                    }}
                    className={mobileUtilityIconClass}
                    aria-label={
                        unreadNotificationCount > 0
                            ? `Notifications, ${unreadNotificationCount} unread`
                            : 'Notifications'
                    }
                    title="Notifications"
                >
                    <Bell
                        size={15}
                        strokeWidth={2.1}
                        aria-hidden="true"
                    />

                    {unreadNotificationCount > 0 ? (
                        <span className="absolute -right-1 -top-1 grid min-h-3.5 min-w-3.5 place-items-center rounded-full bg-red-600 px-0.5 text-[7px] font-black leading-none text-white shadow-sm">
                            {unreadNotificationCount > 99
                                ? '99+'
                                : unreadNotificationCount}
                        </span>
                    ) : null}
                </Link>

                <Link
                    to={
                        hasTrackableOrder
                            ? `/orders/${encodeURIComponent(
                                String(activeTrackingOrderId),
                            )}`
                            : '/orders'
                    }
                    onClick={() => {
                        setMenuOpen(false);
                        setMobileLocationOpen(false);
                        setMobileSearchOpen(false);
                    }}
                    className={mobileUtilityIconClass}
                    aria-label={
                        hasTrackableOrder
                            ? 'Track current order'
                            : 'Open orders and delivery'
                    }
                    title={
                        hasTrackableOrder
                            ? 'Track order'
                            : 'Orders & delivery'
                    }
                >
                    <Truck
                        size={15}
                        strokeWidth={2.1}
                        aria-hidden="true"
                    />
                </Link>
            </div>
        ) : null;
  
    const mobileAuth =
        isBootstrapping ? (
            <div className="h-10 w-full animate-pulse rounded-xl bg-white/50 backdrop-blur-xl" />
        ) : isAuthenticated ? (
            <>
                {mobileAccount}

                <div className="flex min-h-10 w-full items-center justify-center border-b border-stone-300/35 py-1 md:rounded-xl md:border md:border-white/85 md:bg-white/52 md:px-1.5 md:shadow-sm md:backdrop-blur-2xl">
                    <ModeSwitcher compact />
                </div>

                {mobileMenuUtilities}
  
                <button
                    type="button"
                    onClick={
                        handleLogout
                    }
                    disabled={
                        isLoggingOut
                    }
                    className="focus-ring flex min-h-9 w-full items-center justify-start gap-2 px-1 text-[10px] font-black text-red-700 transition hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-11 md:justify-center md:rounded-2xl md:border md:border-red-200/70 md:bg-red-50/72 md:px-3 md:text-xs md:shadow-sm md:backdrop-blur-xl md:hover:bg-red-50/90"
                >
                    {isLoggingOut ? (
                        <LoaderCircle
                            size={14}
                            className="animate-spin"
                            aria-hidden="true"
                        />
                    ) : (
                        <LogOut
                            size={14}
                            aria-hidden="true"
                        />
                    )}
  
                    {isLoggingOut
                        ? 'Signing out'
                        : 'Logout'}
                </button>
            </>
        ) : (
            <>
                <Link
                    to="/login"
                    className={
                        getNavClasses(
                            '/login',
                        )
                    }
                >
                    Login
                </Link>
  
                <Link
                    to="/register"
                    className={
                        getNavClasses(
                            '/register',
                        )
                    }
                >
                    Register
                </Link>
            </>
        );
  
    return (
        <header
            className={[
                'top-0',
                'z-50',
                'border-b',
                'border-stone-200/60',
                'backdrop-blur-xl',
                'transition-all',
                'duration-200',

                isWorkspaceShellRoute
                    ? 'hidden lg:block'
                    : '',
  
                isHeroGlassPage
                    ? 'fixed left-0 right-0 w-full border-white/35 bg-white/30 shadow-[0_8px_30px_rgba(17,24,39,0.06)] backdrop-blur-2xl'
                    : 'sticky bg-[#f7f5ef]/95',
            ].join(
                ' ',
            )}
        >
            <div className="page-shell">
                <div className="hidden xl:block">
                    <div className="flex min-h-[72px] items-center gap-3 py-3">
                        <div className="shrink-0">
                            {brandCluster}
                        </div>
  
                        <nav
                            className="flex shrink-0 items-center gap-1"
                            aria-label="Primary navigation"
                        >
                            {navItems
                                .filter((item) =>
                                    [
                                        '/',
                                        '/grocery',
                                        '/brands',
                                        '/recipes',
                                    ].includes(
                                        item.to,
                                    ),
                                )
                                .map(
                                    (
                                        item,
                                    ) => (
                                        <Link
                                            key={
                                                item.to
                                            }
                                            to={
                                                item.to
                                            }
                                            className={
                                                getNavClasses(
                                                    item.to,
                                                )
                                            }
                                        >
                                            {
                                                item.label
                                            }
                                        </Link>
                                    ),
                                )}
  
                            {!isAuthenticated ? (
                                <Link
                                    to="/about"
                                    className={
                                        getNavClasses(
                                            '/about',
                                        )
                                    }
                                >
                                    About
                                </Link>
                            ) : null}
                        </nav>
  
                        <div className="w-[190px] shrink-0">
                            <NavbarLocationStatus />
                        </div>
  
                        <div className="min-w-[220px] flex-1">
                            <SearchBar
                                value={
                                    currentQuery
                                }
                                onSubmit={
                                    handleSearch
                                }
                                compact
                            />
                        </div>
  
                        <div className="shrink-0">
                            {wideDesktopAuth}
                        </div>
                    </div>
                </div>
  
                <div className="hidden py-3 md:block xl:hidden">
                    <div className="flex min-h-[52px] items-center justify-between gap-4">
                        {brandCluster}
  
                        <nav
                            className="hidden items-center gap-1 lg:flex"
                            aria-label="Primary navigation"
                        >
                            {navItems.map(
                                (
                                    item,
                                ) => (
                                    <Link
                                        key={
                                            item.to
                                        }
                                        to={
                                            item.to
                                        }
                                        className={
                                            getNavClasses(
                                                item.to,
                                            )
                                        }
                                    >
                                        {
                                            item.label
                                        }
                                    </Link>
                                ),
                            )}
  
                            <div className="ml-1">
                                {desktopAuth}
                            </div>
                        </nav>
  
                        <button
                            type="button"
                            onClick={() =>
                                setMenuOpen(
                                    (
                                        value,
                                    ) =>
                                        !value,
                                )
                            }
                            className="focus-ring ml-auto grid size-11 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 lg:hidden"
                            aria-expanded={
                                menuOpen
                            }
                            aria-label={
                                menuOpen
                                    ? 'Close menu'
                                    : 'Open menu'
                            }
                        >
                            {menuOpen ? (
                                <X
                                    size={20}
                                    aria-hidden="true"
                                />
                            ) : (
                                <Menu
                                    size={20}
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    </div>
  
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <NavbarLocationStatus />
  
                        <SearchBar
                            value={
                                currentQuery
                            }
                            onSubmit={
                                handleSearch
                            }
                            compact
                        />
                    </div>
                </div>
  
                <div
                    ref={mobileUtilityRef}
                    className="relative md:hidden"
                >
                    <motion.div
                        initial={false}
                        animate={{
                            height:
                                mobileCompact && isMobileCompactPage
                                    ? 56
                                    : 64,
                        }}
                        transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                        className="flex w-full items-center"
                    >
                        <Link
                            to="/"
                            onClick={() => {
                                setMenuOpen(false);
                                setMobileLocationOpen(false);
                                setMobileSearchOpen(false);
                            }}
                            className="focus-ring flex shrink-0 items-center gap-1.5 rounded-[15px]"
                            aria-label="EPANTRY home"
                        >
                            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-emerald-700 text-[13px] font-black text-white shadow-[0_8px_20px_rgba(4,120,87,0.24)] ring-1 ring-white/35">
                                E
                            </span>

                            <span className="text-[10px] font-black tracking-[0.04em] text-stone-900">
                                EPANTRY
                            </span>
                        </Link>

                        <div className="ml-auto flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileLocationOpen((value) => !value);
                                    setMobileSearchOpen(false);
                                    setMenuOpen(false);
                                }}
                                className={[
                                    'focus-ring grid size-9 shrink-0 place-items-center rounded-[14px] border shadow-[0_7px_18px_rgba(28,25,23,0.10)] backdrop-blur-xl transition',
                                    mobileLocationOpen
                                        ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800'
                                        : 'border-white/75 bg-white/58 text-stone-700 hover:bg-white/80 hover:text-stone-950',
                                ].join(' ')}
                                aria-label="Choose location"
                                aria-expanded={mobileLocationOpen}
                            >
                                <MapPin
                                    size={17}
                                    strokeWidth={2.15}
                                    aria-hidden="true"
                                />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setMobileSearchOpen((value) => !value);
                                    setMobileLocationOpen(false);
                                    setMenuOpen(false);
                                }}
                                className={[
                                    'focus-ring grid size-9 shrink-0 place-items-center rounded-[14px] border shadow-[0_7px_18px_rgba(28,25,23,0.10)] backdrop-blur-xl transition',
                                    mobileSearchOpen
                                        ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800'
                                        : 'border-white/75 bg-white/58 text-stone-700 hover:bg-white/80 hover:text-stone-950',
                                ].join(' ')}
                                aria-label="Search EPANTRY"
                                aria-expanded={mobileSearchOpen}
                            >
                                <Search
                                    size={17}
                                    strokeWidth={2.15}
                                    aria-hidden="true"
                                />
                            </button>

                            {showMobileCartIcon ? (
                                <Link
                                    to={cartNavigation.href}
                                    onClick={() => {
                                        setMobileLocationOpen(false);
                                        setMobileSearchOpen(false);
                                        setMenuOpen(false);
                                    }}
                                    className="focus-ring relative grid size-9 shrink-0 place-items-center rounded-[14px] border border-white/75 bg-white/58 text-stone-700 shadow-[0_7px_18px_rgba(28,25,23,0.10)] backdrop-blur-xl transition hover:bg-white/80 hover:text-stone-950"
                                    aria-label={`Open cart with ${cartNavigation.count} item${cartNavigation.count === 1 ? '' : 's'}`}
                                    title="Cart"
                                >
                                    <ShoppingCart
                                        size={17}
                                        strokeWidth={2.1}
                                        aria-hidden="true"
                                    />

                                    <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-emerald-700 px-1 text-[8px] font-black leading-none text-white shadow-sm">
                                        {cartNavigation.count > 99
                                            ? '99+'
                                            : cartNavigation.count}
                                    </span>
                                </Link>
                            ) : showMobileTrackIcon ? (
                                <Link
                                    to={`/orders/${encodeURIComponent(
                                        String(
                                            activeTrackingOrderId,
                                        ),
                                    )}`}
                                    onClick={() => {
                                        setMobileLocationOpen(false);
                                        setMobileSearchOpen(false);
                                        setMenuOpen(false);
                                    }}
                                    className="focus-ring grid size-9 shrink-0 place-items-center rounded-[14px] border border-white/75 bg-white/58 text-stone-700 shadow-[0_7px_18px_rgba(28,25,23,0.10)] backdrop-blur-xl transition hover:bg-white/80 hover:text-stone-950"
                                    aria-label="Track current order"
                                    title="Track order"
                                >
                                    <Truck
                                        size={17}
                                        strokeWidth={2.1}
                                        aria-hidden="true"
                                    />
                                </Link>
                            ) : null}

                            {showMobileNotificationIcon ? (
                                <Link
                                    to="/notifications"
                                    onClick={() => {
                                        setMobileLocationOpen(false);
                                        setMobileSearchOpen(false);
                                        setMenuOpen(false);
                                    }}
                                    className="focus-ring relative grid size-9 shrink-0 place-items-center rounded-[14px] border border-white/75 bg-white/58 text-stone-700 shadow-[0_7px_18px_rgba(28,25,23,0.10)] backdrop-blur-xl transition hover:bg-white/80 hover:text-stone-950"
                                    aria-label={`Notifications, ${unreadNotificationCount} unread`}
                                    title="Notifications"
                                >
                                    <Bell
                                        size={17}
                                        strokeWidth={2.1}
                                        aria-hidden="true"
                                    />

                                    <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[8px] font-black leading-none text-white shadow-sm">
                                        {unreadNotificationCount > 99
                                            ? '99+'
                                            : unreadNotificationCount}
                                    </span>
                                </Link>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen((value) => !value);
                                    setMobileLocationOpen(false);
                                    setMobileSearchOpen(false);
                                }}
                                className={[
                                    'focus-ring grid size-9 shrink-0 place-items-center rounded-[14px] border shadow-[0_7px_18px_rgba(28,25,23,0.10)] backdrop-blur-xl transition',
                                    menuOpen
                                        ? 'border-stone-300/80 bg-stone-950 text-white'
                                        : 'border-white/75 bg-white/58 text-stone-700 hover:bg-white/80 hover:text-stone-950',
                                ].join(' ')}
                                aria-expanded={menuOpen}
                                aria-label={
                                    menuOpen
                                        ? 'Close menu'
                                        : 'Open menu'
                                }
                            >
                                {menuOpen ? (
                                    <X
                                        size={17}
                                        strokeWidth={2.1}
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Menu
                                        size={18}
                                        strokeWidth={2.1}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        </div>
                    </motion.div>

                    <AnimatePresence>
                        {mobileLocationOpen ? (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.985 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -5, scale: 0.99 }}
                                transition={{
                                    duration: 0.18,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                className="absolute left-0 right-0 top-[calc(100%+7px)] z-[78] rounded-[22px] border border-white/75 bg-white/62 p-2 shadow-[0_18px_45px_rgba(28,25,23,0.15)] backdrop-blur-2xl"
                            >
                                <NavbarLocationStatus />
                            </motion.div>
                        ) : null}
                    </AnimatePresence>

                    <AnimatePresence>
                        {mobileSearchOpen ? (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.985 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -5, scale: 0.99 }}
                                transition={{
                                    duration: 0.18,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                className="absolute left-0 right-0 top-[calc(100%+7px)] z-[78] rounded-[22px] border border-white/75 bg-white/62 p-2 shadow-[0_18px_45px_rgba(28,25,23,0.15)] backdrop-blur-2xl"
                            >
                                <SearchBar
                                    value={currentQuery}
                                    onSubmit={handleSearch}
                                    compact
                                />
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
  
                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{
                                opacity:
                                    0,

                                y:
                                    -10,

                                scale:
                                    0.985,
                            }}
                            animate={{
                                opacity:
                                    1,

                                y:
                                    0,

                                scale:
                                    1,
                            }}
                            exit={{
                                opacity:
                                    0,

                                y:
                                    -8,

                                scale:
                                    0.99,
                            }}
                            transition={{
                                duration:
                                    0.22,

                                ease: [
                                    0.22,
                                    1,
                                    0.36,
                                    1,
                                ],
                            }}
                            className="absolute right-2 top-[calc(100%+8px)] z-[80] w-[48vw] min-w-[168px] max-w-[220px] overflow-hidden rounded-[24px] border border-white/90 bg-white/88 shadow-[0_26px_72px_rgba(28,25,23,0.24)] backdrop-blur-[42px] saturate-150 lg:hidden md:static md:mx-0 md:mt-0 md:w-auto md:min-w-0 md:max-w-none md:rounded-none md:border-t md:border-stone-200/60 md:bg-transparent md:shadow-none md:backdrop-blur-none md:saturate-100"
                        >
                            <nav
                                className="flex max-h-[calc(100svh-110px)] flex-col gap-1.5 overflow-y-auto p-2.5 md:grid md:max-h-none md:grid-cols-3 md:gap-2 md:overflow-visible md:p-3 md:py-3"
                                aria-label="Mobile navigation"
                            >
                                {navItems.map(
                                    (
                                        item,
                                        index,
                                    ) => (
                                        <Link
                                            key={
                                                item.to
                                            }
                                            to={
                                                item.to
                                            }
                                            className={[
                                                'focus-ring',
                                                'relative',
                                                'flex',
                                                'min-h-8',
                                                'items-center',
                                                'justify-start',
                                                'border-b',
                                                'border-stone-300/35',
                                                'px-1',
                                                'text-[10px]',
                                                'font-black',
                                                'tracking-[0.01em]',
                                                'md:min-h-11',
                                                'md:justify-center',
                                                'md:rounded-2xl',
                                                'md:border',
                                                'md:px-3',
                                                'md:text-xs',
                                                'md:shadow-sm',
                                                'md:backdrop-blur-md',
                                                'transition',
                                                index ===
                                                navItems.length - 1 &&
                                                navItems.length % 2 === 1
                                                    ? 'md:col-span-1'
                                                    : '',
                                                isActive(
                                                    item.to,
                                                )
                                                    ? 'border-emerald-700/35 text-emerald-800 md:border-emerald-700/15 md:bg-emerald-700 md:text-white'
                                                    : 'text-stone-700 hover:text-stone-950 md:border-white/70 md:bg-white/35 md:hover:bg-white/60',
                                            ].join(
                                                ' ',
                                            )}
                                        >
                                            {
                                                item.label
                                            }
                                        </Link>
                                    ),
                                )}

                                <div className="my-1 h-px w-full bg-gradient-to-r from-transparent via-stone-400/55 to-transparent md:col-span-3" />

                                {mobileAuth}
                            </nav>
                        </motion.div>
                    )}
                </AnimatePresence>
  
                {logoutError && (
                    <div
                        className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
                        role="alert"
                    >
                        <CircleAlert
                            size={15}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                        />
  
                        <span className="min-w-0 flex-1 leading-5">
                            {
                                logoutError
                            }
                        </span>
  
                        <button
                            type="button"
                            onClick={() =>
                                setLogoutError(
                                    '',
                                )
                            }
                            className="focus-ring grid size-6 shrink-0 place-items-center rounded-lg text-red-700 transition hover:bg-red-100"
                            aria-label="Dismiss sign out error"
                        >
                            <X
                                size={14}
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
  }