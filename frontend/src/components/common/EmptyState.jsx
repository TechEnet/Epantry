export default function EmptyState({ title = 'Nothing found', description = 'Try adjusting your search or filters.', children }) {
  return (
    <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-stone-100 text-stone-500">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 11h5" /></svg>
      </div>
      <h3 className="text-lg font-bold text-stone-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">{description}</p>
      {children && <div className="mt-6 w-full max-w-xl">{children}</div>}
    </div>
  )
}
