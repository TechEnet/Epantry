import { useEffect, useState } from 'react'

export default function SearchBar({ value = '', onSubmit, placeholder = 'Search products, brands, recipes...', compact = false }) {
  const [query, setQuery] = useState(value)

  useEffect(() => setQuery(value), [value])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(query)
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="relative w-full">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`focus-ring w-full rounded-2xl border border-stone-200 bg-white pr-24 text-stone-900 shadow-sm placeholder:text-stone-400 ${compact ? 'h-11 pl-11 text-sm' : 'h-13 pl-12 text-sm sm:text-base'}`}
      />
      <button type="submit" className="focus-ring absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800">
        Search
      </button>
    </form>
  )
}
