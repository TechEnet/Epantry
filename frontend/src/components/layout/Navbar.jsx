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
    Leaf,
    Search,
    ScanLine,
    Settings,
    ShoppingCart,
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
  
  
  import {
    useAdmin,
  } from '../../features/admin/context/AdminContext';
  
  import {
    useAuth,
  } from '../../features/auth/context/AuthContext';
  
  import NavbarLocationStatus from '../../features/location/components/NavbarLocationStatus';
  import { useLocationStore } from '../../features/location/store/location.store';
  import ModeSwitcher from '../../features/auth/components/ModeSwitcher';
  import NotificationBell from '../../features/notifications/components/NotificationBell';

  import {
    isHostPathAllowed,
    normalizeHostWorkspaceType,
  } from '../../features/host/hostWorkspace.config';

  import {
    getOrder,
    listOrders,
    getMarketplaceCartDeliveryEta,
  } from '../../features/commerce/services/commerce.service';

  import {
    listHeaderNotifications,
  } from '../../features/analytics/services/analytics.service';

  import {
    getSearchErrorMessage,
    runSmartSearch,
  } from '../../features/search/services/search.service';
  
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

  // Actual ParentOrder.status values (backend commerce.transaction.models.js).
  // Payment-pending and completed/cancelled orders are not active deliveries.
  const ACTIVE_DELIVERY_STATUSES = new Set([
    'confirmed',
    'partially_unavailable',
    'delivery_failed', // Keep visible so the customer can open the order for help.
  ]);

  function isActiveCustomerDelivery(order) {
    const id = order?.id || order?._id;
    const status = String(order?.status || '').trim().toLowerCase();
    return Boolean(id) && ACTIVE_DELIVERY_STATUSES.has(status);
  }

  function displayDeliveryStatus(order) {
    const normalized = String(order?.status || '').trim().toLowerCase();
    if (normalized === 'delivery_failed') return 'Delivery needs attention';
    if (normalized === 'partially_unavailable') return 'Items need attention';
    const sellerStatuses = (Array.isArray(order?.sellerProgress) ? order.sellerProgress : [])
      .map((seller) => String(seller?.status || '').trim().toLowerCase());
    if (sellerStatuses.includes('out_for_delivery')) return 'Out for delivery';
    if (sellerStatuses.includes('carrier_handoff')) return 'Handed to carrier';
    if (sellerStatuses.includes('packed')) return 'Packed';
    if (sellerStatuses.includes('picking')) return 'Being prepared';
    return 'Order in progress';
  }

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
    const recipeCart = readSessionJson(RECIPE_CART_PENDING_KEY);
    const marketplaceCart = readSessionJson(FLOATING_MARKETPLACE_CART_KEY);
    const recipeItems = Array.isArray(recipeCart?.items) ? recipeCart.items : [];
    const marketplaceItems = Array.isArray(marketplaceCart?.items) ? marketplaceCart.items : [];
    const groceryPackCount = marketplaceItems.reduce(
      (sum, item) => sum + Math.max(1, Number(item?.quantity || 1)),
      0,
    );

    return {
      href: '/cart/recipe',
      count: recipeItems.length + groceryPackCount,
    };
  }

  const BASE_NAV_ITEMS = [
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
            'About',

        to:
            '/about',
    },
  ];
  
  const HOST_NAV_ITEMS = [
    {
        label:
            'Dashboard',

        to:
            '/host/operations',
    },

    {
        label:
            'Catalog',

        to:
            '/host/catalog',
    },

    {
        label:
            'Create Listing',

        to:
            '/host/listings',
    },

    {
        label:
            'Hospitality',

        to:
            '/host/hospitality',
    },

    {
        label:
            'Orders',

        to:
            '/host/orders',
    },

    {
        label:
            'Analytics',

        to:
            '/host/analytics',
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
  
  // Assets live in frontend/public/Hamburger (served at /Hamburger/).
  const MENU_ICON_IMAGES = [
    '/Hamburger/1.webp',
    '/Hamburger/2.svg',
    '/Hamburger/3.webp',
    '/Hamburger/4.svg',
    '/Hamburger/5.webp',
  ];

  // Curated search prompts, not search results. Selecting one runs normal EPANTRY search.
  const NAVBAR_SEARCH_IDEAS = [
    { query: 'Butter Chicken', kind: 'Recipe' },
    { query: 'Alphonso Mango', kind: 'Grocery' },
    { query: 'Palak Paneer', kind: 'Recipe' },
    { query: 'Fresh Broccoli', kind: 'Grocery' },
    { query: 'Thai Green Curry', kind: 'Recipe' },
    { query: 'Rolled Oats', kind: 'Grocery' },
  ];

  export default function Navbar() {
    const setDeliveryContext =
        useLocationStore(
            (state) => state.setDeliveryContext,
        );

    const clearDeliveryContext =
        useLocationStore(
            (state) => state.clearDeliveryContext,
        );

    const storedDeliveryContext =
        useLocationStore(
            (state) => state.deliveryContext,
        );
    const [menuIconIndex, setMenuIconIndex] = useState(0);

    const [
        menuOpen,
        setMenuOpen,
    ] =
        useState(false);

    // Fade up to the next symbol every 3 seconds. Pause when menu is open.
    useEffect(() => {
        if (menuOpen) return undefined;
        const intervalId = window.setInterval(() => {
            setMenuIconIndex((current) => (current + 1) % MENU_ICON_IMAGES.length);
        }, 3000);
        return () => window.clearInterval(intervalId);
    }, [menuOpen]);

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
        navbarSearchLoading,
        setNavbarSearchLoading,
    ] =
        useState(false);

    const [
        navbarSearchResults,
        setNavbarSearchResults,
    ] =
        useState([]);

    const [
        navbarSearchMessage,
        setNavbarSearchMessage,
    ] =
        useState('');

    const [
        navbarSearchQuery,
        setNavbarSearchQuery,
    ] =
        useState('');

    const [
        navbarSearchResultsOpen,
        setNavbarSearchResultsOpen,
    ] =
        useState(false);

    const [
        accountMenuOpen,
        setAccountMenuOpen,
    ] =
        useState(false);

    const accountMenuRef =
        useRef(null);

    const [accountActiveTab, setAccountActiveTab] = useState('explore');

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
    ] = useState(null);

    // All current customer deliveries (not only the first order).
    const [activeDeliveryOrders, setActiveDeliveryOrders] = useState([]);
    const [deliveryPopoverOpen, setDeliveryPopoverOpen] = useState(false);
    const deliveryPopoverRef = useRef(null);

    const [
        unreadNotificationCount,
        setUnreadNotificationCount,
    ] =
        useState(0);
  
    const location =
        useLocation();
  
    // A two-pixel reading-progress line stays attached to the navbar.
    // Ref-only DOM updates avoid rerendering the large navbar on every scroll.
    const landingProgressRef = useRef(null);
    useEffect(() => {
        if (typeof window === 'undefined' || window.location.pathname !== '/') return undefined;
        let scheduled = false;
        const update = () => {
            scheduled = false;
            const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const ratio = maxScroll ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
            if (landingProgressRef.current) {
                landingProgressRef.current.style.transform = `scaleX(${ratio})`;
            }
        };
        const requestUpdate = () => {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        window.addEventListener('load', requestUpdate);
        return () => {
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
            window.removeEventListener('load', requestUpdate);
        };
    }, [location.pathname]);

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
  
    const retailMediaPreview =
        typeof window !== 'undefined' &&
        window.self !== window.top &&
        new URLSearchParams(location.search).get('retailMediaPreview') === '1';

    const isHostPresentation =
        activeMode === 'host' &&
        hostEnabled === true &&
        !retailMediaPreview;

    const hostWorkspaceType =
        normalizeHostWorkspaceType(
            user,
        );

    // Host access never removes public browsing. The public catalogue is
    // readable in every mode; customer-only actions remain protected by routes.
    const isOnHostWorkspace =
        location.pathname === '/host' ||
        location.pathname.startsWith('/host/');

    const navItems =
        useMemo(
            () => {
                if (isHostPresentation) {
                    if (isOnHostWorkspace) {
                        return [
                            ...HOST_NAV_ITEMS.filter((item) =>
                                isHostPathAllowed(item.to, hostWorkspaceType),
                            ),
                        ];
                    }

                    // In the public store, show its normal navigation, but
                    // keep one-tap access back to the Host workspace.
                    return [
                        ...BASE_NAV_ITEMS,
                        { label: 'Host Studio', to: '/host/operations' },
                    ];
                }

                return [
                    ...BASE_NAV_ITEMS,
                    { label: 'Scan', to: '/scan' },
                ];
            },
            [
                hostWorkspaceType,
                isHostPresentation,
                isOnHostWorkspace,
            ],
        );
  
    const {
        hasAdminAccess,
    } =
        useAdmin();

    const isCustomerPresentation =
        customerEnabled === true &&
        !isHostPresentation &&
        !hasAdminAccess &&
        superAdminEnabled !== true;

    const widePrimaryNavItems =
        isHostPresentation
            ? navItems
            : navItems.filter(
                (item) =>
                    item.to !== '/scan',
            );
  
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
            : isHostPresentation
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

    // Back is a navigation action, not an authenticated-only action.
    // Keep it off the landing/auth entry pages, and show it on all other routes.
    const showUniversalBackButton =
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
            : isHostPresentation
                ? 'Host'
                : 'Customer';

    const scanDestination =
        isHostPresentation
            ? '/host/scan'
            : '/scan';

    const canUseScan =
        isHostPresentation
            ? isHostPathAllowed(
                '/host/scan',
                hostWorkspaceType,
            )
            : customerEnabled === true;

    const showCustomerCart =
        isAuthenticated &&
        customerEnabled &&
        !isHostPresentation &&
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

    // Show a real delivery-time estimate on grocery/product pages too.
    // Checkout and active-order ETA remain authoritative; only use the saved
    // Marketplace cart as a fallback, never invent a delivery time.
    useEffect(() => {
        if (!showCustomerCart || isBootstrapping) return undefined;

        let cancelled = false;
        let requestVersion = 0;
        const refreshCartDeliveryEta = async () => {
            const requestId = ++requestVersion;
            const savedCart = readSessionJson(FLOATING_MARKETPLACE_CART_KEY);
            const cartId = savedCart?.cartId;
            const validCart = cartId &&
                Array.isArray(savedCart?.items) && savedCart.items.length > 0 &&
                savedCart.fulfillmentType !== 'pickup';

            if (!validCart) {
                const previous = useLocationStore.getState().deliveryContext;
                if (String(previous?.targetPath || '').startsWith('/cart/')) {
                    clearDeliveryContext();
                }
                return;
            }

            try {
                const eta = await getMarketplaceCartDeliveryEta(cartId);
                if (cancelled || requestId !== requestVersion) return;
                const minutes = Number(eta?.estimatedDeliveryMinutes);
                const validArrival = Number.isFinite(Date.parse(eta?.estimatedArrivalAt || ''));
                const hasEstimate = eta?.available &&
                    (validArrival || (Number.isFinite(minutes) && minutes > 0));

                // Active-order ETA takes priority over the basket estimate.
                const previous = useLocationStore.getState().deliveryContext;
                if (String(previous?.targetPath || '').startsWith('/orders/')) return;

                if (!hasEstimate) {
                    if (String(previous?.targetPath || '').startsWith('/cart/')) {
                        clearDeliveryContext();
                    }
                    return;
                }

                setDeliveryContext({
                    city: eta.destination?.city || '',
                    state: eta.destination?.state || '',
                    country: eta.destination?.country || 'India',
                    label: eta.destination?.label ||
                        (eta.destination?.postalCode
                            ? `PIN ${eta.destination.postalCode}`
                            : 'Delivery destination'),
                    estimatedDeliveryMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
                    estimatedArrivalAt: validArrival ? eta.estimatedArrivalAt : '',
                    estimatedRoadDistanceKm: Number(eta.estimatedRoadDistanceKm),
                    averageSpeedKmh: Number(eta.averageSpeedKmh),
                    targetPath: `/cart/${encodeURIComponent(String(cartId))}`,
                    calculationMethod: eta.calculationMethod || '',
                });
            } catch {
                // A missing cart ETA does not affect location or shopping.
            }
        };

        void refreshCartDeliveryEta();
        const intervalId = window.setInterval(refreshCartDeliveryEta, 45000);
        window.addEventListener(FLOATING_CART_UPDATE_EVENT, refreshCartDeliveryEta);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener(FLOATING_CART_UPDATE_EVENT, refreshCartDeliveryEta);
        };
    }, [showCustomerCart, isBootstrapping, setDeliveryContext, clearDeliveryContext]);

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
                setActiveDeliveryOrders([]);
                setDeliveryPopoverOpen(false);
                setUnreadNotificationCount(
                    0,
                );

                if (
                    storedDeliveryContext?.targetPath
                        ?.startsWith('/orders/')
                ) {
                    clearDeliveryContext();
                }

                return undefined;
            }

            let inFlight = false;
            let refreshQueued = false;

            const refreshContextualActions =
                async () => {
                    if (cancelled || document.visibilityState === 'hidden') return;
                    if (inFlight) {
                        refreshQueued = true;
                        return;
                    }
                    inFlight = true;
                    try {
                    const requests =
                        await Promise.allSettled([
                            showCustomerCart
                                ? listOrders({ page: 1, limit: 50 })
                                : Promise.resolve({ orders: [], pagination: { pages: 1 } }),
                            listHeaderNotifications({
                                userId: user?.id || user?._id,
                                activeMode,
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

                        // Backend caps /orders at 50 per page. Include older active
                        // orders too, otherwise a customer with many past orders
                        // sees an incorrect delivery count. Bounded to 10 pages
                        // to prevent endless header network requests.
                        const combinedOrders = [...orders];
                        const availablePages = Math.min(
                            10,
                            Math.max(1, Number(ordersResult.value?.pagination?.pages || 1)),
                        );
                        for (let page = 2; page <= availablePages; page += 1) {
                            if (cancelled) return;
                            try {
                                const nextPage = await listOrders({ page, limit: 50 });
                                if (cancelled) return;
                                combinedOrders.push(...(Array.isArray(nextPage?.orders) ? nextPage.orders : []));
                            } catch {
                                // Preserve the latest known orders if an older page fails.
                                break;
                            }
                        }
                        const deliveryOrders = combinedOrders.filter(isActiveCustomerDelivery);
                        setActiveDeliveryOrders(deliveryOrders);
                        const activeOrder = deliveryOrders[0] || null;
                        setActiveTrackingOrder(activeOrder);

                        // An active order can have no calculable ETA (for example,
                        // missing stock-location PIN). Check the next active order
                        // instead of leaving the rotating delivery label empty.
                        if (activeOrder) {
                            for (const deliveryOrder of deliveryOrders) {
                                try {
                                    const orderId = deliveryOrder.id || deliveryOrder._id;
                                    const orderDetail = await getOrder(orderId);
                                    if (cancelled) return;
                                    const eta = orderDetail?.deliveryEta;
                                    const minutes = Number(eta?.estimatedDeliveryMinutes);
                                    const validArrival = Number.isFinite(Date.parse(eta?.estimatedArrivalAt || ''));
                                    if (!eta?.available || (!validArrival && !(Number.isFinite(minutes) && minutes > 0))) {
                                        continue;
                                    }
                                    setDeliveryContext({
                                        city: eta.destination?.city || '',
                                        state: eta.destination?.state || '',
                                        country: eta.destination?.country || 'India',
                                        label: eta.destination?.label ||
                                            (eta.destination?.postalCode
                                                ? `PIN ${eta.destination.postalCode}`
                                                : 'Delivery destination'),
                                        estimatedDeliveryMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
                                        estimatedArrivalAt: validArrival ? eta.estimatedArrivalAt : '',
                                        estimatedRoadDistanceKm: Number(eta.estimatedRoadDistanceKm),
                                        averageSpeedKmh: Number(eta.averageSpeedKmh),
                                        targetPath: `/orders/${encodeURIComponent(String(orderId))}`,
                                        calculationMethod: eta.calculationMethod || '',
                                    });
                                    break;
                                } catch {
                                    // Try the next active order. Tracking continues normally.
                                }
                            }
                        } else if (
                            storedDeliveryContext?.targetPath
                                ?.startsWith('/orders/')
                        ) {
                            clearDeliveryContext();
                        }
                    } else if (!showCustomerCart) {
                        setActiveTrackingOrder(null);
                        setActiveDeliveryOrders([]);
                        setDeliveryPopoverOpen(false);
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
                    } finally {
                        inFlight = false;
                        if (refreshQueued && !cancelled) {
                            refreshQueued = false;
                            void refreshContextualActions();
                        }
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
            window.addEventListener('epantry:orders-changed', refreshContextualActions);
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
                window.removeEventListener('epantry:orders-changed', refreshContextualActions);
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
            user?.id,
            user?._id,
            activeMode,
            location.pathname,
            setDeliveryContext,
            clearDeliveryContext,
            storedDeliveryContext?.targetPath,
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

            setNavbarSearchResultsOpen(
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

    const handleSearchResultOpen =
        (
            result,
            searchQuery =
                navbarSearchQuery,
        ) => {
            if (!result?.path) {
                return;
            }

            setNavbarSearchResultsOpen(
                false,
            );

            setMobileSearchOpen(
                false,
            );

            setMenuOpen(
                false,
            );

            if (
                result.type ===
                    'product' &&
                String(
                    result.path,
                ).startsWith(
                    '/grocery/product/',
                )
            ) {
                const encodedProductSlug =
                    String(
                        result.path,
                    )
                        .slice(
                            '/grocery/product/'.length,
                        )
                        .split(
                            /[?#]/,
                        )[0];

                const nextSearchParams =
                    new URLSearchParams();

                const normalizedSearchQuery =
                    String(
                        searchQuery ||
                            result.displayName ||
                            '',
                    ).trim();

                if (normalizedSearchQuery) {
                    nextSearchParams.set(
                        'q',
                        normalizedSearchQuery,
                    );
                }

                if (encodedProductSlug) {
                    try {
                        nextSearchParams.set(
                            'product',
                            decodeURIComponent(
                                encodedProductSlug,
                            ),
                        );
                    } catch {
                        nextSearchParams.set(
                            'product',
                            encodedProductSlug,
                        );
                    }
                }

                navigate(
                    `/grocery/search-results?${nextSearchParams.toString()}`,
                );

                return;
            }

            navigate(
                result.path,
            );
        };

    const handleSearch =
        (
            query,
        ) => {
            const normalized =
                String(
                    query ||
                        '',
                ).trim();

            if (
                normalized.length <
                2
            ) {
                return;
            }

            setNavbarSearchResultsOpen(
                false,
            );

            setMobileSearchOpen(
                false,
            );

            setMenuOpen(
                false,
            );

            const nextSearchParams =
                new URLSearchParams();

            nextSearchParams.set(
                'q',
                normalized,
            );

            navigate(
                `/grocery/search-results?${nextSearchParams.toString()}`,
            );
        };

    const renderNavbarSearchResults =
        () => null;

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
                : 'text-stone-800 hover:bg-white/80 hover:text-stone-950',
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
            <span className="flex min-w-0 flex-col justify-center">
                <img
                    src="/branding/epantry-wordmark.webp"
                    alt="EPANTRY.in"
                    width={1636}
                    height={265}
                    className="block h-auto w-[174px] max-w-full object-contain"
                    decoding="async"
                />
                <span className="mt-0.5 text-[11px] font-semibold leading-[17px] tracking-[0.08em] text-[#202421]">
                    Food Intelligence
                </span>
            </span>
        </Link>
    );
  
    const universalBackButton =
        showUniversalBackButton ? (
            <button
                type="button"
                onClick={
                    handleUniversalBack
                }
                className="focus-ring ep-nav-icon ep-nav-back"
                aria-label="Go to previous page"
                title="Previous page"
            >
                <ArrowLeft
                    size={18}
                    aria-hidden="true"
                />
            </button>
        ) : null;


    const customerCartButton =
        showCustomerCart ? (
            <Link
                to={cartNavigation.href}
                className="focus-ring ep-nav-icon ep-nav-customer-cart"
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

    const activeDeliveryCount = activeDeliveryOrders.length;
    const customerDeliveryButton = showCustomerCart && activeDeliveryCount > 0 ? (
        <div
            className="ep-nav-delivery-anchor"
            ref={deliveryPopoverRef}
            onMouseEnter={() => {
                if (activeDeliveryCount > 1) setDeliveryPopoverOpen(true);
            }}
            onMouseLeave={() => setDeliveryPopoverOpen(false)}
        >
            <button
                type="button"
                className="focus-ring ep-nav-icon ep-nav-delivery-trigger"
                aria-label={activeDeliveryCount === 1
                    ? 'Track your active order'
                    : `View ${activeDeliveryCount} active deliveries`}
                title={activeDeliveryCount === 1 ? 'Track order' : `${activeDeliveryCount} active deliveries`}
                aria-expanded={activeDeliveryCount > 1 ? deliveryPopoverOpen : undefined}
                aria-haspopup={activeDeliveryCount > 1 ? 'dialog' : undefined}
                onFocus={() => {
                    if (activeDeliveryCount > 1) setDeliveryPopoverOpen(true);
                }}
                onClick={() => {
                    if (activeDeliveryCount === 1) {
                        setDeliveryPopoverOpen(false);
                        const id = activeDeliveryOrders[0]?.id || activeDeliveryOrders[0]?._id;
                        if (id) navigate(`/orders/${encodeURIComponent(String(id))}`);
                    } else {
                        setDeliveryPopoverOpen(true);
                        setSearchPopoverOpen(false);
                        setLocationPopoverOpen(false);
                        setAccountMenuOpen(false);
                    }
                }}
            >
                <svg
                    className="ep-nav-driving-scene"
                    width="35"
                    height="30"
                    viewBox="0 0 44 32"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                >
                    {/* Road moves behind the vehicle; the count badge stays stationary. */}
                    <path d="M2 29H42" stroke="#C0CBBE" strokeWidth="1.4" strokeLinecap="round" />
                    <path className="ep-nav-driving-road-marks" d="M1 29H43" stroke="#819B89" strokeWidth="1.7" strokeDasharray="5 6" />
                    <g className="ep-nav-driving-wind" stroke="#C86C42" strokeWidth="1.65" strokeLinecap="round">
                        <path d="M2 14H7" />
                        <path d="M0 18H5" />
                    </g>
                    <g className="ep-nav-driving-vehicle">
                        <rect x="8" y="9" width="19" height="13" rx="2.4" fill="#173F35" />
                        <path d="M27 13.5H32.5L39 19.5V22H27V13.5Z" fill="#235A49" />
                        <path d="M29.5 15.4H32L35.8 19H29.5V15.4Z" fill="#E4EBDD" />
                        <path d="M10.7 11.6H23.8" stroke="#B9CDB8" strokeWidth="1.15" strokeLinecap="round" opacity=".7" />
                        <path d="M11 19.7H24" stroke="#C86C42" strokeWidth="1.2" strokeLinecap="round" />
                        <path d="M8 22H39" stroke="#173F35" strokeWidth="1.4" strokeLinecap="round" />
                        <g className="ep-nav-driving-wheel ep-nav-driving-wheel-back">
                            <circle cx="15.7" cy="23" r="3.5" fill="#173F35" stroke="#F7F6F2" strokeWidth="1.1" />
                            <path d="M15.7 20.8V25.2M13.5 23H17.9" stroke="#F7F6F2" strokeWidth=".85" strokeLinecap="round" />
                        </g>
                        <g className="ep-nav-driving-wheel ep-nav-driving-wheel-front">
                            <circle cx="33" cy="23" r="3.5" fill="#173F35" stroke="#F7F6F2" strokeWidth="1.1" />
                            <path d="M33 20.8V25.2M30.8 23H35.2" stroke="#F7F6F2" strokeWidth=".85" strokeLinecap="round" />
                        </g>
                    </g>
                </svg>
                <span className="ep-nav-delivery-count" aria-hidden="true">
                    {activeDeliveryCount > 99 ? '99+' : activeDeliveryCount}
                </span>
            </button>
            <AnimatePresence>
                {activeDeliveryCount > 1 && deliveryPopoverOpen && (
                    <motion.div
                        className="ep-nav-delivery-panel"
                        role="dialog"
                        aria-label="Active customer deliveries"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: .16 }}
                    >
                        <div className="ep-nav-delivery-head">
                            <div>
                                <span className="ep-nav-delivery-eyebrow">YOUR DELIVERIES</span>
                                <strong>Orders in progress</strong>
                            </div>
                            <span className="ep-nav-delivery-total">{activeDeliveryCount}</span>
                        </div>
                        <div className="ep-nav-delivery-list">
                            {activeDeliveryOrders.map((order) => {
                                const id = order.id || order._id;
                                const title = String(order.primaryItemName || '').trim()
                                    || `Order ${String(id).slice(-6).toUpperCase()}`;
                                return (
                                    <Link
                                        key={String(id)}
                                        to={`/orders/${encodeURIComponent(String(id))}`}
                                        className="ep-nav-delivery-row"
                                        onClick={() => setDeliveryPopoverOpen(false)}
                                    >
                                        <span className="ep-nav-delivery-row-main">
                                            <span className="ep-nav-delivery-title">{title}</span>
                                            <span className="ep-nav-delivery-status">{displayDeliveryStatus(order)}</span>
                                        </span>
                                        <ArrowLeft size={16} className="ep-nav-menu-arrow" aria-hidden="true" />
                                    </Link>
                                );
                            })}
                        </div>
                        <Link to="/orders" className="ep-nav-delivery-all"
                            onClick={() => setDeliveryPopoverOpen(false)}>
                            All orders <ArrowLeft size={15} className="ep-nav-menu-arrow" aria-hidden="true" />
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    ) : null;

    // One responsive header for all screen sizes. Account actions remain
    // governed by the existing AuthContext and route protections.
    const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
    const [searchDraft, setSearchDraft] = useState(currentQuery);
    const [searchIdeaIndex, setSearchIdeaIndex] = useState(0);
    const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
    const [authOffer, setAuthOffer] = useState('Login');
    const searchPopoverRef = useRef(null);
    const locationPopoverRef = useRef(null);
    const guestMenuRef = useRef(null);

    // Gently rotate a sample query only while search is open and unused.
    useEffect(() => {
        if (!searchPopoverOpen || searchDraft.trim()) return undefined;
        const timerId = window.setInterval(() => {
            setSearchIdeaIndex((index) => (index + 1) % NAVBAR_SEARCH_IDEAS.length);
        }, 2900);
        return () => window.clearInterval(timerId);
    }, [searchPopoverOpen, searchDraft]);

    useEffect(() => {
        if (isAuthenticated || isBootstrapping) return undefined;
        const id = window.setInterval(() => {
            setAuthOffer((current) => current === 'Login' ? 'Register' : 'Login');
        }, 5000);
        return () => window.clearInterval(id);
    }, [isAuthenticated, isBootstrapping]);

    useEffect(() => {
        setSearchPopoverOpen(false);
        setLocationPopoverOpen(false);
        setDeliveryPopoverOpen(false);
        setSearchDraft(currentQuery);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!searchPopoverOpen && !locationPopoverOpen && !menuOpen) return undefined;
        const onOutside = (event) => {
            if (searchPopoverOpen && !searchPopoverRef.current?.contains(event.target)) {
                setSearchPopoverOpen(false);
            }
            if (locationPopoverOpen && !locationPopoverRef.current?.contains(event.target)) {
                setLocationPopoverOpen(false);
            }
            if (menuOpen && !guestMenuRef.current?.contains(event.target)) {
                setMenuOpen(false);
            }
        };
        const onEscape = (event) => {
            if (event.key !== 'Escape') return;
            setSearchPopoverOpen(false);
            setLocationPopoverOpen(false);
            setMenuOpen(false);
        };
        document.addEventListener('pointerdown', onOutside);
        document.addEventListener('keydown', onEscape);
        return () => {
            document.removeEventListener('pointerdown', onOutside);
            document.removeEventListener('keydown', onEscape);
        };
    }, [searchPopoverOpen, locationPopoverOpen, menuOpen]);

    useEffect(() => {
        if (!deliveryPopoverOpen) return undefined;
        const onOutside = (event) => {
            if (deliveryPopoverRef.current && !deliveryPopoverRef.current.contains(event.target)) {
                setDeliveryPopoverOpen(false);
            }
        };
        const onEscape = (event) => {
            if (event.key === 'Escape') setDeliveryPopoverOpen(false);
        };
        document.addEventListener('pointerdown', onOutside);
        document.addEventListener('keydown', onEscape);
        return () => {
            document.removeEventListener('pointerdown', onOutside);
            document.removeEventListener('keydown', onEscape);
        };
    }, [deliveryPopoverOpen]);

    const handleBrandHome = (event) => {
        setMenuOpen(false);
        setAccountMenuOpen(false);
        setSearchPopoverOpen(false);
        setLocationPopoverOpen(false);
        if (location.pathname === '/') {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const publicLinks = BASE_NAV_ITEMS.filter((item) => item.to !== '/');
    const hostLinks = hostEnabled && (activeMode === 'host' || isHostPresentation)
        ? HOST_NAV_ITEMS.filter((item) => isHostPathAllowed(item.to, hostWorkspaceType))
        : [];
    const adminLinks = (hasAdminAccess || superAdminEnabled)
        ? [{ label: 'Super Admin Dashboard', to: '/admin' }]
        : [];
    const customerLinks = customerEnabled && activeMode === 'customer'
        ? [
            { label: 'My Dashboard', to: '/dashboard' },
            { label: 'My Pantry', to: '/pantry' },
            { label: 'My Orders', to: '/orders' },
            { label: 'Meal Plans', to: '/meal-plan' },
          ]
        : [];
    const primaryWorkspaceLinks = [...adminLinks, ...hostLinks, ...customerLinks];
    if (dashboardDestination && !primaryWorkspaceLinks.some((item) => item.to === dashboardDestination)) {
        primaryWorkspaceLinks.unshift({ label: 'Dashboard', to: dashboardDestination });
    }
    const uniqueWorkspaceLinks = primaryWorkspaceLinks.filter((item, index, array) =>
        array.findIndex((candidate) => candidate.to === item.to) === index,
    );

    // All three account groups share one compact dropdown. Users switch groups
    // directly instead of navigating a long, stacked menu.
    const accountTabs = [
        { id: 'explore', label: 'Explore' },
        { id: 'workspace', label: 'Your workspace' },
        { id: 'tools', label: 'Account & tools' },
    ];

    const handleAccountTabKeyDown = (event, index) => {
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % accountTabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + accountTabs.length) % accountTabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = accountTabs.length - 1;
        else return;
        event.preventDefault();
        setAccountActiveTab(accountTabs[nextIndex].id);
        event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
    };

    const submitHeaderSearch = (event) => {
        event.preventDefault();
        const query = searchDraft.trim();
        if (query.length < 2) return;
        handleSearch(query);
        setSearchPopoverOpen(false);
    };

    const menuLink = (item, close) => (
        <Link
            key={item.to}
            to={item.to}
            onClick={close}
            role="menuitem"
            className={`ep-nav-menu-link${isActive(item.to) ? ' ep-nav-menu-active' : ''}`}
        >
            <span>{item.label}</span>
            <ArrowLeft size={15} className="ep-nav-menu-arrow" aria-hidden="true" />
        </Link>
    );

    // Account dropdown presentation only. Role routes and permissions are unchanged.
    const accountMenuLink = (item, compact = false) => (
        <Link
            key={item.to}
            to={item.to}
            onClick={() => setAccountMenuOpen(false)}
            aria-current={isActive(item.to) ? 'page' : undefined}
            className={`ep-acc-link${compact ? ' ep-acc-link-compact' : ''}${isActive(item.to) ? ' ep-acc-link-active' : ''}`}
        >
            <span>{item.label}</span>
            <ArrowLeft size={14} className="ep-acc-link-arrow" aria-hidden="true" />
        </Link>
    );

    return (
        <header
            className={[
                'ep-nav-root',
                isWorkspaceShellRoute ? 'ep-nav-workspace' : '',
                isHeroGlassPage ? 'ep-nav-on-hero' : '',
            ].join(' ')}
        >
            <style>{`
                .ep-nav-root { position:sticky; top:0; z-index:90; width:100%; background:rgba(247,246,242,.97); border-bottom:1px solid #D7DDCF; box-shadow:0 5px 28px rgba(23,63,53,.075); -webkit-backdrop-filter:blur(16px); backdrop-filter:blur(16px); color:#202421; font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,sans-serif; }
                .ep-nav-on-hero { position:fixed; inset:0 0 auto 0; } .ep-nav-workspace { display:none; } @media (min-width:1024px) { .ep-nav-workspace { display:block; } }
                .ep-nav-inner { width:100%; min-height:70px; display:flex; align-items:center; padding:0 clamp(12px,2.4vw,42px); position:relative; }
                .ep-nav-start { display:flex; align-items:center; gap:9px; min-width:0; flex-shrink:0; position:relative; z-index:8; }
                .ep-nav-end { margin-left:auto; display:flex; align-items:center; gap:10px; min-width:0; position:relative; z-index:5; }
                .ep-nav-logo { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; min-width:0; z-index:3; text-decoration:none; }
                .ep-nav-logo img { width:178px; height:auto; max-height:31px; object-fit:contain; filter:saturate(1.65) contrast(1.28) brightness(.86); }
                .ep-nav-logo span { font-size:12px !important; font-weight:600; letter-spacing:.095em; color:#202421; line-height:1.2; }
                .ep-nav-icon { width:42px; height:42px; flex-shrink:0; border:1px solid #D7DDCF; border-radius:15px; color:#173F35; background:#F7F6F2; display:grid; place-items:center; cursor:pointer; transition:background .18s,border-color .18s,transform .18s; }
                .ep-nav-icon:hover,.ep-nav-icon[aria-expanded=true] { background:#D7DDCF; border-color:#ADBBA9; transform:translateY(-1px); }
                .ep-nav-icon:focus-visible,.ep-nav-menu-link:focus-visible,.ep-nav-account:focus-visible,.ep-nav-guest-cta:focus-visible { outline:2px solid #C86C42; outline-offset:3px; }
                .ep-nav-mobile-location { display:none; } .ep-nav-location-inline { width:190px; min-width:0; flex-shrink:0; }
                .ep-nav-location-inline > * { width:100%; }
                .ep-nav-pop-anchor { position:relative; flex-shrink:0; }
                .ep-nav-pop { position:absolute; top:calc(100% + 13px); right:0; z-index:110; border:1px solid #D7DDCF; background:rgba(247,246,242,.99); border-radius:20px; box-shadow:0 24px 56px rgba(23,63,53,.18); padding:14px; }
                .ep-nav-search-panel { left:0; right:auto; width:min(460px,calc(100vw - 28px)); padding:0; overflow:hidden; border-radius:18px; }
                .ep-nav-location-panel { width:min(300px,calc(100vw - 28px)); }
                /* Five rotating EPANTRY food-menu images; lightweight WebP/SVG assets. */
                .ep-nav-food-menu { background:#F7F6F2; color:#173F35; border-color:#C8D2C4; border-radius:13px; }
                .ep-nav-food-menu:hover { background:#E9EDE5; border-color:#9FAF9E; }
                .ep-nav-food-menu[aria-expanded=true] { background:#173F35; border-color:#173F35; color:#F7F6F2; }
                .ep-nav-food-glyph { position:relative; display:block; width:29px; height:29px; flex-shrink:0; overflow:hidden; }
                .ep-nav-food-glyph img { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:contain; opacity:0; transform:translateY(5px) scale(.95); transition:opacity 480ms ease,transform 480ms ease; pointer-events:none; }
                .ep-nav-food-glyph img.is-active { opacity:1; transform:translateY(0) scale(1); }
                @media (prefers-reduced-motion:reduce) { .ep-nav-food-glyph img { transition:none !important; transform:none !important; } }
                .ep-nav-food-menu-head { display:flex; align-items:center; gap:9px; padding:13px 13px 12px; margin-bottom:5px; color:#F7F6F2; background:#173F35; border-radius:12px; font-size:14px !important; font-weight:750; }
                .ep-nav-menu-back { width:100%; border:0; cursor:pointer; background:transparent; font-family:inherit; border-top:1px solid #D7DDCF; border-radius:0; text-align:left; }
                .ep-nav-left-notification { flex-shrink:0; display:flex; align-items:center; justify-content:center; }
                .ep-nav-left-notification > a { width:42px; height:42px; border-radius:15px; border:1px solid #D7DDCF; background:#F7F6F2; display:grid; place-items:center; color:#173F35; text-decoration:none; }
                .ep-nav-left-notification > a:hover { border-color:#B1C1B3; background:#D7DDCF; }
                /* Customer-only left cart and active-delivery tracker. */
                .ep-nav-customer-cart { position:relative; text-decoration:none; }
                 .ep-nav-delivery-anchor { position:relative; flex-shrink:0; }
                /* Pointer bridge prevents the hover menu closing over its visual gap. */
                .ep-nav-delivery-anchor::after { content:''; position:absolute; left:0; top:100%; width:100%; height:15px; pointer-events:auto; }
                .ep-nav-delivery-trigger { position:relative; }
                /* Subtle driving illusion: translating road, turning wheels, vehicle suspension. */
                .ep-nav-driving-scene { display:block; width:35px; height:30px; overflow:visible; flex-shrink:0; }
                .ep-nav-driving-vehicle { animation:ep-nav-drive-suspension 1.75s ease-in-out infinite; }
                .ep-nav-driving-road-marks { animation:ep-nav-drive-road .85s linear infinite; }
                .ep-nav-driving-wheel { transform-box:view-box; animation:ep-nav-drive-wheels 1s linear infinite; }
                .ep-nav-driving-wheel-back { transform-origin:15.7px 23px; }
                .ep-nav-driving-wheel-front { transform-origin:33px 23px; }
                .ep-nav-driving-wind { animation:ep-nav-drive-wind 1.35s ease-in-out infinite; }
                @keyframes ep-nav-drive-suspension { 0%,100% { transform:translate(0,0); } 24% { transform:translate(1.4px,-.6px); } 55% { transform:translate(2px,.15px); } 78% { transform:translate(.8px,-.5px); } }
                @keyframes ep-nav-drive-road { to { stroke-dashoffset:22; } }
                @keyframes ep-nav-drive-wheels { to { transform:rotate(360deg); } }
                @keyframes ep-nav-drive-wind { 0%,100% { opacity:.3; transform:translateX(2px); } 45% { opacity:.9; transform:translateX(-1px); } }
                @media (prefers-reduced-motion:reduce) { .ep-nav-driving-vehicle,.ep-nav-driving-road-marks,.ep-nav-driving-wheel,.ep-nav-driving-wind { animation:none !important; } }
                .ep-nav-delivery-count { position:absolute; right:-6px; top:-7px; display:grid; place-items:center; min-width:19px; height:19px; padding:0 4px; border:2px solid #F7F6F2; border-radius:999px; background:#C86C42; color:white; font-size:10px !important; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
                .ep-nav-delivery-panel { position:absolute; z-index:125; left:0; top:calc(100% + 13px); width:350px; max-width:calc(100vw - 18px); border:1px solid #D7DDCF; border-radius:17px; background:#F7F6F2; color:#202421; box-shadow:0 22px 56px rgba(23,63,53,.18); overflow:hidden; }
                .ep-nav-delivery-head { padding:15px 17px 13px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid #D7DDCF; }
                .ep-nav-delivery-head > div { display:grid; gap:5px; }
                .ep-nav-delivery-eyebrow { font-size:10px !important; letter-spacing:.12em; color:#A85332; font-weight:800; }
                .ep-nav-delivery-head strong { font-size:16px !important; color:#173F35; font-weight:750; }
                .ep-nav-delivery-total { font-size:13px !important; font-weight:750; color:#173F35; background:#D7DDCF; border-radius:9px; padding:5px 9px; }
                .ep-nav-delivery-list { overflow-y:auto; max-height:min(45svh,290px); overscroll-behavior:contain; }
                .ep-nav-delivery-row { padding:12px 16px; display:flex; align-items:center; gap:12px; justify-content:space-between; border-bottom:1px solid #E0E5DA; color:#202421; text-decoration:none; }
                .ep-nav-delivery-row:hover,.ep-nav-delivery-row:focus-visible { background:#E9EDE5; }
                .ep-nav-delivery-row-main { min-width:0; display:grid; gap:4px; }
                .ep-nav-delivery-title { font-size:14px !important; font-weight:750; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .ep-nav-delivery-status { font-size:12px !important; color:#596E61; }
                .ep-nav-delivery-all { padding:11px 16px; display:flex; align-items:center; justify-content:space-between; text-decoration:none; color:#173F35; font-size:13px !important; font-weight:750; }
                .ep-nav-delivery-all:hover { background:#E9EDE5; }
                .ep-nav-delivery-trigger:focus-visible,.ep-nav-delivery-row:focus-visible,.ep-nav-delivery-all:focus-visible { outline:2px solid #C86C42; outline-offset:2px; }
                .ep-nav-search-heading { padding:21px 22px 17px; background:#173F35; color:#F7F6F2; display:flex; justify-content:space-between; align-items:flex-start; gap:15px; }
                .ep-nav-search-heading > div { display:grid; gap:7px; }
                .ep-nav-search-eyebrow { color:#E5B497; font-size:11px !important; font-weight:800; letter-spacing:.14em; }
                .ep-nav-search-heading strong { color:#F7F6F2; font-size:21px !important; line-height:1.2; letter-spacing:-.03em; font-weight:750; }
                .ep-nav-search-dismiss { width:32px; height:32px; flex-shrink:0; display:grid; place-items:center; border:1px solid rgba(255,255,255,.27); border-radius:10px; color:#F7F6F2; background:transparent; cursor:pointer; }
                .ep-nav-search-dismiss:hover { background:rgba(255,255,255,.13); }
                .ep-nav-search-form { margin:17px 19px 10px; display:flex; align-items:center; min-width:0; gap:11px; min-height:54px; border:1px solid #BAC9BA; background:#FFF; border-radius:12px; padding:6px 6px 6px 14px; color:#173F35; }
                .ep-nav-search-form:focus-within { outline:2px solid rgba(200,108,66,.35); border-color:#C86C42; }
                .ep-nav-search-form input { border:0; outline:0; box-shadow:none; background:transparent; min-width:0; flex:1; padding:6px 0; color:#202421; font-family:inherit; font-size:15px !important; }
                .ep-nav-search-form input::placeholder { color:#7B887D; opacity:1; }
                .ep-nav-search-form button { flex-shrink:0; border:0; color:#F7F6F2; background:#173F35; border-radius:9px; padding:11px 13px; font-family:inherit; font-size:14px !important; font-weight:750; cursor:pointer; }
                .ep-nav-search-form button:disabled { background:#D7DDCF; color:#667567; cursor:not-allowed; }
                .ep-nav-search-form button:not(:disabled):hover { background:#245447; }
                .ep-nav-search-discovery { display:flex; align-items:center; gap:12px; padding:8px 20px 19px; flex-wrap:wrap; }
                .ep-nav-search-discovery > span { color:#597063; font-size:12px !important; font-weight:700; }
                .ep-nav-search-shortcuts { display:flex; flex-wrap:wrap; gap:7px; }
                .ep-nav-search-shortcuts a { text-decoration:none; color:#173F35; background:#E9EDE5; border:1px solid #D7DDCF; border-radius:8px; padding:6px 10px; font-size:13px !important; font-weight:700; }
                .ep-nav-search-shortcuts a:hover { color:#8D462C; background:#F6E5DC; border-color:#EDCCBC; }
                /* Six curated, clickable ideas, with gentle movement instead of a static placeholder. */
                .ep-nav-search-ideas { padding:4px 20px 18px; border-top:1px solid #E1E7DE; }
                .ep-nav-search-ideas-heading { display:flex; align-items:center; justify-content:space-between; padding:10px 0 3px; }
                .ep-nav-search-ideas-heading span { font-size:11px !important; font-weight:750; letter-spacing:.08em; color:#657869; text-transform:uppercase; }
                .ep-nav-search-ideas-heading i { display:block; width:24px; height:2px; background:#C86C42; border-radius:2px; }
                .ep-nav-search-ideas-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 14px; }
                .ep-nav-search-idea { display:flex; justify-content:space-between; align-items:center; gap:5px; min-width:0; padding:10px 3px; border:0; border-bottom:1px solid #E0E6DC; background:transparent; color:#264C3F; font-family:inherit; font-size:12px !important; font-weight:650; text-align:left; cursor:pointer; transition:color .2s,background .2s; animation:ep-nav-idea-appear .36s ease both; }
                .ep-nav-search-idea span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .ep-nav-search-idea small { flex-shrink:0; color:#8B988E; font-size:10px !important; font-weight:600; }
                .ep-nav-search-idea:hover,.ep-nav-search-idea:focus-visible,.ep-nav-search-idea.is-current { color:#A35231; background:rgba(200,108,66,.055); }
                .ep-nav-search-idea:focus-visible { outline:2px solid #C86C42; outline-offset:2px; }
                @keyframes ep-nav-idea-appear { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
                @media (prefers-reduced-motion:reduce) { .ep-nav-search-idea { animation:none !important; } }
                .ep-nav-account { display:flex; align-items:center; gap:9px; border:1px solid #D7DDCF; border-radius:22px; background:#F7F6F2; padding:5px 11px 5px 5px; height:47px; cursor:pointer; color:#173F35; text-align:left; }
                .ep-nav-account[aria-expanded=true],.ep-nav-account:hover { background:#DDE5D8; border-color:#B8C8B7; }
                .ep-nav-avatar { width:35px; height:35px; border-radius:50%; display:grid; place-items:center; background:#173F35; color:white; font-size:14px !important; font-weight:700; }
                .ep-nav-userlines { display:flex; flex-direction:column; min-width:0; line-height:1.15; }
                .ep-nav-username { max-width:122px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:14px !important; font-weight:700; color:#202421; }
                .ep-nav-role { font-size:11px !important; text-transform:uppercase; letter-spacing:.09em; font-weight:700; color:#627065; margin-top:3px; }
                /* EPANTRY account navigation: light editorial tabs, one group at a time. */
                .ep-nav-account-pop { width:min(366px,calc(100vw - 20px)); max-height:calc(100dvh - 88px); padding:0; display:flex; flex-direction:column; overflow:hidden; border:1px solid #D7DDCF; border-radius:18px; background:#F9F8F4; box-shadow:0 19px 45px rgba(23,63,53,.16); }
                .ep-acc-top { position:relative; flex:0 0 auto; display:flex; align-items:center; padding:16px 20px 15px; min-height:80px; border-bottom:1px solid #D8DED4; background:linear-gradient(112deg,#F7F6F2 10%,#EAEDE6 100%); }
                .ep-acc-top:before { position:absolute; left:19px; bottom:0; content:''; width:45px; height:3px; background:#C86C42; border-radius:6px 6px 0 0; }
                .ep-acc-identity { display:flex; align-items:center; gap:12px; min-width:0; }
                .ep-acc-portrait { width:39px; height:39px; flex:0 0 39px; display:grid; place-items:center; border-radius:50%; background:#173F35; color:#F7F6F2; font-size:15px !important; font-weight:700; }
                .ep-acc-namebox { display:flex; flex-direction:column; justify-content:center; gap:2px; min-width:0; }
                .ep-acc-kicker { color:#A15B3C; font-size:10px !important; font-weight:750; letter-spacing:.11em; text-transform:uppercase; }
                .ep-acc-name { font-size:18px !important; font-weight:750; letter-spacing:-.025em; line-height:1.18; color:#202421; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .ep-acc-role { color:#556B5D; font-size:12px !important; font-weight:550; }
                .ep-acc-tabs { flex:0 0 auto; display:grid; grid-template-columns:.78fr 1.22fr 1.18fr; gap:2px; align-items:stretch; padding:0 11px; border-bottom:1px solid #DCE2D7; background:#F7F6F2; }
                .ep-acc-tab { appearance:none; border:0; border-bottom:3px solid transparent; background:transparent; border-radius:0; padding:15px 1px 12px; color:#617267; font-family:inherit; font-size:12px !important; font-weight:700; line-height:1.2; letter-spacing:-.015em; white-space:nowrap; cursor:pointer; transition:color .18s,background .18s,border-color .18s; }
                .ep-acc-tab:hover { color:#173F35; background:#ECF0EA; }
                .ep-acc-tab[aria-selected="true"] { color:#173F35; border-bottom-color:#C86C42; font-weight:800; }
                .ep-acc-tab:focus-visible { outline:2px solid #C86C42; outline-offset:-3px; border-radius:4px; }
                .ep-acc-viewport { flex:1 1 auto; min-height:0; background:#F9F8F4; }
                .ep-acc-scroll { box-sizing:border-box; min-height:145px; max-height:min(300px,calc(100dvh - 252px)); overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#B1BDAB #EFF1EB; }
                .ep-acc-scroll::-webkit-scrollbar { width:5px; }
                .ep-acc-scroll::-webkit-scrollbar-track { background:#EFF1EB; }
                .ep-acc-scroll::-webkit-scrollbar-thumb { background:#B1BDAB; border-radius:8px; }
                .ep-acc-scroll:focus-visible { outline:2px solid #C86C42; outline-offset:-2px; }
                .ep-acc-content { padding:2px 2px 15px; }
                .ep-acc-section { padding:11px 19px 6px; }
                .ep-acc-quicklinks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:13px; }
                .ep-acc-mainlinks { display:grid; grid-template-columns:minmax(0,1fr); }
                .ep-acc-toollinks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:13px; }
                .ep-acc-link { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; min-height:42px; padding:10px 3px; border-bottom:1px solid #E4E9E0; border-radius:0; color:#273A2E; text-decoration:none; font-size:14px !important; line-height:1.25; font-weight:650; transition:background .16s,color .16s,padding-left .16s; }
                .ep-acc-link:hover,.ep-acc-link-active { background:#E6EDE4; color:#173F35; padding-left:8px; }
                .ep-acc-link-active { box-shadow:inset 2px 0 0 #C86C42; }
                .ep-acc-link span { min-width:0; overflow-wrap:anywhere; }
                .ep-acc-link-arrow { flex-shrink:0; transform:rotate(180deg); color:#7C9484; opacity:.7; }
                .ep-acc-link:hover .ep-acc-link-arrow,.ep-acc-link-active .ep-acc-link-arrow { opacity:1; color:#B75C36; }
                .ep-acc-link:focus-visible,.ep-acc-signout:focus-visible { outline:2px solid #C86C42; outline-offset:2px; }
                .ep-acc-link-compact { font-size:13px !important; }
                .ep-acc-switch { margin-top:9px; padding:13px 19px; border-top:1px solid #E2E7DD; background:#EEF1E9; }
                .ep-acc-switch-label { display:block; margin-bottom:8px; color:#4F6859; font-size:11px !important; font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
                .ep-acc-empty { padding:13px 0; font-size:13px !important; color:#617267; }
                .ep-acc-footer { flex:0 0 auto; padding:7px 14px 9px; border-top:1px solid #D4DDD1; background:#F7F6F2; }
                .ep-acc-signout { display:flex; align-items:center; width:100%; gap:10px; border:0; background:transparent; border-radius:9px; min-height:39px; padding:8px 10px; cursor:pointer; color:#93513A; text-align:left; font-family:inherit; font-size:14px !important; font-weight:700; transition:background .15s; }
                .ep-acc-signout:hover { background:#F5E9E1; }
                .ep-acc-signout-arrow { transform:rotate(180deg); margin-left:auto; }

                .ep-nav-menu-head { padding:17px 17px 14px; background:#173F35; color:#F7F6F2; }
                .ep-nav-menu-head strong { font-size:16px !important; font-weight:750; display:block; }
                .ep-nav-menu-head small { font-size:12px !important; color:#D7DDCF; display:block; margin-top:3px; }
                .ep-nav-menu-group { padding:10px; }
                .ep-nav-menu-title { font-size:11px !important; font-weight:800; letter-spacing:.13em; text-transform:uppercase; padding:5px 11px 7px; color:#C86C42; }
                .ep-nav-menu-link { display:flex; align-items:center; justify-content:space-between; min-height:39px; padding:9px 11px; border-radius:11px; color:#202421; font-size:14px !important; font-weight:600; line-height:1.25; text-decoration:none; gap:12px; }
                .ep-nav-menu-link:hover,.ep-nav-menu-active { background:#DCE5D9; color:#173F35; }
                .ep-nav-menu-arrow { transform:rotate(180deg); color:#8A9D8E; flex-shrink:0; }
                .ep-nav-menu-divider { height:1px; background:#D7DDCF; margin:1px 11px; }
                .ep-nav-menu-footer { padding:10px 12px 12px; border-top:1px solid #D7DDCF; }
                .ep-nav-logout { display:flex; width:100%; align-items:center; gap:10px; border:0; border-radius:11px; padding:11px; text-align:left; background:transparent; color:#9A4328; font-size:14px !important; font-weight:700; cursor:pointer; }
                .ep-nav-logout:hover { background:#F4DED5; }
                .ep-nav-guest-cta { min-width:99px; height:42px; background:#173F35; color:#F7F6F2; border-radius:13px; padding:0 15px; display:flex; gap:7px; align-items:center; justify-content:center; font-size:14px !important; font-weight:750; white-space:nowrap; text-decoration:none; }
                .ep-nav-guest-cta:hover { background:#245447; }
                .ep-nav-guest-pop { left:0; right:auto; width:248px; padding:7px; }
                .ep-nav-modal-location { display:none; } .ep-nav-mobile-collapsible { display:flex; flex-shrink:0; }
                @media (max-width:1150px) { .ep-nav-logo img { width:143px; } .ep-nav-location-inline { width:160px; } .ep-nav-end { gap:7px; } .ep-nav-inner { padding:0 16px; } }
                @media (max-width:760px) { .ep-nav-delivery-panel { position:fixed; top:66px; left:8px; right:8px; width:auto; max-width:none; max-height:calc(100dvh - 76px); } .ep-nav-inner { min-height:60px; padding:0 11px; } .ep-nav-logo img { width:112px; max-height:22px; filter:saturate(1.85) contrast(1.36) brightness(.82); } .ep-nav-logo span { display:none; } .ep-nav-icon { width:37px; height:37px; border-radius:12px; } .ep-nav-location-inline { display:none; } .ep-nav-mobile-location { display:block; } .ep-nav-account { padding:3px; height:40px; border-radius:16px; } .ep-nav-avatar { width:32px; height:32px; } .ep-nav-userlines,.ep-nav-account-chevron { display:none; } .ep-nav-guest-cta { min-width:78px; height:38px; padding:0 10px; border-radius:11px; font-size:13px !important; } .ep-nav-end { gap:5px; } .ep-nav-start { gap:5px; } .ep-nav-left-notification > a { width:37px; height:37px; border-radius:12px; } .ep-nav-search-panel { position:fixed; left:12px; right:12px; top:66px; width:auto; max-height:calc(100dvh - 82px); overflow-y:auto; } .ep-nav-pop { top:calc(100% + 9px); } .ep-nav-modal-location { display:block; padding:10px 10px 6px; } .ep-nav-mobile-collapsible { display:none; } }
                @media (max-width:360px) { .ep-nav-start[data-customer-actions='true'] .ep-nav-left-notification { display:none; } }
                @media (max-width:430px) { .ep-nav-logo img { width:83px; } .ep-nav-icon { width:32px; height:32px; border-radius:10px; } .ep-nav-start { gap:3px; } .ep-nav-left-notification > a { width:32px; height:32px; border-radius:10px; } .ep-nav-food-glyph { width:24px; height:24px; } .ep-nav-guest-cta { min-width:68px; padding:0 7px; } .ep-nav-mobile-location { display:none; } .ep-nav-inner { padding:0 9px; } .ep-nav-end { gap:4px; } .ep-nav-account-pop { width:min(366px,calc(100vw - 16px)); max-height:calc(100dvh - 70px); } .ep-acc-top { min-height:73px; padding:11px 15px; } .ep-acc-tab { font-size:11px !important; padding:13px 1px 11px; } .ep-acc-section { padding:11px 16px 9px; } .ep-acc-link { min-height:40px; } .ep-acc-scroll { max-height:calc(100dvh - 207px); } .ep-nav-search-panel { left:8px; right:8px; width:auto; } .ep-nav-search-heading { padding:17px 16px 14px; } .ep-nav-search-form { margin:13px 12px 8px; gap:7px; padding-left:9px; } .ep-nav-search-form button { padding:10px 9px; } .ep-nav-search-discovery { padding:8px 12px 15px; } }
                @media (min-width:761px) and (max-width:950px) { .ep-nav-logo { left:50%; } .ep-nav-location-inline { display:none; } .ep-nav-mobile-location { display:block; } .ep-nav-mobile-collapsible { display:none; } .ep-nav-username { max-width:70px; } }
                @media (prefers-reduced-motion:reduce) { .ep-nav-root * { transition-duration:0.01ms !important; animation-duration:0.01ms !important; } }
            `}</style>
            <div className="ep-nav-inner">
                <div className="ep-nav-start" data-customer-actions={showCustomerCart ? 'true' : undefined}>
                    {universalBackButton}
                    {!isAuthenticated && !isBootstrapping && (
                    <div className="ep-nav-pop-anchor" ref={guestMenuRef}>
                        <button
                            type="button"
                            className="ep-nav-icon ep-nav-food-menu"
                            aria-label={menuOpen ? 'Close EPANTRY food menu' : 'Open EPANTRY food menu'}
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            onClick={() => {
                                setMenuOpen((open) => !open);
                                setSearchPopoverOpen(false);
                                setLocationPopoverOpen(false);
                                setAccountMenuOpen(false);
                            }}
                        >
                            {menuOpen ? <X size={19} aria-hidden="true" /> : (
                                <span className="ep-nav-food-glyph" aria-hidden="true">
                                    {MENU_ICON_IMAGES.map((src, index) => (
                                        <img
                                            key={src}
                                            src={src}
                                            alt=""
                                            aria-hidden="true"
                                            loading="eager"
                                            decoding="async"
                                            className={index === menuIconIndex ? 'is-active' : ''}
                                            onError={(event) => {
                                                // Preserve visibility until PNG originals are converted.
                                                const image = event.currentTarget;
                                                if (src.endsWith('.webp') && !image.dataset.fallbackTried) {
                                                    image.dataset.fallbackTried = 'true';
                                                    image.src = src.replace(/\.webp$/, '.png');
                                                }
                                            }}
                                        />
                                    ))}
                                </span>
                            )}
                        </button>
                        <AnimatePresence>
                            {menuOpen && (
                                <motion.div
                                    className="ep-nav-pop ep-nav-guest-pop"
                                    role="menu"
                                    aria-label="Explore EPANTRY"
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: .17 }}
                                >
                                    <div className="ep-nav-food-menu-head">
                                        <Leaf size={17} aria-hidden="true" />
                                        <span>Explore good food</span>
                                    </div>
                                    {publicLinks.map((item) => menuLink(item, () => setMenuOpen(false)))}
                                    {showUniversalBackButton && (
                                        <button
                                            type="button"
                                            className="ep-nav-menu-link ep-nav-menu-back"
                                            role="menuitem"
                                            onClick={() => { setMenuOpen(false); handleUniversalBack(); }}
                                        ><span>Go back</span><ArrowLeft size={15} aria-hidden="true" /></button>
                                    )}
                                    <div className="ep-nav-modal-location"><NavbarLocationStatus /></div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    )}

                    <div className="ep-nav-pop-anchor ep-nav-search-anchor" ref={searchPopoverRef}
                        onMouseEnter={() => setSearchPopoverOpen(true)}
                        onMouseLeave={(event) => {
                            if (!event.currentTarget.contains(document.activeElement)) setSearchPopoverOpen(false);
                        }}
                    >
                        <button
                            type="button"
                            className="ep-nav-icon ep-nav-search-trigger"
                            aria-label="Search products, brands and recipes"
                            aria-haspopup="dialog"
                            aria-expanded={searchPopoverOpen}
                            onFocus={() => setSearchPopoverOpen(true)}
                            onClick={() => {
                                setSearchPopoverOpen(true);
                                setMenuOpen(false);
                                setLocationPopoverOpen(false);
                                setAccountMenuOpen(false);
                            }}
                        ><Search size={19} aria-hidden="true" /></button>
                        <AnimatePresence>
                            {searchPopoverOpen && (
                                <motion.div
                                    className="ep-nav-pop ep-nav-search-panel"
                                    role="dialog"
                                    aria-label="Search EPANTRY"
                                    initial={{ opacity: 0, y: -7 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -7 }}
                                    transition={{ duration: .16 }}
                                >
                                    <div className="ep-nav-search-heading">
                                        <div>
                                            <span className="ep-nav-search-eyebrow">EPANTRY SEARCH</span>
                                            <strong>Find something good.</strong>
                                        </div>
                                        <button type="button" className="ep-nav-search-dismiss"
                                            onClick={() => setSearchPopoverOpen(false)} aria-label="Close search"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={submitHeaderSearch} role="search" className="ep-nav-search-form">
                                        <Search size={19} aria-hidden="true" />
                                        <input
                                            type="search"
                                            aria-label="Search products, brands and recipes"
                                            value={searchDraft}
                                            onChange={(event) => setSearchDraft(event.target.value)}
                                            placeholder={`Try ${NAVBAR_SEARCH_IDEAS[searchIdeaIndex].query}...`}
                                            autoComplete="off"
                                        />
                                        <button type="submit" disabled={searchDraft.trim().length < 2}>Search</button>
                                    </form>
                                    <div className="ep-nav-search-discovery">
                                        <span>Or explore</span>
                                        <div className="ep-nav-search-shortcuts">
                                            {[
                                                { label: 'Grocery', to: '/grocery' },
                                                { label: 'Recipes', to: '/recipes' },
                                                { label: 'Brands', to: '/brands' },
                                            ].map((item) => (
                                                <Link key={item.to} to={item.to} onClick={() => setSearchPopoverOpen(false)}>{item.label}</Link>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="ep-nav-search-ideas" aria-label="Suggested searches">
                                        <div className="ep-nav-search-ideas-heading">
                                            <span>Ideas to explore</span>
                                            <i aria-hidden="true" />
                                        </div>
                                        <div className="ep-nav-search-ideas-grid">
                                            {NAVBAR_SEARCH_IDEAS.map((idea, index) => (
                                                <button
                                                    key={idea.query}
                                                    type="button"
                                                    className={`ep-nav-search-idea${index === searchIdeaIndex ? ' is-current' : ''}`}
                                                    style={{ animationDelay: `${index * 55}ms` }}
                                                    onClick={() => {
                                                        setSearchDraft(idea.query);
                                                        handleSearch(idea.query);
                                                    }}
                                                    title={`Search ${idea.query}`}
                                                >
                                                    <span>{idea.query}</span>
                                                    <small>{idea.kind}</small>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="ep-nav-left-notification">
                        {isAuthenticated && !isBootstrapping ? (
                            <NotificationBell compact />
                        ) : (
                            <Link to="/login" aria-label="Sign in to view notifications" title="Sign in for notifications" className="ep-nav-icon ep-nav-guest-bell">
                                <Bell size={18} aria-hidden="true" />
                            </Link>
                        )}
                    </div>
                    {customerCartButton}
                    {customerDeliveryButton}
                </div>

                <Link to="/" onClick={handleBrandHome} aria-label="EPANTRY home; click to return to top" className="ep-nav-logo">
                    <img src="/branding/epantry-wordmark.webp" alt="EPANTRY.in" width="1636" height="265" decoding="async" />
                    <span>Food Intelligence</span>
                </Link>

                <div className="ep-nav-end">
                    <div className="ep-nav-location-inline"><NavbarLocationStatus /></div>
                    <div className="ep-nav-pop-anchor ep-nav-mobile-location" ref={locationPopoverRef}>
                        <button
                            type="button" className="ep-nav-icon" aria-label="Delivery location"
                            aria-expanded={locationPopoverOpen}
                            onClick={() => { setLocationPopoverOpen((v) => !v); setSearchPopoverOpen(false); setAccountMenuOpen(false); }}
                        ><MapPin size={19} /></button>
                        <AnimatePresence>
                            {locationPopoverOpen && (
                                <motion.div className="ep-nav-pop ep-nav-location-panel" initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.16}}>
                                    <NavbarLocationStatus />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {isBootstrapping ? (
                        <span style={{width:89,height:40,borderRadius:14,background:'#D7DDCF'}} aria-label="Loading account" />
                    ) : isAuthenticated ? (
                        <div className="ep-nav-pop-anchor" ref={accountMenuRef}>
                            <button
                                type="button" className="ep-nav-account" aria-label="Open account and navigation menu"
                                aria-haspopup="dialog" aria-expanded={accountMenuOpen}
                                onClick={() => { setAccountMenuOpen((v) => !v); setAccountActiveTab('explore'); setSearchPopoverOpen(false); setLocationPopoverOpen(false); }}
                            >
                                <span className="ep-nav-avatar">{accountInitials}</span>
                                <span className="ep-nav-userlines">
                                    <span className="ep-nav-username">{firstName || 'My account'}</span>
                                    <span className="ep-nav-role">{accountRoleLabel}</span>
                                </span>
                                <ChevronDown size={16} className="ep-nav-account-chevron" aria-hidden="true" />
                            </button>
                            <AnimatePresence>
                                {accountMenuOpen && (
                                    <motion.div
                                        className="ep-nav-pop ep-nav-account-pop"
                                        role="dialog"
                                        aria-label="Account and website navigation"
                                        initial={{opacity:0,y:-7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-7}}
                                        transition={{duration:.17}}
                                    >
                                        <div className="ep-acc-top">
                                            <div className="ep-acc-identity">
                                                <span className="ep-acc-portrait" aria-hidden="true">{accountInitials}</span>
                                                <div className="ep-acc-namebox">
                                                    <span className="ep-acc-kicker">Your EPANTRY account</span>
                                                    <strong className="ep-acc-name">{user?.name || 'My account'}</strong>
                                                    <span className="ep-acc-role">{accountRoleLabel}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ep-acc-tabs" role="tablist" aria-label="Account navigation groups">
                                            {accountTabs.map((tab, index) => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    role="tab"
                                                    id={`ep-acc-tab-${tab.id}`}
                                                    aria-controls={`ep-acc-panel-${tab.id}`}
                                                    aria-selected={accountActiveTab === tab.id}
                                                    tabIndex={accountActiveTab === tab.id ? 0 : -1}
                                                    className="ep-acc-tab"
                                                    onClick={() => setAccountActiveTab(tab.id)}
                                                    onKeyDown={(event) => handleAccountTabKeyDown(event, index)}
                                                >{tab.label}</button>
                                            ))}
                                        </div>
                                        <div className="ep-acc-viewport">
                                            <div
                                                className="ep-acc-scroll"
                                                role="tabpanel"
                                                id={`ep-acc-panel-${accountActiveTab}`}
                                                aria-labelledby={`ep-acc-tab-${accountActiveTab}`}
                                                tabIndex={0}
                                                key={accountActiveTab}
                                            >
                                                <div className="ep-acc-content">
                                                    {accountActiveTab === 'explore' && (
                                                        <div className="ep-acc-section">
                                                            <div className="ep-acc-quicklinks">
                                                                {publicLinks.map((item) => accountMenuLink(item, true))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {accountActiveTab === 'workspace' && (
                                                        <div className="ep-acc-section">
                                                            <div className="ep-acc-mainlinks">
                                                                {uniqueWorkspaceLinks.length > 0
                                                                    ? uniqueWorkspaceLinks.map((item) => accountMenuLink(item))
                                                                    : <span className="ep-acc-empty">No workspace links available.</span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {accountActiveTab === 'tools' && (
                                                        <>
                                                            <div className="ep-acc-section">
                                                                <div className="ep-acc-toollinks">
                                                                    {canUseScan && !hasAdminAccess && !superAdminEnabled && accountMenuLink({ label:'Scan', to:scanDestination }, true)}
                                                                    {isCustomerPresentation && accountMenuLink({ label:'Community', to:'/community' }, true)}
                                                                    {isCustomerPresentation && accountMenuLink({ label:'Learn', to:'/learn' }, true)}
                                                                    {showCustomerCart && accountMenuLink({ label:'My cart', to:cartNavigation.href }, true)}
                                                                    {hasTrackableOrder && accountMenuLink({ label:'Track my order', to:`/orders/${encodeURIComponent(String(activeTrackingOrderId))}` }, true)}
                                                                    {accountMenuLink({ label:'Notifications', to:'/notifications' }, true)}
                                                                    {accountMenuLink({ label:'Account settings', to:'/account/settings' }, true)}
                                                                </div>
                                                                <div className="ep-nav-modal-location"><NavbarLocationStatus /></div>
                                                            </div>
                                                            {!hasAdminAccess && !superAdminEnabled && (
                                                                <div className="ep-acc-switch">
                                                                    <span className="ep-acc-switch-label">Switch workspace mode</span>
                                                                    <ModeSwitcher compact />
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ep-acc-footer">
                                            <button type="button" className="ep-acc-signout" onClick={handleLogout} disabled={isLoggingOut}>
                                                {isLoggingOut ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
                                                <span>{isLoggingOut ? 'Signing out…' : 'Sign out'}</span>
                                                <ArrowLeft size={15} className="ep-acc-signout-arrow" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <Link to={authOffer === 'Login' ? '/login' : '/register'} className="ep-nav-guest-cta" aria-label={`${authOffer} to EPANTRY`}>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={authOffer}
                                    initial={{opacity:0,y:4}}
                                    animate={{opacity:1,y:0}}
                                    exit={{opacity:0,y:-4}}
                                    transition={{duration:.35}}
                                >{authOffer}</motion.span>
                            </AnimatePresence>
                        </Link>
                    )}
                </div>
            </div>
            {logoutError && (
                <div role="alert" style={{padding:'9px 20px',color:'#8A361F',fontWeight:600,fontSize:14,background:'#F7E4DC'}}>
                    {logoutError}
                    <button type="button" onClick={() => setLogoutError('')} aria-label="Dismiss error" style={{marginLeft:14}}><X size={14} /></button>
                </div>
            )}
            {location.pathname === '/' && (
                <div aria-hidden="true" style={{height:3,overflow:'hidden',background:'#D7DDCF',position:'absolute',bottom:-3,left:0,right:0,zIndex:2,pointerEvents:'none'}}>
                    <span ref={landingProgressRef} style={{display:'block',height:'100%',background:'#C86C42',transformOrigin:'left',transform:'scaleX(0)'}} />
                </div>
            )}
        </header>
    );
}
