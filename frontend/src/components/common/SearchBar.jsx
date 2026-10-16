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
        className={`epantry-input focus-ring w-full pr-24 shadow-sm ${compact ? 'h-12 pl-11' : 'h-[52px] pl-12'}`}
      />
      <button type="submit" className="epantry-primary-button focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 px-4">
        Search
      </button>
    </form>
  )
}
