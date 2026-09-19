export default function LoadingSpinner({ label = 'Loading' }) {
  return <div className="flex items-center justify-center gap-3 py-10 text-sm text-stone-600"><span className="size-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-700" /><span>{label}</span></div>
}
