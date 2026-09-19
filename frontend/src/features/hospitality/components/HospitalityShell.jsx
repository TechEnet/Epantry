import {
  BookOpenCheck,
  Building2,
  Calculator,
  ChefHat,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  PackageSearch,
  ScrollText,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  {
    code: "B01",
    label: "Dashboard",
    to: "/host/hospitality",
    icon: LayoutDashboard,
    end: true,
  },
  {
    code: "B02",
    label: "Organization / Outlets",
    to: "/host/hospitality/outlets",
    icon: Building2,
  },
  {
    code: "B03",
    label: "Supplier Master",
    to: "/host/hospitality/suppliers",
    icon: Truck,
  },
  {
    code: "B04",
    label: "Ingredient / Product Master",
    to: "/host/hospitality/products",
    icon: PackageSearch,
  },
  {
    code: "B05",
    label: "Production Recipes",
    to: "/host/hospitality/recipes",
    icon: ChefHat,
  },
  {
    code: "B06",
    label: "Menus",
    to: "/host/hospitality/menus",
    icon: ClipboardList,
  },
  {
    code: "B07",
    label: "Procurement",
    to: "/host/hospitality/procurement",
    icon: ShoppingCart,
  },
  {
    code: "B08",
    label: "Costing",
    to: "/host/hospitality/costing",
    icon: Calculator,
  },
  {
    code: "B09",
    label: "Dish Passport",
    to: "/host/hospitality/dish-passports",
    icon: FileSearch,
  },
  {
    code: "B10",
    label: "Grey Book",
    to: "/host/hospitality/grey-book",
    icon: BookOpenCheck,
  },
  {
    code: "B11",
    label: "Change Management / Audit",
    to: "/host/hospitality/change-management",
    icon: ScrollText,
  },
];

function NavigationItem({ item }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
          isActive
            ? "bg-emerald-700 text-white shadow-sm"
            : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
        ].join(" ")
      }
    >
      <Icon size={18} aria-hidden="true" />

      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase tracking-[0.12em] opacity-60">
          {item.code}
        </span>

        <span className="block truncate">{item.label}</span>
      </span>
    </NavLink>
  );
}

export default function HospitalityShell({ children }) {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f7f5ef]">
      <div className="page-shell py-5 sm:py-7">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div className="grid min-h-[760px] lg:grid-cols-[285px_minmax(0,1fr)]">
            <aside className="border-b border-stone-200 bg-stone-50/80 lg:border-b-0 lg:border-r">
              <div className="p-4 sm:p-5">
                <div className="rounded-[22px] bg-stone-950 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600">
                      <Store size={20} aria-hidden="true" />
                    </div>

                    <div>
                      <p className="font-black">Hospitality Ops</p>

                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                        Host organization scope
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 border-t border-stone-800 pt-4 text-xs leading-5 text-stone-400">
                    B2B is an operating function inside Host. Outlet scope and
                    Hospitality permissions are enforced by the backend.
                  </p>
                </div>

                <nav
                  className="mt-5 hidden max-h-[calc(100vh-250px)] space-y-1.5 overflow-y-auto pr-1 lg:block"
                  aria-label="Hospitality"
                >
                  {NAV_ITEMS.map((item) => (
                    <NavigationItem key={item.to} item={item} />
                  ))}
                </nav>

                <nav
                  className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
                  aria-label="Hospitality"
                >
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
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
                      {item.code}
                    </NavLink>
                  ))}
                </nav>
              </div>
            </aside>

            <section className="min-w-0 bg-[#f7f5ef]">
              <div className="epantry-workspace-canvas">
                {children}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
