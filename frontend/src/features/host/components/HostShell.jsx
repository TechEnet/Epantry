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
  LayoutDashboard,
  LockKeyhole,
  ScanLine,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  WalletCards,
  Warehouse,
} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import MobileWorkspaceNav from "../../pwa/components/MobileWorkspaceNav";

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

function HostNavigationItem({ item, collapsed = false, nested = false, onNavigate }) {
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

  const sidebarOpen = !sidebarCollapsed || sidebarHovered;

  const allNavigationItems = navigationGroups.flatMap((group) => group.items);

  const navigationItems = mobileNavigationOrder
    .map((to) => allNavigationItems.find((item) => item.to === to))
    .filter(Boolean);

  function collapseSidebarAfterNavigation() {
    setSidebarCollapsed(true);
    setSidebarHovered(false);

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
    <div className="min-h-[calc(100vh-72px)] bg-[#f7f5ef] pb-20 lg:pb-0">
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
            <aside className="relative border-b border-stone-200 bg-stone-50/80 lg:border-b-0 lg:bg-transparent">
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
                  "p-4 sm:p-5",
                  "lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-full lg:flex-col lg:overflow-visible lg:transform-gpu lg:will-change-[width,padding] lg:transition-[width,padding] lg:duration-[560ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
                  sidebarOpen
                    ? "lg:w-[360px] lg:bg-transparent lg:border-r-0 lg:shadow-none lg:px-5 lg:py-5 lg:pr-[120px]"
                    : "lg:w-[70px] lg:rounded-r-[32px] lg:border-r lg:border-stone-200 lg:bg-stone-50/95 lg:px-3 lg:py-4 lg:shadow-[8px_0_22px_rgba(15,23,42,0.07)]",
                ].join(" ")}
              >
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
                      <p className="truncate text-sm font-black">EPANTRY Host</p>

                      <p className="mt-0.5 truncate text-[11px] font-semibold text-stone-400">
                        {accessLabel} · {identityLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <nav
                  className={[
                    "lg:relative lg:z-10",
                    sidebarOpen
                      ? "mt-3.5 hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-3.5 lg:overflow-y-auto lg:pb-3 lg:pr-1"
                      : "mt-2 hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:pb-2 lg:pr-0",
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
                        collapsed={!sidebarOpen}
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

                <nav
                  className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
                  aria-label="Host workspace"
                >
                  {navigationItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={`${item.to}:${item.screenLabel || item.label}`}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          [
                            "focus-ring inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black",

                            isActive
                              ? "bg-emerald-700 text-white"
                              : "border border-stone-200 bg-white text-stone-600",
                          ].join(" ")
                        }
                      >
                        <Icon size={15} aria-hidden="true" />

                        {visibleLabel(item)}
                      </NavLink>
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

      <MobileWorkspaceNav workspace="host" />
    </div>
  );
}
