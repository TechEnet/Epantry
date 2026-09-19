import {
  ArrowLeft,
  ChefHat,
  CircleCheck,
  Search,
  TriangleAlert,
} from 'lucide-react'

import {
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  getWhatShouldWeCook,
} from '../services/recipe.service'

function parseIngredientIds(
  value,
) {
  return [
    ...new Set(
      String(
        value ||
          '',
      )
        .split(
          /[\s,]+/,
        )
        .map(
          (
            item,
          ) =>
            item.trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

function percentage(
  value,
) {
  const numeric =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return 0
  }

  return Math.round(
    numeric *
      100,
  )
}

export default function WhatShouldWeCookPage() {
  const [
    ingredientInput,
    setIngredientInput,
  ] =
    useState(
      '',
    )

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  async function handleSubmit(
    event,
  ) {
    event.preventDefault()

    const ingredientIds =
      parseIngredientIds(
        ingredientInput,
      )

    if (
      ingredientIds.length ===
      0
    ) {
      setError(
        'Add at least one canonical ingredient ID.',
      )

      return
    }

    setLoading(
      true,
    )

    setError(
      '',
    )

    try {
      setData(
        await getWhatShouldWeCook(
          ingredientIds,
          12,
        ),
      )
    } catch (requestError) {
      setError(
        requestError?.message ||
        'Unable to calculate recipe matches.',
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  const recipes =
    data?.recipes ||
    []

  return (
    <main className="min-h-screen bg-[#f7f5ef]">

      <div className="page-shell py-8 sm:py-10">

        <Link
          to="/recipes"
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 hover:text-stone-950"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Recipes
        </Link>

        <section className="mt-3 overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">

          <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">

            <div className="bg-stone-950 p-7 text-white sm:p-10">

              <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-emerald-600">
                <ChefHat
                  size={27}
                  aria-hidden="true"
                />
              </div>

              <p className="mt-7 text-xs font-black uppercase tracking-[0.15em] text-emerald-400">
                What Should We Cook?
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                Start with what you already have.
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-300">
                M07 ranks published recipes by canonical ingredient coverage.
                Optional ingredients do not reduce coverage and missing
                requirements remain explicit.
              </p>

              <div className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-5">

                <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                  Basic M07 input
                </p>

                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Enter canonical ingredient IDs separated by commas or spaces.
                  Friendly pantry selection is added when Living Pantry is
                  connected in its later module.
                </p>

              </div>

            </div>

            <div className="p-7 sm:p-10">

              <form
                onSubmit={
                  handleSubmit
                }
              >

                <label
                  htmlFor="ingredient-ids"
                  className="text-sm font-black text-stone-950"
                >
                  Available canonical ingredients
                </label>

                <textarea
                  id="ingredient-ids"
                  value={
                    ingredientInput
                  }
                  onChange={(
                    event,
                  ) =>
                    setIngredientInput(
                      event.target.value,
                    )
                  }
                  rows={7}
                  placeholder="64e000000000000000000001, 64e000000000000000000002"
                  className="focus-ring mt-3 w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 p-4 font-mono text-sm text-stone-900 outline-none"
                />

                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
                  >
                    {
                      error
                    }
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    loading
                  }
                  className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search
                    size={17}
                    aria-hidden="true"
                  />

                  {loading
                    ? 'Calculating matches...'
                    : 'Find recipes'}
                </button>

              </form>

            </div>

          </div>

        </section>

        {data && (
          <section className="mt-7">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Matching results
              </p>

              <h2 className="mt-1 text-3xl font-black tracking-tight text-stone-950">
                Best current matches
              </h2>

            </div>

            {recipes.length ===
            0 ? (
              <div className="mt-5 rounded-[26px] border border-dashed border-stone-300 bg-white p-9 text-center">

                <TriangleAlert
                  size={32}
                  className="mx-auto text-stone-400"
                  aria-hidden="true"
                />

                <p className="mt-3 font-black text-stone-950">
                  No recipe shares these ingredients.
                </p>

                <p className="mt-2 text-sm text-stone-500">
                  EPANTRY returns no result instead of fabricating a match.
                </p>

              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                {recipes.map(
                  (
                    item,
                  ) => {
                    const coverage =
                      percentage(
                        item?.matching
                          ?.coverageRatio,
                      )

                    return (
                      <article
                        key={
                          item?.recipe
                            ?.id ||
                          item?.dish
                            ?.id
                        }
                        className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                            {
                              coverage
                            }% covered
                          </span>

                          <CircleCheck
                            size={18}
                            className="text-emerald-700"
                            aria-hidden="true"
                          />

                        </div>

                        <h3 className="mt-4 text-xl font-black tracking-tight text-stone-950">
                          {
                            item?.dish
                              ?.name ||
                            item?.recipe
                              ?.title
                          }
                        </h3>

                        <div className="mt-4 grid grid-cols-2 gap-2">

                          <div className="rounded-2xl bg-stone-50 p-3">

                            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                              Matched
                            </p>

                            <p className="mt-1 text-lg font-black text-stone-950">
                              {
                                item?.matching
                                  ?.matchedIngredientCount ||
                                0
                              }
                            </p>

                          </div>

                          <div className="rounded-2xl bg-stone-50 p-3">

                            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                              Missing
                            </p>

                            <p className="mt-1 text-lg font-black text-stone-950">
                              {
                                item?.matching
                                  ?.missingIngredientCount ||
                                0
                              }
                            </p>

                          </div>

                        </div>

                        <Link
                          to={
                            item?.path ||
                            `/recipes/${item?.dish?.slug}`
                          }
                          className="focus-ring mt-5 inline-flex w-full justify-center rounded-2xl bg-stone-950 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                        >
                          Open recipe
                        </Link>

                      </article>
                    )
                  },
                )}

              </div>
            )}

          </section>
        )}

      </div>

    </main>
  )
}