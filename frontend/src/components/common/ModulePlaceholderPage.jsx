import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ModulePlaceholderPage({ eyebrow, title, description }) {
  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] py-20">
      <div className="page-shell">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            {eyebrow}
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-stone-950 sm:text-5xl">
            {title}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-500">
            {description}
          </p>

          <div className="mt-8 rounded-2xl bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-900">
              This EPANTRY module route is ready for its dedicated implementation phase.
            </p>
          </div>

          <Link
            to="/"
            className="focus-ring mt-8 inline-flex items-center gap-2 rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-emerald-300 hover:text-emerald-800"
          >
            <ArrowLeft size={17} />
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
