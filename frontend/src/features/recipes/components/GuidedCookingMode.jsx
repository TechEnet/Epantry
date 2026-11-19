import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChefHat, Clock3, Pause, Play, ShoppingBasket, X } from 'lucide-react'
import { getCookingJourney, saveCookingJourney } from '../utils/cookingJourney'

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function displayQuantity(item) {
  const raw = item.displayQuantity ?? item.quantity
  const value = typeof raw === 'number' || typeof raw === 'string' ? String(raw).trim() : ''
  return value || 'Not exact'
}

export default function GuidedCookingMode({ slug, title, servings, steps = [], ingredients = [], onClose, onShop }) {
  const dialogRef = useRef(null)
  const openFrom = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const savedIndex = getCookingJourney(slug)?.stepIndex || 0
  const [index, setIndex] = useState(Math.min(savedIndex, Math.max(0, steps.length - 1)))
  const step = steps[index] || null
  const timerSeconds = Math.max(0, Number(step?.timerSeconds) || 0)
  const [remaining, setRemaining] = useState(timerSeconds)
  const [running, setRunning] = useState(false)
  const label = useMemo(() => String(step?.instruction || '').trim(), [step])

  useEffect(() => {
    openFrom.current = document.activeElement
    dialogRef.current?.focus()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current?.(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!controls.includes(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = oldOverflow
      openFrom.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    setRemaining(Math.max(0, Number(steps[index]?.timerSeconds) || 0))
    setRunning(false)
  }, [index, steps])

  useEffect(() => {
    if (!running || remaining <= 0) return undefined
    const interval = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [running, remaining <= 0])

  function chooseStep(next) {
    const safeIndex = Math.max(0, Math.min(steps.length - 1, next))
    setIndex(safeIndex)
    saveCookingJourney({ slug, servings, stepIndex: safeIndex })
  }

  return (
    <div className="fixed inset-0 z-[140] bg-[#0B2921]/75 p-2 backdrop-blur-sm sm:p-5" role="presentation">
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Guided cooking: ${title || 'Recipe'}`}
        className="mx-auto flex h-full max-h-[calc(100svh-16px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[18px] bg-[#F6F4EE] text-[#173F35] shadow-2xl outline-none sm:max-h-[calc(100svh-40px)] sm:rounded-[24px]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#CBD9C8] bg-[#E4F0E5] px-4 py-3 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#B55C39]"><ChefHat size={16} /> Guided cooking / {servings} servings</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{title || 'Your recipe'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close cooking mode" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#B5C9B7] bg-white hover:bg-[#F3F8F1]"><X size={20} /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(250px,310px)]">
          <div className="flex min-h-0 flex-col overflow-y-auto px-5 py-5 sm:px-10 sm:py-8">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>Step {index + 1} of {steps.length}</span>
              <span className="text-[#5B6A60]">{Math.round(((index + 1) / steps.length) * 100)}% through</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#CEDBCF]" role="progressbar" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Cooking step progress">
              <div className="h-full rounded-full bg-[#176345] transition-[width]" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
            <div className="flex flex-1 flex-col justify-center py-8">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#B55C39]">Follow this step</p>
              <p className="mt-4 max-w-[680px] text-[clamp(1.45rem,3.1vw,2.55rem)] font-semibold leading-[1.3] tracking-[-.03em] text-[#183D31]">{label || 'No instruction was published for this step.'}</p>
              {step?.temperature?.value != null && step?.temperature?.unit && (
                <p className="mt-5 text-sm font-semibold text-[#58685E]">Temperature: {step.temperature.value}°{String(step.temperature.unit).toUpperCase()}</p>
              )}
              {timerSeconds > 0 && (
                <div className="mt-7 flex max-w-[400px] flex-wrap items-center gap-3 border-t border-[#CBD9C8] pt-5">
                  <Clock3 size={20} aria-hidden="true" />
                  <span role="timer" aria-label={`${remaining} seconds remaining`} className="text-3xl font-semibold tabular-nums">{formatDuration(remaining)}</span>
                  <button type="button" onClick={() => setRunning(v => !v)} disabled={remaining === 0}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173F35] px-5 text-sm font-semibold text-white disabled:opacity-50">
                    {running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pause' : 'Start'}
                  </button>
                  <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => { setRunning(false); setRemaining(timerSeconds) }}>Reset</button>
                  {remaining === 0 && <span role="status" className="text-sm font-semibold text-[#A4462E]">Timer finished</span>}
                </div>
              )}
            </div>
            <nav aria-label="Cooking steps" className="flex shrink-0 items-center justify-between gap-3 border-t border-[#CBD9C8] pt-5">
              <button type="button" onClick={() => chooseStep(index - 1)} disabled={index === 0} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#9AB7A5] px-4 text-sm font-semibold disabled:opacity-35"><ArrowLeft size={16} /> Previous</button>
              {index < steps.length - 1 ? (
                <button type="button" onClick={() => chooseStep(index + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173F35] px-5 text-sm font-semibold text-white">Next step <ArrowRight size={16} /></button>
              ) : (
                <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173F35] px-5 text-sm font-semibold text-white"><Check size={17} /> Finish guide</button>
              )}
            </nav>
          </div>
          <aside className="min-h-0 max-h-[30svh] overflow-y-auto border-t border-[#CBD9C8] bg-[#E9EEE5] px-5 py-5 lg:max-h-none lg:border-l lg:border-t-0 lg:px-6" aria-label="Ingredients for selected servings">
            <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-semibold">Ingredients</h3><span className="text-sm font-medium">{servings} servings</span></div>
            <ul className="mt-4 divide-y divide-[#CBD9C8] text-sm">
              {ingredients.map((item, i) => (
                <li key={item.id || item.ingredientId || i} className="flex items-start justify-between gap-3 py-3">
                  <span className="min-w-0 font-medium">{item.ingredient?.name || item.name || 'Ingredient'}</span>
                  <span className="shrink-0 text-[#617067]">{displayQuantity(item)} {item.displayUnit || item.unit || ''}</span>
                </li>
              ))}
            </ul>
            {typeof onShop === 'function' && (
              <button type="button" onClick={onShop} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#84A891] bg-white px-3 text-sm font-semibold"><ShoppingBasket size={17} /> Check missing ingredients</button>
            )}
            <p className="mt-3 text-xs leading-5 text-[#5D6B62]">The pantry and shopping basket are checked separately. Finishing a guide does not automatically change your pantry or place an order.</p>
          </aside>
        </div>
      </section>
    </div>
  )
}
