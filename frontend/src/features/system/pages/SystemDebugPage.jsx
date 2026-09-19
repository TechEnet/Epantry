import { CircleCheck, CircleX, Database, Server } from 'lucide-react'
import { motion } from 'motion/react'

import { fadeUp } from '../../../lib/motion'
import { useBootstrapQuery } from '../hooks/useBootstrapQuery'
import { useHealthQuery } from '../hooks/useHealthQuery'

function StatusRow({ ok, label, value, icon: Icon }) {
  const StatusIcon = ok ? CircleCheck : CircleX

  return (
    <div className="flex items-center justify-between gap-4 border-b border-stone-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-brand-700" aria-hidden="true" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-stone-600">
        <StatusIcon className={`size-4 ${ok ? 'text-brand-600' : 'text-red-600'}`} aria-hidden="true" />
        <span>{value}</span>
      </div>
    </div>
  )
}

export default function SystemDebugPage() {
  const health = useHealthQuery()
  const bootstrap = useBootstrapQuery()

  return (
    <main className="page-shell py-10">
      <motion.section {...fadeUp} className="surface-card mx-auto max-w-3xl p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Developer diagnostics</p>
        <h1 className="mt-2 text-2xl font-bold">Frontend / Backend Status</h1>
        <p className="mt-2 text-sm text-stone-600">
          Development-only visibility for the API foundation. Customer-facing UI does not depend on this page.
        </p>

        <div className="mt-6">
          <StatusRow
            ok={health.isSuccess}
            label="Express API"
            value={health.isLoading ? 'Checking...' : health.isSuccess ? 'Connected' : health.error?.message || 'Unavailable'}
            icon={Server}
          />
          <StatusRow
            ok={bootstrap.isSuccess}
            label="Bootstrap metadata"
            value={bootstrap.isLoading ? 'Checking...' : bootstrap.isSuccess ? 'Loaded' : bootstrap.error?.message || 'Unavailable'}
            icon={Database}
          />
        </div>

        {bootstrap.data?.data?.features ? (
          <div className="mt-6 rounded-xl bg-stone-50 p-4">
            <h2 className="font-semibold">Feature flags</h2>
            <pre className="mt-2 overflow-auto text-xs text-stone-700">
              {JSON.stringify(bootstrap.data.data.features, null, 2)}
            </pre>
          </div>
        ) : null}
      </motion.section>
    </main>
  )
}
