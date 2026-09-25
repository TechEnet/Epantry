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
    forkCommunityRecipe,
    getCommunityErrorMessage,
    getCommunityRecipe,
    listCommunityRecipes,
    listMyCommunityRecipes,
    reviewCommunityRecipe,
    searchCommunityIngredients,
    submitCommunityRecipe,
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
  
                <label>
                    <span className="text-xs font-black text-stone-500">
                        Visibility
                    </span>
  
                    <select
                        value={
                            form.visibility
                        }
                        onChange={(
                            event,
                        ) =>
                            setForm(
                                (
                                    current,
                                ) => ({
                                    ...current,
  
                                    visibility:
                                        event.target.value,
                                }),
                            )
                        }
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
                    >
                        <option value="private">
                            Private
                        </option>
  
                        <option value="friends">
                            Friends only
                        </option>
  
                        <option value="public">
                            Public - moderation required
                        </option>
                    </select>
                </label>
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
                    ? 'Create adaptation with lineage'
                    : form.visibility ===
                        'public'
                        ? 'Create & send to moderation'
                        : 'Create Community Recipe'}
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
  
                        <button
                            type="button"
                            onClick={
                                shareRecipe
                            }
                            className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
                        >
                            <Share2
                                size={16}
                            />
  
                            Share recipe link
                        </button>
  
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
  
  export default function CommunityRecipesPage() {
    const {
        communityRecipeId,
    } =
        useParams();
  
    const {
        isAuthenticated,
        customerEnabled,
        hostEnabled,
        activeMode,
    } =
        useAuth();
  
    const [
        tab,
        setTab,
    ] =
        useState(
            'discover',
        );
  
    const [
        search,
        setSearch,
    ] =
        useState('');
  
    const [
        recipes,
        setRecipes,
    ] =
        useState([]);
  
    const [
        myRecipes,
        setMyRecipes,
    ] =
        useState([]);
  
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
        notice,
        setNotice,
    ] =
        useState('');
  
    const canContribute =
        isAuthenticated &&
        customerEnabled;
  
    const loadDiscover =
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
                        await listCommunityRecipes({
                            page:
                                1,
  
                            limit:
                                30,
  
                            search:
                                search.trim() ||
                                undefined,
                        });
  
                    setRecipes(
                        result?.recipes ||
                            [],
                    );
                } catch (
                    requestError
                ) {
                    setError(
                        getCommunityErrorMessage(
                            requestError,
                            'Unable to load Community Recipes.',
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                search,
            ],
        );
  
    const loadMine =
        useCallback(
            async () => {
                if (!canContribute) {
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
                            'Unable to load your Community Recipes.',
                        ),
                    );
                } finally {
                    setLoading(
                        false,
                    );
                }
            },
            [
                canContribute,
            ],
        );
  
    useEffect(
        () => {
            if (
                !isAuthenticated ||
                hostEnabled !== true ||
                activeMode !== 'host'
            ) {
                setLoading(false);
                return;
            }
  
            if (communityRecipeId) {
                return;
            }
  
            if (
                tab ===
                'mine'
            ) {
                loadMine();
            } else if (
                tab ===
                'discover'
            ) {
                loadDiscover();
            } else {
                setLoading(
                    false,
                );
            }
        },
        [
            communityRecipeId,
            tab,
            loadDiscover,
            loadMine,
            isAuthenticated,
            hostEnabled,
            activeMode,
        ],
    );
  
    const publicCards =
        useMemo(
            () =>
                recipes,
            [
                recipes,
            ],
        );
  
    if (
        !isAuthenticated ||
        hostEnabled !== true ||
        activeMode !== 'host'
    ) {
        return null;
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
  
    async function submitMine(
        recipeId,
    ) {
        setNotice(
            '',
        );
  
        setError(
            '',
        );
  
        try {
            await submitCommunityRecipe(
                recipeId,
                'Ready for public Community moderation.',
            );
  
            setNotice(
                'Recipe submitted. Public discovery remains blocked until moderation and M08 approval are complete.',
            );
  
            await loadMine();
        } catch (
            requestError
        ) {
            setError(
                getCommunityErrorMessage(
                    requestError,
                    'Unable to submit this recipe.',
                ),
            );
        }
    }
  
    return (
        <main className="page-shell py-8 sm:py-10">
            <section className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5 lg:gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white lg:h-12 lg:w-12 lg:rounded-2xl">
                                <Users
                                    size={20}
                                    className="lg:h-[22px] lg:w-[22px]"
                                />
                            </div>
  
                            <div className="min-w-0">
                                <h1 className="whitespace-nowrap text-[24px] font-black leading-none tracking-tight text-stone-950 lg:text-4xl">
                                    Community Recipes
                                </h1>
                            </div>
                        </div>
  
                        <p className="mt-3 max-w-[300px] text-[11px] font-medium leading-[1.45] text-stone-600 lg:mt-4 lg:max-w-3xl lg:text-sm lg:leading-7">
                            Create and adapt recipes freely. EPANTRY keeps creator notes separate from verified Food Intelligence.
                        </p>
                    </div>
  
                    <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto lg:justify-start">
                        {canContribute ? (
                            <Link
                                to="/creator-studio"
                                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-black text-stone-600 hover:border-emerald-300 hover:text-emerald-800 lg:gap-2 lg:px-4 lg:py-2.5 lg:text-xs"
                            >
                                <ChefHat
                                    size={15}
                                />
  
                                Creator Studio
                            </Link>
                        ) : null}
  
                        <Link
                            to="/learn"
                            className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-black text-stone-600 hover:border-emerald-300 hover:text-emerald-800 lg:gap-2 lg:px-4 lg:py-2.5 lg:text-xs"
                        >
                            <BookOpen
                                size={15}
                            />
  
                            Learn / Pro
                        </Link>
                    </div>
                </div>
  
                <div className="mt-7 flex flex-wrap gap-2">
                    {[
                        [
                            'discover',
                            'Discover',
                        ],
  
                        ...(canContribute
                            ? [
                                [
                                    'mine',
                                    'My recipes',
                                ],
  
                                [
                                    'create',
                                    'Create',
                                ],
                            ]
                            : []),
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
                                    'focus-ring rounded-full px-4 py-2 text-xs font-black transition',
  
                                    tab ===
                                    value
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                                ].join(
                                    ' ',
                                )}
                            >
                                {
                                    label
                                }
                            </button>
                        ),
                    )}
                </div>
            </section>
  
            {error ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                    <CircleAlert
                        size={18}
                        className="mt-0.5 shrink-0"
                    />
  
                    {error}
                </div>
            ) : null}
  
            {notice ? (
                <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                    {notice}
                </div>
            ) : null}
  
            {tab ===
            'discover' ? (
                <>
                    <div className="mt-6 flex rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
                        <Search
                            size={18}
                            className="ml-3 mt-3 text-stone-400"
                        />
  
                        <input
                            value={
                                search
                            }
                            onChange={(
                                event,
                            ) =>
                                setSearch(
                                    event.target.value,
                                )
                            }
                            onKeyDown={(
                                event,
                            ) => {
                                if (
                                    event.key ===
                                    'Enter'
                                ) {
                                    loadDiscover();
                                }
                            }}
                            placeholder="Search community dishes, cuisine or tags"
                            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-semibold outline-none"
                        />
  
                        <button
                            type="button"
                            onClick={
                                loadDiscover
                            }
                            className="focus-ring rounded-xl bg-stone-950 px-4 text-xs font-black text-white"
                        >
                            Search
                        </button>
                    </div>
  
                    {loading ? (
                        <div className="grid min-h-72 place-items-center">
                            <LoaderCircle
                                className="animate-spin text-emerald-700"
                            />
                        </div>
                    ) : publicCards.length ? (
                        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {publicCards.map(
                                (
                                    item,
                                ) => (
                                    <Link
                                        key={
                                            item.communityRecipe.id
                                        }
                                        to={`/community/${encodeURIComponent(
                                            item.communityRecipe.id,
                                        )}`}
                                        className="focus-ring overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                                    >
                                        <div className="aspect-[16/9] bg-stone-100">
                                            {item.dish.heroImageUrl ? (
                                                <img
                                                    src={
                                                        item.dish.heroImageUrl
                                                    }
                                                    alt={
                                                        item.dish.name
                                                    }
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="grid h-full place-items-center text-stone-300">
                                                    <ChefHat
                                                        size={34}
                                                    />
                                                </div>
                                            )}
                                        </div>
  
                                        <div className="p-5">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                                                    Community contributed
                                                </span>
  
                                                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700">
                                                    <Star
                                                        size={13}
                                                        className="fill-current"
                                                    />
  
                                                    {item.ratings.average ?? '—'}
                                                </span>
                                            </div>
  
                                            <h2 className="mt-3 text-lg font-black text-stone-950">
                                                {
                                                    item.dish.name
                                                }
                                            </h2>
  
                                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">
                                                {item.dish.description ||
                                                    'Community recipe'}
                                            </p>
  
                                            <div className="mt-4 flex items-center justify-between text-xs font-bold text-stone-500">
                                                <span>
                                                    {item.creator?.displayName ||
                                                        'Community creator'}
                                                </span>
  
                                                <span className="inline-flex items-center gap-1">
                                                    <Eye
                                                        size={13}
                                                    />
  
                                                    View
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ),
                            )}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-[26px] border border-dashed border-stone-300 bg-white p-10 text-center">
                            <ChefHat
                                size={34}
                                className="mx-auto text-stone-300"
                            />
  
                            <p className="mt-3 text-sm font-black text-stone-700">
                                No public Community Recipes found
                            </p>
                        </div>
                    )}
                </>
            ) : null}
  
            {tab ===
                'mine' &&
            canContribute ? (
                <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-black text-stone-950">
                        My Community Recipes
                    </h2>
  
                    {loading ? (
                        <LoaderCircle
                            className="mt-5 animate-spin text-emerald-700"
                        />
                    ) : (
                        <div className="mt-5 space-y-3">
                            {myRecipes.map(
                                (
                                    recipe,
                                ) => (
                                    <div
                                        key={
                                            recipe.id
                                        }
                                        className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-black text-stone-900">
                                                Recipe Version {recipe.recipeVersionId.slice(-6)}
                                            </p>
  
                                            <p className="mt-1 text-xs font-semibold text-stone-500">
                                                {recipe.visibility} · {recipe.status} · moderation {recipe.moderationState}
                                            </p>
                                        </div>
  
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/community/${encodeURIComponent(
                                                    recipe.id,
                                                )}`}
                                                className="focus-ring rounded-xl bg-stone-100 px-3 py-2 text-xs font-black text-stone-600"
                                            >
                                                Open
                                            </Link>
  
                                            {recipe.status ===
                                            'active' ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        submitMine(
                                                            recipe.id,
                                                        )
                                                    }
                                                    className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                                                >
                                                    <Send
                                                        size={14}
                                                    />
  
                                                    Submit public
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    )}
                </section>
            ) : null}
  
            {tab ===
                'create' &&
            canContribute ? (
                <div className="mt-6">
                    <RecipeComposer
                        onCreated={() => {
                            setNotice(
                                'Community Recipe created. Public recipes remain moderation-gated; private/friends recipes are not broadly discoverable.',
                            );
  
                            setTab(
                                'mine',
                            );
                        }}
                    />
                </div>
            ) : null}
  
            {!isAuthenticated ? (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-5">
                    <Heart
                        size={20}
                        className="mt-0.5 shrink-0 text-emerald-700"
                    />
  
                    <p className="text-sm leading-6 text-stone-600">
                        Browse is public. Sign in as a Customer to create, adapt, review or follow creators.
                    </p>
                </div>
            ) : null}
        </main>
    );
  }