import { useState } from "react";

import {
  BadgeCheck,
  Banknote,
  BarChart3,
  Barcode,
  Building2,
  BookOpenCheck,
  Boxes,
  ChefHat,
  FileSearch,
  History,
  Home,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  ScanLine,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  WalletCards,
  Warehouse,
  X,
} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import ExecutionScalePanel from "../../executionScale/components/ExecutionScalePanel";
import HostRetailMediaPage from "../../retailMedia/pages/HostRetailMediaPage";

function visibleLabel(item) {
  return item.screenLabel || item.label;
}

const navigationGroups = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      {
        label: "Dashboard",
        to: "/host/operations",
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: "Business Operations",
        to: "/host/operations-center",
        icon: Store,
        end: true,
      },
    ],
  },
  {
    id: "business-setup",
    label: "Business Setup",
    icon: Building2,
    items: [
      {
        label: "Business Profile",
        to: "/host/business-profile",
        icon: Building2,
      },
    ],
  },
  {
    id: "catalog-listings",
    label: "Catalog & Listings",
    icon: Boxes,
    items: [
      {
        label: "Product Catalog",
        to: "/host/catalog",
        icon: Boxes,
      },
      {
        label: "Scan a Product",
        to: "/host/scan",
        icon: Barcode,
      },
      {
        label: "Add / Edit Products",
        to: "/host/product-intelligence",
        icon: ScanLine,
      },
      {
        label: "Check Product Data",
        to: "/host/data-quality",
        icon: FileSearch,
      },
      {
        label: "Manage Brand",
        to: "/host/brands",
        icon: BadgeCheck,
      },
      {
        label: "Recipe Listings",
        to: "/host/brand-recipes",
        icon: ChefHat,
      },
      {
        label: "Listing History",
        to: "/host/listing-history",
        icon: History,
      },
    ],
  },
  {
    id: "commerce-fulfillment",
    label: "Sell & Fulfill",
    icon: ShoppingBag,
    items: [
      {
        label: "Pricing & Stock",
        to: "/host/marketplace",
        icon: Warehouse,
      },
      {
        label: "Orders",
        to: "/host/orders",
        icon: ShoppingBag,
      },
      {
        label: "Fulfillment",
        to: "/host/fulfillment",
        icon: Truck,
      },
      {
        label: "Earnings",
        to: "/host/earnings",
        icon: Banknote,
      },
      {
        label: "Payments & Finance",
        to: "/host/finance",
        icon: WalletCards,
      },
    ],
  },
  {
    id: "growth-insights",
    label: "Growth & Insights",
    icon: BarChart3,
    items: [
      {
        label: "Campaigns & Promotions",
        to: "/host/campaigns",
        icon: BarChart3,
      },
      {
        label: "Business Analytics",
        to: "/host/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    id: "hospitality",
    label: "Hospitality",
    icon: BookOpenCheck,
    items: [
      {
        label: "Hospitality Operations",
        to: "/host/hospitality",
        icon: BookOpenCheck,
      },
    ],
  },
  {
    id: "account-security",
    label: "Account & Security",
    icon: LockKeyhole,
    items: [
      {
        label: "Team & Documents",
        to: "/host/settings",
        icon: Settings,
      },
      {
        label: "My Profile",
        to: "/host/profile",
        icon: UserRound,
      },
      {
        label: "Login & Security",
        to: "/account/security/mfa",
        icon: LockKeyhole,
      },
    ],
  },
];

const mobileNavigationOrder = [
  "/host/operations",
  "/host/catalog",
  "/host/scan",
  "/host/product-intelligence",
  "/host/data-quality",
  "/host/marketplace",
  "/host/orders",
  "/host/fulfillment",
  "/host/earnings",
  "/host/finance",
  "/host/brand-recipes",
  "/host/listing-history",
  "/host/campaigns",
  "/host/settings",
  "/host/hospitality",
  "/host/analytics",
  "/host/brands",
  "/host/business-profile",
  "/account/security/mfa",
];

function routeMatchesItem(item, pathname) {
  if (item.end) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function HostNavigationItem({
  item,
  collapsed = false,
  nested = false,
  onNavigate,
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? visibleLabel(item) : undefined}
      title={collapsed ? visibleLabel(item) : undefined}
      className={({ isActive }) =>
        [
          collapsed
            ? "focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200"
            : "focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors duration-200",
          nested && !collapsed ? "ml-2" : "",
          isActive
            ? "bg-emerald-700 text-white shadow-sm"
            : "text-stone-600 hover:bg-emerald-50 hover:text-emerald-800",
        ].join(" ")
      }
    >
      <Icon size={18} aria-hidden="true" />

      <span
        className={[
          "min-w-0 flex-1 overflow-hidden whitespace-normal leading-5 transition-[max-width,opacity,transform] duration-200 ease-out",
          collapsed
            ? "max-w-0 -translate-x-1 opacity-0"
            : "max-w-[240px] translate-x-0 opacity-100",
        ].join(" ")}
      >
        {visibleLabel(item)}
      </span>
    </NavLink>
  );
}

function HostNavigationGroup({
  group,
  collapsed,
  active,
  onNavigate,
  onOpenSidebar,
}) {
  const Icon = group.icon;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={group.label}
        title={group.label}
        className={[
          "focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200",
          active
            ? "bg-emerald-700 text-white shadow-sm"
            : "text-stone-600 hover:bg-emerald-50 hover:text-emerald-800",
        ].join(" ")}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="group/host-section">
      <div
        className={[
          "flex items-center gap-2 border-b border-stone-200 px-1 pb-2 text-[11px] font-black uppercase tracking-[0.12em] transition-colors duration-200",
          active
            ? "text-emerald-800"
            : "text-stone-500 group-hover/host-section:text-emerald-700",
        ].join(" ")}
      >
        <Icon size={14} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 whitespace-normal leading-4">
          {group.label}
        </span>
      </div>

      <div className="mt-1.5 space-y-1">
        {group.items.map((item) => (
          <HostNavigationItem
            key={`${item.to}:${item.screenLabel || item.label}`}
            item={item}
            nested
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

const HOST_SIDEBAR_STORAGE_KEY = "epantry_host_sidebar_collapsed";

function readHostSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(HOST_SIDEBAR_STORAGE_KEY) === "1";
}

export default function HostShell({ children }) {
  const location = useLocation();

  const { currentUser, hostAccessStatus } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    readHostSidebarCollapsed
  );

  const [sidebarHovered, setSidebarHovered] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const sidebarOpen = !sidebarCollapsed || sidebarHovered;

  const allNavigationItems = navigationGroups.flatMap((group) => group.items);

  const navigationItems = mobileNavigationOrder
    .map((to) => allNavigationItems.find((item) => item.to === to))
    .filter(Boolean);

  function collapseSidebarAfterNavigation() {
    setSidebarCollapsed(true);
    setSidebarHovered(false);
    setMobileSidebarOpen(false);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(HOST_SIDEBAR_STORAGE_KEY, "1");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | M21 Retail Media
  |--------------------------------------------------------------------------
  */

  const isRetailMediaRoute = location.pathname === "/host/campaigns";

  /*
  |--------------------------------------------------------------------------
  | M22 Execution Scale
  |--------------------------------------------------------------------------
  |
  | Compose into the Host Operations Center.
  |
  | No new application role.
  */

  const isHostOperationsCenterRoute =
    location.pathname === "/host/operations-center";

  const identityLabel =
    currentUser?.displayName ||
    currentUser?.name ||
    currentUser?.email ||
    "Host account";

  const accessLabel =
    hostAccessStatus === "active" ? "Active Host" : "Host workspace";

  return (
    <div className="min-h-screen bg-[#f7f5ef] pb-0 lg:min-h-[calc(100vh-72px)]">
      <div className="sticky top-0 z-[105] flex h-14 items-center border-b border-stone-200/70 bg-[#f7f5ef]/92 px-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="focus-ring grid size-10 place-items-center rounded-[15px] border border-stone-200 bg-white/88 text-stone-800 shadow-[0_7px_20px_rgba(28,25,23,0.10)]"
          aria-label="Open host sidebar"
          aria-expanded={mobileSidebarOpen}
        >
          <Menu size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <span className="ml-3 text-[11px] font-black uppercase tracking-[0.14em] text-stone-700">
          Host workspace
        </span>
      </div>

      {mobileSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[120] bg-stone-950/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close host sidebar"
        />
      ) : null}

      <div className="page-shell py-5 sm:py-7">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div
            className={[
              "grid min-h-[760px] lg:transition-[grid-template-columns] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
              sidebarOpen
                ? "lg:grid-cols-[240px_minmax(0,1fr)]"
                : "lg:grid-cols-[70px_minmax(0,1fr)]",
            ].join(" ")}
          >
            <aside
              className={[
                "fixed inset-y-0 left-0 z-[130] w-[min(88vw,340px)] overflow-y-auto border-r border-stone-200 bg-stone-50/95 shadow-[18px_0_50px_rgba(28,25,23,0.18)] transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:relative lg:inset-auto lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible lg:border-b-0 lg:border-r-0 lg:bg-transparent lg:shadow-none",
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
              ].join(" ")}
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
                  "flex min-h-full flex-col p-4 sm:p-5",
                  "lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-full lg:flex-col lg:overflow-visible lg:transform-gpu lg:will-change-[width,padding] lg:transition-[width,padding] lg:duration-[560ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
                  sidebarOpen
                    ? "lg:w-[360px] lg:bg-transparent lg:border-r-0 lg:shadow-none lg:px-5 lg:py-5 lg:pr-[120px]"
                    : "lg:w-[70px] lg:rounded-r-[32px] lg:border-r lg:border-stone-200 lg:bg-stone-50/95 lg:px-3 lg:py-4 lg:shadow-[8px_0_22px_rgba(15,23,42,0.07)]",
                ].join(" ")}
              >
                <div className="mb-3 flex items-center justify-between lg:hidden">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                    Host navigation
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
                      aria-label="Close host sidebar"
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {sidebarOpen ? (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-[240px] bg-stone-50/95 lg:block" />
                    <div className="pointer-events-none absolute inset-y-0 left-[190px] z-0 hidden w-[170px] rounded-r-[999px] border-r border-stone-200 bg-stone-50/95 shadow-[12px_0_30px_rgba(15,23,42,0.08)] lg:block" />
                  </>
                ) : null}
                <div
                  className={[
                    "rounded-[18px] bg-stone-950 px-3.5 py-3 text-white transition-[opacity,transform] duration-200 ease-out lg:relative lg:z-10 lg:w-full lg:max-w-[220px] lg:self-start",
                    !sidebarOpen ? "lg:hidden" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                      <Store size={17} aria-hidden="true" />
                    </div>

                    <div
                      className={[
                        "min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out",
                        !sidebarOpen
                          ? "lg:max-w-0 lg:-translate-x-1 lg:opacity-0"
                          : "lg:max-w-[170px] lg:translate-x-0 lg:opacity-100",
                      ].join(" ")}
                    >
                      <p className="truncate text-sm font-black">
                        EPANTRY Host
                      </p>

                      <p className="mt-0.5 truncate text-[11px] font-semibold text-stone-400">
                        {accessLabel} · {identityLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <nav
                  className={[
                    "relative z-10 mt-3.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pb-3 pr-1",
                    sidebarOpen
                      ? "lg:mt-3.5 lg:gap-3.5 lg:pb-3 lg:pr-1"
                      : "lg:mt-2 lg:gap-1 lg:pb-2 lg:pr-0",
                  ].join(" ")}
                  aria-label="Host workspace"
                >
                  {navigationGroups.map((group) => {
                    const active = group.items.some((item) =>
                      routeMatchesItem(item, location.pathname)
                    );

                    return (
                      <HostNavigationGroup
                        key={group.id}
                        group={group}
                        collapsed={mobileSidebarOpen ? false : !sidebarOpen}
                        active={active}
                        onNavigate={collapseSidebarAfterNavigation}
                        onOpenSidebar={() => {
                          setSidebarCollapsed(false);
                          setSidebarHovered(false);

                          if (typeof window !== "undefined") {
                            window.sessionStorage.setItem(
                              HOST_SIDEBAR_STORAGE_KEY,
                              "0"
                            );
                          }
                        }}
                      />
                    );
                  })}
                </nav>
              </div>
            </aside>

            <section
              className={[
                "min-w-0 overflow-hidden bg-[#f7f5ef] lg:transition-[padding-left] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
                sidebarOpen ? "lg:pl-[120px]" : "lg:pl-0",
              ].join(" ")}
            >
              <div className="epantry-workspace-canvas">
                {isRetailMediaRoute ? (
                  <HostRetailMediaPage />
                ) : (
                  <>
                    {children}

                    {isHostOperationsCenterRoute ? (
                      <div className="px-4 pb-7 sm:px-6 lg:px-7">
                        <ExecutionScalePanel />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
