import {
  ArrowLeft,
  BadgeCheck,
  CirclePlus,
  FileCheck2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
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
  useParams,
} from 'react-router-dom'

import AdminShell from '../components/AdminShell'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  declareRecipeFoodIntelligence,
  getAdminRecipeFoodIntelligenceLatest,
} from '../../foodIntelligence/services/foodIntelligence.service'

import {
  changeAdminDishLifecycle,
  changeAdminRecipeVersionLifecycle,
  createNextAdminRecipeVersion,
  getAdminRecipeVersion,
  publishAdminRecipeVersion,
  reviewAdminRecipeVersion,
  submitAdminRecipeForReview,
  updateAdminRecipeDraft,
  updateAdminRecipeHeroImage,
  uploadRecipeImage,
} from '../../recipes/services/recipe.service'

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


const FOOD_NUTRIENT_FIELDS = [
  {
    key:
      'energy',

    label:
      'Energy',

    unit:
      'kcal',
  },

  {
    key:
      'protein',

    label:
      'Protein',

    unit:
      'g',
  },

  {
    key:
      'carbohydrate',

    label:
      'Carbohydrate',

    unit:
      'g',
  },

  {
    key:
      'total_fat',

    label:
      'Total fat',

    unit:
      'g',
  },

  {
    key:
      'saturated_fat',

    label:
      'Saturated fat',

    unit:
      'g',
  },

  {
    key:
      'fiber',

    label:
      'Dietary fibre',

    unit:
      'g',
  },

  {
    key:
      'total_sugars',

    label:
      'Total sugars',

    unit:
      'g',
  },

  {
    key:
      'sodium',

    label:
      'Sodium',

    unit:
      'mg',
  },
]

const FOOD_ALLERGEN_FIELDS = [
  {
    key:
      'milk',

    label:
      'Milk',
  },

  {
    key:
      'egg',

    label:
      'Egg',
  },

  {
    key:
      'peanuts',

    label:
      'Peanuts',
  },

  {
    key:
      'tree_nuts',

    label:
      'Tree nuts',
  },

  {
    key:
      'wheat_gluten',

    label:
      'Wheat / gluten',
  },

  {
    key:
      'soy',

    label:
      'Soy',
  },

  {
    key:
      'sesame',

    label:
      'Sesame',
  },

  {
    key:
      'fish',

    label:
      'Fish',
  },

  {
    key:
      'shellfish',

    label:
      'Shellfish',
  },
]

function initialFoodIntelligenceState() {
  return {
    nutrition:
      Object.fromEntries(
        FOOD_NUTRIENT_FIELDS.map(
          (
            field,
          ) => [
            field.key,
            '',
          ],
        ),
      ),

    allergens:
      Object.fromEntries(
        FOOD_ALLERGEN_FIELDS.map(
          (
            field,
          ) => [
            field.key,
            '',
          ],
        ),
      ),

    dietaryClassification:
      'not_declared',

    basis:
      'Per serving. Super Admin declaration from the reviewed Recipe formulation.',

    reason:
      'Recipe nutrition, allergen and dietary declaration reviewed by Super Admin.',
  }
}

function foodIntelligenceStateFromStatus(
  statusData,
) {
  const initial =
    initialFoodIntelligenceState()

  const snapshot =
    statusData?.latest ||
    statusData?.latestApproved ||
    null

  const declaration =
    snapshot?.declaration ||
    null

  if (!declaration) {
    return initial
  }

  const nutrition = {
    ...initial.nutrition,
  }

  for (
    const item
    of declaration.nutrition ||
      []
  ) {
    if (
      Object.hasOwn(
        nutrition,
        item.key,
      )
    ) {
      nutrition[
        item.key
      ] =
        item.amount ??
        ''
    }
  }

  const allergens = {
    ...initial.allergens,
  }

  for (
    const item
    of declaration.allergens ||
      []
  ) {
    if (
      Object.hasOwn(
        allergens,
        item.key,
      )
    ) {
      allergens[
        item.key
      ] =
        item.relationship ||
        ''
    }
  }

  return {
    nutrition,

    allergens,

    dietaryClassification:
      declaration.dietaryClassification ||
      'not_declared',

    basis:
      declaration.basis ||
      initial.basis,

    reason:
      snapshot.status ===
        'requires_review'
        ? 'Super Admin reviewed the Host Recipe Food Intelligence declaration against the submitted Recipe formulation.'
        : initial.reason,
  }
}

function foodIntelligenceStatusLabel(
  statusData,
) {
  const latest =
    statusData?.latest

  if (!latest) {
    return {
      label:
        'Missing',

      className:
        'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (
    latest.isStale
  ) {
    return {
      label:
        'Stale after Recipe edit',

      className:
        'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (
    latest.status ===
      'approved'
  ) {
    return {
      label:
        'Approved',

      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800',
    }
  }

  if (
    latest.status ===
      'requires_review'
  ) {
    return {
      label:
        'Host declaration · review required',

      className:
        'border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  return {
    label:
      String(
        latest.status ||
        'Pending',
      ).replace(
        /_/g,
        ' ',
      ),

    className:
      'border-stone-200 bg-stone-50 text-stone-700',
  }
}

function numericOrNull(
  value,
) {
  if (
    value ===
    '' ||
    value ===
    null ||
    value ===
    undefined
  ) {
    return null
  }

  const numeric =
    Number(
      value,
    )

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : null
}

function buildDraftState(
  data,
) {
  const recipe =
    data?.recipeVersion ||
    {}

  const ingredients =
    data?.ingredients ||
    []

  const steps =
    data?.steps ||
    []

  return {
    title:
      recipe.title ||
      '',

    recipeDescription:
      recipe.description ||
      '',

    baseServings:
      recipe.baseServings ||
      1,

    servingSizeAmount:
      recipe.servingSizeAmount ??
      '',

    servingSizeUnit:
      recipe.servingSizeUnit ||
      '',

    finishedYieldAmount:
      recipe.finishedYieldAmount ??
      '',

    finishedYieldUnit:
      recipe.finishedYieldUnit ||
      '',

    scalingMethod:
      recipe.scalingMethod ||
      'linear',

    minRecommendedServings:
      recipe.minRecommendedServings ??
      '',

    maxRecommendedServings:
      recipe.maxRecommendedServings ??
      '',

    preparationTimeMinutes:
      recipe.preparationTimeMinutes ||
      0,

    cookingTimeMinutes:
      recipe.cookingTimeMinutes ||
      0,

    difficulty:
      recipe.difficulty ||
      'easy',

    sourceType:
      recipe.source?.type ||
      'internal',

    sourceName:
      recipe.source?.name ||
      '',

    sourceUrl:
      recipe.source?.url ||
      '',

    sourceBrandId:
      recipe.source?.brandId ||
      '',

    sourceOrganizationId:
      recipe.source
        ?.organizationId ||
      '',

    unsafeIncomplete:
      recipe.unsafeIncomplete ===
      true,

    unsafeIncompleteReason:
      recipe.unsafeIncompleteReason ||
      '',

    ingredients:
      ingredients.map(
        (
          ingredient,
        ) => ({
          id:
            ingredient.id,

          canonicalIngredientId:
            ingredient.canonicalIngredientId,

          canonicalIngredient:
            ingredient.canonicalIngredient ||
            null,

          quantity:
            ingredient.quantity,

          unit:
            ingredient.unit,

          preparationState:
            ingredient.preparationState ||
            '',

          optional:
            ingredient.optional ===
            true,

          role:
            ingredient.role ||
            'main',

          notes:
            ingredient.notes ||
            '',

          substitutionGroupKey:
            ingredient.substitutionGroupKey ||
            '',

          productConstraints:
            ingredient.productConstraints ||
            [],

          scalingRule: {
            type:
              ingredient.scalingRule
                ?.type ||
              'linear',

            exponent:
              ingredient.scalingRule
                ?.exponent ??
              1,

            minMultiplier:
              ingredient.scalingRule
                ?.minMultiplier ??
              null,

            maxMultiplier:
              ingredient.scalingRule
                ?.maxMultiplier ??
              null,
          },
        }),
      ),

    steps:
      steps.map(
        (
          step,
        ) => ({
          stepNumber:
            step.stepNumber,

          instruction:
            step.instruction,

          timerSeconds:
            step.timerSeconds ??
            '',

          temperatureValue:
            step.temperature
              ?.value ??
            '',

          temperatureUnit:
            step.temperature
              ?.unit ||
            '',

          equipment:
            step.equipment ||
            [],

          parallelizable:
            step.parallelizable ===
            true,

          prepAhead:
            step.prepAhead ===
            true,
        }),
      ),
  }
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

  if (
    status ===
    'disabled'
  ) {
    return 'bg-red-50 text-red-800'
  }

  return 'bg-stone-100 text-stone-700'
}

function adminRecipeLabel(
  value,
) {
  return String(
    value ||
      '',
  )
    .replace(
      /_/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    )
}

function AdminRecipeDetailsSheet({
  dish,
  recipe,
  ingredients,
  foodIntelligence,
}) {
  const ingredientRows =
    Array.isArray(
      ingredients,
    )
      ? ingredients
      : []

  const nutritionRows =
    FOOD_NUTRIENT_FIELDS
      .map(
        (
          field,
        ) => ({
          ...field,

          value:
            foodIntelligence
              ?.nutrition?.[
                field.key
              ],
        }),
      )
      .filter(
        (
          field,
        ) =>
          field.value !==
            '' &&
          field.value !==
            null &&
          field.value !==
            undefined,
      )

  const allergenRows =
    FOOD_ALLERGEN_FIELDS
      .map(
        (
          field,
        ) => ({
          ...field,

          value:
            foodIntelligence
              ?.allergens?.[
                field.key
              ],
        }),
      )
      .filter(
        (
          field,
        ) =>
          Boolean(
            field.value,
          ),
      )

  return (
    <div className="h-64 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-800 bg-emerald-950 px-4 py-3 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-200">
          Recipe details sheet
        </p>
        <h3 className="mt-1 truncate text-sm font-black">
          {dish?.name ||
            recipe?.title ||
            'Recipe'}
        </h3>
      </div>

      <div className="h-[calc(100%-61px)] overflow-y-auto p-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
          {[
            [
              'Servings',
              recipe?.baseServings ??
                '—',
            ],
            [
              'Prep',
              `${Number(
                recipe?.preparationTimeMinutes ||
                  0,
              )} min`,
            ],
            [
              'Cook',
              `${Number(
                recipe?.cookingTimeMinutes ||
                  0,
              )} min`,
            ],
            [
              'Difficulty',
              adminRecipeLabel(
                recipe?.difficulty,
              ) ||
                '—',
            ],
            [
              'Cuisine',
              dish?.cuisine ||
                '—',
            ],
            [
              'Course',
              dish?.course ||
                '—',
            ],
          ].map(
            ([
              label,
              value,
            ]) => (
              <div
                key={label}
                className="border-b border-stone-100 pb-1.5"
              >
                <dt className="font-black uppercase tracking-[0.08em] text-stone-400">
                  {label}
                </dt>
                <dd className="mt-0.5 font-black text-stone-900">
                  {value}
                </dd>
              </div>
            ),
          )}
        </dl>

        <div className="mt-3 border-t border-stone-200 pt-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">
            Ingredients
          </p>
          <div className="mt-1.5 space-y-1">
            {ingredientRows.length ? (
              ingredientRows.map(
                (
                  ingredient,
                  index,
                ) => (
                  <p
                    key={
                      ingredient.id ||
                      `${ingredient.canonicalIngredientId}-${index}`
                    }
                    className="text-[10px] font-semibold leading-4 text-stone-700"
                  >
                    {ingredient.quantity}{' '}
                    {ingredient.unit}{' '}
                    {ingredient
                      ?.canonicalIngredient
                      ?.canonicalName ||
                      'Ingredient'}
                    {ingredient.preparationState
                      ? ` · ${ingredient.preparationState}`
                      : ''}
                  </p>
                ),
              )
            ) : (
              <p className="text-[10px] font-semibold text-stone-400">
                No ingredient rows available.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 border-t border-stone-200 pt-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">
            Nutrition
          </p>
          {nutritionRows.length ? (
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {nutritionRows.map(
                (
                  item,
                ) => (
                  <p
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-[10px]"
                  >
                    <span className="font-bold text-stone-500">
                      {item.label}
                    </span>
                    <span className="font-black text-stone-900">
                      {item.value}{' '}
                      {item.unit}
                    </span>
                  </p>
                ),
              )}
            </div>
          ) : (
            <p className="mt-1 text-[10px] font-semibold text-stone-400">
              Not declared
            </p>
          )}
        </div>

        <div className="mt-3 border-t border-stone-200 pt-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">
            Allergens & dietary
          </p>
          <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-700">
            {allergenRows.length
              ? allergenRows
                  .map(
                    (
                      item,
                    ) =>
                      `${item.label}: ${adminRecipeLabel(
                        item.value,
                      )}`,
                  )
                  .join(
                    ' · ',
                  )
              : 'No allergen relationship declared'}
          </p>
          <p className="mt-1 text-[10px] font-black text-stone-900">
            Dietary: {adminRecipeLabel(
              foodIntelligence
                ?.dietaryClassification ||
                'not_declared',
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AdminRecipeEditorPage() {
  const {
    versionId,
  } =
    useParams()

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

  const canPublish =
    hasAdminPermission(
      'recipe.publish',
    )

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    draft,
    setDraft,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    busy,
    setBusy,
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
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const [
    governanceReason,
    setGovernanceReason,
  ] =
    useState(
      '',
    )

  const [
    reviewType,
    setReviewType,
  ] =
    useState(
      'editorial',
    )

  const [
    reviewDecision,
    setReviewDecision,
  ] =
    useState(
      'approved',
    )


  const [
    foodIntelligence,
    setFoodIntelligence,
  ] =
    useState(
      initialFoodIntelligenceState,
    )

  const [
    foodIntelligenceStatus,
    setFoodIntelligenceStatus,
  ] =
    useState(
      null,
    )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const [
            nextData,
            nextFoodIntelligenceStatus,
          ] =
            await Promise.all([
              getAdminRecipeVersion(
                versionId,
              ),

              getAdminRecipeFoodIntelligenceLatest(
                versionId,
              ),
            ])

          setData(
            nextData,
          )

          setDraft(
            buildDraftState(
              nextData,
            ),
          )

          setFoodIntelligenceStatus(
            nextFoodIntelligenceStatus,
          )

          setFoodIntelligence(
            foodIntelligenceStateFromStatus(
              nextFoodIntelligenceStatus,
            ),
          )
        } catch (loadError) {
          setError(
            loadError?.message ||
            'Unable to load Recipe Version.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        versionId,
      ],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  const recipe =
    data?.recipeVersion ||
    {}

  const dish =
    data?.dish ||
    {}

  const foodIntelligenceStatusView =
    foodIntelligenceStatusLabel(
      foodIntelligenceStatus,
    )

  const editable =
    recipe.status ===
      'draft' &&
    canMutate

  const pendingHostIngredientCount =
    (
      data?.ingredients ||
      []
    ).filter(
      (
        ingredient,
      ) =>
        ingredient
          ?.canonicalIngredient
          ?.attributes
          ?.hostRecipeProposal
          ?.state ===
          'pending' ||
        ingredient
          ?.canonicalIngredient
          ?.status ===
          'disabled',
    ).length

  const ingredientIdToLine =
    useMemo(
      () =>
        new Map(
          (
            data?.ingredients ||
            []
          ).map(
            (
              ingredient,
            ) => [
              String(
                ingredient.id,
              ),

              ingredient.lineNumber,
            ],
          ),
        ),
      [
        data?.ingredients,
      ],
    )

  function requireReason() {
    if (
      !governanceReason.trim()
    ) {
      setError(
        'Enter a governance reason before performing this action.',
      )

      return false
    }

    return true
  }

  function updateIngredient(
    index,
    key,
    value,
  ) {
    setDraft(
      (
        current,
      ) => ({
        ...current,

        ingredients:
          current.ingredients.map(
            (
              ingredient,
              ingredientIndex,
            ) =>
              ingredientIndex ===
              index
                ? {
                    ...ingredient,

                    [key]:
                      value,
                  }
                : ingredient,
          ),
      }),
    )
  }

  function updateStep(
    index,
    key,
    value,
  ) {
    setDraft(
      (
        current,
      ) => ({
        ...current,

        steps:
          current.steps.map(
            (
              step,
              stepIndex,
            ) =>
              stepIndex ===
              index
                ? {
                    ...step,

                    [key]:
                      value,
                  }
                : step,
          ),
      }),
    )
  }

  function buildPayload() {
    return {
      title:
        draft.title.trim(),

      recipeDescription:
        draft.recipeDescription.trim(),

      baseServings:
        Number(
          draft.baseServings,
        ),

      servingSizeAmount:
        numericOrNull(
          draft.servingSizeAmount,
        ),

      servingSizeUnit:
        numericOrNull(
          draft.servingSizeAmount,
        ) ===
        null
          ? null
          : draft.servingSizeUnit ||
            null,

      finishedYieldAmount:
        numericOrNull(
          draft.finishedYieldAmount,
        ),

      finishedYieldUnit:
        numericOrNull(
          draft.finishedYieldAmount,
        ) ===
        null
          ? null
          : draft.finishedYieldUnit ||
            null,

      scalingMethod:
        draft.scalingMethod,

      minRecommendedServings:
        numericOrNull(
          draft.minRecommendedServings,
        ),

      maxRecommendedServings:
        numericOrNull(
          draft.maxRecommendedServings,
        ),

      preparationTimeMinutes:
        Number(
          draft.preparationTimeMinutes ||
          0,
        ),

      cookingTimeMinutes:
        Number(
          draft.cookingTimeMinutes ||
          0,
        ),

      difficulty:
        draft.difficulty,

      source: {
        type:
          draft.sourceType,

        name:
          draft.sourceName.trim(),

        url:
          draft.sourceUrl.trim(),

        brandId:
          draft.sourceBrandId.trim() ||
          null,

        organizationId:
          draft.sourceOrganizationId.trim() ||
          null,
      },

      unsafeIncomplete:
        draft.unsafeIncomplete,

      unsafeIncompleteReason:
        draft.unsafeIncompleteReason.trim(),

      ingredients:
        draft.ingredients.map(
          (
            ingredient,
            index,
          ) => ({
            lineNumber:
              index +
              1,

            canonicalIngredientId:
              ingredient.canonicalIngredientId.trim(),

            quantity:
              Number(
                ingredient.quantity,
              ),

            unit:
              ingredient.unit,

            preparationState:
              ingredient.preparationState.trim(),

            optional:
              ingredient.optional ===
              true,

            role:
              ingredient.role,

            notes:
              ingredient.notes.trim(),

            substitutionGroupKey:
              ingredient.substitutionGroupKey.trim(),

            productConstraints:
              ingredient.productConstraints,

            scalingRule: {
              type:
                ingredient.scalingRule
                  ?.type ||
                'linear',

              exponent:
                Number(
                  ingredient.scalingRule
                    ?.exponent ??
                  1,
                ),

              minMultiplier:
                ingredient.scalingRule
                  ?.minMultiplier ??
                null,

              maxMultiplier:
                ingredient.scalingRule
                  ?.maxMultiplier ??
                null,
            },
          }),
        ),

      steps:
        draft.steps.map(
          (
            step,
            index,
          ) => ({
            stepNumber:
              index +
              1,

            instruction:
              step.instruction.trim(),

            timerSeconds:
              numericOrNull(
                step.timerSeconds,
              ),

            temperatureValue:
              numericOrNull(
                step.temperatureValue,
              ),

            temperatureUnit:
              numericOrNull(
                step.temperatureValue,
              ) ===
              null
                ? null
                : step.temperatureUnit ||
                  null,

            equipment:
              step.equipment,

            parallelizable:
              step.parallelizable ===
              true,

            prepAhead:
              step.prepAhead ===
              true,
          }),
        ),

      substitutions:
        (
          data?.substitutions ||
          []
        )
          .map(
            (
              substitution,
            ) => {
              const sourceIngredientLineNumber =
                ingredientIdToLine.get(
                  String(
                    substitution.sourceRecipeIngredientId,
                  ),
                )

              if (
                !sourceIngredientLineNumber
              ) {
                return null
              }

              return {
                sourceIngredientLineNumber,

                substituteCanonicalIngredientId:
                  substitution.substituteCanonicalIngredientId,

                replacementRatio:
                  Number(
                    substitution.replacementRatio,
                  ),

                replacementUnit:
                  substitution.replacementUnit ||
                  null,

                priority:
                  Number(
                    substitution.priority ||
                    1,
                  ),

                notes:
                  substitution.notes ||
                  '',
              }
            },
          )
          .filter(
            Boolean,
          ),
    }
  }

  async function runAction(
    action,
    successMessage,
  ) {
    setBusy(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    try {
      const result =
        await action()

      setSuccess(
        successMessage,
      )

      if (
        result?.recipeVersion
          ?.id &&
        result.recipeVersion.id !==
          versionId
      ) {
        navigate(
          `/admin/recipes/${result.recipeVersion.id}`,
        )

        return
      }

      await load()
    } catch (actionError) {
      setError(
        actionError?.message ||
        'Recipe governance action failed.',
      )
    } finally {
      setBusy(
        false,
      )
    }
  }

  async function handleRecipeHeroImageUpload(
    file,
  ) {
    if (
      !file ||
      !dish?.id ||
      !canMutate ||
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

    setSuccess(
      '',
    )

    try {
      const uploaded =
        await uploadRecipeImage({
          file,
          scope:
            'admin',
        })

      await updateAdminRecipeHeroImage(
        dish.id,
        uploaded.heroImageUrl,
      )

      setSuccess(
        'Recipe image uploaded and attached successfully.',
      )

      await load()
    } catch (uploadError) {
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          'Unable to upload Recipe image.',
      )
    } finally {
      setImageUploading(
        false,
      )
    }
  }

  async function handleRemoveRecipeHeroImage() {
    if (
      !dish?.id ||
      !canMutate ||
      imageUploading ||
      !dish.heroImageUrl
    ) {
      return
    }

    const confirmed =
      window.confirm(
        'Remove the current Recipe image?',
      )

    if (!confirmed) {
      return
    }

    setImageUploading(
      true,
    )

    setError(
      '',
    )

    setSuccess(
      '',
    )

    try {
      await updateAdminRecipeHeroImage(
        dish.id,
        '',
      )

      setSuccess(
        'Recipe image removed.',
      )

      await load()
    } catch (removeError) {
      setError(
        removeError?.response?.data?.message ||
          removeError?.message ||
          'Unable to remove Recipe image.',
      )
    } finally {
      setImageUploading(
        false,
      )
    }
  }

  async function handleSave() {
    await runAction(
      () =>
        updateAdminRecipeDraft(
          versionId,
          buildPayload(),
        ),

      'Recipe draft saved.',
    )
  }

  async function handleSubmitReview() {
    if (
      !requireReason()
    ) {
      return
    }

    await runAction(
      () =>
        submitAdminRecipeForReview(
          versionId,
          governanceReason.trim(),
        ),

      'Recipe submitted for review.',
    )
  }

  async function handleReview() {
    if (
      !requireReason()
    ) {
      return
    }

    await runAction(
      () =>
        reviewAdminRecipeVersion(
          versionId,
          {
            reviewType,

            decision:
              reviewDecision,

            reason:
              governanceReason.trim(),
          },
        ),

      'Recipe review recorded.',
    )
  }

  async function handleSaveFoodIntelligence() {
    const nutrition =
      FOOD_NUTRIENT_FIELDS
        .map(
          (
            field,
          ) => {
            const raw =
              foodIntelligence
                .nutrition[
                field.key
              ]

            if (
              raw ===
                '' ||
              raw ===
                null ||
              raw ===
                undefined
            ) {
              return null
            }

            const amount =
              Number(
                raw,
              )

            if (
              !Number.isFinite(
                amount,
              ) ||
              amount <
                0
            ) {
              return {
                invalid:
                  true,

                label:
                  field.label,
              }
            }

            return {
              key:
                field.key,

              amount,

              unit:
                field.unit,
            }
          },
        )

    const invalidNutrition =
      nutrition.find(
        (
          item,
        ) =>
          item?.invalid ===
          true,
      )

    if (invalidNutrition) {
      setError(
        `${invalidNutrition.label} must be zero or a positive number.`,
      )

      return
    }

    const normalizedNutrition =
      nutrition.filter(
        Boolean,
      )

    const allergens =
      FOOD_ALLERGEN_FIELDS
        .map(
          (
            field,
          ) => {
            const relationship =
              foodIntelligence
                .allergens[
                field.key
              ]

            if (!relationship) {
              return null
            }

            return {
              key:
                field.key,

              canonicalName:
                field.label,

              relationship,
            }
          },
        )
        .filter(
          Boolean,
        )

    if (
      normalizedNutrition.length ===
        0 &&
      allergens.length ===
        0 &&
      foodIntelligence
        .dietaryClassification ===
        'not_declared'
    ) {
      setError(
        'Enter nutrition, an allergen relationship, or a dietary classification before saving Food Intelligence.',
      )

      return
    }

    if (
      !foodIntelligence
        .reason
        .trim()
    ) {
      setError(
        'Enter a Food Intelligence governance reason.',
      )

      return
    }

    await runAction(
      () =>
        declareRecipeFoodIntelligence({
          recipeVersionId:
            versionId,

          nutrition:
            normalizedNutrition,

          allergens,

          dietaryClassification:
            foodIntelligence
              .dietaryClassification,

          basis:
            foodIntelligence
              .basis
              .trim(),

          reason:
            foodIntelligence
              .reason
              .trim(),
        }),

      'Recipe Food Intelligence saved and approved.',
    )
  }

  async function handlePublish() {
    if (
      !requireReason()
    ) {
      return
    }

    await runAction(
      () =>
        publishAdminRecipeVersion(
          versionId,
          {
            reason:
              governanceReason.trim(),
          },
        ),

      'Recipe published.',
    )
  }

  async function handleNextVersion() {
    if (
      !requireReason()
    ) {
      return
    }

    await runAction(
      () =>
        createNextAdminRecipeVersion(
          dish.id,
          {
            sourceRecipeVersionId:
              versionId,

            changeReason:
              governanceReason.trim(),
          },
        ),

      'Next Recipe Version created.',
    )
  }

  async function handleVersionLifecycle(
    action,
  ) {
    if (
      !requireReason()
    ) {
      return
    }

    await runAction(
      () =>
        changeAdminRecipeVersionLifecycle(
          versionId,
          {
            action,

            reason:
              governanceReason.trim(),
          },
        ),

      `Recipe Version ${action} completed.`,
    )
  }

  async function handleDishLifecycle(
    action,
  ) {
    if (
      !requireReason()
    ) {
      return
    }

    await runAction(
      () =>
        changeAdminDishLifecycle(
          dish.id,
          {
            action,

            reason:
              governanceReason.trim(),
          },
        ),

      `Dish ${action} completed.`,
    )
  }

  if (loading) {
    return (
      <AdminShell
        title="Recipe Editor"
        description="Loading Recipe Version."
      >
        <div className="grid min-h-80 place-items-center rounded-[26px] border border-stone-200 bg-white">
          <LoaderCircle
            size={30}
            className="animate-spin text-emerald-700"
            aria-label="Loading Recipe Version"
          />
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={
        dish.name ||
        'Recipe Editor'
      }
      description="Edit draft formulation, review governed versions and publish approved Recipe truth."
      actions={
        <button
          type="button"
          onClick={
            () =>
              navigate(
                '/admin/recipes',
              )
          }
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700"
        >
          <ArrowLeft
            size={16}
            aria-hidden="true"
          />

          Recipes
        </button>
      }
    >

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {
            error
          }
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {
            success
          }
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">

        <div className="space-y-5">

          <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div>

                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Version {
                    recipe.versionNumber
                  }
                </p>

                <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">
                  {
                    recipe.title
                  }
                </h2>

              </div>

              <span
                className={[
                  'rounded-full',
                  'px-3',
                  'py-1',
                  'text-[10px]',
                  'font-black',
                  'uppercase',
                  'tracking-[0.12em]',
                  statusClass(
                    recipe.status,
                  ),
                ].join(
                  ' ',
                )}
              >
                {
                  recipe.status
                }
              </span>

            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="grid gap-3 sm:grid-cols-2 lg:w-[620px] lg:shrink-0">
                  {dish.heroImageUrl ? (
                    <img
                      src={dish.heroImageUrl}
                      alt={`${dish.name || recipe.title || 'Recipe'} preview`}
                      className="h-64 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="grid h-64 w-full place-items-center rounded-2xl border border-stone-200 bg-white text-xs font-bold text-stone-400">
                      No Recipe image
                    </div>
                  )}

                  <AdminRecipeDetailsSheet
                    dish={dish}
                    recipe={recipe}
                    ingredients={
                      data?.ingredients ||
                      []
                    }
                    foodIntelligence={
                      foodIntelligence
                    }
                  />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-black text-stone-950">
                    Recipe image
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Upload or replace the Dish hero image without rewriting immutable Recipe Version history. This works for existing published Recipes too. JPEG, PNG, and WebP up to 8 MB are supported.
                  </p>

                  {canMutate && dish.status !== 'retired' ? (
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
                        {dish.heroImageUrl ? 'Replace image' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={busy || imageUploading}
                          onChange={(event) => {
                            const file =
                              event.target.files?.[0]

                            event.target.value =
                              ''

                            if (file) {
                              handleRecipeHeroImageUpload(
                                file,
                              )
                            }
                          }}
                        />
                      </label>

                      {dish.heroImageUrl ? (
                        <button
                          type="button"
                          disabled={busy || imageUploading}
                          onClick={handleRemoveRecipeHeroImage}
                          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                        >
                          <Trash2
                            size={14}
                            aria-hidden="true"
                          />
                          Remove image
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {draft && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">

                <label className="text-xs font-black text-stone-700 md:col-span-2">
                  Recipe title

                  <input
                    value={
                      draft.title
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        title:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                <label className="text-xs font-black text-stone-700 md:col-span-2">
                  Description

                  <textarea
                    value={
                      draft.recipeDescription
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        recipeDescription:
                          event.target.value,
                      })
                    }
                    rows={4}
                    className="focus-ring mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                <label className="text-xs font-black text-stone-700">
                  Base servings

                  <input
                    type="number"
                    min="1"
                    value={
                      draft.baseServings
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        baseServings:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                <label className="text-xs font-black text-stone-700">
                  Scaling method

                  <select
                    value={
                      draft.scalingMethod
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        scalingMethod:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-50"
                  >
                    <option value="linear">
                      Linear
                    </option>

                    <option value="mixed">
                      Mixed / exceptions
                    </option>
                  </select>

                </label>

                <label className="text-xs font-black text-stone-700">
                  Preparation minutes

                  <input
                    type="number"
                    min="0"
                    value={
                      draft.preparationTimeMinutes
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        preparationTimeMinutes:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                <label className="text-xs font-black text-stone-700">
                  Cooking minutes

                  <input
                    type="number"
                    min="0"
                    value={
                      draft.cookingTimeMinutes
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        cookingTimeMinutes:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                <label className="text-xs font-black text-stone-700">
                  Difficulty

                  <select
                    value={
                      draft.difficulty
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        difficulty:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-50"
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
                  Minimum recommended servings

                  <input
                    type="number"
                    min="1"
                    value={
                      draft.minRecommendedServings
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        minRecommendedServings:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                <label className="text-xs font-black text-stone-700">
                  Maximum recommended servings

                  <input
                    type="number"
                    min="1"
                    value={
                      draft.maxRecommendedServings
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        maxRecommendedServings:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

              </div>
            )}

          </section>

          {draft && (
            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

              <div className="flex items-center justify-between gap-3">

                <div>

                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Canonical requirements
                  </p>

                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    Ingredient rows
                  </h2>

                </div>

                {editable && (
                  <button
                    type="button"
                    onClick={
                      () =>
                        setDraft({
                          ...draft,

                          ingredients: [
                            ...draft.ingredients,

                            {
                              canonicalIngredientId:
                                '',

                              quantity:
                                1,

                              unit:
                                'g',

                              preparationState:
                                '',

                              optional:
                                false,

                              role:
                                'main',

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
                            },
                          ],
                        })
                    }
                    className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                  >
                    <Plus
                      size={14}
                      aria-hidden="true"
                    />

                    Ingredient
                  </button>
                )}

              </div>

              <div className="mt-4 space-y-3">

                {draft.ingredients.map(
                  (
                    ingredient,
                    index,
                  ) => (
                    <div
                      key={
                        ingredient.id ||
                        index
                      }
                      className="grid gap-2 rounded-2xl bg-stone-50 p-3 lg:grid-cols-[minmax(220px,1fr)_100px_90px_120px_1fr_42px]"
                    >

                      {!editable &&
                      ingredient.canonicalIngredient ? (
                        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2">
                          <p className="text-sm font-black text-stone-950">
                            {
                              ingredient
                                .canonicalIngredient
                                .canonicalName
                            }
                          </p>

                          {ingredient
                            .canonicalIngredient
                            .attributes
                            ?.hostRecipeProposal
                            ?.state ===
                            'pending' ||
                          ingredient
                            .canonicalIngredient
                            .status ===
                            'disabled' ? (
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
                              Host proposed · Editorial approval verifies this ingredient
                            </p>
                          ) : (
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
                              Canonical ingredient verified
                            </p>
                          )}
                        </div>
                      ) : (
                        <input
                          value={
                            ingredient.canonicalIngredientId
                          }
                          disabled={
                            !editable
                          }
                          onChange={(
                            event,
                          ) =>
                            updateIngredient(
                              index,
                              'canonicalIngredientId',
                              event.target.value,
                            )
                          }
                          className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 font-mono text-xs outline-none disabled:bg-stone-100"
                          placeholder="Canonical Ingredient ObjectId"
                        />
                      )}

                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        value={
                          ingredient.quantity
                        }
                        disabled={
                          !editable
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
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-100"
                      />

                      <select
                        value={
                          ingredient.unit
                        }
                        disabled={
                          !editable
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
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-2 text-sm outline-none disabled:bg-stone-100"
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
                          ingredient.role
                        }
                        disabled={
                          !editable
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
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-2 text-sm outline-none disabled:bg-stone-100"
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
                          ingredient.preparationState
                        }
                        disabled={
                          !editable
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
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-100"
                      />

                      <button
                        type="button"
                        disabled={
                          !editable ||
                          draft.ingredients
                            .length <=
                            1
                        }
                        onClick={
                          () =>
                            setDraft({
                              ...draft,

                              ingredients:
                                draft.ingredients.filter(
                                  (
                                    _,
                                    rowIndex,
                                  ) =>
                                    rowIndex !==
                                    index,
                                ),
                            })
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

            </section>
          )}

          {draft && (
            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

              <div className="flex items-center justify-between gap-3">

                <div>

                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Ordered method
                  </p>

                  <h2 className="mt-1 text-xl font-black text-stone-950">
                    Recipe steps
                  </h2>

                </div>

                {editable && (
                  <button
                    type="button"
                    onClick={
                      () =>
                        setDraft({
                          ...draft,

                          steps: [
                            ...draft.steps,

                            {
                              instruction:
                                '',

                              timerSeconds:
                                '',

                              temperatureValue:
                                '',

                              temperatureUnit:
                                '',

                              equipment:
                                [],

                              parallelizable:
                                false,

                              prepAhead:
                                false,
                            },
                          ],
                        })
                    }
                    className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                  >
                    <Plus
                      size={14}
                      aria-hidden="true"
                    />

                    Step
                  </button>
                )}

              </div>

              <div className="mt-4 space-y-3">

                {draft.steps.map(
                  (
                    step,
                    index,
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[42px_minmax(0,1fr)_110px_42px]"
                    >

                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-stone-950 text-xs font-black text-white">
                        {
                          index +
                          1
                        }
                      </div>

                      <input
                        value={
                          step.instruction
                        }
                        disabled={
                          !editable
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
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-100"
                      />

                      <input
                        type="number"
                        min="0"
                        value={
                          step.timerSeconds
                        }
                        disabled={
                          !editable
                        }
                        onChange={(
                          event,
                        ) =>
                          updateStep(
                            index,
                            'timerSeconds',
                            event.target.value,
                          )
                        }
                        placeholder="Timer sec"
                        className="focus-ring h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-100"
                      />

                      <button
                        type="button"
                        disabled={
                          !editable ||
                          draft.steps
                            .length <=
                            1
                        }
                        onClick={
                          () =>
                            setDraft({
                              ...draft,

                              steps:
                                draft.steps.filter(
                                  (
                                    _,
                                    rowIndex,
                                  ) =>
                                    rowIndex !==
                                    index,
                                ),
                            })
                        }
                        className="focus-ring grid h-10 w-10 place-items-center rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-30"
                        aria-label="Remove method step"
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

            </section>
          )}

          {draft &&
            [
              'in_review',
              'published',
            ].includes(
              recipe.status,
            ) &&
            (canMutate ||
              canPublish) && (
              <section className="rounded-[26px] border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm sm:p-6">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                      Recipe Food Intelligence
                    </p>

                    <h2 className="mt-1 text-xl font-black text-stone-950">
                      Nutrition, allergens & dietary
                    </h2>

                    <p className="mt-2 max-w-3xl text-xs leading-5 text-stone-600">
                      Host-declared values are loaded here when available. Super Admin must review and correct them before approval. AI is not authoritative for nutrition, allergen or dietary truth. Saving creates an approved, append-only Food Intelligence snapshot for this exact Recipe Version. Calculation source and lineage are generated by the system automatically.
                    </p>

                  </div>

                  <span
                    className={`inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${foodIntelligenceStatusView.className}`}
                  >
                    {foodIntelligenceStatusView.label}
                  </span>

                </div>

                {foodIntelligenceStatus?.latest?.status ===
                  'requires_review' ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                    A Host Food Intelligence declaration is waiting for review. Verify the values against the Recipe formulation, correct anything necessary, then use <strong>Save & approve Recipe Food Intelligence</strong>. The Host declaration itself never becomes public safety truth without Super Admin approval.
                  </div>
                ) : null}

                {!foodIntelligenceStatus?.latest ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800">
                    No approved Food Intelligence exists for this Recipe Version. A published legacy Recipe will continue to show <strong>Cannot verify</strong> publicly until this section is completed and saved.
                  </div>
                ) : null}

                {foodIntelligenceStatus?.latest?.isStale ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800">
                    The latest Food Intelligence was created before the most recent Recipe submission. It is stale and cannot authorize publication. Review the current formulation and save a fresh snapshot.
                  </div>
                ) : null}

                <div className="mt-5">

                  <p className="text-xs font-black text-stone-800">
                    Nutrition per serving
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                    {FOOD_NUTRIENT_FIELDS.map(
                      (
                        field,
                      ) => (
                        <label
                          key={
                            field.key
                          }
                          className="rounded-2xl border border-stone-200 bg-white p-3 text-xs font-black text-stone-700"
                        >
                          {field.label}

                          <div className="mt-2 flex items-center gap-2">

                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={
                                foodIntelligence
                                  .nutrition[
                                  field.key
                                ]
                              }
                              onChange={(
                                event,
                              ) =>
                                setFoodIntelligence({
                                  ...foodIntelligence,

                                  nutrition: {
                                    ...foodIntelligence.nutrition,

                                    [field.key]:
                                      event.target.value,
                                  },
                                })
                              }
                              placeholder="0"
                              className="focus-ring h-10 min-w-0 flex-1 rounded-xl border border-stone-200 px-3 text-sm outline-none"
                            />

                            <span className="text-[11px] font-black text-stone-500">
                              {field.unit}
                            </span>

                          </div>

                        </label>
                      ),
                    )}

                  </div>

                </div>

                <div className="mt-6">

                  <p className="text-xs font-black text-stone-800">
                    Positive allergen relationships
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-stone-500">
                    Blank means no positive relationship is being asserted. It never means allergen-free.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                    {FOOD_ALLERGEN_FIELDS.map(
                      (
                        field,
                      ) => (
                        <label
                          key={
                            field.key
                          }
                          className="rounded-2xl border border-stone-200 bg-white p-3 text-xs font-black text-stone-700"
                        >
                          {field.label}

                          <select
                            value={
                              foodIntelligence
                                .allergens[
                                field.key
                              ]
                            }
                            onChange={(
                              event,
                            ) =>
                              setFoodIntelligence({
                                ...foodIntelligence,

                                allergens: {
                                  ...foodIntelligence.allergens,

                                  [field.key]:
                                    event.target.value,
                                },
                              })
                            }
                            className="focus-ring mt-2 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold outline-none"
                          >
                            <option value="">
                              Not declared
                            </option>

                            <option value="contains">
                              Contains
                            </option>

                            <option value="may_contain">
                              May contain
                            </option>

                            <option value="cross_contact">
                              Cross-contact
                            </option>
                          </select>

                        </label>
                      ),
                    )}

                  </div>

                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">

                  <label className="text-xs font-black text-stone-700">
                    Dietary classification

                    <select
                      value={
                        foodIntelligence
                          .dietaryClassification
                      }
                      onChange={(
                        event,
                      ) =>
                        setFoodIntelligence({
                          ...foodIntelligence,

                          dietaryClassification:
                            event.target.value,
                        })
                      }
                      className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none"
                    >
                      <option value="not_declared">
                        Not declared
                      </option>

                      <option value="vegetarian">
                        Vegetarian
                      </option>

                      <option value="vegan">
                        Vegan
                      </option>

                      <option value="eggitarian">
                        Eggitarian
                      </option>

                      <option value="non_vegetarian">
                        Non-vegetarian
                      </option>
                    </select>

                  </label>

                  <label className="text-xs font-black text-stone-700">
                    Calculation basis

                    <input
                      value={
                        foodIntelligence
                          .basis
                      }
                      onChange={(
                        event,
                      ) =>
                        setFoodIntelligence({
                          ...foodIntelligence,

                          basis:
                            event.target.value,
                        })
                      }
                      className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
                    />

                  </label>

                  <label className="text-xs font-black text-stone-700 md:col-span-2">
                    Food Intelligence governance reason

                    <textarea
                      value={
                        foodIntelligence
                          .reason
                      }
                      onChange={(
                        event,
                      ) =>
                        setFoodIntelligence({
                          ...foodIntelligence,

                          reason:
                            event.target.value,
                        })
                      }
                      rows={3}
                      className="focus-ring mt-2 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm outline-none"
                    />

                  </label>

                </div>

                <button
                  type="button"
                  onClick={
                    handleSaveFoodIntelligence
                  }
                  disabled={
                    busy
                  }
                  className="focus-ring mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <BadgeCheck
                    size={16}
                    aria-hidden="true"
                  />

                  {foodIntelligenceStatus?.latest?.status ===
                    'requires_review'
                    ? 'Review Host Declaration & Approve'
                    : 'Save & approve Recipe Food Intelligence'}
                </button>

              </section>
            )}

          {draft && (
            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">

              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Source & safety
              </p>

              <h2 className="mt-1 text-xl font-black text-stone-950">
                Attribution
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">

                <label className="text-xs font-black text-stone-700">
                  Source type

                  <select
                    value={
                      draft.sourceType
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        sourceType:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none disabled:bg-stone-50"
                  >
                    <option value="internal">
                      Internal
                    </option>

                    <option value="brand">
                      Brand
                    </option>

                    <option value="chef">
                      Chef
                    </option>

                    <option value="community">
                      Community
                    </option>

                    <option value="imported">
                      Imported
                    </option>
                  </select>

                </label>

                <label className="text-xs font-black text-stone-700">
                  Source name

                  <input
                    value={
                      draft.sourceName
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        sourceName:
                          event.target.value,
                      })
                    }
                    className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none disabled:bg-stone-50"
                  />

                </label>

                {draft.sourceType ===
                  'brand' && (
                  <>
                    <label className="text-xs font-black text-stone-700">
                      Canonical Brand ID

                      <input
                        value={
                          draft.sourceBrandId
                        }
                        disabled={
                          !editable
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraft({
                            ...draft,

                            sourceBrandId:
                              event.target.value,
                          })
                        }
                        className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 font-mono text-xs outline-none disabled:bg-stone-50"
                      />

                    </label>

                    <label className="text-xs font-black text-stone-700">
                      Source Organization ID

                      <input
                        value={
                          draft.sourceOrganizationId
                        }
                        disabled={
                          !editable
                        }
                        onChange={(
                          event,
                        ) =>
                          setDraft({
                            ...draft,

                            sourceOrganizationId:
                              event.target.value,
                          })
                        }
                        className="focus-ring mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 font-mono text-xs outline-none disabled:bg-stone-50"
                      />

                    </label>
                  </>
                )}

                <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">

                  <input
                    type="checkbox"
                    checked={
                      draft.unsafeIncomplete
                    }
                    disabled={
                      !editable
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft({
                        ...draft,

                        unsafeIncomplete:
                          event.target.checked,
                      })
                    }
                    className="mt-1"
                  />

                  <span>

                    <span className="block text-sm font-black text-amber-950">
                      Mark unsafe / incomplete
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-amber-800">
                      This blocks publication until corrected.
                    </span>

                  </span>

                </label>

                {draft.unsafeIncomplete && (
                  <label className="text-xs font-black text-stone-700 md:col-span-2">
                    Unsafe / incomplete reason

                    <textarea
                      value={
                        draft.unsafeIncompleteReason
                      }
                      disabled={
                        !editable
                      }
                      onChange={(
                        event,
                      ) =>
                        setDraft({
                          ...draft,

                          unsafeIncompleteReason:
                            event.target.value,
                        })
                      }
                      rows={3}
                      className="focus-ring mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none disabled:bg-stone-50"
                    />

                  </label>
                )}

              </div>

            </section>
          )}

          {editable && (
            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                busy
              }
              className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save
                size={17}
                aria-hidden="true"
              />

              Save draft
            </button>
          )}

        </div>

        <aside className="space-y-5">

          <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-2">

              <ShieldAlert
                size={18}
                className="text-emerald-700"
                aria-hidden="true"
              />

              <h2 className="font-black text-stone-950">
                Governance
              </h2>

            </div>

            <p className="mt-2 text-xs leading-5 text-stone-500">
              Every privileged transition requires an explicit reason and is
              audited.
            </p>

            <textarea
              value={
                governanceReason
              }
              onChange={(
                event,
              ) =>
                setGovernanceReason(
                  event.target.value,
                )
              }
              rows={4}
              placeholder="Governance reason..."
              className="focus-ring mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm outline-none"
            />

            {recipe.status ===
              'in_review' &&
              pendingHostIngredientCount >
                0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-800">
                  {pendingHostIngredientCount}{' '}
                  Host-proposed ingredient{pendingHostIngredientCount === 1 ? '' : 's'} awaiting verification. Review the names above, then record an Editorial approval to promote them into the canonical Ingredient Dictionary.
                </div>
              )}

            {recipe.status ===
              'draft' &&
              canMutate && (
                <button
                  type="button"
                  onClick={
                    handleSubmitReview
                  }
                  disabled={
                    busy
                  }
                  className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  <Send
                    size={16}
                    aria-hidden="true"
                  />

                  Submit for review
                </button>
              )}

            {recipe.status ===
              'in_review' &&
              canMutate && (
                <div className="mt-4 space-y-3">

                  <select
                    value={
                      reviewType
                    }
                    onChange={(
                      event,
                    ) =>
                      setReviewType(
                        event.target.value,
                      )
                    }
                    className="focus-ring h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none"
                  >
                    <option value="editorial">
                      Editorial review
                    </option>

                    <option value="qa">
                      QA review
                    </option>

                    <option value="safety">
                      Safety review
                    </option>
                  </select>

                  <select
                    value={
                      reviewDecision
                    }
                    onChange={(
                      event,
                    ) =>
                      setReviewDecision(
                        event.target.value,
                      )
                    }
                    className="focus-ring h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none"
                  >
                    <option value="approved">
                      Approve
                    </option>

                    <option value="changes_requested">
                      Request changes
                    </option>

                    <option value="rejected">
                      Reject
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={
                      handleReview
                    }
                    disabled={
                      busy
                    }
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm font-black text-stone-800 hover:bg-stone-50 disabled:opacity-60"
                  >
                    <FileCheck2
                      size={16}
                      aria-hidden="true"
                    />

                    Record review
                  </button>

                </div>
              )}

            {recipe.status ===
              'in_review' &&
              canPublish && (
                <button
                  type="button"
                  onClick={
                    handlePublish
                  }
                  disabled={
                    busy ||
                    pendingHostIngredientCount >
                      0
                  }
                  className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <BadgeCheck
                    size={16}
                    aria-hidden="true"
                  />

                  Publish Recipe
                </button>
              )}

            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
              Publication still passes backend readiness, Recipe publish permission,
              recent MFA and immutable audit checks. EPANTRY has one root Super Admin,
              so that same Super Admin may submit, review and publish a Recipe.
              Host-originated Recipes remain Host-submitted and Super-Admin-published.
              Any Host-proposed ingredient is promoted to canonical truth only when the
              Super Admin records Editorial approval.
            </div>

          </section>

          {canMutate &&
            recipe.status !==
              'draft' && (
              <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">

                <h2 className="font-black text-stone-950">
                  Version correction
                </h2>

                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Published history is never edited in place.
                </p>

                <button
                  type="button"
                  onClick={
                    handleNextVersion
                  }
                  disabled={
                    busy
                  }
                  className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 disabled:opacity-60"
                >
                  <CirclePlus
                    size={16}
                    aria-hidden="true"
                  />

                  Create next version
                </button>

              </section>
            )}

          {canMutate && (
            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">

              <h2 className="font-black text-stone-950">
                Recovery controls
              </h2>

              <p className="mt-2 text-xs leading-5 text-stone-500">
                Unsafe or broken recipes can be removed from public eligibility
                without deleting historical records.
              </p>

              <div className="mt-4 space-y-2">

                {![
                  'disabled',
                  'retired',
                ].includes(
                  recipe.status,
                ) && (
                  <button
                    type="button"
                    onClick={
                      () =>
                        handleVersionLifecycle(
                          'disable',
                        )
                    }
                    disabled={
                      busy
                    }
                    className="focus-ring w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-800 disabled:opacity-60"
                  >
                    Disable Version
                  </button>
                )}

                {recipe.status ===
                  'published' && (
                  <button
                    type="button"
                    onClick={
                      () =>
                        handleVersionLifecycle(
                          'retire',
                        )
                    }
                    disabled={
                      busy
                    }
                    className="focus-ring w-full rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-black text-stone-700 disabled:opacity-60"
                  >
                    Retire Version
                  </button>
                )}

                {dish.status ===
                  'active' && (
                  <button
                    type="button"
                    onClick={
                      () =>
                        handleDishLifecycle(
                          'disable',
                        )
                    }
                    disabled={
                      busy
                    }
                    className="focus-ring w-full rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-black text-stone-700 disabled:opacity-60"
                  >
                    Disable Dish
                  </button>
                )}

                {dish.status ===
                  'disabled' && (
                  <button
                    type="button"
                    onClick={
                      () =>
                        handleDishLifecycle(
                          'restore',
                        )
                    }
                    disabled={
                      busy
                    }
                    className="focus-ring w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-800 disabled:opacity-60"
                  >
                    Restore Dish
                  </button>
                )}

              </div>

            </section>
          )}

          <button
            type="button"
            onClick={
              load
            }
            disabled={
              busy
            }
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-black text-stone-700 disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RefreshCw
                size={15}
                aria-hidden="true"
              />
            )}

            Refresh
          </button>

        </aside>

      </div>

    </AdminShell>
  )
}