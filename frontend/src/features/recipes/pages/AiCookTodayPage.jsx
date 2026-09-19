import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Clock3,
  CookingPot,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Utensils,
} from 'lucide-react'

import {
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  generateAiCook,
} from '../services/recipe.service'

function displayValue(
  value,
  fallback =
    '—',
) {
  const normalized =
    String(
      value ||
        '',
    ).trim()

  return normalized ||
    fallback
}

function SuggestionCard({
  suggestion,
  onSelect,
  loading,
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect(
          suggestion,
        )
      }
      disabled={loading}
      className="focus-ring group flex h-full w-full flex-col rounded-[26px] border border-emerald-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_20px_45px_rgba(16,185,129,0.12)] disabled:cursor-wait disabled:opacity-70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CookingPot
            size={21}
            aria-hidden="true"
          />
        </div>

        <ArrowRight
          size={18}
          className="mt-1 text-stone-300 transition group-hover:translate-x-1 group-hover:text-emerald-700"
          aria-hidden="true"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {suggestion.cuisine ? (
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-stone-600">
            {suggestion.cuisine}
          </span>
        ) : null}

        {suggestion.difficulty ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
            {suggestion.difficulty}
          </span>
        ) : null}
      </div>

      <h2 className="mt-3 text-xl font-black tracking-tight text-stone-950">
        {suggestion.name}
      </h2>

      <p className="mt-2 flex-1 text-sm leading-6 text-stone-600">
        {displayValue(
          suggestion.whyItFits,
          'A practical idea based on the ingredients you entered.',
        )}
      </p>

      <div className="mt-5 flex items-center gap-2 text-xs font-bold text-stone-500">
        <Clock3
          size={15}
          aria-hidden="true"
        />
        {displayValue(
          suggestion.estimatedTime,
          'Time varies',
        )}
      </div>

      {Array.isArray(
        suggestion.uses,
      ) &&
      suggestion.uses.length >
        0 ? (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
            Uses what you have
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestion.uses
              .slice(
                0,
                5,
              )
              .map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-100 bg-emerald-50/70 px-2.5 py-1 text-xs font-bold text-emerald-800"
                >
                  {item}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </button>
  )
}

function FullRecipe({
  recipe,
  onBack,
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-[0_22px_60px_rgba(28,25,23,0.08)]">
      <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 p-6 text-white sm:p-8">
        <button
          type="button"
          onClick={onBack}
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white/15"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />
          Back to ideas
        </button>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
              AI generated recipe
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {recipe.name}
            </h2>

            {recipe.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
                {recipe.description}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                Servings
              </p>
              <p className="mt-1 text-sm font-black">
                {displayValue(
                  recipe.servings,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                Time
              </p>
              <p className="mt-1 text-sm font-black">
                {displayValue(
                  recipe.totalTime,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                Level
              </p>
              <p className="mt-1 text-sm font-black">
                {displayValue(
                  recipe.difficulty,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="border-b border-stone-200 p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Utensils
                size={19}
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Ingredients
              </p>
              <h3 className="text-lg font-black text-stone-950">
                What you need
              </h3>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {recipe.ingredients.map((ingredient, index) => (
              <div
                key={`${ingredient.item}-${index}`}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-black text-stone-900">
                    {ingredient.item}
                  </p>

                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-stone-700 shadow-sm">
                    {displayValue(
                      ingredient.amount,
                      'As needed',
                    )}
                  </span>
                </div>

                {ingredient.note ? (
                  <p className="mt-1.5 text-xs leading-5 text-stone-500">
                    {ingredient.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {Array.isArray(
            recipe.substitutions,
          ) &&
          recipe.substitutions.length >
            0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                <RotateCcw
                  size={15}
                  aria-hidden="true"
                />
                Substitutions
              </p>

              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-amber-950">
                {recipe.substitutions.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-950 text-white">
              <ListChecks
                size={19}
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Method
              </p>
              <h3 className="text-lg font-black text-stone-950">
                Cook it step by step
              </h3>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {recipe.steps.map((step, index) => (
              <div
                key={`${step.step}-${index}`}
                className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-950 text-sm font-black text-white">
                  {index + 1}
                </div>

                <div>
                  <p className="text-sm font-semibold leading-6 text-stone-800">
                    {step.instruction}
                  </p>

                  {step.time ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-800">
                      <Clock3
                        size={12}
                        aria-hidden="true"
                      />
                      {step.time}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {Array.isArray(
            recipe.tips,
          ) &&
          recipe.tips.length >
            0 ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-800">
                <Lightbulb
                  size={15}
                  aria-hidden="true"
                />
                Helpful tips
              </p>

              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-emerald-950">
                {recipe.tips.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default function AiCookTodayPage() {
  const [
    ingredients,
    setIngredients,
  ] = useState('')

  const [
    suggestions,
    setSuggestions,
  ] = useState([])

  const [
    selectedRecipe,
    setSelectedRecipe,
  ] = useState(null)

  const [
    loadingSuggestions,
    setLoadingSuggestions,
  ] = useState(false)

  const [
    loadingRecipe,
    setLoadingRecipe,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  async function handleFindIdeas(
    event,
  ) {
    event.preventDefault()

    const normalizedIngredients =
      ingredients.trim()

    if (!normalizedIngredients) {
      setError(
        'Tell me at least one ingredient you have.',
      )
      return
    }

    setLoadingSuggestions(
      true,
    )
    setSelectedRecipe(
      null,
    )
    setError('')

    try {
      const data =
        await generateAiCook({
          action:
            'suggestions',
          ingredients:
            normalizedIngredients,
        })

      setSuggestions(
        Array.isArray(
          data?.suggestions,
        )
          ? data.suggestions
          : [],
      )
    } catch (requestError) {
      setSuggestions([])
      setError(
        requestError?.message ||
          'Unable to generate cooking ideas right now.',
      )
    } finally {
      setLoadingSuggestions(
        false,
      )
    }
  }

  async function handleSelectSuggestion(
    suggestion,
  ) {
    if (
      !suggestion?.name ||
      loadingRecipe
    ) {
      return
    }

    setLoadingRecipe(
      true,
    )
    setError('')

    try {
      const data =
        await generateAiCook({
          action:
            'recipe',
          ingredients:
            ingredients.trim(),
          dishName:
            suggestion.name,
        })

      setSelectedRecipe(
        data?.recipe ||
          null,
      )
    } catch (requestError) {
      setError(
        requestError?.message ||
          'Unable to generate the full recipe right now.',
      )
    } finally {
      setLoadingRecipe(
        false,
      )
    }
  }

  return (
    <div className="px-4 pb-8 pt-0 sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
        <Link
          to="/dashboard"
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 transition hover:text-stone-950"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />
          Dashboard
        </Link>

        <section className="mt-3 min-h-[520px] overflow-hidden rounded-[30px] border border-sky-200 bg-[#F3FAFF] shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
          <div className="grid h-full min-h-[520px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="relative overflow-hidden bg-[linear-gradient(145deg,#D8F2FF_0%,#D5F4F0_55%,#E7F2FF_100%)] p-9 text-[#2F1F18] sm:p-11 xl:p-12">
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/35 blur-3xl"
              />

              <div className="relative">
                <div className="grid h-16 w-16 place-items-center rounded-[22px] border border-sky-300/60 bg-white/45 text-[#6B2A1A] backdrop-blur">
                  <ChefHat
                    size={30}
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-8 text-sm font-black uppercase tracking-[0.18em] text-[#7A321D]">
                  EPANTRY AI · Cook Today
                </p>

                <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-6xl">
                  What do you have today?
                </h1>

                <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#56332A]/85">
                  Tell EPANTRY what is in your kitchen. AI will suggest a few dishes you can make, then build the complete recipe when you choose one.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {[
                    'Tell us what you have',
                    'Choose a dish idea',
                    'Get the full recipe',
                  ].map((label, index) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-cyan-200/80 bg-[#E7F7F6]/85 p-4 backdrop-blur"
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.13em] text-[#A53D21]">
                        Step {index + 1}
                      </p>
                      <p className="mt-1.5 text-sm font-bold text-[#2F1F18]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form
              onSubmit={handleFindIdeas}
              className="bg-[#E7F4FF] p-9 sm:p-11 xl:p-12"
            >
              <label
                htmlFor="cook-today-ingredients"
                className="text-base font-black text-[#17324D]"
              >
                Ingredients you have
              </label>

              <p className="mt-2 text-sm font-semibold leading-6 text-[#54738E]">
                Write naturally or separate items with commas. Example: chicken, tomato, onion, rice, yogurt.
              </p>

              <textarea
                id="cook-today-ingredients"
                value={ingredients}
                onChange={(event) =>
                  setIngredients(
                    event.target.value,
                  )
                }
                rows={8}
                placeholder="I have chicken breast, onions, tomatoes, rice, yogurt and a few basic spices..."
                className="focus-ring mt-4 w-full resize-y rounded-[22px] border border-sky-200 bg-[#F8FCFF] p-5 text-base font-semibold leading-7 text-[#17324D] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loadingSuggestions}
                className="focus-ring mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#147E92] px-6 text-base font-black text-white shadow-lg shadow-cyan-900/15 transition hover:bg-[#0F6879] disabled:cursor-wait disabled:opacity-60"
              >
                {loadingSuggestions ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles
                    size={18}
                    aria-hidden="true"
                  />
                )}

                {loadingSuggestions
                  ? 'Creating ideas...'
                  : 'Show me what I can cook'}
              </button>

              <p className="mt-4 text-xs font-medium leading-5 text-[#6B8296]">
                AI-generated cooking guidance can vary. Check allergies and use normal food-safety practices while cooking.
              </p>
            </form>
          </div>
        </section>

        {loadingRecipe ? (
          <section className="mt-6 grid min-h-[260px] place-items-center rounded-[28px] border border-emerald-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <LoaderCircle
                size={30}
                className="mx-auto animate-spin text-emerald-700"
                aria-hidden="true"
              />
              <p className="mt-4 text-lg font-black text-stone-950">
                Building your recipe...
              </p>
              <p className="mt-1 text-sm text-stone-500">
                EPANTRY AI is turning that dish into complete cooking steps.
              </p>
            </div>
          </section>
        ) : null}

        {!loadingRecipe &&
        selectedRecipe ? (
          <div className="mt-6">
            <FullRecipe
              recipe={selectedRecipe}
              onBack={() =>
                setSelectedRecipe(
                  null,
                )
              }
            />
          </div>
        ) : null}

        {!selectedRecipe &&
        suggestions.length >
          0 ? (
          <section className="mt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  AI suggestions
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">
                  You could cook one of these
                </h2>
              </div>

              <p className="text-sm font-semibold text-stone-500">
                Choose a dish to generate the full recipe.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.name}
                  suggestion={suggestion}
                  onSelect={handleSelectSuggestion}
                  loading={loadingRecipe}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
