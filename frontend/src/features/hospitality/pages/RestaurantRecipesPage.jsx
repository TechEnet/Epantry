import {
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Send,
  UtensilsCrossed,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  searchCommunityIngredients,
} from '../../community/services/community.service'

import {
  uploadRecipeImage,
} from '../../recipes/services/recipe.service'

import {
  createHospitalityRestaurantRecipe,
  getHospitalityErrorMessage,
  getHospitalityRestaurantRecipe,
  listHospitalityOutlets,
  listHospitalityRestaurantRecipes,
  listHospitalitySupplierProducts,
  updateHospitalityRestaurantRecipe,
} from '../services/hospitality.service'

const inputClass =
  'focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none'

const units = [
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'tsp',
  'tbsp',
  'cup',
]

const roles = [
  'main',
  'seasoning',
  'garnish',
  'fat',
  'liquid',
  'other',
]

const nutrients = [
  ['energyKcal', 'Energy', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbohydrateG', 'Carbohydrate', 'g'],
  ['fatG', 'Fat', 'g'],
  ['fiberG', 'Fiber', 'g'],
  ['sugarG', 'Sugar', 'g'],
  ['sodiumMg', 'Sodium', 'mg'],
]

const allergens = [
  ['milk', 'Milk'],
  ['egg', 'Egg'],
  ['peanut', 'Peanut'],
  ['tree_nut', 'Tree nuts'],
  ['soy', 'Soy'],
  ['wheat', 'Wheat'],
  ['sesame', 'Sesame'],
]

function rowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function blankIngredient() {
  return {
    rowId: rowId(),
    ingredientQuery: '',
    canonicalIngredientId: '',
    ingredientName: '',
    quantity: 1,
    unit: 'g',
    role: 'main',
    preparationState: '',
    expectedWastePercentage: 0,
    preferredSupplierProductId: '',
    operationalNote: '',
  }
}

function blankStep() {
  return {
    rowId: rowId(),
    instruction: '',
    timerMinutes: '',
  }
}

function blankFood() {
  return {
    nutrition: Object.fromEntries(
      nutrients.map(([key]) => [key, '']),
    ),
    allergens: Object.fromEntries(
      allergens.map(([key]) => [key, '']),
    ),
    dietaryClassification: 'not_declared',
    basis: 'Per serving. Restaurant declaration from the submitted Recipe.',
    reason: 'Restaurant-provided Recipe information for Super Admin review.',
  }
}

function blankForm() {
  return {
    outletId: '',
    customerVisibility: 'public_candidate',
    title: '',
    description: '',
    cuisine: '',
    course: '',
    heroImageUrl: '',
    baseServings: 4,
    preparationTimeMinutes: 10,
    cookingTimeMinutes: 20,
    difficulty: 'easy',
    kitchenNote: '',
    ingredients: [blankIngredient()],
    steps: [blankStep()],
    foodIntelligence: blankFood(),
  }
}

function foodPayload(form) {
  const nutrition = nutrients
    .map(([key, _label, unit]) => {
      const raw = form.foodIntelligence.nutrition[key]
      if (raw === '' || raw === null || raw === undefined) return null
      const amount = Number(raw)
      if (!Number.isFinite(amount) || amount < 0) return null
      return {
        key,
        amount,
        unit,
      }
    })
    .filter(Boolean)

  const allergenRows = allergens
    .map(([key, canonicalName]) => {
      const relationship = form.foodIntelligence.allergens[key]
      return relationship
        ? {
            key,
            canonicalName,
            relationship,
          }
        : null
    })
    .filter(Boolean)

  const dietaryClassification =
    form.foodIntelligence.dietaryClassification || 'not_declared'

  if (
    !nutrition.length &&
    !allergenRows.length &&
    dietaryClassification === 'not_declared'
  ) {
    return null
  }

  return {
    jurisdictionCode: 'IN',
    nutrition,
    allergens: allergenRows,
    dietaryClassification,
    basis: form.foodIntelligence.basis.trim(),
    reason: form.foodIntelligence.reason.trim(),
  }
}

function payload(form) {
  const declaration = foodPayload(form)

  return {
    outletId: form.outletId,
    customerVisibility: form.customerVisibility,
    kitchenNote: form.kitchenNote.trim(),
    operationalIngredients: form.ingredients.map((ingredient) => ({
      canonicalIngredientId: ingredient.canonicalIngredientId,
      expectedWastePercentage: Number(
        ingredient.expectedWastePercentage || 0,
      ),
      preferredSupplierProductId:
        ingredient.preferredSupplierProductId || null,
      note: ingredient.operationalNote.trim(),
    })),
    recipe: {
      name: form.title.trim(),
      description: form.description.trim(),
      cuisine: form.cuisine.trim(),
      course: form.course.trim(),
      tags: ['restaurant-recipe'],
      language: 'en',
      heroImageUrl: form.heroImageUrl.trim(),
      title: form.title.trim(),
      recipeDescription: form.description.trim(),
      baseServings: Number(form.baseServings),
      servingSizeAmount: null,
      servingSizeUnit: null,
      finishedYieldAmount: null,
      finishedYieldUnit: null,
      scalingMethod: 'linear',
      minRecommendedServings: null,
      maxRecommendedServings: null,
      preparationTimeMinutes: Number(form.preparationTimeMinutes || 0),
      cookingTimeMinutes: Number(form.cookingTimeMinutes || 0),
      difficulty: form.difficulty,
      unsafeIncomplete: false,
      unsafeIncompleteReason: '',
      ingredients: form.ingredients.map((ingredient, index) => ({
        lineNumber: index + 1,
        canonicalIngredientId: ingredient.canonicalIngredientId,
        proposedIngredientName: '',
        quantity: Number(ingredient.quantity),
        unit: ingredient.unit,
        preparationState: ingredient.preparationState.trim(),
        optional: false,
        role: ingredient.role,
        notes: '',
        substitutionGroupKey: '',
        productConstraints: [],
        scalingRule: {
          type: 'linear',
          exponent: 1,
          minMultiplier: null,
          maxMultiplier: null,
        },
      })),
      steps: form.steps.map((step, index) => ({
        stepNumber: index + 1,
        instruction: step.instruction.trim(),
        timerSeconds:
          step.timerMinutes === ''
            ? null
            : Math.round(Number(step.timerMinutes) * 60),
        temperatureValue: null,
        temperatureUnit: null,
        equipment: [],
        parallelizable: false,
        prepAhead: false,
      })),
      substitutions: [],
      ...(declaration
        ? {
            foodIntelligence: declaration,
          }
        : {}),
    },
  }
}

function Field({ label, children }) {
  return (
    <label className="block text-xs font-black text-stone-700">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}

function IngredientRow({
  value,
  onChange,
  onRemove,
  canRemove,
  supplierProducts,
}) {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const query = value.ingredientQuery.trim()

    if (
      value.canonicalIngredientId &&
      query === value.ingredientName
    ) {
      setResults([])
      return undefined
    }

    if (query.length < 2) {
      setResults([])
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await searchCommunityIngredients({
          search: query,
          limit: 8,
        })
        if (!cancelled) {
          setResults(response?.ingredients || [])
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    value.ingredientQuery,
    value.canonicalIngredientId,
    value.ingredientName,
  ])

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
      <div className="grid gap-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <input
            className={inputClass}
            value={value.ingredientQuery}
            onChange={(event) =>
              onChange({
                ingredientQuery: event.target.value,
                canonicalIngredientId: '',
                ingredientName: '',
              })
            }
            placeholder="Search EPANTRY ingredient"
          />

          {searching ? (
            <div className="absolute z-30 mt-1 w-full rounded-xl border border-stone-200 bg-white p-3 text-xs font-bold text-stone-500 shadow-xl">
              Searching ingredients…
            </div>
          ) : results.length ? (
            <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-xl">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    onChange({
                      canonicalIngredientId: result.id,
                      ingredientName: result.canonicalName,
                      ingredientQuery: result.canonicalName,
                    })
                    setResults([])
                  }}
                  className="block w-full px-3 py-2 text-left text-xs font-black hover:bg-emerald-50"
                >
                  {result.canonicalName}
                </button>
              ))}
            </div>
          ) : null}

          {value.canonicalIngredientId ? (
            <p className="mt-1 text-[10px] font-black text-emerald-700">
              EPANTRY ingredient selected
            </p>
          ) : null}
        </div>

        <input
          type="number"
          min="0.001"
          step="any"
          className={inputClass}
          value={value.quantity}
          onChange={(event) =>
            onChange({
              quantity: Number(event.target.value),
            })
          }
          placeholder="Qty"
        />

        <select
          className={inputClass}
          value={value.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        >
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={value.role}
          onChange={(event) => onChange({ role: event.target.value })}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        <input
          className={inputClass}
          value={value.preparationState}
          onChange={(event) =>
            onChange({ preparationState: event.target.value })
          }
          placeholder="Preparation note"
        />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_44px]">
        <input
          type="number"
          min="0"
          max="95"
          step="0.1"
          className={inputClass}
          value={value.expectedWastePercentage}
          onChange={(event) =>
            onChange({
              expectedWastePercentage: Number(event.target.value),
            })
          }
          placeholder="Waste %"
        />

        <select
          className={inputClass}
          value={value.preferredSupplierProductId}
          onChange={(event) =>
            onChange({
              preferredSupplierProductId: event.target.value,
            })
          }
        >
          <option value="">No preferred supplier item</option>
          {supplierProducts
            .filter(
              (item) =>
                !value.canonicalIngredientId ||
                item.canonicalIngredientId === value.canonicalIngredientId,
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.localDescription || item.supplierSku} — {item.packQuantity}{' '}
                {item.packUnit}
              </option>
            ))}
        </select>

        <input
          className={inputClass}
          value={value.operationalNote}
          onChange={(event) =>
            onChange({ operationalNote: event.target.value })
          }
          placeholder="Kitchen / purchasing note"
        />

        <button
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
          className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-40"
          aria-label="Remove ingredient"
        >
          <X size={16} className="mx-auto" />
        </button>
      </div>
    </div>
  )
}

export default function RestaurantRecipesPage() {
  const [form, setForm] = useState(blankForm)
  const [recipes, setRecipes] = useState([])
  const [outlets, setOutlets] = useState([])
  const [supplierProducts, setSupplierProducts] = useState([])
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [recipeResult, outletResult, supplierResult] = await Promise.all([
        listHospitalityRestaurantRecipes(),
        listHospitalityOutlets(),
        listHospitalitySupplierProducts(),
      ])

      const nextOutlets = outletResult?.outlets || []
      setRecipes(recipeResult?.restaurantRecipes || [])
      setOutlets(nextOutlets)
      setSupplierProducts(supplierResult?.supplierProducts || [])
      setForm((current) => ({
        ...current,
        outletId: current.outletId || nextOutlets[0]?.id || '',
      }))
    } catch (loadError) {
      setError(getHospitalityErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.outletId &&
          form.title.trim() &&
          Number(form.baseServings) > 0 &&
          form.ingredients.length &&
          form.ingredients.every(
            (item) =>
              item.canonicalIngredientId &&
              Number(item.quantity) > 0,
          ) &&
          form.steps.length &&
          form.steps.every((step) => step.instruction.trim()),
      ),
    [form],
  )

  function updateIngredient(index, patch) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    }))
  }

  async function handleImage(file) {
    if (!file) return
    setImageUploading(true)
    setError('')
    try {
      const uploaded = await uploadRecipeImage({
        file,
        scope: 'host',
      })
      setForm((current) => ({
        ...current,
        heroImageUrl: uploaded.heroImageUrl,
      }))
      setNotice('Recipe image uploaded. Save the Restaurant Recipe to keep it.')
    } catch (uploadError) {
      setError(
        getHospitalityErrorMessage(
          uploadError,
          'Unable to upload Recipe image.',
        ),
      )
    } finally {
      setImageUploading(false)
    }
  }

  async function editRecipe(recipeId) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await getHospitalityRestaurantRecipe(recipeId)
      const recipe = result?.recipe || {}
      const version = recipe.recipeVersion || {}
      const dish = recipe.dish || {}
      const operational = result?.operationalRecipe || {}
      const operationalRows = operational.ingredients || []
      const operationalByIngredient = new Map(
        operationalRows.map((item) => [item.canonicalIngredientId, item]),
      )

      const food = result?.foodIntelligence?.latest?.declaration || {}
      const nextFood = blankFood()
      for (const item of food.nutrition || []) {
        if (Object.hasOwn(nextFood.nutrition, item.key)) {
          nextFood.nutrition[item.key] = item.amount ?? ''
        }
      }
      for (const item of food.allergens || []) {
        if (Object.hasOwn(nextFood.allergens, item.key)) {
          nextFood.allergens[item.key] = item.relationship || ''
        }
      }
      nextFood.dietaryClassification =
        food.dietaryClassification || 'not_declared'
      nextFood.basis = food.basis || nextFood.basis

      setForm({
        ...blankForm(),
        outletId: result?.listing?.outletId || '',
        customerVisibility:
          result?.listing?.customerVisibility || 'public_candidate',
        title: version.title || dish.name || '',
        description: version.description || dish.description || '',
        cuisine: dish.cuisine || '',
        course: dish.course || '',
        heroImageUrl: dish.heroImageUrl || '',
        baseServings: Number(version.baseServings || 4),
        preparationTimeMinutes: Number(version.preparationTimeMinutes || 0),
        cookingTimeMinutes: Number(version.cookingTimeMinutes || 0),
        difficulty: version.difficulty || 'easy',
        kitchenNote: operational.changeReason || '',
        ingredients: (recipe.ingredients || []).map((item) => {
          const canonicalName = item?.canonicalIngredient?.canonicalName || ''
          const ops = operationalByIngredient.get(item.canonicalIngredientId) || {}
          return {
            ...blankIngredient(),
            ingredientQuery: canonicalName,
            canonicalIngredientId: item.canonicalIngredientId || '',
            ingredientName: canonicalName,
            quantity: Number(item.quantity || 1),
            unit: item.unit || 'g',
            role: item.role || 'main',
            preparationState: item.preparationState || '',
            expectedWastePercentage: Number(ops.expectedWastePercentage || 0),
            preferredSupplierProductId: ops.preferredSupplierProductId || '',
            operationalNote: ops.notes || '',
          }
        }),
        steps: (recipe.steps || []).map((step) => ({
          ...blankStep(),
          instruction: step.instruction || '',
          timerMinutes:
            step.timerSeconds === null || step.timerSeconds === undefined
              ? ''
              : Number(step.timerSeconds) / 60,
        })),
        foodIntelligence: nextFood,
      })
      setEditingId(recipeId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (editError) {
      setError(getHospitalityErrorMessage(editError))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (editingId) {
        await updateHospitalityRestaurantRecipe(editingId, payload(form))
        setNotice('Restaurant Recipe updated and sent back to Super Admin review.')
      } else {
        await createHospitalityRestaurantRecipe(payload(form))
        setNotice('Restaurant Recipe submitted to Super Admin for approval.')
      }
      setEditingId('')
      setForm({
        ...blankForm(),
        outletId: outlets[0]?.id || '',
      })
      await load()
    } catch (saveError) {
      setError(getHospitalityErrorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7faf8] px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[26px] border border-emerald-100 bg-gradient-to-br from-[#ddf7e9] via-[#edf9ff] to-[#f4ecff] p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                to="/host/hospitality"
                className="inline-flex items-center gap-2 text-xs font-black text-emerald-800"
              >
                <ArrowLeft size={15} /> Hospitality Operations
              </Link>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white">
                  <UtensilsCrossed size={21} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Chef + Restaurant
                  </p>
                  <h1 className="text-2xl font-black text-stone-950 sm:text-3xl">
                    Restaurant Recipes
                  </h1>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-stone-600">
                Create the complete recipe customers need to understand the dish, then add the kitchen-only waste and supplier settings EPANTRY needs for stock, procurement and costing.
              </p>
            </div>

            <Link
              to="/host/hospitality/legacy-recipes"
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700 shadow-sm"
            >
              View existing kitchen records
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            <CheckCircle2 size={18} /> {notice}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.8fr)]">
          <div className="space-y-5">
            <section className="rounded-[24px] border border-sky-100 bg-sky-50/80 p-4 sm:p-5">
              <h2 className="text-lg font-black text-stone-950">
                1. Customer-facing recipe details
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">
                These are the details customers can see after Super Admin approval.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Outlet">
                  <select
                    className={inputClass}
                    value={form.outletId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        outletId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose outlet</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Customer visibility">
                  <select
                    className={inputClass}
                    value={form.customerVisibility}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerVisibility: event.target.value,
                      }))
                    }
                  >
                    <option value="public_candidate">Show after approval</option>
                    <option value="organization_only">Kitchen only</option>
                  </select>
                </Field>

                <Field label="Dish / recipe name">
                  <input
                    className={inputClass}
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Butter Chicken"
                  />
                </Field>

                <Field label="Base servings">
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={form.baseServings}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        baseServings: Number(event.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Cuisine">
                  <input
                    className={inputClass}
                    value={form.cuisine}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cuisine: event.target.value,
                      }))
                    }
                    placeholder="Indian"
                  />
                </Field>

                <Field label="Course">
                  <input
                    className={inputClass}
                    value={form.course}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        course: event.target.value,
                      }))
                    }
                    placeholder="Main Course"
                  />
                </Field>

                <Field label="Preparation minutes">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={form.preparationTimeMinutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        preparationTimeMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Cooking minutes">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={form.cookingTimeMinutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cookingTimeMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Difficulty">
                  <select
                    className={inputClass}
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        difficulty: event.target.value,
                      }))
                    }
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Description">
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe what the customer should know about this dish."
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Recipe image">
                    <div className="rounded-2xl border border-dashed border-sky-200 bg-white/80 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {form.heroImageUrl ? (
                          <img
                            src={form.heroImageUrl}
                            alt="Restaurant Recipe preview"
                            className="h-28 w-full rounded-xl object-cover sm:w-44"
                          />
                        ) : (
                          <div className="grid h-28 w-full place-items-center rounded-xl bg-sky-50 text-sky-500 sm:w-44">
                            <ImagePlus size={24} />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={imageUploading}
                          onChange={(event) => handleImage(event.target.files?.[0])}
                          className="text-xs font-bold"
                        />
                      </div>
                    </div>
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-stone-950">
                    2. Ingredients + kitchen settings
                  </h2>
                  <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">
                    Ingredient quantity is customer-facing recipe truth. Waste and preferred supplier stay internal to your restaurant.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      ingredients: [
                        ...current.ingredients,
                        blankIngredient(),
                      ],
                    }))
                  }
                  className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                >
                  <Plus size={14} className="mr-1 inline" /> Add ingredient
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {form.ingredients.map((ingredient, index) => (
                  <IngredientRow
                    key={ingredient.rowId}
                    value={ingredient}
                    supplierProducts={supplierProducts}
                    canRemove={form.ingredients.length > 1}
                    onChange={(patch) => updateIngredient(index, patch)}
                    onRemove={() =>
                      setForm((current) => ({
                        ...current,
                        ingredients: current.ingredients.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  />
                ))}
              </div>

              <div className="mt-4">
                <Field label="Kitchen note">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={form.kitchenNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        kitchenNote: event.target.value,
                      }))
                    }
                    placeholder="Internal preparation / operations note"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-[24px] border border-violet-100 bg-violet-50/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-stone-950">
                    3. Cooking steps
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-stone-600">
                    Write the method in the order a customer or cook should follow it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      steps: [...current.steps, blankStep()],
                    }))
                  }
                  className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white"
                >
                  <Plus size={14} className="mr-1 inline" /> Add step
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {form.steps.map((step, index) => (
                  <div
                    key={step.rowId}
                    className="grid gap-2 rounded-2xl border border-violet-100 bg-white/80 p-3 md:grid-cols-[44px_minmax(0,1fr)_130px_44px]"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-sm font-black text-violet-800">
                      {index + 1}
                    </div>
                    <textarea
                      rows={2}
                      className={inputClass}
                      value={step.instruction}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          steps: current.steps.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  instruction: event.target.value,
                                }
                              : item,
                          ),
                        }))
                      }
                      placeholder="What happens in this step?"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className={inputClass}
                      value={step.timerMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          steps: current.steps.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  timerMinutes: event.target.value,
                                }
                              : item,
                          ),
                        }))
                      }
                      placeholder="Minutes"
                    />
                    <button
                      type="button"
                      disabled={form.steps.length <= 1}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          steps: current.steps.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                      className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-40"
                    >
                      <X size={16} className="mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-amber-100 bg-amber-50/80 p-4 sm:p-5">
              <h2 className="text-lg font-black text-stone-950">
                4. Nutrition, allergens & dietary information
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">
                Add only information you can support. Super Admin reviews this before the Restaurant Recipe is published.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {nutrients.map(([key, label, unit]) => (
                  <Field key={key} label={`${label} (${unit})`}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={inputClass}
                      value={form.foodIntelligence.nutrition[key]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          foodIntelligence: {
                            ...current.foodIntelligence,
                            nutrition: {
                              ...current.foodIntelligence.nutrition,
                              [key]: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {allergens.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <select
                      className={inputClass}
                      value={form.foodIntelligence.allergens[key]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          foodIntelligence: {
                            ...current.foodIntelligence,
                            allergens: {
                              ...current.foodIntelligence.allergens,
                              [key]: event.target.value,
                            },
                          },
                        }))
                      }
                    >
                      <option value="">Not declared</option>
                      <option value="contains">Contains</option>
                      <option value="may_contain">May contain</option>
                      <option value="cross_contact">Cross-contact</option>
                    </select>
                  </Field>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Dietary type">
                  <select
                    className={inputClass}
                    value={form.foodIntelligence.dietaryClassification}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        foodIntelligence: {
                          ...current.foodIntelligence,
                          dietaryClassification: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="not_declared">Not declared</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggitarian">Eggitarian</option>
                    <option value="non_vegetarian">Non-vegetarian</option>
                  </select>
                </Field>

                <Field label="Source / basis">
                  <input
                    className={inputClass}
                    value={form.foodIntelligence.basis}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        foodIntelligence: {
                          ...current.foodIntelligence,
                          basis: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </div>
            </section>

            <button
              type="button"
              disabled={!canSubmit || busy || imageUploading}
              onClick={save}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {busy ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : editingId ? (
                <Save size={17} />
              ) : (
                <Send size={17} />
              )}
              {editingId
                ? 'Save changes & resubmit'
                : 'Submit Restaurant Recipe for approval'}
            </button>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-black text-stone-950">
                Your Restaurant Recipes
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">
                Published recipes become eligible for the customer Restaurant section in M5-C. Internal recipes stay kitchen-only.
              </p>

              {loading ? (
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-stone-500">
                  <LoaderCircle size={15} className="animate-spin" /> Loading…
                </div>
              ) : recipes.length ? (
                <div className="mt-4 space-y-3">
                  {recipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="rounded-2xl border border-stone-200 bg-stone-50 p-3"
                    >
                      <div className="flex gap-3">
                        {recipe.heroImageUrl ? (
                          <img
                            src={recipe.heroImageUrl}
                            alt=""
                            className="h-14 w-14 rounded-xl object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-stone-950">
                            {recipe.title}
                          </p>
                          <p className="mt-0.5 text-[11px] font-bold text-stone-500">
                            {recipe.outletName || 'Outlet'} · {recipe.baseServings} servings
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-[9px] font-black uppercase text-sky-800">
                              {recipe.status === 'published'
                                ? 'Published'
                                : recipe.status === 'in_review'
                                  ? 'Waiting for Super Admin'
                                  : 'Changes requested'}
                            </span>
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-800">
                              {recipe.customerVisibility === 'public_candidate'
                                ? 'Customer listing'
                                : 'Kitchen only'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {recipe.status === 'draft' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => editRecipe(recipe.id)}
                          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-800"
                        >
                          Edit requested changes
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-stone-50 p-3 text-xs font-semibold text-stone-500">
                  No Restaurant Recipe has been submitted yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
