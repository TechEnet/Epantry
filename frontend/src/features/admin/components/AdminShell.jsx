import { useState } from "react";

import {
  BadgeCheck,
  BarChart3,
  Bot,
  Boxes,
  ChefHat,
  CircleUserRound,
  Crown,
  DatabaseZap,
  FileSearch,
  Flag,
  FlaskConical,
  Home,
  LayoutDashboard,
  List,
  LockKeyhole,
  Megaphone,
  Menu,
  Package,
  ScanLine,
  Search,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Users,
  WalletCards,
  Webhook,
  X,
} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";

import AdminGlobalSearch from "../../adminGovernance/components/AdminGlobalSearch";

import { useAdmin } from "../context/AdminContext";

function formatRoleKey(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function visibleLabel(item) {
  return item.screenLabel || item.label;
}

function routeMatchesItem(item, pathname) {
  if (item.end) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function AdminNavigationItem({ item, collapsed = false, onNavigate }) {
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
            ? "focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-[18px] border text-sm font-bold transition duration-200"
            : "focus-ring flex min-h-[44px] items-center gap-3 rounded-[17px] border px-3 py-2.5 text-sm font-bold transition duration-200",
          isActive
            ? "border-[#d6ad78] bg-[linear-gradient(145deg,#f5ddb9_0%,#e8c48f_100%)] text-[#3f3124] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_5px_12px_rgba(118,83,47,0.14)]"
            : "border-[#dfd0bb] bg-[linear-gradient(145deg,rgba(255,254,250,0.96)_0%,rgba(248,239,226,0.96)_100%)] text-[#5a4938] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_8px_rgba(92,65,37,0.07)] hover:-translate-y-px hover:border-[#ccb590] hover:bg-[#fffdf8] hover:text-[#17483b] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_5px_12px_rgba(92,65,37,0.10)]",
        ].join(" ")
      }
    >
      <Icon size={18} aria-hidden="true" className="shrink-0 self-start" />

      <span
        className={[
          "min-w-0 flex-1 whitespace-normal leading-5 transition-[max-width,opacity,transform] duration-200 ease-out",
          collapsed
            ? "max-w-0 -translate-x-1 overflow-hidden opacity-0"
            : "max-w-[240px] translate-x-0 opacity-100",
        ].join(" ")}
      >
        {visibleLabel(item)}
      </span>
    </NavLink>
  );
}

function AdminNavigationGroup({
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
          "focus-ring mx-auto flex h-11 w-11 items-center justify-center rounded-[18px] border transition duration-200",
          active
            ? "border-[#d6ad78] bg-[linear-gradient(145deg,#f5ddb9_0%,#e8c48f_100%)] text-[#3f3124] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_5px_12px_rgba(118,83,47,0.14)]"
            : "border-[#dfd0bb] bg-[linear-gradient(145deg,#fffdf8_0%,#f3e8d7_100%)] text-[#5a4938] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_3px_8px_rgba(92,65,37,0.08)] hover:-translate-y-px hover:text-[#17483b]",
        ].join(" ")}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="group/admin-section relative shrink-0 pb-3.5 pr-3.5 pt-2">
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
            "flex min-h-[36px] items-center gap-2 rounded-[15px] border border-[#315f50]/80 bg-[linear-gradient(145deg,#1c4b3f_0%,#153d33_100%)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#f5ead8] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_4px_10px_rgba(35,52,44,0.10)]",
            active ? "ring-1 ring-[#d9b36f]/60" : "",
          ].join(" ")}
        >
          <Icon size={14} aria-hidden="true" className="shrink-0" />

          <span className="min-w-0 flex-1 whitespace-normal leading-4">
            {group.label}
          </span>
        </div>

        <div className="mt-2 space-y-1.5">
          {group.items.map((item) => (
            <AdminNavigationItem
              key={`${item.to}:${item.label}`}
              item={item}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const ADMIN_SIDEBAR_STORAGE_KEY = "epantry_admin_sidebar_collapsed";

function readAdminSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === "1";
}

export default function AdminShell({
  title,
  description,
  children,
  actions = null,
  flushTop = false,
}) {
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    readAdminSidebarCollapsed
  );

  const [sidebarHovered, setSidebarHovered] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const sidebarOpen = !sidebarCollapsed || sidebarHovered;

  function collapseSidebarAfterNavigation() {
    setSidebarCollapsed(true);
    setSidebarHovered(false);
    setMobileSidebarOpen(false);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, "1");
    }
  }

  function openSidebar() {
    setSidebarCollapsed(false);
    setSidebarHovered(false);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, "0");
    }
  }

  const {
    isRootSuperAdmin,
    adminRoleKeys,
    adminPermissionKeys,
    hasAdminPermission,
  } = useAdmin();

  const canReadIdentity =
    hasAdminPermission("admin.dashboard.read") ||
    hasAdminPermission("host.review.read") ||
    hasAdminPermission("marketplace.read") ||
    hasAdminPermission("trust_safety.read");

  const navigationGroups = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      items: [
        {
          label: "Admin Overview",
          to: "/admin",
          icon: LayoutDashboard,
          end: true,
          visible: true,
        },
      ],
    },
    {
      id: "insights-demand",
      label: "Insights & Demand",
      icon: BarChart3,
      items: [
        {
          label: "Analytics Overview",
          to: "/admin/analytics",
          icon: BarChart3,
          visible:
            hasAdminPermission("admin.dashboard.read") ||
            hasAdminPermission("admin.audit.read") ||
            hasAdminPermission("marketplace.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Customer Search Demand",
          to: "/admin/search-demand",
          icon: Search,
          visible:
            hasAdminPermission("admin.dashboard.read") ||
            hasAdminPermission("marketplace.read") ||
            hasAdminPermission("catalog.read"),
        },
      ],
    },
    {
      id: "people-access",
      label: "People & Access",
      icon: Users,
      items: [
        {
          label: "People & Businesses",
          to: "/admin/users-organizations",
          icon: CircleUserRound,
          visible: canReadIdentity,
        },
        {
          label: "Access & Permissions",
          to: "/admin/roles",
          icon: ShieldCheck,
          visible: isRootSuperAdmin,
        },
      ],
    },
    {
      id: "catalog-food-data",
      label: "Catalog & Food Data",
      icon: Package,
      items: [
        {
          label: "Catalog & Listings",
          to: "/admin/catalog",
          icon: Package,
          visible:
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("recipe.read"),
        },
        {
          label: "Product Review",
          to: "/admin/product-intelligence",
          icon: ScanLine,
          visible:
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Bulk Product Review",
          to: "/admin/bulk-product-review",
          icon: Boxes,
          visible:
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Image Privacy & Safety Review",
          to: "/admin/privacy",
          icon: ShieldCheck,
          visible: hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Brands & Claims",
          to: "/admin/brands",
          icon: BadgeCheck,
          visible:
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Ingredients",
          to: "/admin/catalog/ingredients",
          icon: List,
          visible: hasAdminPermission("catalog.read"),
        },
        {
          label: "Data Quality",
          to: "/admin/data-quality",
          icon: FileSearch,
          visible:
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Recipes",
          to: "/admin/recipes",
          icon: ChefHat,
          visible: hasAdminPermission("recipe.read"),
        },
        {
          label: "Recipe Review",
          to: "/admin/recipe-review",
          icon: FlaskConical,
          visible:
            hasAdminPermission("recipe.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Food Intelligence",
          to: "/admin/food-intelligence",
          icon: DatabaseZap,
          visible:
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("recipe.read") ||
            hasAdminPermission("trust_safety.read"),
        },
      ],
    },
    {
      id: "hosts-marketplace",
      label: "Hosts & Marketplace",
      icon: Store,
      items: [
        {
          label: "Host Approvals",
          to: "/admin/host-operations",
          icon: Store,
          visible:
            hasAdminPermission("host.review.read") ||
            hasAdminPermission("marketplace.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Orders & Disputes",
          to: "/admin/orders-disputes",
          icon: ShoppingBasket,
          visible:
            hasAdminPermission("marketplace.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Integrations",
          to: "/admin/integrations",
          icon: Webhook,
          visible: hasAdminPermission("marketplace.read"),
        },
      ],
    },
    {
      id: "finance-memberships",
      label: "Finance & Memberships",
      icon: WalletCards,
      items: [
        {
          label: "Earnings & Collections",
          to: "/admin/earnings",
          icon: WalletCards,
          visible:
            isRootSuperAdmin ||
            hasAdminPermission("finance.read") ||
            hasAdminPermission("admin.dashboard.read"),
        },
        {
          label: "Payments & Settlements",
          to: "/admin/finance-ops",
          icon: WalletCards,
          visible: hasAdminPermission("finance.read"),
        },
        {
          label: "Pro Memberships",
          to: "/admin/pro",
          icon: Crown,
          visible: isRootSuperAdmin,
        },
      ],
    },
    {
      id: "content-promotions",
      label: "Content & Promotions",
      icon: Megaphone,
      items: [
        {
          label: "Homepage & Content",
          to: "/admin/cms",
          icon: Boxes,
          visible: hasAdminPermission("cms.read"),
        },
        {
          label: "Community & Creator Reviews",
          to: "/admin/community",
          icon: Users,
          visible:
            hasAdminPermission("recipe.read") ||
            hasAdminPermission("trust_safety.read"),
        },
        {
          label: "Ads & Promotions Review",
          to: "/admin/ad-review",
          icon: Megaphone,
          visible:
            hasAdminPermission("marketplace.read") ||
            hasAdminPermission("trust_safety.read"),
        },
      ],
    },
    {
      id: "safety-platform",
      label: "Safety & Platform Control",
      icon: ShieldAlert,
      items: [
        {
          label: "Platform Rules & Features",
          to: "/admin/policy",
          icon: Flag,
          visible: hasAdminPermission("admin.dashboard.read"),
        },
        {
          label: "Trust & Safety",
          to: "/admin/trust-safety",
          icon: ShieldAlert,
          visible: hasAdminPermission("trust_safety.read"),
        },

        {
          label: "Activity & System Logs",
          to: "/admin/audit",
          icon: ScrollText,
          visible: hasAdminPermission("admin.audit.read"),
        },
        {
          label: "AI Quality Review",
          to: "/admin/ai-quality",
          icon: Bot,
          visible:
            hasAdminPermission("admin.audit.read") ||
            hasAdminPermission("catalog.read") ||
            hasAdminPermission("trust_safety.read"),
        },
      ],
    },
    {
      id: "account-security",
      label: "Account & Security",
      icon: LockKeyhole,
      items: [
        {
          label: "Login & Security",
          to: "/account/security/mfa",
          icon: LockKeyhole,
          visible: true,
        },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible),
    }))
    .filter((group) => group.items.length > 0);

  const primaryRole = isRootSuperAdmin
    ? "Super Admin"
    : formatRoleKey(adminRoleKeys[0]) || "Internal Admin";

  return (
    <main className="min-h-screen bg-[#f7f5ef] lg:min-h-[calc(100vh-72px)]">
      <div className="sticky top-0 z-[105] flex h-12 items-center border-b border-stone-200/70 bg-[#f7f5ef]/92 px-2.5 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="focus-ring grid size-9 place-items-center rounded-[13px] border border-stone-200 bg-white/88 text-stone-800 shadow-[0_7px_20px_rgba(28,25,23,0.10)]"
          aria-label="Open Super Admin menu"
          aria-expanded={mobileSidebarOpen}
        >
          <Menu size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <span className="ml-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-stone-700">
          Super Admin
        </span>
      </div>

      {mobileSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[120] bg-stone-950/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close Super Admin menu"
        />
      ) : null}

      <div
        className={["page-shell", flushTop ? "py-0" : "py-3 sm:py-4"].join(" ")}
      >
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div
            className={[
              "grid min-h-0 lg:transition-[grid-template-columns] lg:duration-[460ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
              sidebarOpen
                ? "lg:grid-cols-[248px_minmax(0,1fr)]"
                : "lg:grid-cols-[70px_minmax(0,1fr)]",
            ].join(" ")}
          >
            <aside
              className={[
                "fixed inset-y-0 left-0 z-[130] w-[min(88vw,330px)] overflow-y-auto border-r border-stone-200 bg-[#faf8f4] shadow-[18px_0_50px_rgba(28,25,23,0.18)] transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:relative lg:inset-auto lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible lg:border-r lg:border-stone-200 lg:bg-[#faf8f4] lg:shadow-none",
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
                    ? "lg:w-[248px] lg:bg-[#faf8f4] lg:px-4 lg:py-5 lg:shadow-none"
                    : "lg:w-[70px] lg:rounded-r-[26px] lg:border-r lg:border-stone-200 lg:bg-[#faf8f4] lg:px-3 lg:py-4 lg:shadow-[5px_0_16px_rgba(83,58,33,0.06)]",
                ].join(" ")}
              >
                <div className="mb-3 flex items-center justify-between lg:hidden">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                    Admin navigation
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
                      aria-label="Close Super Admin menu"
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div
                  className={[
                    "shrink-0 rounded-[22px] border border-[#315f50] bg-[linear-gradient(145deg,#17483b_0%,#11382f_100%)] px-3.5 py-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_7px_16px_rgba(31,63,53,0.16)] transition-[opacity,transform] duration-200 ease-out lg:relative lg:z-10 lg:w-full lg:max-w-[220px] lg:self-start",
                    !sidebarOpen ? "lg:hidden" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_8px_rgba(4,120,87,0.22)]">
                      <ShieldCheck size={17} aria-hidden="true" />
                    </div>

                    <div
                      className={[
                        "min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out",
                        !sidebarOpen
                          ? "lg:max-w-0 lg:-translate-x-1 lg:opacity-0"
                          : "lg:max-w-[170px] lg:translate-x-0 lg:opacity-100",
                      ].join(" ")}
                    >
                      <p className="text-[13px] font-black leading-4 text-[#fff7e8]">
                        EPANTRY Admin
                      </p>

                      <p className="mt-1 whitespace-normal text-[10px] font-semibold leading-4 text-[#d7c7aa]">
                        {primaryRole} · {adminPermissionKeys.length} permissions
                      </p>
                    </div>
                  </div>
                </div>

                <nav
                  className={[
                    "relative z-10 mt-4 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overflow-x-visible pb-6 pr-1",
                    sidebarOpen
                      ? "lg:mt-4 lg:gap-3.5 lg:pb-6 lg:pr-1"
                      : "lg:mt-2 lg:gap-1 lg:pb-2 lg:pr-0",
                  ].join(" ")}
                  aria-label="Super Admin workspace"
                >
                  {navigationGroups.map((group) => {
                    const active = group.items.some((item) =>
                      routeMatchesItem(item, location.pathname)
                    );

                    return (
                      <AdminNavigationGroup
                        key={group.id}
                        group={group}
                        collapsed={mobileSidebarOpen ? false : !sidebarOpen}
                        active={active}
                        onNavigate={collapseSidebarAfterNavigation}
                        onOpenSidebar={openSidebar}
                      />
                    );
                  })}
                </nav>

                <div
                  className={[
                    "mt-auto rounded-[18px] border border-[#dfd0bb] bg-[#fffdf8] px-3.5 py-3 text-[10px] font-semibold leading-4 text-[#6b5a48] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] lg:relative lg:z-10 lg:w-full lg:max-w-[220px] lg:self-start",
                    !sidebarOpen ? "lg:hidden" : "",
                  ].join(" ")}
                >
                  Admin tools are grouped by the work they control. Your access
                  decides which tools appear here.
                </div>
              </div>
            </aside>

            <section className="min-w-0 overflow-hidden bg-[#f7f5ef] lg:pl-0">
              <div className="epantry-workspace-canvas">
                <header className="border-b border-stone-200 bg-white px-3 py-2.5 sm:px-5 sm:py-5 lg:px-6">
                  <div className="mb-2 max-w-3xl sm:mb-3">
                    <AdminGlobalSearch />
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-4">
                    <div className="min-w-0">
                      <div className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.11em] text-emerald-800 sm:mb-1 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.13em]">
                        <ShieldCheck size={13} aria-hidden="true" />
                        Secure admin workspace
                      </div>

                      <h1 className="text-[18px] font-black leading-5 tracking-tight text-stone-950 sm:text-2xl sm:leading-tight">
                        {title}
                      </h1>

                      {description ? (
                        <p className="mt-0.5 max-w-3xl text-[8px] font-semibold leading-3.5 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                          {description}
                        </p>
                      ) : null}
                    </div>

                    {actions ? <div className="shrink-0">{actions}</div> : null}
                  </div>
                </header>

                <div className="min-w-0 bg-[#f7f5ef] p-2.5 sm:p-5 lg:p-6">
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
