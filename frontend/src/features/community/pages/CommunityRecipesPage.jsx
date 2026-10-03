import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ChefHat,
    CircleAlert,
    CopyPlus,
    Eye,
    Heart,
    LoaderCircle,
    Plus,
    Search,
    Send,
    Share2,
    ShieldCheck,
    Star,
    Users,
    X,
  } from 'lucide-react';
  
  import {
    useCallback,
    useEffect,
    useMemo,
    useState,
  } from 'react';
  
  import {
    Link,
    useParams,
  } from 'react-router-dom';
  
  import {
    useAuth,
  } from '../../auth/context/AuthContext';
  
  import {
    createCommunityRecipe,
    createCommunityRecipeShare,
    forkCommunityRecipe,
    getCommunityErrorMessage,
    getCommunityRecipe,
    listCommunityRecipeShares,
    listMyCommunityRecipes,
    listSharedWithMeCommunityRecipes,
    reviewCommunityRecipe,
    revokeCommunityRecipeShare,
    searchCommunityIngredients,
  } from '../services/community.service';
  
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
  ];
  
  function normalizeNumber(
    value,
    fallback = 0,
  ) {
    const parsed =
        Number(
            value,
        );
  
    return Number.isFinite(
        parsed,
    )
        ? parsed
        : fallback;
  }
  
  function createBlankForm() {
    return {
        title:
            '',
  
        description:
            '',
  
        cuisine:
            '',
  
        course:
            '',
  
        tags:
            '',
  
        language:
            'en',
  
        baseServings:
            4,
  
        preparationTimeMinutes:
            15,
  
        cookingTimeMinutes:
            30,
  
        difficulty:
            'easy',
  
        visibility:
            'private',
  
        creatorStatement:
            '',
  
        ingredients:
            [],
  
        steps: [
            {
                instruction:
                    '',
            },
        ],
    };
  }
  
  function buildPayload(
    form,
  ) {
    const tags =
        String(
            form.tags ||
                '',
        )
            .split(',')
            .map(
                (
                    item,
                ) =>
                    item.trim(),
            )
            .filter(
                Boolean,
            );
  
    return {
        visibility:
            form.visibility,
  
        creatorStatement:
            form.creatorStatement,
  
        rights: {
            allowForks:
                true,
  
            allowProseReuseInForks:
                false,
  
            allowMediaReuseInForks:
                false,
        },
  
        recipe: {
            name:
                form.title,
  
            description:
                form.description,
  
            cuisine:
                form.cuisine,
  
            course:
                form.course,
  
            tags,
  
            language:
                form.language,
  
            heroImageUrl:
                '',
  
            title:
                form.title,
  
            recipeDescription:
                form.description,
  
            baseServings:
                Math.max(
                    1,
                    Math.round(
                        normalizeNumber(
                            form.baseServings,
                            4,
                        ),
                    ),
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
                null,
  
            maxRecommendedServings:
                null,
  
            preparationTimeMinutes:
                Math.max(
                    0,
                    Math.round(
                        normalizeNumber(
                            form.preparationTimeMinutes,
                        ),
                    ),
                ),
  
            cookingTimeMinutes:
                Math.max(
                    0,
                    Math.round(
                        normalizeNumber(
                            form.cookingTimeMinutes,
                        ),
                    ),
                ),
  
            difficulty:
                form.difficulty,
  
            source: {
                type:
                    'community',
  
                name:
                    '',
  
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
                form.ingredients.map(
                    (
                        item,
                        index,
                    ) => ({
                        lineNumber:
                            index +
                            1,
  
                        canonicalIngredientId:
                            item.id,
  
                        quantity:
                            Math.max(
                                0.000001,
                                normalizeNumber(
                                    item.quantity,
                                    1,
                                ),
                            ),
  
                        unit:
                            item.unit ||
                            'g',
  
                        preparationState:
                            item.preparationState ||
                            '',
  
                        optional:
                            item.optional ===
                            true,
  
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
                    }),
                ),
  
            steps:
                form.steps
                    .map(
                        (
                            step,
                            index,
                        ) => ({
                            stepNumber:
                                index +
                                1,
  
                            instruction:
                                String(
                                    step.instruction ||
                                        '',
                                ).trim(),
  
                            timerSeconds:
                                null,
  
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
                    )
                    .filter(
                        (
                            step,
                        ) =>
                            step.instruction,
                    ),
  
            substitutions:
                [],
        },
    };
  }
  
  function detailToForm(
    detail,
  ) {
    const recipe =
        detail?.recipe ||
        {};
  
    const version =
        recipe.recipeVersion ||
        {};
  
    const dish =
        recipe.dish ||
        {};
  
    return {
        ...createBlankForm(),
  
        title:
            `${version.title || dish.name || 'Recipe'} - My adaptation`,
  
        description:
            version.description ||
            dish.description ||
            '',
  
        cuisine:
            dish.cuisine ||
            '',
  
        course:
            dish.course ||
            '',
  
        tags:
            (
                dish.tags ||
                []
            ).join(
                ', ',
            ),
  
        language:
            dish.language ||
            'en',
  
        baseServings:
            version.baseServings ||
            4,
  
        preparationTimeMinutes:
            version.preparationTimeMinutes ||
            0,
  
        cookingTimeMinutes:
            version.cookingTimeMinutes ||
            0,
  
        difficulty:
            version.difficulty ||
            'easy',
  
        visibility:
            'private',
  
        ingredients:
            (
                recipe.ingredients ||
                []
            ).map(
                (
                    item,
                ) => ({
                    id:
                        item.canonicalIngredientId,
  
                    canonicalName:
                        item.canonicalIngredientName ||
                        item.displayName ||
                        item.canonicalIngredientId,
  
                    quantity:
                        item.quantity,
  
                    unit:
                        item.unit,
  
                    preparationState:
                        item.preparationState ||
                        '',
  
                    optional:
                        item.optional ===
                        true,
                }),
            ),
  
        steps:
            (
                recipe.steps ||
                []
            ).map(
                (
                    step,
                ) => ({
                    instruction:
                        step.instruction,
                }),
            ),
    };
  }
  
  function RecipeComposer({
    sourceDetail = null,
    onCreated,
    onCancel,
  }) {
    const [
        form,
        setForm,
    ] =
        useState(
            () =>
                sourceDetail
                    ? detailToForm(
                        sourceDetail,
                    )
                    : createBlankForm(),
        );
  
    const [
        ingredientQuery,
        setIngredientQuery,
    ] =
        useState('');
  
    const [
        ingredientResults,
        setIngredientResults,
    ] =
        useState([]);
  
    const [
        ingredientBusy,
        setIngredientBusy,
    ] =
        useState(false);
  
    const [
        submitting,
        setSubmitting,
    ] =
        useState(false);
  
    const [
        error,
        setError,
    ] =
        useState('');
  
    useEffect(
        () => {
            const query =
                ingredientQuery.trim();
  
            if (
                query.length <
                2
            ) {
                setIngredientResults(
                    [],
                );
  
                return undefined;
            }
  
            const timer =
                window.setTimeout(
                    async () => {
                        setIngredientBusy(
                            true,
                        );
  
                        try {
                            const result =
                                await searchCommunityIngredients({
                                    search:
                                        query,
                                });
  
                            setIngredientResults(
                                result?.ingredients ||
                                    [],
                            );
                        } catch {
                            setIngredientResults(
                                [],
                            );
                        } finally {
                            setIngredientBusy(
                                false,
                            );
                        }
                    },
                    300,
                );
  
            return () =>
                window.clearTimeout(
                    timer,
                );
        },
        [
            ingredientQuery,
        ],
    );
  
    function addIngredient(
        ingredient,
    ) {
        if (
            form.ingredients.some(
                (
                    item,
                ) =>
                    item.id ===
                    ingredient.id,
            )
        ) {
            return;
        }
  
        setForm(
            (
                current,
            ) => ({
                ...current,
  
                ingredients: [
                    ...current.ingredients,
  
                    {
                        id:
                            ingredient.id,
  
                        canonicalName:
                            ingredient.canonicalName,
  
                        quantity:
                            1,
  
                        unit:
                            'g',
  
                        preparationState:
                            '',
  
                        optional:
                            false,
                    },
                ],
            }),
        );
  
        setIngredientQuery(
            '',
        );
  
        setIngredientResults(
            [],
        );
    }
  
    function updateIngredient(
        index,
        patch,
    ) {
        setForm(
            (
                current,
            ) => ({
                ...current,
  
                ingredients:
                    current.ingredients.map(
                        (
                            item,
                            itemIndex,
                        ) =>
                            itemIndex ===
                            index
                                ? {
                                    ...item,
                                    ...patch,
                                }
                                : item,
                    ),
            }),
        );
    }
  
    async function handleSubmit(
        event,
    ) {
        event.preventDefault();
  
        if (
            !form.title.trim() ||
            !form.ingredients.length ||
            !form.steps.some(
                (
                    step,
                ) =>
                    step.instruction.trim(),
            )
        ) {
            setError(
                'Add a title, at least one canonical Ingredient, and at least one method step.',
            );
  
            return;
        }
  
        setSubmitting(
            true,
        );
  
        setError(
            '',
        );
  
        try {
            const payload =
                buildPayload(
                    form,
                );
  
            const result =
                sourceDetail
                    ? await forkCommunityRecipe({
                        communityRecipeId:
                            sourceDetail
                                .communityRecipe
                                .id,
  
                        payload: {
                            ...payload,
  
                            attributionLabel:
                                `Adapted from ${sourceDetail.recipe?.dish?.name || 'community recipe'}`,
  
                            reuseSourceProse:
                                false,
  
                            reuseSourceMedia:
                                false,
                        },
                    })
                    : await createCommunityRecipe(
                        payload,
                    );
  
            onCreated?.(
                result,
            );
        } catch (
            requestError
        ) {
            setError(
                getCommunityErrorMessage(
                    requestError,
                    'Unable to save this Community Recipe.',
                ),
            );
        } finally {
            setSubmitting(
                false,
            );
        }
    }
  
    return (
        <form
            onSubmit={
                handleSubmit
            }
            className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        {sourceDetail
                            ? 'Adapt with lineage'
                            : 'Community recipe composer'}
                    </p>
  
                    <h2 className="mt-1 text-2xl font-black text-stone-950">
                        {sourceDetail
                            ? 'Create your adaptation'
                            : 'Create a recipe'}
                    </h2>
                </div>
  
                {onCancel ? (
                    <button
                        type="button"
                        onClick={
                            onCancel
                        }
                        className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-500"
                    >
                        <X
                            size={16}
                        />
                    </button>
                ) : null}
            </div>
  
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                    <span className="text-xs font-black text-stone-500">
                        Recipe title
                    </span>
  
                    <input
                        value={
                            form.title
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    title:
                                        event.target.value,
                                }),
                            )
                        }
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                </label>
  
                <label className="sm:col-span-2">
                    <span className="text-xs font-black text-stone-500">
                        Description
                    </span>
  
                    <textarea
                        rows={3}
                        value={
                            form.description
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    description:
                                        event.target.value,
                                }),
                            )
                        }
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                </label>
  
                <label>
                    <span className="text-xs font-black text-stone-500">
                        Cuisine
                    </span>
  
                    <input
                        value={
                            form.cuisine
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    cuisine:
                                        event.target.value,
                                }),
                            )
                        }
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
                    />
                </label>
  
                <label>
                    <span className="text-xs font-black text-stone-500">
                        Course / meal type
                    </span>
  
                    <input
                        value={
                            form.course
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    course:
                                        event.target.value,
                                }),
                            )
                        }
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
                    />
                </label>
  
                <label className="sm:col-span-2">
                    <span className="text-xs font-black text-stone-500">
                        Tags, comma separated
                    </span>
  
                    <input
                        value={
                            form.tags
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    tags:
                                        event.target.value,
                                }),
                            )
                        }
                        placeholder="quick, family, north indian"
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
                    />
                </label>
  
                <label>
                    <span className="text-xs font-black text-stone-500">
                        Servings
                    </span>
  
                    <input
                        type="number"
                        min="1"
                        value={
                            form.baseServings
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    baseServings:
                                        event.target.value,
                                }),
                            )
                        }
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
                    />
                </label>
  
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-black text-emerald-900">
                        Private by default
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                        This personal recipe is only yours. After saving, you can create a private link for a specific friend. It cannot be published publicly.
                    </p>
                </div>
            </div>
  
            <div className="mt-7">
                <h3 className="text-base font-black text-stone-950">
                    Canonical ingredients
                </h3>
  
                <p className="mt-1 text-xs leading-5 text-stone-500">
                    Community recipes still use EPANTRY canonical Ingredient IDs so scaling, pantry reconciliation and Food Intelligence stay on the governed engine.
                </p>
  
                <div className="relative mt-3">
                    <Search
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                    />
  
                    <input
                        value={
                            ingredientQuery
                        }
                        onChange={(
                            event,
                        ) =>
                            setIngredientQuery(
                                event.target.value,
                            )
                        }
                        placeholder="Search ingredient, e.g. tomato"
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-emerald-300"
                    />
  
                    {ingredientBusy ? (
                        <LoaderCircle
                            size={16}
                            className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-emerald-700"
                        />
                    ) : null}
  
                    {ingredientResults.length ? (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                            {ingredientResults.map(
                                (
                                    ingredient,
                                ) => (
                                    <button
                                        key={
                                            ingredient.id
                                        }
                                        type="button"
                                        onClick={() =>
                                            addIngredient(
                                                ingredient,
                                            )
                                        }
                                        className="focus-ring block w-full border-b border-stone-100 px-4 py-3 text-left text-sm font-bold text-stone-700 last:border-0 hover:bg-emerald-50"
                                    >
                                        {
                                            ingredient.canonicalName
                                        }
                                    </button>
                                ),
                            )}
                        </div>
                    ) : null}
                </div>
  
                <div className="mt-4 space-y-3">
                    {form.ingredients.map(
                        (
                            item,
                            index,
                        ) => (
                            <div
                                key={
                                    item.id
                                }
                                className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto] sm:items-center"
                            >
                                <div>
                                    <p className="text-sm font-black text-stone-800">
                                        {
                                            item.canonicalName
                                        }
                                    </p>
  
                                    <input
                                        value={
                                            item.preparationState
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            updateIngredient(
                                                index,
                                                {
                                                    preparationState:
                                                        event.target.value,
                                                },
                                            )
                                        }
                                        placeholder="Preparation, e.g. chopped"
                                        className="mt-1 w-full bg-transparent text-xs font-semibold text-stone-500 outline-none"
                                    />
                                </div>
  
                                <input
                                    type="number"
                                    min="0.000001"
                                    step="any"
                                    value={
                                        item.quantity
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        updateIngredient(
                                            index,
                                            {
                                                quantity:
                                                    event.target.value,
                                            },
                                        )
                                    }
                                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-bold outline-none"
                                />
  
                                <select
                                    value={
                                        item.unit
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        updateIngredient(
                                            index,
                                            {
                                                unit:
                                                    event.target.value,
                                            },
                                        )
                                    }
                                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-bold outline-none"
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
  
                                <button
                                    type="button"
                                    onClick={() =>
                                        setForm(
                                            (
                                                current,
                                            ) => ({
                                                ...current,
  
                                                ingredients:
                                                    current.ingredients.filter(
                                                        (
                                                            _,
                                                            itemIndex,
                                                        ) =>
                                                            itemIndex !==
                                                            index,
                                                    ),
                                            }),
                                        )
                                    }
                                    className="focus-ring grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-600"
                                >
                                    <X
                                        size={15}
                                    />
                                </button>
                            </div>
                        ),
                    )}
                </div>
            </div>
  
            <div className="mt-7">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-black text-stone-950">
                        Method
                    </h3>
  
                    <button
                        type="button"
                        onClick={() =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    steps: [
                                        ...current.steps,
  
                                        {
                                            instruction:
                                                '',
                                        },
                                    ],
                                }),
                            )
                        }
                        className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-2 text-xs font-black text-stone-600"
                    >
                        <Plus
                            size={14}
                        />
  
                        Add step
                    </button>
                </div>
  
                <div className="mt-3 space-y-3">
                    {form.steps.map(
                        (
                            step,
                            index,
                        ) => (
                            <div
                                key={
                                    index
                                }
                                className="flex gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3"
                            >
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-emerald-800">
                                    {index + 1}
                                </div>
  
                                <textarea
                                    rows={2}
                                    value={
                                        step.instruction
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setForm(
                                            (
                                                current,
                                            ) => ({
                                                ...current,
  
                                                steps:
                                                    current.steps.map(
                                                        (
                                                            item,
                                                            itemIndex,
                                                        ) =>
                                                            itemIndex ===
                                                            index
                                                                ? {
                                                                    ...item,
  
                                                                    instruction:
                                                                        event.target.value,
                                                                }
                                                                : item,
                                                    ),
                                            }),
                                        )
                                    }
                                    className="min-w-0 flex-1 resize-y bg-transparent text-sm font-semibold leading-6 outline-none"
                                />
                            </div>
                        ),
                    )}
                </div>
            </div>
  
            <label className="mt-6 block">
                <span className="text-xs font-black text-stone-500">
                    Creator statement / context
                </span>
  
                <textarea
                    rows={3}
                    value={
                        form.creatorStatement
                    }
                    onChange={(
                        event,
                    ) =>
                        setForm(
                            (
                                current,
                            ) => ({
                                ...current,
  
                                creatorStatement:
                                    event.target.value,
                            }),
                        )
                    }
                    placeholder="What should cooks know about your version? This remains creator-provided, not an EPANTRY verified fact."
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
                />
            </label>
  
            {error ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">
                    <CircleAlert
                        size={16}
                        className="mt-0.5 shrink-0"
                    />
  
                    {error}
                </div>
            ) : null}
  
            <button
                type="submit"
                disabled={
                    submitting
                }
                className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
            >
                {submitting ? (
                    <LoaderCircle
                        size={17}
                        className="animate-spin"
                    />
                ) : sourceDetail ? (
                    <CopyPlus
                        size={17}
                    />
                ) : (
                    <Plus
                        size={17}
                    />
                )}
  
                {sourceDetail
                    ? 'Create private adaptation'
                    : 'Save private recipe'}
            </button>
        </form>
    );
  }
  
  function CommunityRecipeDetail({
    communityRecipeId,
  }) {
    const {
        isAuthenticated,
        customerEnabled,
        hostEnabled,
    } =
        useAuth();
  
    const [
        detail,
        setDetail,
    ] =
        useState(null);
  
    const [
        loading,
        setLoading,
    ] =
        useState(true);
  
    const [
        error,
        setError,
    ] =
        useState('');
  
    const [
        showFork,
        setShowFork,
    ] =
        useState(false);
  
    const [
        rating,
        setRating,
    ] =
        useState(5);
  
    const [
        reviewText,
        setReviewText,
    ] =
        useState('');
  
    const [
        reviewBusy,
        setReviewBusy,
    ] =
        useState(false);
  
    const [
        notice,
        setNotice,
    ] =
        useState('');
  
    const load =
        useCallback(
            async () => {
                setLoading(
                    true,
                );
  
                setError(
                    '',
                );
  
                try {
                    setDetail(
                        await getCommunityRecipe(
                            communityRecipeId,
                        ),
                    );
                } catch (
                    requestError
                ) {
                    setError(
                        getCommunityErrorMessage(
                            requestError,
                            'Unable to load this Community Recipe.',
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                communityRecipeId,
            ],
        );
  
    useEffect(
        () => {
            load();
        },
        [
            load,
        ],
    );
  
    async function shareRecipe() {
        const shareUrl =
            typeof window !==
            'undefined'
                ? window.location.href
                : '';
  
        const title =
            detail?.recipe?.dish?.name ||
            detail?.recipe?.recipeVersion?.title ||
            'EPANTRY Community Recipe';
  
        try {
            if (
                typeof navigator !==
                    'undefined' &&
                typeof navigator.share ===
                    'function'
            ) {
                await navigator.share({
                    title,
                    url:
                        shareUrl,
                });
  
                setNotice(
                    'Recipe share sheet opened. Only this Community Recipe link is shared; private household or pantry data is never included.',
                );
  
                return;
            }
  
            if (
                typeof navigator !==
                    'undefined' &&
                navigator.clipboard?.writeText &&
                shareUrl
            ) {
                await navigator.clipboard.writeText(
                    shareUrl,
                );
  
                setNotice(
                    'Community Recipe link copied. Private household or pantry data is not part of the shared link.',
                );
  
                return;
            }
  
            setNotice(
                'Sharing is not available in this browser. Copy the current Community Recipe URL manually.',
            );
        } catch (
            shareError
        ) {
            if (
                shareError?.name !==
                'AbortError'
            ) {
                setNotice(
                    'Unable to share this Community Recipe right now.',
                );
            }
        }
    }
  
    async function submitReview() {
        setReviewBusy(
            true,
        );
  
        setNotice(
            '',
        );
  
        try {
            await reviewCommunityRecipe({
                communityRecipeId,
  
                payload: {
                    overallRating:
                        rating,
  
                    tasteRating:
                        null,
  
                    easeRating:
                        null,
  
                    timeAccuracyRating:
                        null,
  
                    familyResponseRating:
                        null,
  
                    wouldCookAgain:
                        true,
  
                    reviewText,
                },
            });
  
            setReviewText(
                '',
            );
  
            setNotice(
                'Review recorded. Verified-cook status is determined from M09 cooking evidence, not purchase history.',
            );
  
            await load();
        } catch (
            requestError
        ) {
            setNotice(
                getCommunityErrorMessage(
                    requestError,
                    'Unable to submit review.',
                ),
            );
        } finally {
            setReviewBusy(
                false,
            );
        }
    }
  
    if (loading) {
        return (
            <main className="page-shell grid min-h-[420px] place-items-center py-10">
                <LoaderCircle
                    className="animate-spin text-emerald-700"
                />
            </main>
        );
    }
  
    if (
        error ||
        !detail
    ) {
        return (
            <main className="page-shell py-10">
                <div className="rounded-[28px] bg-red-50 p-6 text-red-800">
                    {error ||
                        'Community Recipe not found.'}
                </div>
            </main>
        );
    }
  
    const recipe =
        detail.recipe ||
        {};
  
    const dish =
        recipe.dish ||
        {};
  
    const version =
        recipe.recipeVersion ||
        {};
  
    return (
        <main className="page-shell py-8 sm:py-10">
            <Link
                to="/community"
                className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-emerald-800"
            >
                <ArrowLeft
                    size={17}
                />
  
                Community Recipes
            </Link>
  
            <section className="mt-5 overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
                <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="p-6 sm:p-8 lg:p-10">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                                Community contributed
                            </span>
  
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                                {
                                    detail.communityRecipe.visibility
                                }
                            </span>
  
                            {detail.lineage ? (
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                                    Adapted with lineage
                                </span>
                            ) : null}
                        </div>
  
                        <h1 className="mt-5 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                            {version.title ||
                                dish.name}
                        </h1>
  
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                            {version.description ||
                                dish.description ||
                                'No description supplied.'}
                        </p>
  
                        {detail.creator ? (
                            <Link
                                to={`/creators/${encodeURIComponent(
                                    detail.creator.id,
                                )}`}
                                className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-xs font-black text-stone-700 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                                <ChefHat
                                    size={15}
                                />
  
                                {
                                    detail.creator.displayName
                                }
  
                                {detail.creator.verificationStatus ===
                                'verified'
                                    ? ' · Verified creator'
                                    : ''}
                            </Link>
                        ) : detail.owner ? (
                            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-xs font-black text-violet-800">
                                <Users size={15} />
                                Personal recipe by {detail.owner.name}
                            </div>
                        ) : null}
  
                        {detail.communityRecipe.creatorStatement ? (
                            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                                    Creator-provided statement
                                </p>
  
                                <p className="mt-2 text-sm leading-6 text-amber-950">
                                    {
                                        detail.communityRecipe.creatorStatement
                                    }
                                </p>
                            </div>
                        ) : null}
                    </div>
  
                    <aside className="border-t border-stone-200 bg-[#f7f5ef] p-6 lg:border-l lg:border-t-0">
                        <div className="flex items-center gap-2">
                            <ShieldCheck
                                size={19}
                                className="text-emerald-700"
                            />
  
                            <p className="text-sm font-black text-stone-900">
                                Trust boundary
                            </p>
                        </div>
  
                        <p className="mt-3 text-xs leading-5 text-stone-600">
                            Ingredient requirements use M07 canonical Recipe truth. Nutrition/allergen data is recalculated through M08 and is never copied from a parent adaptation.
                        </p>
  
                        <div className="mt-5 rounded-2xl bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                                Ratings
                            </p>
  
                            <div className="mt-2 flex items-center gap-2">
                                <Star
                                    size={17}
                                    className="fill-current text-amber-500"
                                />
  
                                <span className="text-xl font-black text-stone-950">
                                    {detail.ratings.average ??
                                        '—'}
                                </span>
  
                                <span className="text-xs font-semibold text-stone-500">
                                    ({detail.ratings.count} reviews, {detail.ratings.verifiedCookCount} verified cooks)
                                </span>
                            </div>
                        </div>
  
                        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs font-semibold leading-5 text-violet-800">
                            Personal recipes are shared only through a friend-specific private link from My recipes.
                        </div>
  
                        {isAuthenticated &&
                        customerEnabled ? (
                            <button
                                type="button"
                                onClick={() =>
                                    setShowFork(
                                        true,
                                    )
                                }
                                className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-black text-white hover:bg-stone-800"
                            >
                                <CopyPlus
                                    size={16}
                                />
  
                                Adapt this recipe
                            </button>
                        ) : null}
                    </aside>
                </div>
            </section>
  
            {detail.lineage ? (
                <section className="mt-6 rounded-[24px] border border-blue-200 bg-blue-50 p-5 text-blue-950">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                        Adaptation lineage
                    </p>
  
                    <p className="mt-2 text-sm font-bold">
                        {
                            detail.lineage.attributionLabel
                        }
                    </p>
  
                    <p className="mt-2 text-xs leading-5 text-blue-900/80">
                        Creator prose copied: {detail.lineage.copiedCreatorProse ? 'yes' : 'no'} · Creator media copied: {detail.lineage.copiedCreatorMedia ? 'yes' : 'no'} · Food Intelligence copied: no.
                    </p>
                </section>
            ) : null}
  
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-black text-stone-950">
                        Ingredients
                    </h2>
  
                    <div className="mt-4 space-y-2">
                        {(recipe.ingredients || []).map(
                            (
                                ingredient,
                            ) => (
                                <div
                                    key={
                                        ingredient.id
                                    }
                                    className="flex items-center justify-between gap-4 rounded-2xl bg-stone-50 px-4 py-3"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-stone-800">
                                            {ingredient.canonicalIngredientName ||
                                                ingredient.displayName ||
                                                ingredient.canonicalIngredientId}
                                        </p>
  
                                        {ingredient.preparationState ? (
                                            <p className="mt-0.5 text-xs font-semibold text-stone-500">
                                                {
                                                    ingredient.preparationState
                                                }
                                            </p>
                                        ) : null}
                                    </div>
  
                                    <p className="shrink-0 text-sm font-black text-stone-950">
                                        {
                                            ingredient.quantity
                                        }{' '}
                                        {
                                            ingredient.unit
                                        }
                                    </p>
                                </div>
                            ),
                        )}
                    </div>
  
                    <h2 className="mt-7 text-xl font-black text-stone-950">
                        Method
                    </h2>
  
                    <div className="mt-4 space-y-3">
                        {(recipe.steps || []).map(
                            (
                                step,
                            ) => (
                                <div
                                    key={
                                        step.id
                                    }
                                    className="flex gap-3 rounded-2xl border border-stone-200 p-4"
                                >
                                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
                                        {
                                            step.stepNumber
                                        }
                                    </div>
  
                                    <p className="text-sm leading-6 text-stone-700">
                                        {
                                            step.instruction
                                        }
                                    </p>
                                </div>
                            ),
                        )}
                    </div>
                </section>
  
                <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-black text-stone-950">
                        Reviews
                    </h2>
  
                    {isAuthenticated &&
                    customerEnabled ? (
                        <div className="mt-4 rounded-2xl bg-stone-50 p-4">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(
                                    (
                                        value,
                                    ) => (
                                        <button
                                            key={
                                                value
                                            }
                                            type="button"
                                            onClick={() =>
                                                setRating(
                                                    value,
                                                )
                                            }
                                            className="focus-ring p-1"
                                        >
                                            <Star
                                                size={20}
                                                className={
                                                    value <=
                                                    rating
                                                        ? 'fill-current text-amber-500'
                                                        : 'text-stone-300'
                                                }
                                            />
                                        </button>
                                    ),
                                )}
                            </div>
  
                            <textarea
                                rows={3}
                                value={
                                    reviewText
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setReviewText(
                                        event.target.value,
                                    )
                                }
                                placeholder="How did it cook?"
                                className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold outline-none"
                            />
  
                            <button
                                type="button"
                                disabled={
                                    reviewBusy
                                }
                                onClick={
                                    submitReview
                                }
                                className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
                            >
                                {reviewBusy ? (
                                    <LoaderCircle
                                        size={15}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Send
                                        size={15}
                                    />
                                )}
  
                                Submit review
                            </button>
  
                            {notice ? (
                                <p className="mt-3 text-xs font-semibold leading-5 text-stone-500">
                                    {notice}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
  
                    <div className="mt-4 space-y-3">
                        {(detail.reviews || []).map(
                            (
                                review,
                            ) => (
                                <div
                                    key={
                                        review.id
                                    }
                                    className="rounded-2xl border border-stone-200 p-4"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700">
                                            <Star
                                                size={14}
                                                className="fill-current"
                                            />
  
                                            {review.overallRating}/5
                                        </span>
  
                                        {review.verifiedCook ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">
                                                <CheckCircle2
                                                    size={12}
                                                />
  
                                                Verified cook
                                            </span>
                                        ) : null}
                                    </div>
  
                                    {review.reviewText ? (
                                        <p className="mt-2 text-sm leading-6 text-stone-600">
                                            {
                                                review.reviewText
                                            }
                                        </p>
                                    ) : null}
                                </div>
                            ),
                        )}
                    </div>
                </section>
            </div>
  
            {showFork ? (
                <div className="mt-6">
                    <RecipeComposer
                        sourceDetail={
                            detail
                        }
                        onCancel={() =>
                            setShowFork(
                                false,
                            )
                        }
                        onCreated={() => {
                            setShowFork(
                                false,
                            );
  
                            setNotice(
                                'Adaptation created with lineage. Nutrition/allergen calculations will be recalculated independently.',
                            );
                        }}
                    />
                </div>
            ) : null}
        </main>
    );
  }
  
  function ShareRecipePanel({
    recipe,
    onClose,
    onChanged,
  }) {
    const [
        friendEmail,
        setFriendEmail,
    ] = useState('');

    const [
        shares,
        setShares,
    ] = useState([]);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        busy,
        setBusy,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState('');

    const [
        notice,
        setNotice,
    ] = useState('');

    const [
        latestShareUrl,
        setLatestShareUrl,
    ] = useState('');

    const loadShares =
        useCallback(
            async () => {
                setLoading(
                    true,
                );

                setError(
                    '',
                );

                try {
                    const result =
                        await listCommunityRecipeShares(
                            recipe.id,
                        );

                    setShares(
                        result?.shares ||
                            [],
                    );
                } catch (
                    requestError
                ) {
                    setError(
                        getCommunityErrorMessage(
                            requestError,
                            'Unable to load friend sharing details.',
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                recipe.id,
            ],
        );

    useEffect(
        () => {
            loadShares();
        },
        [
            loadShares,
        ],
    );

    async function createShare() {
        setBusy(
            true,
        );

        setError(
            '',
        );

        setNotice(
            '',
        );

        try {
            const result =
                await createCommunityRecipeShare({
                    communityRecipeId:
                        recipe.id,

                    friendEmail,
                });

            const sharePath =
                result?.share
                    ?.sharePath ||
                '';

            const url =
                sharePath &&
                typeof window !==
                    'undefined'
                    ? `${window.location.origin}${sharePath}`
                    : sharePath;

            setLatestShareUrl(
                url,
            );

            setFriendEmail(
                '',
            );

            setNotice(
                result?.message ||
                    'Private friend link created.',
            );

            await loadShares();
            onChanged?.();
        } catch (
            requestError
        ) {
            setError(
                getCommunityErrorMessage(
                    requestError,
                    'Unable to create a private friend link.',
                ),
            );
        } finally {
            setBusy(
                false,
            );
        }
    }

    async function copyLatestLink() {
        if (
            !latestShareUrl ||
            !navigator?.clipboard
                ?.writeText
        ) {
            setNotice(
                'Copy the private link shown below.',
            );

            return;
        }

        await navigator.clipboard.writeText(
            latestShareUrl,
        );

        setNotice(
            'Private friend link copied.',
        );
    }

    async function revokeShare(
        shareId,
    ) {
        setBusy(
            true,
        );

        setError(
            '',
        );

        try {
            await revokeCommunityRecipeShare(
                shareId,
            );

            setNotice(
                'Friend access revoked.',
            );

            await loadShares();
            onChanged?.();
        } catch (
            requestError
        ) {
            setError(
                getCommunityErrorMessage(
                    requestError,
                    'Unable to revoke friend access.',
                ),
            );
        } finally {
            setBusy(
                false,
            );
        }
    }

    const activeShares =
        shares.filter(
            (
                share,
            ) =>
                share.status ===
                'active',
        );

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
            <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-violet-200 bg-white p-6 shadow-2xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-600">
                            Private friend sharing
                        </p>

                        <h2 className="mt-2 text-2xl font-black text-stone-950">
                            {recipe.dish?.name ||
                                'Personal recipe'}
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-stone-600">
                            Enter one friend&apos;s email. The link works only for that Customer account. Create a separate link for another friend.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            onClose
                        }
                        className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600"
                        aria-label="Close friend sharing"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="mt-6 rounded-2xl bg-violet-50 p-4">
                    <label className="block">
                        <span className="text-xs font-black text-violet-900">
                            Friend email
                        </span>

                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                                type="email"
                                value={
                                    friendEmail
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setFriendEmail(
                                        event.target.value,
                                    )
                                }
                                placeholder="friend@example.com"
                                className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                            />

                            <button
                                type="button"
                                disabled={
                                    busy ||
                                    !friendEmail.trim()
                                }
                                onClick={
                                    createShare
                                }
                                className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                            >
                                <Share2 size={16} />
                                Create link
                            </button>
                        </div>
                    </label>
                </div>

                {latestShareUrl ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-black text-emerald-900">
                            Send this private link to your friend
                        </p>

                        <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 text-xs font-semibold text-stone-600">
                            {latestShareUrl}
                        </p>

                        <button
                            type="button"
                            onClick={
                                copyLatestLink
                            }
                            className="focus-ring mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white"
                        >
                            Copy link
                        </button>
                    </div>
                ) : null}

                {notice ? (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                        <CheckCircle2
                            size={16}
                            className="mt-0.5 shrink-0"
                        />
                        {notice}
                    </div>
                ) : null}

                {error ? (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">
                        <CircleAlert
                            size={16}
                            className="mt-0.5 shrink-0"
                        />
                        {error}
                    </div>
                ) : null}

                <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-black text-stone-950">
                            Shared with
                        </h3>

                        <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-black text-stone-600">
                            {activeShares.length} active
                        </span>
                    </div>

                    {loading ? (
                        <LoaderCircle className="mt-4 animate-spin text-violet-700" />
                    ) : activeShares.length ? (
                        <div className="mt-3 space-y-2">
                            {activeShares.map(
                                (
                                    share,
                                ) => (
                                    <div
                                        key={
                                            share.id
                                        }
                                        className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-black text-stone-900">
                                                {share.recipient?.name ||
                                                    share.friendEmail}
                                            </p>

                                            <p className="mt-1 text-xs font-semibold text-stone-500">
                                                {share.friendEmail}
                                                {' · '}
                                                {share.claimedAt
                                                    ? 'Opened by friend'
                                                    : 'Link ready'}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={
                                                busy
                                            }
                                            onClick={() =>
                                                revokeShare(
                                                    share.id,
                                                )
                                            }
                                            className="focus-ring rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                                        >
                                            Revoke access
                                        </button>
                                    </div>
                                ),
                            )}
                        </div>
                    ) : (
                        <p className="mt-3 rounded-2xl border border-dashed border-stone-300 p-5 text-sm font-semibold text-stone-500">
                            This recipe has not been shared with any friend yet.
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
  }

  function CommunityGuideCards({
    isAuthenticated,
    onCreate,
    onMyRecipes,
  }) {
    const steps = [
        {
            number:
                '01',

            title:
                'Explore recipe ideas',

            description:
                'Start with EPANTRY Recipes when you want inspiration for what to cook next.',

            actionLabel:
                'Browse Recipes',

            icon:
                BookOpen,

            tone:
                'border-emerald-200 bg-emerald-100/85 text-emerald-950',

            iconTone:
                'bg-emerald-700 text-white',

            actionTone:
                'text-emerald-800',

            to:
                '/recipes',
        },
        {
            number:
                '02',

            title:
                'Create your own recipe',

            description:
                'Save the dishes you cook at home so your personal collection stays in one place.',

            actionLabel:
                isAuthenticated
                    ? 'Create recipe'
                    : 'Log in to create',

            icon:
                ChefHat,

            tone:
                'border-amber-200 bg-amber-100/90 text-amber-950',

            iconTone:
                'bg-amber-600 text-white',

            actionTone:
                'text-amber-800',

            to:
                isAuthenticated
                    ? null
                    : '/login?returnTo=%2Fcommunity',

            onClick:
                isAuthenticated
                    ? onCreate
                    : null,
        },
        {
            number:
                '03',

            title:
                'Keep it private or share',

            description:
                'Your recipe stays yours. Share a specific recipe with a friend only when you choose.',

            actionLabel:
                isAuthenticated
                    ? 'Open My recipes'
                    : 'Sign in to manage',

            icon:
                Share2,

            tone:
                'border-violet-200 bg-violet-100/85 text-violet-950',

            iconTone:
                'bg-violet-700 text-white',

            actionTone:
                'text-violet-800',

            to:
                isAuthenticated
                    ? null
                    : '/login?returnTo=%2Fcommunity',

            onClick:
                isAuthenticated
                    ? onMyRecipes
                    : null,
        },
        {
            number:
                '04',

            title:
                'Find what you need',

            description:
                'When the recipe is ready, move to Grocery to discover ingredients and products.',

            actionLabel:
                'Go to Grocery',

            icon:
                Search,

            tone:
                'border-sky-200 bg-sky-100/90 text-sky-950',

            iconTone:
                'bg-sky-700 text-white',

            actionTone:
                'text-sky-800',

            to:
                '/grocery',
        },
    ];

    return (
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 lg:grid-cols-4">
            {steps.map(
                (
                    step,
                ) => {
                    const Icon =
                        step.icon;

                    const content = (
                        <>
                            <div className="flex items-start justify-between gap-2">
                                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-9 sm:w-9 ${step.iconTone}`}>
                                    <Icon
                                        size={16}
                                        aria-hidden="true"
                                    />
                                </span>

                                <span className="text-[9px] font-black tracking-[0.16em] opacity-45 sm:text-[10px]">
                                    {step.number}
                                </span>
                            </div>

                            <h3 className="mt-3 text-[13px] font-black leading-[1.15] sm:text-[15px] lg:text-base">
                                {step.title}
                            </h3>

                            <p className="mt-1.5 text-[10px] font-semibold leading-[1.45] opacity-70 sm:text-xs sm:leading-5">
                                {step.description}
                            </p>

                            <span className={`mt-3 inline-flex text-[10px] font-black sm:text-xs ${step.actionTone}`}>
                                {step.actionLabel} →
                            </span>
                        </>
                    );

                    const className = `focus-ring flex min-h-[142px] flex-col rounded-[20px] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[168px] sm:rounded-[24px] sm:p-4 lg:min-h-[184px] lg:p-5 ${step.tone}`;

                    if (step.to) {
                        return (
                            <Link
                                key={
                                    step.number
                                }
                                to={
                                    step.to
                                }
                                className={
                                    className
                                }
                            >
                                {content}
                            </Link>
                        );
                    }

                    return (
                        <button
                            key={
                                step.number
                            }
                            type="button"
                            onClick={
                                step.onClick
                            }
                            className={
                                className
                            }
                        >
                            {content}
                        </button>
                    );
                },
            )}
        </div>
    );
  }

  export default function CommunityRecipesPage() {
    const {
        communityRecipeId,
    } = useParams();

    const {
        isAuthenticated,
        customerEnabled,
        hostEnabled,
        activeMode,
        switchMode,
    } = useAuth();

    const [
        tab,
        setTab,
    ] = useState(
        'mine',
    );

    const [
        myRecipes,
        setMyRecipes,
    ] = useState([]);

    const [
        sharedRecipes,
        setSharedRecipes,
    ] = useState([]);

    const [
        selectedShareRecipe,
        setSelectedShareRecipe,
    ] = useState(null);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        error,
        setError,
    ] = useState('');

    const [
        notice,
        setNotice,
    ] = useState('');

    const canUseCustomerCommunity =
        isAuthenticated &&
        customerEnabled ===
            true &&
        activeMode ===
            'customer';

    const loadMine =
        useCallback(
            async () => {
                if (
                    !canUseCustomerCommunity
                ) {
                    return;
                }

                setLoading(
                    true,
                );

                setError(
                    '',
                );

                try {
                    const result =
                        await listMyCommunityRecipes({
                            page:
                                1,

                            limit:
                                50,
                        });

                    setMyRecipes(
                        result?.recipes ||
                            [],
                    );
                } catch (
                    requestError
                ) {
                    setError(
                        getCommunityErrorMessage(
                            requestError,
                            'We could not load your saved recipes right now.',
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                canUseCustomerCommunity,
            ],
        );

    const loadShared =
        useCallback(
            async () => {
                if (
                    !canUseCustomerCommunity
                ) {
                    return;
                }

                setLoading(
                    true,
                );

                setError(
                    '',
                );

                try {
                    const result =
                        await listSharedWithMeCommunityRecipes();

                    setSharedRecipes(
                        result?.shares ||
                            [],
                    );
                } catch (
                    requestError
                ) {
                    setError(
                        getCommunityErrorMessage(
                            requestError,
                            'We could not load recipes shared with you right now.',
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                canUseCustomerCommunity,
            ],
        );

    useEffect(
        () => {
            if (
                communityRecipeId ||
                !canUseCustomerCommunity
            ) {
                setLoading(
                    false,
                );
                return;
            }

            if (
                tab ===
                'shared'
            ) {
                loadShared();
            } else if (
                tab ===
                'mine'
            ) {
                loadMine();
            } else {
                setLoading(
                    false,
                );
            }
        },
        [
            communityRecipeId,
            tab,
            loadMine,
            loadShared,
            canUseCustomerCommunity,
        ],
    );

    if (!isAuthenticated) {
        return (
            <main className="page-shell pb-6 pt-2 sm:pb-8 sm:pt-3">
                <section className="overflow-hidden rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#DCFCE7_0%,#FEF3C7_48%,#EDE9FE_100%)] p-4 shadow-sm sm:rounded-[30px] sm:p-6 lg:p-8">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] lg:items-end lg:gap-8">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800 sm:text-xs">
                                Community · Your recipe space
                            </p>

                            <h1 className="mt-2 max-w-3xl text-[26px] font-black leading-[1.02] tracking-[-0.04em] text-stone-950 sm:text-4xl lg:text-5xl">
                                Keep your recipes together. Share only when you want.
                            </h1>

                            <p className="mt-3 max-w-2xl text-xs font-semibold leading-5 text-stone-700 sm:text-sm sm:leading-6">
                                Use Community as your personal recipe space: save dishes you cook, open recipes friends send you, and decide exactly what you want to share.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                                <Link
                                    to="/login?returnTo=%2Fcommunity"
                                    className="focus-ring rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-800 sm:text-sm"
                                >
                                    Log in
                                </Link>

                                <Link
                                    to="/register?returnTo=%2Fcommunity"
                                    className="focus-ring rounded-xl border border-stone-950/15 bg-white/75 px-4 py-2.5 text-xs font-black text-stone-900 backdrop-blur transition hover:bg-white sm:text-sm"
                                >
                                    Create Customer account
                                </Link>
                            </div>
                        </div>

                        <div className="rounded-[20px] bg-emerald-900 p-4 text-emerald-50 shadow-sm sm:rounded-[24px] sm:p-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 sm:text-xs">
                                What this page does for you
                            </p>

                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-2xl bg-white/10 p-2.5">
                                    <Heart
                                        size={16}
                                        className="mx-auto"
                                        aria-hidden="true"
                                    />
                                    <p className="mt-1.5 text-[10px] font-black sm:text-xs">
                                        Save
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white/10 p-2.5">
                                    <Users
                                        size={16}
                                        className="mx-auto"
                                        aria-hidden="true"
                                    />
                                    <p className="mt-1.5 text-[10px] font-black sm:text-xs">
                                        Share
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white/10 p-2.5">
                                    <ChefHat
                                        size={16}
                                        className="mx-auto"
                                        aria-hidden="true"
                                    />
                                    <p className="mt-1.5 text-[10px] font-black sm:text-xs">
                                        Cook
                                    </p>
                                </div>
                            </div>

                            <p className="mt-3 text-[10px] font-semibold leading-4 text-emerald-100/80 sm:text-xs sm:leading-5">
                                Your personal recipes do not become public automatically. You stay in control of who can open them.
                            </p>
                        </div>
                    </div>

                    <CommunityGuideCards
                        isAuthenticated={
                            false
                        }
                    />
                </section>
            </main>
        );
    }

    if (
        customerEnabled !==
        true
    ) {
        return (
            <main className="page-shell pb-6 pt-2 sm:pb-8 sm:pt-3">
                <section className="rounded-[24px] border border-rose-200 bg-rose-100 p-5 shadow-sm sm:rounded-[30px] sm:p-7">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 sm:text-xs">
                        Customer recipe space
                    </p>

                    <h1 className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                        This recipe space needs Customer access
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-stone-700">
                        Community is where Customers keep personal recipes and receive recipes shared by friends. Your other EPANTRY access stays unchanged.
                    </p>
                </section>
            </main>
        );
    }

    if (
        activeMode !==
        'customer'
    ) {
        return (
            <main className="page-shell pb-6 pt-2 sm:pb-8 sm:pt-3">
                <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#DBEAFE_0%,#E0F2FE_48%,#DCFCE7_100%)] p-5 shadow-sm sm:rounded-[30px] sm:p-7">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 sm:text-xs">
                        You are in Host mode
                    </p>

                    <h1 className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                        Open Customer mode for your personal recipes
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-stone-700">
                        Your Host workspace is for business work. Personal recipes and recipes shared by friends live in your Customer space, so switch modes to continue here.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            switchMode(
                                'customer',
                            )
                        }
                        className="focus-ring mt-4 rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-900"
                    >
                        Switch to Customer mode
                    </button>
                </section>
            </main>
        );
    }

    if (communityRecipeId) {
        return (
            <CommunityRecipeDetail
                communityRecipeId={
                    communityRecipeId
                }
            />
        );
    }

    return (
        <main className="page-shell pb-8 pt-2 sm:pb-10 sm:pt-3">
            <section className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#DCFCE7_0%,#FEF3C7_48%,#EDE9FE_100%)] p-4 shadow-sm sm:rounded-[30px] sm:p-6 lg:p-8">
                <div className="flex items-start gap-3 sm:gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-800 text-white sm:h-12 sm:w-12">
                        <Users size={21} />
                    </div>

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800 sm:text-xs">
                            Community · Personal recipes
                        </p>

                        <h1 className="mt-1 text-[25px] font-black tracking-tight text-stone-950 sm:text-4xl">
                            Your recipe space
                        </h1>

                        <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-stone-700 sm:text-sm sm:leading-6">
                            Keep your own recipes organised, open recipes friends share with you, and share selected recipes when you choose. Nothing here becomes public automatically.
                        </p>
                    </div>
                </div>

                <CommunityGuideCards
                    isAuthenticated={
                        true
                    }
                    onCreate={() =>
                        setTab(
                            'create',
                        )
                    }
                    onMyRecipes={() =>
                        setTab(
                            'mine',
                        )
                    }
                />

                <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                    {[
                        [
                            'mine',
                            'My recipes',
                        ],
                        [
                            'shared',
                            'Shared by friends',
                        ],
                        [
                            'create',
                            'Create recipe',
                        ],
                    ].map(
                        ([
                            value,
                            label,
                        ]) => (
                            <button
                                key={
                                    value
                                }
                                type="button"
                                onClick={() =>
                                    setTab(
                                        value,
                                    )
                                }
                                className={[
                                    'focus-ring rounded-full px-3.5 py-2 text-[11px] font-black transition sm:px-4 sm:py-2.5 sm:text-xs',
                                    tab ===
                                    value
                                        ? 'bg-stone-950 text-white shadow-sm'
                                        : 'border border-stone-950/10 bg-white/70 text-stone-800 hover:bg-white',
                                ].join(
                                    ' ',
                                )}
                            >
                                {label}
                            </button>
                        ),
                    )}
                </div>
            </section>

            {notice ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-100 p-4 text-sm font-bold text-emerald-900 sm:mt-5">
                    <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0"
                    />
                    {notice}
                </div>
            ) : null}

            {error ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 sm:mt-5">
                    <CircleAlert
                        size={18}
                        className="mt-0.5 shrink-0"
                    />
                    {error}
                </div>
            ) : null}

            {tab ===
            'mine' ? (
                <section className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-100/75 p-4 shadow-sm sm:mt-6 sm:rounded-[28px] sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-lg font-black text-stone-950 sm:text-xl">
                                My recipes
                            </h2>

                            <p className="mt-1 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">
                                Recipes you have saved for yourself. Open one anytime or share it with a friend when you are ready.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setTab(
                                    'create',
                                )
                            }
                            className="focus-ring w-fit rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-black text-white"
                        >
                            Create recipe
                        </button>
                    </div>

                    {loading ? (
                        <LoaderCircle className="mt-5 animate-spin text-emerald-700" />
                    ) : myRecipes.length ? (
                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                            {myRecipes.map(
                                (
                                    recipe,
                                ) => (
                                    <article
                                        key={
                                            recipe.id
                                        }
                                        className="rounded-2xl border border-emerald-200 bg-white/85 p-4 shadow-sm sm:p-5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                                                    {recipe.visibility ===
                                                    'friends'
                                                        ? 'Friends only'
                                                        : 'Private'}
                                                </span>

                                                <h3 className="mt-3 text-lg font-black text-stone-950">
                                                    {recipe.dish?.name ||
                                                        'My recipe'}
                                                </h3>

                                                <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-500">
                                                    {recipe.dish?.description ||
                                                        'A recipe saved in your personal EPANTRY collection.'}
                                                </p>
                                            </div>

                                            <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-800">
                                                {recipe.activeShareCount ||
                                                    0}{' '}
                                                shared
                                            </span>
                                        </div>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            <Link
                                                to={`/community/${encodeURIComponent(
                                                    recipe.id,
                                                )}`}
                                                className="focus-ring rounded-xl bg-stone-100 px-3 py-2 text-xs font-black text-stone-700"
                                            >
                                                Open recipe
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedShareRecipe(
                                                        recipe,
                                                    )
                                                }
                                                className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white"
                                            >
                                                <Share2 size={14} />
                                                Share with friend
                                            </button>
                                        </div>
                                    </article>
                                ),
                            )}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-emerald-300 bg-white/80 p-6 text-center sm:p-8">
                            <p className="text-sm font-black text-stone-700">
                                Your recipe space is empty right now. Create your first recipe to get started.
                            </p>
                        </div>
                    )}
                </section>
            ) : null}

            {tab ===
            'shared' ? (
                <section className="mt-4 rounded-[24px] border border-sky-200 bg-sky-100/75 p-4 shadow-sm sm:mt-6 sm:rounded-[28px] sm:p-6">
                    <h2 className="text-lg font-black text-stone-950 sm:text-xl">
                        Shared by friends
                    </h2>

                    <p className="mt-1 text-xs font-semibold leading-5 text-stone-600 sm:text-sm">
                        Recipes friends have chosen to share with your Customer account. Open one here whenever you want to cook it.
                    </p>

                    {loading ? (
                        <LoaderCircle className="mt-5 animate-spin text-sky-700" />
                    ) : sharedRecipes.length ? (
                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                            {sharedRecipes.map(
                                (
                                    item,
                                ) => (
                                    <Link
                                        key={
                                            item.share.id
                                        }
                                        to={`/community/${encodeURIComponent(
                                            item.recipe.id,
                                        )}`}
                                        className="focus-ring rounded-2xl border border-sky-200 bg-white/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                                    >
                                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-800">
                                            From {item.owner?.name ||
                                                'a friend'}
                                        </span>

                                        <h3 className="mt-3 text-lg font-black text-stone-950">
                                            {item.recipe.name}
                                        </h3>

                                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-500">
                                            {item.recipe.description ||
                                                'A recipe a friend shared with you.'}
                                        </p>

                                        <p className="mt-4 text-xs font-black text-sky-700">
                                            Open recipe →
                                        </p>
                                    </Link>
                                ),
                            )}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-sky-300 bg-white/80 p-6 text-center sm:p-8">
                            <p className="text-sm font-black text-stone-700">
                                Nothing has been shared with you yet. When a friend sends a recipe, it will appear here.
                            </p>
                        </div>
                    )}
                </section>
            ) : null}

            {tab ===
            'create' ? (
                <div className="mt-4 sm:mt-6">
                    <RecipeComposer
                        onCreated={() => {
                            setNotice(
                                'Recipe saved. Open My recipes whenever you want to view it or share it with a friend.',
                            );

                            setTab(
                                'mine',
                            );
                        }}
                    />
                </div>
            ) : null}

            {selectedShareRecipe ? (
                <ShareRecipePanel
                    recipe={
                        selectedShareRecipe
                    }
                    onClose={() =>
                        setSelectedShareRecipe(
                            null,
                        )
                    }
                    onChanged={
                        loadMine
                    }
                />
            ) : null}
        </main>
    );
  }
