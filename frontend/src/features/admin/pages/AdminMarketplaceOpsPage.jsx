import {
  Boxes,
  PackageSearch,
  Store,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import AdminShell from '../components/AdminShell'

function ActionCard({
  icon: Icon,
  title,
  description,
  to,
  label,
}) {
  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm">

      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">

        <Icon
          size={19}
          aria-hidden="true"
        />

      </div>

      <h2 className="mt-4 font-black text-stone-950">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-stone-500">
        {description}
      </p>

      <Link
        to={
          to
        }
        className="focus-ring mt-5 inline-flex rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white"
      >
        {label}
      </Link>

    </div>
  )
}

export default function AdminMarketplaceOpsPage() {
  return (
    <AdminShell
      title="Marketplace Operations"
      description="Operational marketplace control plane. Canonical Product governance, Host approval and Host-owned commercial data remain separate authority domains."
    >

      <div className="grid gap-4 lg:grid-cols-3">

        <ActionCard
          icon={
            Store
          }
          title="Host lifecycle"
          description="Review Host applications and manage approved Host access using the existing audited Host lifecycle workflow."
          to="/admin/hosts"
          label="Open Host Review"
        />

        <ActionCard
          icon={
            PackageSearch
          }
          title="Canonical products"
          description="Commercial Offers reference canonical Packs. Product facts remain controlled by Catalog governance."
          to="/admin/catalog"
          label="Open Catalog"
        />

        <ActionCard
          icon={
            Boxes
          }
          title="Commercial isolation"
          description="Price, stock and serviceability are Host-owned marketplace records and are never written into ProductVersion."
          to="/admin"
          label="Admin Overview"
        />

      </div>

      <section className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 p-5">

        <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">
          M05 authority boundary
        </p>

        <p className="mt-2 text-sm leading-6 text-amber-900">
          Internal Marketplace Ops does not receive an implicit tenant impersonation path. Host commercial writes continue through the authenticated Host workspace.
        </p>

      </section>

    </AdminShell>
  )
}