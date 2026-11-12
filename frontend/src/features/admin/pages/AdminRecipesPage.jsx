import {
  ChefHat,
  CirclePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react'

import {
  useNavigate,
} from 'react-router-dom'

import AdminShell from '../components/AdminShell'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  changeAdminDishLifecycle,
  createAdminRecipe,
  listAdminRecipes,
  uploadRecipeImage,
} from '../../recipes/services/recipe.service'

import {
  createAdminIngredient,
  getAdminIngredients,
} from '../services/catalogAdmin.service'

const RECIPE_UNITS = [
  'mg',
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'slice',
  'clove',
  'bunch',
  'pinch',
]

const INGREDIENT_ROLES = [
  'main',
  'base',
  'seasoning',
  'garnish',
  'liquid',
  'fat',
  'binder',
  'leavening',
  'sauce',
  'other',
]

function createIngredientRow() {
  return {
    canonicalIngredientId:
      '',

    canonicalIngredientName:
      '',

    quantity:
      '',

    unit:
      'g',

    role:
      'main',

    preparationState:
      '',
  }
}

function ingredientId(
  ingredient,
) {
  return String(
    ingredient?.id ||
      ingredient?._id ||
      '',
  )
}

function ingredientName(
  ingredient,
) {
  return String(
    ingredient?.canonicalName ||
      ingredient?.name ||
      ingredient?.normalizedKey ||
      ingredient?.slug ||
      'Canonical ingredient',
  )
}

function ingredientMeta(
  ingredient,
) {
  return String(
    ingredient?.normalizedKey ||
      ingredient?.slug ||
      ingredient?.status ||
      '',
  )
}

function canonicalIngredientNameFromQuery(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .replace(
      /\s+/g,
      ' ',
    )
    .split(
      ' ',
    )
    .map(
      (part) =>
        part
          ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
          : '',
    )
    .join(
      ' ',
    )
}

function IngredientPicker({
  value,
  selectedName,
  onSelect,
  canCreateCanonicalIngredient,
}) {
  const [
    query,
    setQuery,
  ] =
    useState(
      selectedName ||
        '',
    )

  const [
    options,
    setOptions,
  ] =
    useState(
      [],
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    )

  const [
    open,
    setOpen,
  ] =
    useState(
      false,
    )

  const [
    lookupError,
    setLookupError,
  ] =
    useState(
      '',
    )


  const [
    creating,
    setCreating,
  ] =
    useState(
      false,
    )

  const [
    createError,
    setCreateError,
  ] =
    useState(
      '',
    )

  useEffect(
    () => {
      if (
        selectedName &&
        value
      ) {
        setQuery(
          selectedName,
        )
      }
    },
    [
      selectedName,
      value,
    ],
  )

  useEffect(
    () => {
      if (!open) {
        return undefined
      }

      let cancelled =
        false

      const timer =
        window.setTimeout(
          async () => {
            setLoading(
              true,
            )

            setLookupError(
              '',
            )

            try {
              const result =
                await getAdminIngredients({
                  page:
                    1,

                  limit:
                    20,

                  status:
                    'active',

                  search:
                    query.trim(),
                })

              if (cancelled) {
                return
              }

              setOptions(
                Array.isArray(
                  result?.ingredients,
                )
                  ? result.ingredients
                  : [],
              )
            } catch (error) {
              if (cancelled) {
                return
              }

              setOptions(
                [],
              )

              setLookupError(
                error?.message ||
                  'Unable to search the Ingredient Dictionary.',
              )
            } finally {
              if (!cancelled) {
                setLoading(
                  false,
                )
              }
            }
          },
          180,
        )

      return () => {
        cancelled =
          true

        window.clearTimeout(
          timer,
        )
      }
    },
    [
      open,
      query,
    ],
  )

  function handleInput(
    event,
  ) {
    const nextValue =
      event.target.value

    setQuery(
      nextValue,
    )

    setOpen(
      true,
    )

    setCreateError(
      '',
    )

    if (value) {
      onSelect({
        id:
          '',

        name:
          '',
      })
    }
  }

  function chooseIngredient(
    ingredient,
  ) {
    const id =
      ingredientId(
        ingredient,
      )

    const name =
      ingredientName(
        ingredient,
      )

    if (!id) {
      return
    }

    setQuery(
      name,
    )

    setOpen(
      false,
    )

    onSelect({
      id,
      name,
    })
  }


  async function createAndSelectIngredient() {
    const rawQuery =
      query.trim()

    const canonicalName =
      canonicalIngredientNameFromQuery(
        rawQuery,
      )

    if (
      !canCreateCanonicalIngredient ||
      !canonicalName ||
      creating
    ) {
      return
    }

    setCreating(
      true,
    )

    setCreateError(
      '',
    )

    try {
      const result =
        await createAdminIngredient({
          canonicalName,

          aliases:
            rawQuery &&
            rawQuery.toLowerCase() !==
              canonicalName.toLowerCase()
              ? [
                  rawQuery,
                ]
              : [],

          status:
            'active',
        })

      const ingredient =
        result?.ingredient ||
        result

      const id =
        ingredientId(
          ingredient,
        )

      if (!id) {
        throw new Error(
          'Ingredient was created but could not be selected.',
        )
      }

      chooseIngredient(
        ingredient,
      )
    } catch (error) {
      setCreateError(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to create this canonical ingredient.',
      )

      setOpen(
        true,
      )
    } finally {
      setCreating(
        false,
      )
    }
  }

  return (
    <div className="relative min-w-0">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />

        <input
          value={
            query
          }
          onFocus={() =>
            setOpen(
              true,
            )
          }
          onChange={
            handleInput
          }
          onBlur={() => {
            window.setTimeout(
              () =>
                setOpen(
                  false,
                ),
              120,
            )
          }}
          placeholder="Search ingredient, e.g. rice or cumin"
          autoComplete="off"
          className="focus-ring h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm outline-none"
        />
      </div>

      {value && (
        <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
          Canonical ingredient selected
        </p>
      )}

      {open && (
        <div className="absolute z-40 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs font-bold text-stone-500">
              <LoaderCircle
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />

              Searching Ingredient Dictionary…
            </div>
          ) : lookupError ? (
            <p className="px-3 py-3 text-xs font-semibold text-red-700">
              {lookupError}
            </p>
          ) : options.length >
            0 ? (
            <div className="space-y-1">
              {options.map(
                (ingredient) => {
                  const id =
                    ingredientId(
                      ingredient,
                    )

                  return (
                    <button
                      key={
                        id
                      }
                      type="button"
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        chooseIngredient(
                          ingredient,
                        )
                      }
                      className="focus-ring block w-full rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                    >
                      <span className="block text-sm font-black text-stone-900">
                        {ingredientName(
                          ingredient,
                        )}
                      </span>

                      {ingredientMeta(
                        ingredient,
                      ) && (
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-stone-500">
                          {ingredientMeta(
                            ingredient,
                          )}
                        </span>
                      )}
                    </button>
                  )
                },
              )}
            </div>
          ) : (
            <div className="px-3 py-3">
              <p className="text-xs font-bold text-stone-700">
                No active canonical ingredient matches this search.
              </p>

              {query.trim() &&
              canCreateCanonicalIngredient ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[11px] leading-5 text-emerald-900">
                    Keep the Recipe workflow here. Create this missing canonical
                    ingredient now; you can refine aliases or taxonomy in A07 later.
                  </p>

                  <button
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={
                      createAndSelectIngredient
                    }
                    disabled={
                      creating
                    }
                    className="focus-ring mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creating ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CirclePlus
                        size={14}
                        aria-hidden="true"
                      />
                    )}

                    {creating
                      ? 'Creating…'
                      : `Create “${canonicalIngredientNameFromQuery(
                          query,
                        )}” & select`}
                  </button>

                  {createError && (
                    <p className="mt-2 text-[11px] font-bold leading-5 text-red-700">
                      {createError}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-[11px] leading-5 text-stone-500">
                  This ingredient is not in the active dictionary. A Catalog admin
                  can create it without changing the Recipe draft.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function createStepRow() {
  return {
    instruction:
      '',

    timerMinutes:
      '',
  }
}

function formatDateTime(
  value,
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—'
  }

  return date.toLocaleString()
}

function statusClass(
  status,
) {
  if (
    status ===
    'published'
  ) {
    return 'bg-emerald-50 text-emerald-800'
  }

  if (
    status ===
    'in_review'
  ) {
    return 'bg-blue-50 text-blue-800'
  }

  if (
    status ===
    'draft'
  ) {
    return 'bg-amber-50 text-amber-800'
  }

  return 'bg-stone-100 text-stone-700'
}

export default function AdminRecipesPage() {
  const navigate =
    useNavigate()

  const {
    hasAdminPermission,
  } =
    useAdmin()

  const canMutate =
    hasAdminPermission(
      'recipe.mutate',
    )


  const canCreateCanonicalIngredient =
    hasAdminPermission(
      'catalog.mutate',
    )

  const [
    recipes,
    setRecipes,
  ] =
    useState(
      [],
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    search,
    setSearch,
  ] =
    useState(
      '',
    )

  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 320)
    return () => window.clearTimeout(timer)
  }, [search])

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(
      false,
    )

  const [
    showAllRecent,
    setShowAllRecent,
  ] =
    useState(
      false,
    )

  const [
    creating,
    setCreating,
  ] =
    useState(
      false,
    )


  const [
    imageUploading,
    setImageUploading,
  ] =
    useState(
      false,
    )


  const [
    deletingDishId,
    setDeletingDishId,
  ] =
    useState(
      '',
    )

  const [
    form,
    setForm,
  ] =
    useState({
      name:
        '',

      cuisine:
        '',

      course:
        '',

      dietaryType:
        '',

      description:
        '',

      heroImageUrl:
        '',

      baseServings:
        4,

      preparationTimeMinutes:
        10,

      cookingTimeMinutes:
        20,

      difficulty:
        'easy',

      sourceName:
        'EPANTRY Editorial',

      ingredients: [
        createIngredientRow(),
      ],

      steps: [
        createStepRow(),
      ],
    })

  const loadRequestId = useRef(0)

  const loadRecipes =
    useCallback(
      async () => {
        const requestId = ++loadRequestId.current
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const firstPage =
            await listAdminRecipes({
              page:
                1,

              limit:
                100,

              status:
                'all',

              search:
                debouncedSearch,
            })

          const combined =
            Array.isArray(
              firstPage?.recipes,
            )
              ? [
                  ...firstPage.recipes,
                ]
              : []

          const pageCount =
            Number(
              firstPage?.pagination?.pages ||
                0,
            )

          if (
            pageCount >
            1
          ) {
            const remainingPages =
              await Promise.all(
                Array.from(
                  {
                    length:
                      pageCount -
                      1,
                  },
                  (_, index) =>
                    listAdminRecipes({
                      page:
                        index +
                        2,

                      limit:
                        100,

                      status:
                        'all',

                      search:
                        debouncedSearch,
                    }),
                ),
              )

            for (
              const pageData
              of remainingPages
            ) {
              if (
                Array.isArray(
                  pageData?.recipes,
                )
              ) {
                combined.push(
                  ...pageData.recipes,
                )
              }
            }
          }

          if (requestId === loadRequestId.current) {
            setRecipes(combined)
          }
        } catch (loadError) {
          if (requestId === loadRequestId.current) {
            setError(loadError?.message || 'Unable to load Recipe workspace.')
          }
        } finally {
          if (requestId === loadRequestId.current) {
            setLoading(false)
          }
        }
      },
      [
        debouncedSearch,
      ],
    )

  useEffect(() => {
    loadRecipes()
    return () => {
      loadRequestId.current += 1
    }
  }, [loadRecipes])

  const pendingReviews =
    useMemo(
      () =>
        recipes
          .filter(
            (
              item,
            ) =>
              item?.latestVersion
                ?.status ===
              'in_review',
          )
          .sort(
            (
              left,
              right,
            ) =>
              new Date(
                right?.latestVersion
                  ?.submittedAt ||
                  right?.latestVersion
                    ?.updatedAt ||
                  0,
              ).getTime() -
              new Date(
                left?.latestVersion
                  ?.submittedAt ||
                  left?.latestVersion
                    ?.updatedAt ||
                  0,
              ).getTime(),
          ),
      [
        recipes,
      ],
    )

  const recipeSummary =
    useMemo(
      () => {
        const summary = {
          total:
            recipes.length,

          pending:
            0,

          drafts:
            0,

          published:
            0,

          needsFoodCheck:
            0,
        }

        for (
          const item
          of recipes
        ) {
          const versionStatus =
            item?.latestVersion
              ?.status ||
            ''

          if (
            versionStatus ===
            'in_review'
          ) {
            summary.pending +=
              1
          }

          if (
            versionStatus ===
            'draft'
          ) {
            summary.drafts +=
              1
          }

          if (
            versionStatus ===
            'published'
          ) {
            summary.published +=
              1
          }

          if (
            item?.foodIntelligence
              ?.approved !==
            true
          ) {
            summary.needsFoodCheck +=
              1
          }
        }

        return summary
      },
      [
        recipes,
      ],
    )

  const sortedRecentRecipes =
    useMemo(
      () =>
        [
          ...recipes,
        ].sort(
          (
            left,
            right,
          ) =>
            new Date(
              right?.latestVersion
                ?.updatedAt ||
                right?.dish
                  ?.updatedAt ||
                0,
            ).getTime() -
            new Date(
              left?.latestVersion
                ?.updatedAt ||
                left?.dish
                  ?.updatedAt ||
                0,
            ).getTime(),
        ),
      [
        recipes,
      ],
    )

  const visibleRecentRecipes = showAllRecent
    ? sortedRecentRecipes
    : sortedRecentRecipes.slice(0, 8)

  const validIngredients =
    useMemo(
      () =>
        form.ingredients.filter(
          (
            row,
          ) =>
            row.canonicalIngredientId
              .trim() &&
            Number(
              row.quantity,
            ) >
              0,
        ),
      [
        form.ingredients,
      ],
    )

  const validSteps =
    useMemo(
      () =>
        form.steps.filter(
          (
            row,
          ) =>
            row.instruction.trim(),
        ),
      [
        form.steps,
      ],
    )

  function updateIngredientSelection(
    index,
    ingredient,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        ingredients:
          current.ingredients.map(
            (
              row,
              rowIndex,
            ) =>
              rowIndex ===
              index
                ? {
                    ...row,

                    canonicalIngredientId:
                      ingredient.id ||
                      '',

                    canonicalIngredientName:
                      ingredient.name ||
                      '',
                  }
                : row,
          ),
      }),
    )
  }

  function updateIngredient(
    index,
    key,
    value,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        ingredients:
          current.ingredients.map(
            (
              row,
              rowIndex,
            ) =>
              rowIndex ===
              index
                ? {
                    ...row,

                    [key]:
                      value,
                  }
                : row,
          ),
      }),
    )
  }

  function updateStep(
    index,
    key,
    value,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        steps:
          current.steps.map(
            (
              row,
              rowIndex,
            ) =>
              rowIndex ===
              index
                ? {
                    ...row,

                    [key]:
                      value,
                  }
                : row,
          ),
      }),
    )
  }

  async function handleRecipeImageUpload(
    file,
  ) {
    if (
      !file ||
      imageUploading
    ) {
      return
    }

    setImageUploading(
      true,
    )

    setError(
      '',
    )

    try {
      const uploaded =
        await uploadRecipeImage({
          file,
          scope:
            'admin',
        })

      setForm(
        (
          current,
        ) => ({
          ...current,

          heroImageUrl:
            uploaded.heroImageUrl,
        }),
      )
    } catch (uploadError) {
      setError(
        uploadError?.message ||
          'Unable to upload Recipe image.',
      )
    } finally {
      setImageUploading(
        false,
      )
    }
  }

  async function handleCreate(
    event,
  ) {
    event.preventDefault()

    if (
      !form.name.trim() ||
      !form.dietaryType ||
      validIngredients.length ===
        0 ||
      validSteps.length ===
        0
    ) {
      setError(
        'Recipe name, food type, at least one canonical ingredient and one method step are required.',
      )

      return
    }

    setCreating(
      true,
    )

    setError(
      '',
    )

    try {
      const payload = {
        name:
          form.name.trim(),

        description:
          form.description.trim(),

        cuisine:
          form.cuisine.trim(),

        course:
          form.course.trim(),

        tags:
          [
            form.cuisine,
            form.course,
            form.dietaryType === 'veg'
              ? 'vegetarian'
              : form.dietaryType === 'nonveg'
                ? 'non-vegetarian'
                : '',
          ]
            .map(
              (
                value,
              ) =>
                value.trim(),
            )
            .filter(
              Boolean,
            ),

        language:
          'en',

        heroImageUrl:
          form.heroImageUrl.trim(),

        title:
          form.name.trim(),

        recipeDescription:
          form.description.trim(),

        baseServings:
          Number(
            form.baseServings,
          ),

        servingSizeAmount:
          null,

        servingSizeUnit:
          null,

        finishedYieldAmount:
          null,

        finishedYieldUnit:
          null,

        scalingMethod:
          'linear',

        minRecommendedServings:
          1,

        maxRecommendedServings:
          12,

        preparationTimeMinutes:
          Number(
            form.preparationTimeMinutes,
          ),

        cookingTimeMinutes:
          Number(
            form.cookingTimeMinutes,
          ),

        difficulty:
          form.difficulty,

        source: {
          type:
            'internal',

          name:
            form.sourceName.trim(),

          url:
            '',

          brandId:
            null,

          organizationId:
            null,
        },

        unsafeIncomplete:
          false,

        unsafeIncompleteReason:
          '',

        ingredients:
          validIngredients.map(
            (
              row,
              index,
            ) => ({
              lineNumber:
                index +
                1,

              canonicalIngredientId:
                row.canonicalIngredientId.trim(),

              quantity:
                Number(
                  row.quantity,
                ),

              unit:
                row.unit,

              preparationState:
                row.preparationState.trim(),

              optional:
                false,

              role:
                row.role,

              notes:
                '',

              substitutionGroupKey:
                '',

              productConstraints:
                [],

              scalingRule: {
                type:
                  'linear',

                exponent:
                  1,

                minMultiplier:
                  null,

                maxMultiplier:
                  null,
              },
            }),
          ),

        steps:
          validSteps.map(
            (
              row,
              index,
            ) => ({
              stepNumber:
                index +
                1,

              instruction:
                row.instruction.trim(),

              timerSeconds:
                row.timerMinutes ===
                ''
                  ? null
                  : Math.max(
                      0,
                      Math.round(
                        Number(
                          row.timerMinutes,
                        ) *
                          60,
                      ),
                    ),

              temperatureValue:
                null,

              temperatureUnit:
                null,

              equipment:
                [],

              parallelizable:
                false,

              prepAhead:
                false,
            }),
          ),

        substitutions:
          [],
      }

      const created =
        await createAdminRecipe(
          payload,
        )

      const versionId =
        created?.recipeVersion
          ?.id

      if (
        versionId
      ) {
        navigate(
          `/admin/recipes/${versionId}`,
        )

        return
      }

      setShowCreate(
        false,
      )

      await loadRecipes()
    } catch (createError) {
      setError(
        createError?.message ||
        'Unable to create Recipe draft.',
      )
    } finally {
      setCreating(
        false,
      )
    }
  }

  async function handleDeleteRecipe(
    dish,
  ) {
    if (
      !canMutate ||
      !dish?.id ||
      deletingDishId
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Delete \"${dish.name || 'this Recipe'}\"? The Dish will be retired so governed Recipe history remains available for audit.`,
      )

    if (!confirmed) {
      return
    }

    setDeletingDishId(
      dish.id,
    )

    setError(
      '',
    )

    try {
      await changeAdminDishLifecycle(
        dish.id,
        {
          action:
            'retire',

          reason:
            'Deleted from the Super Admin Recipe Management workspace. Governed history is retained as retired.',
        },
      )

      await loadRecipes()
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.message ||
          deleteError?.message ||
          'Unable to delete Recipe.',
      )
    } finally {
      setDeletingDishId(
        '',
      )
    }
  }

  return (
    <AdminShell
      title="Recipe Review & Creation"
      description="Review incoming recipes and manage the recipe library."
    >
      <main className="epantry-recipe-governance min-w-0 bg-[#F7F6F2] pb-5 text-[#202421] sm:pb-8">
        <style>{`
          .epantry-recipe-governance { font-family: inherit; }
          .epantry-recipe-governance .recipe-focus-ring:focus-visible { outline: 3px solid #B56845; outline-offset: 2px; }
          .epantry-recipe-governance #recipe-create-form label { font-size: 14px; line-height: 1.45; }
          .epantry-recipe-governance #recipe-create-form input,
          .epantry-recipe-governance #recipe-create-form select,
          .epantry-recipe-governance #recipe-create-form textarea { font-size: 15px; min-height: 44px; }
          .epantry-recipe-governance #recipe-create-form p.text-xs,
          .epantry-recipe-governance #recipe-create-form span.text-xs { font-size: 13px; line-height: 1.5; }
          @media (max-width: 639px) {
            .page-shell:has(.epantry-recipe-governance) { width: 100% !important; max-width: none !important; margin-inline: 0 !important; padding: 0 !important; }
            .page-shell:has(.epantry-recipe-governance) .epantry-workspace-canvas > div:last-child { padding: 0 !important; }
            .epantry-recipe-governance { width: 100%; min-width: 0; border: 0; }

            /* Recipe mobile: full-bleed workspace without nested cards or redundant headings. */
            .epantry-recipe-governance {
              width: 100% !important;
              max-width: none !important;
              padding-bottom: 0 !important;
              background: #F7F6F2;
            }
            .epantry-recipe-governance .recipe-overview-hero {
              padding: 17px 16px 16px !important;
              background: #EEF2EB;
            }
            .epantry-recipe-governance .recipe-overview-hero > div:first-child > p:first-child,
            .epantry-recipe-governance .recipe-hero-description {
              display: none !important;
            }
            .epantry-recipe-governance .recipe-overview-hero h1,
            .epantry-recipe-governance .recipe-overview-hero h2 {
              margin-top: 0 !important;
              font-size: 27px !important;
              line-height: 1.17 !important;
              letter-spacing: -0.035em !important;
            }
            .epantry-recipe-governance .recipe-hero-actions {
              margin-top: 13px !important;
            }
            .epantry-recipe-governance .recipe-hero-actions button {
              min-height: 44px;
              border-radius: 8px;
              padding-inline: 16px;
            }
            .epantry-recipe-governance .recipe-overview-stats {
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 0 !important;
              padding: 0 !important;
              color: #173F35 !important;
              background: #E2E9E0 !important;
            }
            .epantry-recipe-governance .recipe-overview-stats > p {
              display: none !important;
            }
            .epantry-recipe-governance .recipe-pending-total {
              display: flex !important;
              min-width: 0;
              flex-direction: column;
              align-items: flex-start;
              justify-content: center;
              gap: 3px !important;
              margin: 0 !important;
              padding: 12px 6px 13px 13px !important;
              border: 0 !important;
              background: #D4E4D8;
            }
            .epantry-recipe-governance .recipe-pending-total > span:first-child {
              font-size: 26px !important;
              line-height: 1 !important;
              color: #173F35 !important;
            }
            .epantry-recipe-governance .recipe-pending-total > span:last-child {
              margin: 0 !important;
              color: #486457 !important;
              font-size: 12.5px !important;
              line-height: 1.25 !important;
            }
            .epantry-recipe-governance .recipe-summary-grid {
              display: contents !important;
            }
            .epantry-recipe-governance .recipe-summary-grid > div {
              display: flex;
              min-width: 0;
              flex-direction: column;
              justify-content: center;
              gap: 3px;
              border-left: 1px solid #D2DED3;
              padding: 12px 5px 13px 9px;
            }
            .epantry-recipe-governance .recipe-summary-grid > div > p:first-child {
              color: #173F35 !important;
              font-size: 25px !important;
              line-height: 1 !important;
            }
            .epantry-recipe-governance .recipe-summary-grid > div > p:last-child {
              margin: 0 !important;
              font-size: 12.5px !important;
              line-height: 1.25 !important;
              color: #516C5B !important;
            }
            .epantry-recipe-governance .recipe-search-area {
              padding: 12px 16px !important;
            }
            .epantry-recipe-governance .recipe-search-area > div:first-child {
              display: none !important;
            }
            .epantry-recipe-governance .recipe-search-area > div:nth-child(2) {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              margin-top: 0 !important;
              gap: 9px !important;
            }
            .epantry-recipe-governance .recipe-search-area input {
              min-width: 0;
              height: 46px;
              font-size: 14px !important;
            }
            .epantry-recipe-governance .recipe-search-area button {
              flex-shrink: 0;
              width: 48px;
              min-width: 48px;
              height: 46px;
              padding: 0 !important;
              font-size: 0 !important;
            }
            .epantry-recipe-governance .recipe-review-queue {
              padding: 17px 16px !important;
              background: #F6EDE5;
            }
            .epantry-recipe-governance .recipe-review-queue > div:first-child {
              padding-bottom: 12px !important;
              gap: 8px !important;
            }
            .epantry-recipe-governance .recipe-review-queue h2,
            .epantry-recipe-governance .recipe-activity h2 {
              font-size: 22px !important;
              line-height: 1.25 !important;
              margin-top: 3px !important;
            }
            .epantry-recipe-governance .recipe-empty-state {
              padding-block: 13px 0 !important;
              gap: 12px !important;
            }
            .epantry-recipe-governance .recipe-empty-state > div {
              padding-left: 12px !important;
            }
            .epantry-recipe-governance .recipe-empty-state > a {
              min-height: 42px !important;
              font-size: 14px !important;
              align-self: flex-start;
            }
            .epantry-recipe-governance .recipe-activity {
              padding: 18px 16px 21px !important;
              background: #FAFAF6;
            }
            .epantry-recipe-governance .recipe-activity > div:first-child {
              display: flex !important;
              flex-flow: row wrap !important;
              justify-content: space-between;
              align-items: center;
              gap: 10px !important;
              padding-bottom: 12px !important;
            }
            .epantry-recipe-governance .recipe-activity > div:first-child > button {
              min-height: 42px !important;
              border-radius: 8px;
              padding: 0 12px !important;
              font-size: 13px !important;
            }
            .epantry-recipe-governance .recipe-library-row {
              gap: 10px !important;
              padding: 11px 0 !important;
            }
            .epantry-recipe-governance .recipe-library-row > div:first-child {
              width: 58px !important;
              height: 58px !important;
            }
            .epantry-recipe-governance .recipe-library-row > div:nth-child(2) > p:first-child {
              font-size: 15px !important;
            }
            .epantry-recipe-governance .recipe-library-row > div:nth-child(2) > p:not(:first-child) {
              font-size: 12.5px !important;
              line-height: 1.35 !important;
              margin-top: 2px !important;
            }
            .epantry-recipe-governance .recipe-library-row > button {
              min-height: 42px;
              height: 42px;
              padding: 0 9px !important;
              font-size: 13px !important;
            }
          }
        `}</style>

        <section aria-label="Recipe workspace overview" className="recipe-overview grid min-w-0 border-b border-[#D6DED6] lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="recipe-overview-hero flex min-w-0 flex-col justify-between bg-[#E8EEE6] px-4 py-6 sm:px-7 sm:py-8">
            <div>
              <p className="text-[13px] font-bold text-[#496C56]">RECIPE WORKSPACE</p>
              <h1 className="mt-2 max-w-[690px] text-[29px] font-bold leading-[1.13] tracking-[-0.045em] text-[#173F35] sm:hidden">Recipe reviews</h1>
              <h2 className="mt-2 hidden max-w-[690px] text-[29px] font-bold leading-[1.13] tracking-[-0.045em] text-[#173F35] sm:block sm:text-[39px]">Review recipes with clarity.</h2>
              <p className="recipe-hero-description mt-3 max-w-[580px] text-[15px] leading-[1.6] text-[#465950] sm:text-[16px]">
                Check new submissions, follow their status and keep your recipe library up to date.
              </p>
            </div>
            <div className="recipe-hero-actions mt-6 flex flex-wrap items-center gap-3">
              {canMutate && (
                <button
                  type="button"
                  onClick={() => setShowCreate((current) => !current)}
                  aria-expanded={showCreate}
                  aria-controls="recipe-create-form"
                  className="recipe-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-5 text-[15px] font-bold text-white transition hover:bg-[#255A45]"
                >
                  <CirclePlus size={18} aria-hidden="true" />
                  {showCreate ? 'Close recipe form' : 'Create recipe'}
                </button>
              )}
            </div>
          </div>
          <div className="recipe-overview-stats bg-[#173F35] px-5 py-5 text-white sm:px-7 sm:py-7">
            <p className="text-[13px] font-semibold text-[#D3E5D8]">Awaiting your decision</p>
            <div className="recipe-pending-total mt-1 flex items-end gap-3 border-b border-white/20 pb-5">
              <span className="text-[52px] font-bold leading-none tabular-nums sm:text-[62px]">{loading ? '…' : error && recipes.length === 0 ? '—' : recipeSummary.pending}</span>
              <span className="mb-1 text-[15px] text-[#DDE9E0]"><span className="sm:hidden">Pending</span><span className="hidden sm:inline">{recipeSummary.pending === 1 ? 'recipe in review' : 'recipes in review'}</span></span>
            </div>
            <div className="recipe-summary-grid grid grid-cols-3 gap-3 pt-5">
              {[
                ['Published', recipeSummary.published],
                ['Drafts', recipeSummary.drafts],
                ['All recipes', recipeSummary.total],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[24px] font-bold leading-tight tabular-nums">{loading || (error && recipes.length === 0) ? '—' : value}</p>
                  <p className="mt-1 text-[13px] leading-5 text-[#D1E2D6]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {showCreate && canMutate && (
          <div className="border-b border-[#CBDACA] bg-[#E9F1E9] px-4 py-3 text-[14px] font-semibold text-[#173F35] sm:px-7">
            New recipe draft · Fill in the details below, then save it for the normal review process.
          </div>
        )}
      {showCreate &&
        canMutate && (
          <form
            onSubmit={
              handleCreate
            }
            id="recipe-create-form" className="border-y border-[#D1DED5] bg-[#F2F5EF] px-4 py-6 sm:px-7 sm:py-8"
          >

            <div className="flex items-center gap-3">

              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#D8E5DA] text-[#173F35]">
                <ChefHat
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div>

                <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[#173F35]">
                  Create an EPANTRY recipe
                </h2>

                <p className="mt-1 text-xs text-stone-500">
                  Save a draft, then complete the usual review before publishing.
                </p>

              </div>

            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">

              <label className="text-xs font-black text-stone-700">
                Recipe name

                <input
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      name:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                  required
                />

              </label>

              <label className="text-xs font-black text-stone-700">
                Source attribution

                <input
                  value={
                    form.sourceName
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      sourceName:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                />

              </label>

              <label className="text-xs font-black text-stone-700">
                Cuisine

                <input
                  value={
                    form.cuisine
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      cuisine:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                />

              </label>

              <label className="text-xs font-black text-stone-700">
                Course

                <input
                  value={
                    form.course
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      course:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                />

              </label>

              <label className="text-xs font-black text-stone-700 md:col-span-2">
                Food type

                <select
                  value={
                    form.dietaryType
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      dietaryType:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none"
                  required
                >
                  <option value="">
                    Select Veg or Non-veg
                  </option>

                  <option value="veg">
                    Veg
                  </option>

                  <option value="nonveg">
                    Non-veg
                  </option>
                </select>

                <span className="mt-1.5 block text-[10px] font-semibold leading-4 text-stone-500">
                  Required for customer Veg / Non-veg recipe filtering.
                </span>
              </label>

              <label className="text-xs font-black text-stone-700 md:col-span-2">
                Description

                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      description:
                        event.target.value,
                    })
                  }
                  rows={3}
                  className="focus-ring mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none"
                />

              </label>

              <div className="md:col-span-2">
                <p className="text-xs font-black text-stone-700">
                  Recipe image
                </p>

                <div className="mt-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {form.heroImageUrl ? (
                      <img
                        src={form.heroImageUrl}
                        alt="Recipe preview"
                        className="h-28 w-full rounded-2xl object-cover sm:w-44"
                      />
                    ) : (
                      <div className="grid h-28 w-full place-items-center rounded-2xl border border-stone-200 bg-white text-xs font-bold text-stone-400 sm:w-44">
                        No image selected
                      </div>
                    )}

                    <div className="flex-1">
                      <p className="text-xs leading-5 text-stone-500">
                        Upload a JPEG, PNG, or WebP image up to 8 MB. The uploaded image becomes the public Recipe hero image when this Recipe is saved.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                          {imageUploading ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Upload
                              size={14}
                              aria-hidden="true"
                            />
                          )}
                          {form.heroImageUrl ? 'Replace image' : 'Upload image'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={creating || imageUploading}
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0]

                              event.target.value =
                                ''

                              if (file) {
                                handleRecipeImageUpload(
                                  file,
                                )
                              }
                            }}
                          />
                        </label>

                        {form.heroImageUrl ? (
                          <button
                            type="button"
                            disabled={creating || imageUploading}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                heroImageUrl: '',
                              }))
                            }
                            className="focus-ring rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                          >
                            Remove image
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <label className="text-xs font-black text-stone-700">
                Base servings

                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={
                    form.baseServings
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      baseServings:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                />

              </label>

              <label className="text-xs font-black text-stone-700">
                Difficulty

                <select
                  value={
                    form.difficulty
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      difficulty:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
                >
                  <option value="easy">
                    Easy
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="hard">
                    Hard
                  </option>
                </select>

              </label>

              <label className="text-xs font-black text-stone-700">
                Preparation minutes

                <input
                  type="number"
                  min="0"
                  value={
                    form.preparationTimeMinutes
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      preparationTimeMinutes:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                />

              </label>

              <label className="text-xs font-black text-stone-700">
                Cooking minutes

                <input
                  type="number"
                  min="0"
                  value={
                    form.cookingTimeMinutes
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      cookingTimeMinutes:
                        event.target.value,
                    })
                  }
                  className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
                />

              </label>

            </div>

            <div className="mt-7 border-t border-stone-100 pt-6">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <h3 className="font-black text-stone-950">
                    Canonical ingredients
                  </h3>

                  <p className="mt-1 text-xs text-stone-500">
                    Search the canonical Ingredient Dictionary here. No ObjectId
                    copying or extra tab is required.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={
                    () =>
                      setForm({
                        ...form,

                        ingredients: [
                          ...form.ingredients,

                          createIngredientRow(),
                        ],
                      })
                  }
                  className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700"
                >
                  <Plus
                    size={14}
                    aria-hidden="true"
                  />

                  Ingredient
                </button>

              </div>

              <div className="mt-4 space-y-3">

                {form.ingredients.map(
                  (
                    row,
                    index,
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="grid gap-2 rounded-2xl bg-stone-50 p-3 lg:grid-cols-[minmax(220px,1fr)_110px_100px_130px_minmax(160px,0.7fr)_42px]"
                    >

                      <IngredientPicker
                        value={
                          row.canonicalIngredientId
                        }
                        selectedName={
                          row.canonicalIngredientName
                        }
                        onSelect={(ingredient) =>
                          updateIngredientSelection(
                            index,
                            ingredient,
                          )
                        }
                        canCreateCanonicalIngredient={
                          canCreateCanonicalIngredient
                        }
                      />

                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        value={
                          row.quantity
                        }
                        onChange={(
                          event,
                        ) =>
                          updateIngredient(
                            index,
                            'quantity',
                            event.target.value,
                          )
                        }
                        placeholder="Qty"
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
                      />

                      <select
                        value={
                          row.unit
                        }
                        onChange={(
                          event,
                        ) =>
                          updateIngredient(
                            index,
                            'unit',
                            event.target.value,
                          )
                        }
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-2 text-sm outline-none"
                      >
                        {RECIPE_UNITS.map(
                          (
                            unit,
                          ) => (
                            <option
                              key={
                                unit
                              }
                              value={
                                unit
                              }
                            >
                              {
                                unit
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <select
                        value={
                          row.role
                        }
                        onChange={(
                          event,
                        ) =>
                          updateIngredient(
                            index,
                            'role',
                            event.target.value,
                          )
                        }
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-2 text-sm outline-none"
                      >
                        {INGREDIENT_ROLES.map(
                          (
                            role,
                          ) => (
                            <option
                              key={
                                role
                              }
                              value={
                                role
                              }
                            >
                              {
                                role
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <input
                        value={
                          row.preparationState
                        }
                        onChange={(
                          event,
                        ) =>
                          updateIngredient(
                            index,
                            'preparationState',
                            event.target.value,
                          )
                        }
                        placeholder="Preparation state"
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
                      />

                      <button
                        type="button"
                        onClick={
                          () =>
                            setForm({
                              ...form,

                              ingredients:
                                form.ingredients.filter(
                                  (
                                    _,
                                    rowIndex,
                                  ) =>
                                    rowIndex !==
                                    index,
                                ),
                            })
                        }
                        disabled={
                          form.ingredients
                            .length <=
                          1
                        }
                        className="focus-ring grid h-10 w-10 place-items-center rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-30"
                        aria-label="Remove ingredient"
                      >
                        <Trash2
                          size={16}
                          aria-hidden="true"
                        />
                      </button>

                    </div>
                  ),
                )}

              </div>

            </div>

            <div className="mt-7 border-t border-stone-100 pt-6">

              <div className="flex items-center justify-between gap-4">

                <h3 className="font-black text-stone-950">
                  Method steps
                </h3>

                <button
                  type="button"
                  onClick={
                    () =>
                      setForm({
                        ...form,

                        steps: [
                          ...form.steps,

                          createStepRow(),
                        ],
                      })
                  }
                  className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700"
                >
                  <Plus
                    size={14}
                    aria-hidden="true"
                  />

                  Step
                </button>

              </div>

              <div className="mt-4 space-y-3">

                {form.steps.map(
                  (
                    row,
                    index,
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[42px_minmax(0,1fr)_120px_42px]"
                    >

                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-stone-950 text-sm font-black text-white">
                        {
                          index +
                          1
                        }
                      </div>

                      <input
                        value={
                          row.instruction
                        }
                        onChange={(
                          event,
                        ) =>
                          updateStep(
                            index,
                            'instruction',
                            event.target.value,
                          )
                        }
                        placeholder="Instruction"
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
                      />

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          row.timerMinutes
                        }
                        onChange={(
                          event,
                        ) =>
                          updateStep(
                            index,
                            'timerMinutes',
                            event.target.value,
                          )
                        }
                        placeholder="Timer min"
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
                      />

                      <button
                        type="button"
                        onClick={
                          () =>
                            setForm({
                              ...form,

                              steps:
                                form.steps.filter(
                                  (
                                    _,
                                    rowIndex,
                                  ) =>
                                    rowIndex !==
                                    index,
                                ),
                            })
                        }
                        disabled={
                          form.steps
                            .length <=
                          1
                        }
                        className="focus-ring grid h-10 w-10 place-items-center rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-30"
                        aria-label="Remove step"
                      >
                        <Trash2
                          size={16}
                          aria-hidden="true"
                        />
                      </button>

                    </div>
                  ),
                )}

              </div>

            </div>

            <div className="mt-6 flex justify-end">

              <button
                type="submit"
                disabled={
                  creating ||
                  imageUploading
                }
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 text-[15px] font-bold text-white hover:bg-[#255E49] disabled:opacity-60"
              >
                {creating ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CirclePlus
                    size={16}
                    aria-hidden="true"
                  />
                )}

                Create governed draft
              </button>

            </div>

          </form>
        )}



        <section aria-label="Search recipe records" className="recipe-search-area border-b border-[#D5DDD5] bg-[#FCFBF8] px-4 py-4 sm:px-7">
          <div className="mb-2 text-[14px] font-bold text-[#365D46]">Find a recipe</div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6E8071]" />
              <input type="search" aria-label="Search recipes" value={search} onChange={(event) => { setSearch(event.target.value); setShowAllRecent(false) }} placeholder="Search all recipes, cuisines or courses" className="recipe-focus-ring h-12 w-full rounded-lg border border-[#C8D6CB] bg-white pl-10 pr-3 text-[15px] text-[#202421] placeholder:text-[#748176]" />
            </label>
            <button type="button" aria-label="Refresh recipes" onClick={loadRecipes} disabled={loading} className="recipe-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#CBD5CC] bg-white px-4 text-[14px] font-bold text-[#173F35] hover:bg-[#EDF2EC] disabled:opacity-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh</button>
          </div>
        </section>

        <section id="recipe-review-queue" aria-labelledby="recipe-review-heading" className="recipe-review-queue border-b border-[#D9CDBF] bg-[#F3E9DF] px-4 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#D4DED5] pb-4">
            <div>
              <p className="text-[13px] font-bold text-[#905F43]">01 / INCOMING REVIEWS</p>
              <h2 id="recipe-review-heading" className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[28px]">Waiting for review</h2>
            </div>
            <div className="rounded-md bg-[#E6EBE5] px-3 py-2 text-[15px] font-bold tabular-nums text-[#173F35]">
              {loading ? 'Loading…' : error && recipes.length === 0 ? 'Unavailable' : `${pendingReviews.length} pending`}
            </div>
          </div>

          {error && !recipes.length ? (
            <div role="alert" className="mt-4 border-l-[3px] border-[#B34C45] bg-[#FAEAE7] px-4 py-3 text-[15px] text-[#772F2A]">
              <p className="font-bold">Could not load the recipe list.</p>
              <p className="mt-1">{error}</p>
              <button type="button" onClick={loadRecipes} className="recipe-focus-ring mt-3 rounded-md bg-[#173F35] px-4 py-2 text-[14px] font-bold text-white">Retry</button>
            </div>
          ) : loading ? (
            <div role="status" className="flex items-center gap-2 py-6 text-[15px] text-[#55685B]"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Loading submissions…</div>
          ) : pendingReviews.length === 0 ? (
            <div className="recipe-empty-state flex flex-col justify-between gap-3 py-5 sm:flex-row sm:items-center">
              <div className="min-w-0 border-l-[3px] border-[#94AC9B] pl-4">
                <p className="text-[17px] font-bold text-[#173F35]">All caught up</p>
                <p className="mt-1 hidden text-[15px] leading-6 text-[#5A6B61] sm:block">No recipes need a decision right now. New Host submissions will appear here.</p>
              </div>
              <a href="#recipe-activity" className="recipe-focus-ring inline-flex min-h-11 items-center justify-center self-start rounded-lg border border-[#C6D2C6] bg-white px-4 text-[14px] font-bold text-[#173F35] hover:bg-[#F0F4EF]"><span className="sm:hidden">See recent recipes ↓</span><span className="hidden sm:inline">View recipe activity ↓</span></a>
            </div>
          ) : (
            <div className="divide-y divide-[#E1E7E0]">
              {pendingReviews.map((item, index) => {
                const dish = item?.dish || {}
                const version = item?.latestVersion || {}
                const isHostSubmission = Boolean(version?.source?.organizationId) || version?.source?.type === 'community' || version?.source?.type === 'brand'
                return (
                  <div key={version.id || dish.id || index} className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-3 py-4 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-[#E1E9E0] sm:h-16 sm:w-16">
                      {dish.heroImageUrl ? <img src={dish.heroImageUrl} loading="lazy" alt="" className="h-full w-full object-cover" /> : <ChefHat size={24} className="text-[#678270]" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="break-words text-[17px] font-bold text-[#173F35]">{dish.name || version.title || 'Untitled recipe'}</h3>
                      <p className="mt-1 text-[14px] leading-5 text-[#5B6E60]">{isHostSubmission ? 'Host submission' : 'EPANTRY submission'} · Version {version.versionNumber || '—'}{dish.cuisine ? ` · ${dish.cuisine}` : ''}</p>
                      {version.submittedAt && <p className="mt-1 text-[13px] text-[#728075]">Submitted {formatDateTime(version.submittedAt)}</p>}
                    </div>
                    <button type="button" disabled={!version.id} onClick={() => navigate(`/admin/recipes/${version.id}`)} className="recipe-focus-ring col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#173F35] px-4 text-[15px] font-bold text-white hover:bg-[#275F49] disabled:opacity-50 sm:col-span-1">Review recipe ↗</button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section id="recipe-activity" aria-labelledby="recipe-activity-heading" className="recipe-activity bg-[#F5F5F0] px-4 py-6 sm:px-7 sm:py-8">
          <div className="flex flex-col justify-between gap-4 border-b border-[#D6DED5] pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[13px] font-bold text-[#557464]">02 / RECIPE LIBRARY</p>
              <h2 id="recipe-activity-heading" className="mt-1 text-[24px] font-bold tracking-[-0.03em] text-[#173F35] sm:text-[28px]">Recent recipes</h2>
              <p className="mt-1 hidden text-[15px] leading-6 text-[#637167] sm:block">Check status or open an existing recipe in Catalog & Listings.</p>
            </div>
            <button type="button" onClick={() => navigate('/admin/catalog')} className="recipe-focus-ring inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-lg border border-[#BCCBBF] bg-white px-4 text-[15px] font-bold text-[#173F35] hover:bg-[#EDF2EC]"><span className="sm:hidden">Open catalog ↗</span><span className="hidden sm:inline">Open Catalog & Listings ↗</span></button>
          </div>
          {error && recipes.length > 0 && <div role="alert" className="mt-3 border-l-[3px] border-[#B34C45] bg-[#FAEAE7] px-4 py-3 text-[14px] text-[#772F2A]">Could not refresh recipes: {error}</div>}

          {loading && recipes.length === 0 ? (
            <div role="status" className="py-8 text-[15px] text-[#5D6D62]">Loading recipe activity…</div>
          ) : visibleRecentRecipes.length === 0 ? (
            <p className="py-6 text-[15px] text-[#5D6D62]">{error ? 'Recipe data is unavailable.' : 'No recipes match your search.'}</p>
          ) : (
            <>
              <div className="mt-4 grid min-w-0 gap-x-7 lg:grid-cols-2">
                {visibleRecentRecipes.map((item, index) => {
                  const dish = item?.dish || {}
                  const version = item?.latestVersion || {}
                  const foodReady = item?.foodIntelligence?.approved === true
                  const isPending = version.status === 'in_review'
                  return (
                    <div key={version.id || dish.id || index} className={`recipe-library-row min-w-0 border-b border-[#DEE6DD] py-3 ${!showAllRecent && index >= 5 ? 'hidden sm:flex' : 'flex'} items-center gap-3`}>
                      <div className="flex h-[66px] w-[66px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#E2E9E1]">
                        {dish.heroImageUrl ? <img src={dish.heroImageUrl} loading="lazy" alt="" className="h-full w-full object-cover" /> : <ChefHat size={23} aria-hidden="true" className="text-[#6B8572]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[16px] font-bold leading-[1.3] text-[#173F35]">{dish.name || version.title || 'Untitled recipe'}</p>
                        <p className="mt-1 text-[13px] leading-5 text-[#617267]">{dish.cuisine || 'Cuisine not set'} · Version {version.versionNumber || '—'}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium text-[#53685A]">
                          <span>{String(version.status || 'draft').replace(/_/g, ' ')}</span><span aria-hidden="true">·</span>
                          <span className={foodReady ? 'text-[#246748]' : 'text-[#94683F]'}>{foodReady ? 'Food check approved' : 'Food check needed'}</span>
                        </p>
                      </div>
                      <button type="button" onClick={() => isPending && version.id ? navigate(`/admin/recipes/${version.id}`) : navigate('/admin/catalog')} className="recipe-focus-ring inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-[#CDD9CE] bg-white px-3 text-[14px] font-bold text-[#173F35] hover:bg-[#E8F0E8]">{isPending ? 'Review' : 'Manage'}</button>
                    </div>
                  )
                })}
              </div>
              {sortedRecentRecipes.length > 5 && (
                <div className="mt-5 flex justify-center">
                  <button type="button" onClick={() => setShowAllRecent((current) => !current)} className={`recipe-focus-ring min-h-11 rounded-lg border border-[#BFCDBF] bg-white px-6 text-[15px] font-bold text-[#173F35] hover:bg-[#EAF1E9] ${!showAllRecent && sortedRecentRecipes.length <= 8 ? 'sm:hidden' : ''}`}>
                    {showAllRecent ? 'Show fewer' : `View all ${sortedRecentRecipes.length} recipes`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </AdminShell>
  )
}
