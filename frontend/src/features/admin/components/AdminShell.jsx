import { useState } from 'react';

import {
    BadgeCheck,
    Bot,
    Boxes,
    ChefHat,
    CircleUserRound,
    DatabaseZap,
    FileSearch,
    Flag,
    FlaskConical,
    History,
    Home,
    LayoutDashboard,
    List,
    LockKeyhole,
    Menu,
    Megaphone,
    Package,
    ScanLine,
    ScrollText,
    ShieldAlert,
    ShieldCheck,
    ShoppingBasket,
    Store,
    Users,
    WalletCards,
    Webhook,
    X,
  } from 'lucide-react';
  
  import {
    NavLink,
  } from 'react-router-dom';
  
  import AdminGlobalSearch from '../../adminGovernance/components/AdminGlobalSearch';
  
  import {
    useAdmin,
  } from '../context/AdminContext';
  
  function formatRoleKey(value) {
    return String(value || '')
        .split('_')
        .filter(Boolean)
        .map(
            (part) =>
                `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
        )
        .join(' ');
  }
  
  function visibleLabel(item) {
    return item.screenLabel ||
        item.label;
  }
  
  function AdminNavigationItem({
    item,
    collapsed = false,
    onNavigate,
  }) {
    const Icon =
        item.icon;
  
    return (
        <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            aria-label={collapsed ? visibleLabel(item) : undefined}
            title={collapsed ? visibleLabel(item) : undefined}
            className={({
                isActive,
            }) => [
                collapsed
                    ? 'focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200'
                    : 'focus-ring flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-colors duration-200',
                isActive
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950',
            ].join(' ')}
        >
            <Icon
                size={18}
                aria-hidden="true"
            />
  
            <span
                className={[
                    'overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out',
                    collapsed
                        ? 'max-w-0 -translate-x-1 opacity-0'
                        : 'max-w-[260px] translate-x-0 opacity-100',
                ].join(' ')}
            >
                {visibleLabel(item)}
            </span>
        </NavLink>
    );
  }
  
  const ADMIN_SIDEBAR_STORAGE_KEY =
    'epantry_admin_sidebar_collapsed';
  
  function readAdminSidebarCollapsed() {
    if (typeof window === 'undefined') {
        return false;
    }
  
    return window.sessionStorage.getItem(
        ADMIN_SIDEBAR_STORAGE_KEY,
    ) === '1';
  }
  
  export default function AdminShell({
    title,
    description,
    children,
    actions = null,
  }) {
    const [sidebarCollapsed, setSidebarCollapsed] =
        useState(readAdminSidebarCollapsed);

    const [sidebarHovered, setSidebarHovered] =
        useState(false);

    const [mobileSidebarOpen, setMobileSidebarOpen] =
        useState(false);

    const sidebarOpen =
        !sidebarCollapsed || sidebarHovered;

    function collapseSidebarAfterNavigation() {
        setSidebarCollapsed(true);
        setSidebarHovered(false);
        setMobileSidebarOpen(false);

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(
                ADMIN_SIDEBAR_STORAGE_KEY,
                '1',
            );
        }
    }

    const {
        isRootSuperAdmin,
        adminRoleKeys,
        adminPermissionKeys,
        hasAdminPermission,
    } =
        useAdmin();
  
    const canReadIdentity =
        hasAdminPermission(
            'admin.dashboard.read',
        ) ||
        hasAdminPermission(
            'host.review.read',
        ) ||
        hasAdminPermission(
            'marketplace.read',
        ) ||
        hasAdminPermission(
            'trust_safety.read',
        );
  
    const navigationItems = [
        {
            // Preserve the frozen legacy label while M17 exposes the A01 screen name.
            label:
                'Overview',
            screenLabel:
                'A01 Command Center',
            to:
                '/admin',
            icon:
                LayoutDashboard,
            end:
                true,
            visible:
                true,
        },
  
        {
            label:
                'Users & Organizations',
            screenLabel:
                'A02 Users & Organizations',
            to:
                '/admin/users-organizations',
            icon:
                CircleUserRound,
            visible:
                canReadIdentity,
        },
  
        {
            label:
                'Roles & Permissions',
            screenLabel:
                'A03 Roles & Permissions',
            to:
                '/admin/roles',
            icon:
                ShieldCheck,
            visible:
                isRootSuperAdmin,
        },
  
        {
            label:
                'Catalog Products',
            screenLabel:
                'A04 Catalog Products',
            to:
                '/admin/catalog',
            icon:
                Package,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ),
        },
  
        {
            label:
                'Product Intelligence',
            screenLabel:
                'A05 Product Review / NPI',
            to:
                '/admin/product-intelligence',
            icon:
                ScanLine,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Bulk Product Review',
            screenLabel:
                'Bulk Product Review',
            to:
                '/admin/bulk-product-review',
            icon:
                Boxes,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Brand Authority',
            screenLabel:
                'A06 Brand / Claims',
            to:
                '/admin/brands',
            icon:
                BadgeCheck,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Ingredients',
            screenLabel:
                'A07 Ingredient Dictionary',
            to:
                '/admin/catalog/ingredients',
            icon:
                List,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ),
        },
  
        {
            label:
                'Data Quality',
            screenLabel:
                'A08 Data Quality / Duplicates',
            to:
                '/admin/data-quality',
            icon:
                FileSearch,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Recipe Management',
            screenLabel:
                'A09 Recipe Management',
            to:
                '/admin/recipes',
            icon:
                ChefHat,
            visible:
                hasAdminPermission(
                    'recipe.read',
                ),
        },
  
        {
            label:
                'Listing History',
            to:
                '/admin/listing-history',
            icon:
                History,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'recipe.read',
                ),
        },
  
        {
            label:
                'Recipe Review',
            screenLabel:
                'A10 Recipe Version Review',
            to:
                '/admin/recipe-review',
            icon:
                FlaskConical,
            visible:
                hasAdminPermission(
                    'recipe.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Host Review',
            screenLabel:
                'A11 Host / KYB Governance',
            to:
                '/admin/host-operations',
            icon:
                Store,
            visible:
                hasAdminPermission(
                    'host.review.read',
                ) ||
                hasAdminPermission(
                    'marketplace.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Marketplace Ops',
            screenLabel:
                'A12 Orders / Disputes',
            to:
                '/admin/orders-disputes',
            icon:
                ShoppingBasket,
            visible:
                hasAdminPermission(
                    'marketplace.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Finance Operations',
            screenLabel:
                'A13 Finance / Settlements',
            to:
                '/admin/finance-ops',
            icon:
                WalletCards,
            visible:
                hasAdminPermission(
                    'finance.read',
                ),
        },
  
        {
            label:
                'Integration Ops',
            screenLabel:
                'A14 Retailer / Integration Ops',
            to:
                '/admin/integrations',
            icon:
                Webhook,
            visible:
                hasAdminPermission(
                    'marketplace.read',
                ),
        },
  
        {
            label:
                'Rules & Feature Flags',
            screenLabel:
                'A15 Rules / Feature Flags',
            to:
                '/admin/policy',
            icon:
                Flag,
            visible:
                hasAdminPermission(
                    'admin.dashboard.read',
                ),
        },
  
        {
            label:
                'CMS',
            screenLabel:
                'A16 CMS / Home Collections',
            to:
                '/admin/cms',
            icon:
                Boxes,
            visible:
                hasAdminPermission(
                    'cms.read',
                ),
        },
  
        {
            label:
                'Trust & Safety',
            screenLabel:
                'A17 Trust & Safety / Claims',
            to:
                '/admin/trust-safety',
            icon:
                ShieldAlert,
            visible:
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Privacy Ops',
            screenLabel:
                'A18 Privacy / Consent Ops',
            to:
                '/admin/privacy',
            icon:
                Users,
            visible:
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Audit Explorer',
            screenLabel:
                'A19 Audit / Observability',
            to:
                '/admin/audit',
            icon:
                ScrollText,
            visible:
                hasAdminPermission(
                    'admin.audit.read',
                ),
        },
  
        {
            label:
                'Ad Review',
            screenLabel:
                'A20 Ad Review / Policy',
            to:
                '/admin/ad-review',
            icon:
                Megaphone,
            visible:
                hasAdminPermission(
                    'marketplace.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'AI Quality',
            screenLabel:
                'A21 AI / Extraction Quality',
            to:
                '/admin/ai-quality',
            icon:
                Bot,
            visible:
                hasAdminPermission(
                    'admin.audit.read',
                ) ||
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Food Intelligence',
            to:
                '/admin/food-intelligence',
            icon:
                DatabaseZap,
            visible:
                hasAdminPermission(
                    'catalog.read',
                ) ||
                hasAdminPermission(
                    'recipe.read',
                ) ||
                hasAdminPermission(
                    'trust_safety.read',
                ),
        },
  
        {
            label:
                'Security',
            to:
                '/account/security/mfa',
            icon:
                LockKeyhole,
            visible:
                true,
        },
    ].filter(
        (item) =>
            item.visible,
    );
  
    const primaryRole =
        isRootSuperAdmin
            ? 'Super Admin'
            : formatRoleKey(
                adminRoleKeys[0],
            ) ||
            'Internal Admin';
  
    return (
        <main className="min-h-screen bg-[#f7f5ef] lg:min-h-[calc(100vh-72px)]">
            <div className="sticky top-0 z-[105] flex h-14 items-center border-b border-stone-200/70 bg-[#f7f5ef]/92 px-3 backdrop-blur-xl lg:hidden">
                <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="focus-ring grid size-10 place-items-center rounded-[15px] border border-stone-200 bg-white/88 text-stone-800 shadow-[0_7px_20px_rgba(28,25,23,0.10)]"
                    aria-label="Open admin sidebar"
                    aria-expanded={mobileSidebarOpen}
                >
                    <Menu size={19} strokeWidth={2.2} aria-hidden="true" />
                </button>

                <span className="ml-3 text-[11px] font-black uppercase tracking-[0.14em] text-stone-700">
                    Super Admin workspace
                </span>
            </div>

            {mobileSidebarOpen ? (
                <button
                    type="button"
                    className="fixed inset-0 z-[120] bg-stone-950/30 backdrop-blur-[2px] lg:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-label="Close admin sidebar"
                />
            ) : null}

            <div className="page-shell py-5 sm:py-7">
                <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
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
                                'fixed inset-y-0 left-0 z-[130] w-[min(88vw,350px)] overflow-y-auto border-r border-stone-200 bg-stone-50/95 shadow-[18px_0_50px_rgba(28,25,23,0.18)] transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:relative lg:inset-auto lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible lg:border-b-0 lg:border-r-0 lg:bg-transparent lg:shadow-none',
                                mobileSidebarOpen
                                    ? 'translate-x-0'
                                    : '-translate-x-full',
                            ].join(' ')}
                        >
                            <div
                                onMouseEnter={() => {
                                    if (sidebarCollapsed) {
                                        setSidebarHovered(true);
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (sidebarCollapsed) {
                                        setSidebarHovered(false);
                                    }
                                }}
                                className={[
                                    'flex min-h-full flex-col p-4 sm:p-5',
                                    'lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-full lg:flex-col lg:overflow-visible lg:transform-gpu lg:will-change-[width,padding] lg:transition-[width,padding] lg:duration-[560ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                                    sidebarOpen
                                        ? 'lg:w-[390px] lg:bg-transparent lg:border-r-0 lg:shadow-none lg:px-5 lg:py-5 lg:pr-[130px]'
                                        : 'lg:w-[70px] lg:rounded-r-[32px] lg:border-r lg:border-stone-200 lg:bg-stone-50/95 lg:px-3 lg:py-4 lg:shadow-[8px_0_22px_rgba(15,23,42,0.07)]',
                                ].join(' ')}
                            >
                                <div className="mb-3 flex items-center justify-between lg:hidden">
                                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                                        Administration
                                    </span>

                                    <div className="flex items-center gap-2">
                                        <NavLink
                                            to="/"
                                            onClick={() => setMobileSidebarOpen(false)}
                                            className="focus-ring grid size-9 place-items-center rounded-[14px] border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
                                            aria-label="Back to EPANTRY home"
                                            title="Back to home"
                                        >
                                            <Home size={17} aria-hidden="true" />
                                        </NavLink>

                                        <button
                                            type="button"
                                            onClick={() => setMobileSidebarOpen(false)}
                                            className="focus-ring grid size-9 place-items-center rounded-[14px] border border-stone-200 bg-white text-stone-700 shadow-sm"
                                            aria-label="Close admin sidebar"
                                        >
                                            <X size={17} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>

                                {sidebarOpen ? (
                                    <>
                                        <div className="pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-[260px] bg-stone-50/95 lg:block" />
                                        <div className="pointer-events-none absolute inset-y-0 left-[210px] z-0 hidden w-[180px] rounded-r-[999px] border-r border-stone-200 bg-stone-50/95 shadow-[12px_0_30px_rgba(15,23,42,0.08)] lg:block" />
                                    </>
                                ) : null}
                                <div
                                    className={[
                                        'rounded-[22px] bg-stone-950 p-5 text-white transition-[opacity,transform] duration-200 ease-out lg:relative lg:z-10 lg:w-full lg:max-w-[220px] lg:self-start',
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
                                                    : 'lg:max-w-[220px] lg:translate-x-0 lg:opacity-100',
                                            ].join(' ')}
                                        >
                                            <p className="truncate text-base font-black tracking-tight">
                                                EPANTRY
                                            </p>
  
                                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                                                Governance Console
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
                                            Current access
                                        </p>
  
                                        <p className="mt-1.5 text-sm font-bold text-white">
                                            {primaryRole}
                                        </p>
  
                                        <p className="mt-1 text-xs text-stone-400">
                                            {adminPermissionKeys.length} effective permissions
                                        </p>
                                    </div>
                                </div>
  
                                <nav
                                    className={[
                                        'relative z-10 mt-5 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1',
                                        sidebarOpen
                                            ? 'lg:mt-5 lg:pr-1'
                                            : 'lg:mt-2 lg:pr-0',
                                    ].join(' ')}
                                    aria-label="Administration"
                                >
                                    {navigationItems.map(
                                        (item) => (
                                            <AdminNavigationItem
                                                key={`${item.to}:${item.screenLabel || item.label}`}
                                                item={item}
                                                collapsed={mobileSidebarOpen ? false : !sidebarOpen}
                                                onNavigate={collapseSidebarAfterNavigation}
                                            />
                                        ),
                                    )}
                                </nav>
  

  
                                <div
                                    className={[
                                        'mt-5 rounded-2xl border border-stone-200 bg-white p-4 lg:relative lg:z-10 lg:w-full lg:max-w-[220px] lg:self-start',
                                        !sidebarOpen
                                            ? 'lg:hidden'
                                            : '',
                                    ].join(' ')}
                                >
                                    <p className="text-[11px] leading-5 text-stone-500">
                                        Specialized admin profiles are M03 permission assignments, not new application access types. Top-level access remains Customer, Host and Super Admin.
                                    </p>
                                </div>
                            </div>
                        </aside>
  
                        <section
                            className={[
                                'min-w-0 lg:transition-[padding-left] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                                sidebarOpen
                                    ? 'lg:pl-[130px]'
                                    : 'lg:pl-0',
                            ].join(' ')}
                        >
                            <div className="epantry-workspace-canvas">
                            <header className="border-b border-stone-200 bg-white px-5 py-5 sm:px-7 sm:py-6">
                                <div className="mb-5 max-w-3xl">
                                    <AdminGlobalSearch />
                                </div>
  
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                                            <ShieldCheck
                                                size={13}
                                                aria-hidden="true"
                                            />
  
                                            Secure admin workspace
                                        </div>
  
                                        <h1 className="text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                                            {title}
                                        </h1>
  
                                        {description ? (
                                            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                                                {description}
                                            </p>
                                        ) : null}
                                    </div>
  
                                    {actions ? (
                                        <div className="shrink-0">
                                            {actions}
                                        </div>
                                    ) : null}
                                </div>
                            </header>
  
                            <div className="min-w-0 bg-[#f7f5ef] p-4 sm:p-6 lg:p-7">
                                {children}
                            </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
  }
