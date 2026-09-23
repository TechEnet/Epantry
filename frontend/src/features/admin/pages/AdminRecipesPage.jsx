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

  const [
    status,
    setStatus,
  ] =
    useState(
      'active',
    )

  const [
    showCreate,
    setShowCreate,
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

  const loadRecipes =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const data =
            await listAdminRecipes({
              page:
                1,

              limit:
                100,

              status,

              search:
                search.trim(),
            })

          setRecipes(
            Array.isArray(
              data?.recipes,
            )
              ? data.recipes
              : [],
          )
        } catch (loadError) {
          setError(
            loadError?.message ||
            'Unable to load Recipe administration.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        search,
        status,
      ],
    )

  useEffect(
    () => {
      loadRecipes()
    },
    [
      loadRecipes,
    ],
  )

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
      title="Recipe Management"
      description="Create and govern versioned Recipe objects. Published Recipe Versions remain immutable; corrections create new versions."
      actions={
        canMutate ? (
          <button
            type="button"
            onClick={
              () =>
                setShowCreate(
                  (
                    current,
                  ) =>
                    !current,
                )
            }
            className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            <CirclePlus
              size={17}
              aria-hidden="true"
            />

            New Recipe
          </button>
        ) : null
      }
    >

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {
            error
          }
        </div>
      )}

      <section className="mb-6 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-800">
                Live review queue
              </span>

              <span className="text-xs font-bold text-stone-500">
                {pendingReviews.length} pending
              </span>
            </div>

            <h2 className="mt-3 text-lg font-black text-stone-950">
              Recipes awaiting Super Admin review
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">
              Host-submitted Recipes appear here as soon as they enter M07 review. This is an active review queue, not Listing History. Open a Recipe to review its content, Food Intelligence declaration and publication gates.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadRecipes
            }
            disabled={
              loading
            }
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-black text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
              aria-hidden="true"
            />

            Refresh queue
          </button>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-500">
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
            Loading pending Recipe reviews…
          </div>
        ) : pendingReviews.length ===
          0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-black text-stone-800">
              No Recipe is waiting for review.
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              A Host submission will appear here automatically after it is submitted for Super Admin review.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {pendingReviews.map(
              (
                item,
              ) => {
                const dish =
                  item?.dish ||
                  {}

                const version =
                  item?.latestVersion ||
                  {}

                const isHostSubmission =
                  Boolean(
                    version?.source
                      ?.organizationId,
                  ) ||
                  version?.source
                    ?.type ===
                    'community' ||
                  version?.source
                    ?.type ===
                    'brand'

                return (
                  <article
                    key={
                      version.id ||
                      dish.id
                    }
                    className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${statusClass(
                              version.status,
                            )}`}
                          >
                            {String(
                              version.status ||
                                'in_review',
                            ).replace(
                              /_/g,
                              ' ',
                            )}
                          </span>

                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-600">
                            {isHostSubmission
                              ? 'Host submitted'
                              : 'Editorial submission'}
                          </span>

                          <span className="text-[11px] font-bold text-stone-500">
                            Version {version.versionNumber || '—'}
                          </span>
                        </div>

                        <h3 className="mt-2 truncate text-base font-black text-stone-950">
                          {dish.name ||
                            version.title ||
                            'Untitled Recipe'}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                          <span>
                            Source: <strong className="text-stone-700">{version?.source?.name || 'EPANTRY'}</strong>
                          </span>

                          <span>
                            Submitted: <strong className="text-stone-700">{formatDateTime(version.submittedAt)}</strong>
                          </span>

                          {dish.cuisine ? (
                            <span>
                              Cuisine: <strong className="text-stone-700">{dish.cuisine}</strong>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={
                          () =>
                            navigate(
                              `/admin/recipes/${version.id}`,
                            )
                        }
                        className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-stone-950 px-4 text-xs font-black text-white transition hover:bg-emerald-700"
                      >
                        Open Review
                      </button>
                    </div>
                  </article>
                )
              },
            )}
          </div>
        )}
      </section>

      {showCreate &&
        canMutate && (
          <form
            onSubmit={
              handleCreate
            }
            className="mb-6 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
          >

            <div className="flex items-center gap-3">

              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ChefHat
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div>

                <h2 className="text-xl font-black text-stone-950">
                  Create Recipe v1
                </h2>

                <p className="mt-1 text-xs text-stone-500">
                  Draft only. Publication still requires normal review and QA.
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
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-2xl bg-stone-950 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
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

      <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-black text-stone-950">Completed and historical Recipe listings live in Listing History</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          Pending review work stays on this Recipe Management page. Use the dedicated Listing History workspace for existing draft/published/retired Recipe versions, Food Intelligence status, Edit and Delete actions.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/listing-history')}
          className="focus-ring mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-black text-stone-700 hover:bg-stone-100"
        >
          Open Listing History
        </button>
      </div>

    </AdminShell>
  )
}