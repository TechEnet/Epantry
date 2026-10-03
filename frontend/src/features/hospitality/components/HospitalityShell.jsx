import {
  BookOpenCheck,
  Building2,
  Calculator,
  ChefHat,
  ClipboardList,
  FileSearch,
  Home,
  LayoutDashboard,
  Menu,
  PackageSearch,
  ScrollText,
  ShoppingCart,
  Store,
  Truck,
  X,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useState } from "react";

const NAV_ITEMS = [
  {
    label: "Overview",
    to: "/host/hospitality",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Outlets & locations",
    to: "/host/hospitality/outlets",
    icon: Building2,
  },
  {
    label: "Suppliers",
    to: "/host/hospitality/suppliers",
    icon: Truck,
  },
  {
    label: "Ingredients & products",
    to: "/host/hospitality/products",
    icon: PackageSearch,
  },
  {
    label: "Kitchen recipes",
    to: "/host/hospitality/recipes",
    icon: ChefHat,
  },
  {
    label: "Menus",
    to: "/host/hospitality/menus",
    icon: ClipboardList,
  },
  {
    label: "Purchasing",
    to: "/host/hospitality/procurement",
    icon: ShoppingCart,
  },
  {
    label: "Food costing",
    to: "/host/hospitality/costing",
    icon: Calculator,
  },
  {
    label: "Dish records",
    to: "/host/hospitality/dish-passports",
    icon: FileSearch,
  },
  {
    label: "Published records",
    to: "/host/hospitality/grey-book",
    icon: BookOpenCheck,
  },
  {
    label: "Changes & history",
    to: "/host/hospitality/change-management",
    icon: ScrollText,
  },
];

function NavigationItem({ item, compact = false, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={compact ? item.label : undefined}
      className={({ isActive }) =>
        [
          "focus-ring flex items-center rounded-[16px] font-bold transition-all duration-200",
          compact
            ? "h-11 w-11 justify-center px-0"
            : "min-h-11 gap-3 px-3.5 py-2.5 text-[13px]",
          isActive
            ? "bg-emerald-700 text-white shadow-[0_8px_22px_rgba(4,120,87,0.18)]"
            : "text-stone-600 hover:bg-white hover:text-stone-950 hover:shadow-sm",
        ].join(" ")
      }
    >
      <Icon size={18} strokeWidth={2.1} aria-hidden="true" />
      {compact ? null : <span className="min-w-0 truncate">{item.label}</span>}
    </NavLink>
  );
}

export default function HospitalityShell({ children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopHovered, setDesktopHovered] = useState(false);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f7f5ef]">
      <div className="sticky top-0 z-[95] flex h-14 items-center border-b border-stone-200/70 bg-[#f7f5ef]/94 px-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="focus-ring grid size-10 place-items-center rounded-[15px] border border-stone-200 bg-white text-stone-800 shadow-[0_7px_20px_rgba(28,25,23,0.08)]"
          aria-label="Open hospitality navigation"
          aria-expanded={mobileSidebarOpen}
        >
          <Menu size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <div className="ml-3 min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-stone-700">
            Hospitality workspace
          </p>
          <p className="truncate text-[10px] font-semibold text-stone-500">
            Outlets, suppliers & kitchen operations
          </p>
        </div>
      </div>

      {mobileSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[120] bg-stone-950/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close hospitality navigation"
        />
      ) : null}

      <div className="page-shell pt-0 pb-5 sm:pt-0 sm:pb-7">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div className="grid min-h-[760px] lg:grid-cols-[70px_minmax(0,1fr)]">
            <aside className="relative hidden bg-stone-50/95 lg:block">
              <div
                onMouseEnter={() => setDesktopHovered(true)}
                onMouseLeave={() => setDesktopHovered(false)}
                className={[
                  "absolute inset-y-0 left-0 z-30 flex h-full flex-col border-r border-stone-200 bg-stone-50/97 py-4 shadow-[8px_0_24px_rgba(15,23,42,0.06)] transition-[width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  desktopHovered
                    ? "w-[300px] rounded-r-[32px] px-4"
                    : "w-[70px] rounded-r-[28px] px-3",
                ].join(" ")}
              >
                {desktopHovered ? (
                  <div className="rounded-[18px] bg-stone-950 px-3.5 py-3 text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600">
                        <Store size={17} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">Hospitality</p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold text-stone-400">
                          Outlets, suppliers & kitchen operations
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-[16px] bg-stone-950 text-white shadow-sm">
                    <Store size={18} aria-hidden="true" />
                  </div>
                )}

                <nav
                  className={[
                    "mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto pb-2",
                    desktopHovered ? "gap-1.5 pr-1" : "items-center gap-1.5",
                  ].join(" ")}
                  aria-label="Hospitality workspace"
                >
                  {NAV_ITEMS.map((item) => (
                    <NavigationItem
                      key={item.to}
                      item={item}
                      compact={!desktopHovered}
                    />
                  ))}
                </nav>
              </div>
            </aside>

            <aside
              className={[
                "fixed inset-y-0 left-0 z-[130] w-[min(88vw,330px)] overflow-y-auto border-r border-stone-200 bg-stone-50/98 px-4 py-4 shadow-[18px_0_50px_rgba(28,25,23,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden",
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                  Hospitality navigation
                </span>
                <div className="flex items-center gap-2">
                  <NavLink
                    to="/"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="focus-ring grid size-9 place-items-center rounded-[14px] border border-stone-200 bg-white text-stone-700 shadow-sm"
                    aria-label="Back to EPANTRY home"
                  >
                    <Home size={17} aria-hidden="true" />
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="focus-ring grid size-9 place-items-center rounded-[14px] border border-stone-200 bg-white text-stone-700 shadow-sm"
                    aria-label="Close hospitality navigation"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[18px] bg-stone-950 px-3.5 py-3 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600">
                    <Store size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">Hospitality</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-stone-400">
                      Manage outlets, suppliers and kitchen work
                    </p>
                  </div>
                </div>
              </div>

              <nav className="mt-4 space-y-1.5" aria-label="Hospitality workspace">
                {NAV_ITEMS.map((item) => (
                  <NavigationItem
                    key={item.to}
                    item={item}
                    onNavigate={() => setMobileSidebarOpen(false)}
                  />
                ))}
              </nav>
            </aside>

            <section className="min-w-0 overflow-hidden bg-[#f7f5ef]">
              <div className="epantry-workspace-canvas">{children}</div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
