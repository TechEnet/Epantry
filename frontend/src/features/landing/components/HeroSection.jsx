import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CookingPot, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../auth/context/AuthContext";
import { listOrders } from "../../commerce/services/commerce.service";
import { listPublicRecipes } from "../../recipes/services/recipe.service";
import { getRecipeFoodIntelligence } from "../../foodIntelligence/services/foodIntelligence.service";
import {
  RECIPE_VIEWED_EVENT,
  getRecentRecipeViews,
} from "../../recipes/utils/recipeEngagement";
import { apiClient } from "../../../api/apiClient";
import { publicImageProps } from "../../../lib/publicMediaDelivery";
import {
  normalizeName,
  normalizeRecipeSources,
  selectHeroRecipes,
} from "../utils/heroRecipeSelection";
import { useLandingFeaturedQuery } from "../hooks/useLandingFeaturedQuery";

const LANDING_COOK_QUERY_KEY = "epantry-cook-today-landing-input";
const ROTATION_LIMIT = 4;
const ROTATION_DELAYS = { main: 4200, drink: 5000, new: 5600 };
const COMMON_WORDS = new Set([
  "recipe",
  "homemade",
  "the",
  "with",
  "and",
  "from",
  "fresh",
  "easy",
  "quick",
  "food",
  "dish",
  "style",
]);

// Match only actual, published dietary declarations. Never infer vegetarian
// status from a recipe name or from an empty dietary field.
function declaredDietaryKind(values) {
  const labels = values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().toLowerCase().replace(/[_-]+/g, " "));
  if (
    labels.some((value) =>
      [
        "non veg",
        "non vegetarian",
        "nonveg",
        "eggitarian",
        "eggetarian",
      ].includes(value)
    )
  )
    return "nonveg";
  if (labels.some((value) => ["veg", "vegetarian", "vegan"].includes(value)))
    return "veg";
  return "unknown";
}

function publicRecipeDietaryKind(item) {
  return declaredDietaryKind([
    item?.dish?.dietaryType,
    item?.recipe?.dietaryType,
    item?.dish?.dietaryClassification,
    item?.recipe?.dietaryClassification,
    ...(Array.isArray(item?.dish?.tags) ? item.dish.tags : []),
    ...(Array.isArray(item?.recipe?.tags) ? item.recipe.tags : []),
  ]);
}

function intelligenceDietaryKind(intelligence) {
  const labels = (
    Array.isArray(intelligence?.dietary) ? intelligence.dietary : []
  )
    .filter(
      (entry) =>
        entry?.eligible === true ||
        String(entry?.status || "").toLowerCase() === "eligible"
    )
    .map((entry) => entry?.key);
  return declaredDietaryKind(labels);
}

// Display only a duration explicitly recorded in the published recipe data.
// Missing, default-zero or invalid fields must never become an invented time.
function verifiedMinutes(...values) {
  if (
    !values.length ||
    values.some(
      (value) =>
        value === null ||
        value === undefined ||
        (typeof value === "string" && !value.trim())
    )
  )
    return null;
  const minutes = values.map(Number);
  if (minutes.some((value) => !Number.isSafeInteger(value) || value < 0))
    return null;
  const total = minutes.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

// Some catalog entries were created by the development seed with a blanket
// 10-minute preparation + 20-minute cooking duration. Those values are test
// fixtures, not timings verified for each dish, so never advertise them.
function isDevelopmentSeedRecipe(item) {
  return /\bdevelopment seed\b/i.test(String(item?.recipe?.source?.name || ""));
}

function publishedTimestamp(value) {
  const stamp = Date.parse(value || "");
  return Number.isFinite(stamp) ? stamp : 0;
}

function recipeKind(metadata) {
  const values = metadata.map((value) => normalizeName(value)).filter(Boolean);
  const tokens = new Set(values.flatMap((value) => value.split(" ")));
  if (
    [
      "drink",
      "drinks",
      "beverage",
      "beverages",
      "smoothie",
      "smoothies",
      "mocktail",
      "mocktails",
      "cocktail",
      "cocktails",
      "juice",
      "juices",
      "shake",
      "shakes",
      "tea",
      "coffee",
      "latte",
      "lemonade",
      "lassi",
      "milkshake",
      "milkshakes",
      "sherbet",
      "sharbat",
      "soda",
      "sodas",
      "kombucha",
    ].some((key) => tokens.has(key))
  )
    return "drink";
  if (
    [
      "sweet",
      "sweets",
      "dessert",
      "desserts",
      "mithai",
      "pudding",
      "puddings",
      "cake",
      "cakes",
      "pastry",
      "pastries",
      "bakery",
      "halwa",
      "kheer",
      "jalebi",
      "barfi",
      "brownie",
      "brownies",
    ].some((key) => tokens.has(key))
  )
    return "sweet";
  return "meal";
}

function recipeWords(value) {
  return normalizeName(value)
    .split(" ")
    .filter((word) => word.length > 2 && !COMMON_WORDS.has(word));
}

// Compact, consistent outlined food icons instead of OS-dependent emoji.
// Matches the circular broccoli/drumstick thumb from the supplied video.
function DietaryThumbIcon({ kind }) {
  // Standard Indian food labels: green dot for vegetarian, brown-red
  // triangle for non-vegetarian. The original circular switch motion stays.
  const isVeg = kind === "veg";
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.7"
        y="2.7"
        width="18.6"
        height="18.6"
        rx="1.6"
        stroke={isVeg ? "#14834B" : "#A83C32"}
        strokeWidth="2.1"
      />
      {isVeg ? (
        <circle cx="12" cy="12" r="5.3" fill="#14834B" />
      ) : (
        <path d="M12 6.4 18 16.9H6L12 6.4Z" fill="#A83C32" />
      )}
    </svg>
  );
}

function RecipePhoto({ recipe, className = "", loading = "lazy" }) {
  if (!recipe?.image) {
    return (
      <div
        className={`flex items-center justify-center bg-[#E6EADD] text-[#557365] ${className}`}
        aria-label="Recipe photo not available"
      >
        <CookingPot className="h-9 w-9" aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      {...publicImageProps(recipe.image, {
        sizes:
          loading === "eager"
            ? "(max-width: 767px) 100vw, 54vw"
            : "(max-width: 640px) 42vw, 96px",
        priority: loading === "eager",
      })}
      alt={recipe.name}
      className={`object-cover ${className}`}
    />
  );
}

function useRotatingIndex(items, delay, reduceMotion, paused) {
  const [index, setIndex] = useState(0);
  const keys = items.map((item) => item.id).join("|");

  useEffect(() => {
    setIndex(0);
  }, [keys]);

  useEffect(() => {
    if (reduceMotion || paused || items.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((current) => (current + 1) % items.length);
    }, delay);
    return () => window.clearInterval(timer);
  }, [keys, items.length, delay, reduceMotion, paused]);

  return items.length ? items[index % items.length] : null;
}

// This is an editorial ranking from published/featured records, NOT a claim of
// measured platform-wide popularity. The existing public API has no public
// recipe-view-count leaderboard. Account-specific signals are real recent views
// and previously matched orders, read only for signed-in Customers.
function rankRecipes(
  recipes,
  { featuredIds, recentViews, priorityIds, personalized, allRecipes = recipes }
) {
  const recentIds = recentViews.map((view) =>
    view.listingId ? `host:${view.listingId}` : `recipe:${view.slug}`
  );
  const viewedRecipes = recentIds
    .map((id) => allRecipes.find((item) => item.id === id))
    .filter(Boolean);
  const viewedWords = new Set(
    viewedRecipes.slice(0, 5).flatMap((item) => recipeWords(item.name))
  );
  const viewedCuisines = new Set(
    viewedRecipes
      .slice(0, 5)
      .map((item) => normalizeName(item.cuisine))
      .filter(Boolean)
  );
  const now = Date.now();

  return [...recipes].sort((a, b) => {
    const score = (recipe) => {
      const newest = publishedTimestamp(recipe.publishedAt);
      const ageDays = newest
        ? Math.max(0, (now - newest) / 86400000)
        : Infinity;
      let total =
        (recipe.image ? 18 : 0) +
        (featuredIds.has(recipe.id) ? 26 : 0) +
        (Number.isFinite(ageDays) ? Math.max(0, 18 - ageDays / 7) : 0);
      if (personalized) {
        const viewedIndex = recentIds.indexOf(recipe.id);
        if (viewedIndex >= 0) total += Math.max(65, 160 - viewedIndex * 15);
        if (viewedCuisines.has(normalizeName(recipe.cuisine))) total += 40;
        total +=
          Math.min(
            5,
            recipeWords(recipe.name).filter((word) => viewedWords.has(word))
              .length
          ) * 12;
        const priorityIndex = priorityIds.indexOf(recipe.id);
        if (priorityIndex >= 0) total += Math.max(5, 45 - priorityIndex * 5);
      }
      return total;
    };
    return (
      score(b) - score(a) ||
      publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt) ||
      a.id.localeCompare(b.id)
    );
  });
}

function SmallRecipeSlot({ item, slot, isLoading, reduceMotion }) {
  const title = slot === "drink" ? "DRINKS TO TRY" : "RECIPE DISCOVERY";
  const emptyText =
    slot === "drink"
      ? "No published drinks yet."
      : "Published recipes will appear here.";
  return (
    <div className="epantry-hero-related-slot flex min-w-0 flex-col border-t border-[#D6DED4] pt-2.5">
      {item ? (
        // The row itself never moves. Only its contents dissolve, without
        // jumping vertically or leaving a blank gap between suggestions.
        <div className="epantry-hero-related-content relative min-h-[72px] flex-1 overflow-hidden sm:min-h-[76px]">
          <AnimatePresence initial={false}>
            <motion.div
              key={item.id}
              className="absolute inset-0"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.55,
                ease: "easeInOut",
              }}
            >
              <Link
                to={item.path}
                className="focus-ring group flex min-w-0 items-center gap-3 rounded-[8px] transition-colors hover:text-[#173F35]"
              >
                <RecipePhoto
                  recipe={item}
                  className="h-[58px] w-[58px] shrink-0 rounded-[9px] sm:h-[65px] sm:w-[65px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[.045em] text-[#69796F]">
                    {title}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[13px] font-bold leading-[1.3] text-[#202421] group-hover:underline sm:text-[14px] lg:text-[15px]">
                    {item.name}
                  </span>
                </span>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex min-h-[72px] flex-1 items-center gap-2 text-[#53675C]">
          <CookingPot size={20} className="shrink-0" aria-hidden="true" />
          <span className="text-[13px] leading-5">
            {isLoading ? "Checking published recipes…" : emptyText}
          </span>
        </div>
      )}
    </div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [selectedDiet, setSelectedDiet] = useState("veg");
  const [cookInput, setCookInput] = useState("");
  const [cookInputError, setCookInputError] = useState("");
  const [intelligenceById, setIntelligenceById] = useState({});
  const [checkingDietary, setCheckingDietary] = useState(false);
  const [paused, setPaused] = useState(false);
  const checkedDietaryIds = useRef(new Set());

  const { user, isAuthenticated, customerEnabled, isBootstrapping } = useAuth();
  const accountId = isAuthenticated
    ? String(user?.id || user?._id || user?.uid || "")
    : "";
  const personalize =
    !isBootstrapping &&
    isAuthenticated &&
    customerEnabled === true &&
    Boolean(accountId);
  const [recentViews, setRecentViews] = useState([]);

  useEffect(() => {
    if (isBootstrapping) return undefined;
    const refresh = () =>
      setRecentViews(personalize ? getRecentRecipeViews(accountId) : []);
    refresh();
    window.addEventListener(RECIPE_VIEWED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RECIPE_VIEWED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [accountId, personalize, isBootstrapping]);

  const { data: featuredData, isLoading: featuredLoading } =
    useLandingFeaturedQuery();
  const { data: publicData, isLoading: publicLoading } = useQuery({
    queryKey: ["landing", "hero", "published-recipes"],
    queryFn: async () => {
      const first = await listPublicRecipes({ page: 1, limit: 50 });
      if (Number(first?.pagination?.pages || 0) <= 1) return first;
      const second = await listPublicRecipes({ page: 2, limit: 50 });
      return {
        ...first,
        recipes: [...(first?.recipes || []), ...(second?.recipes || [])],
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: approvedData, isLoading: approvedLoading } = useQuery({
    queryKey: ["landing", "hero", "approved-food-listings"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/public/host-listings");
        return response?.data?.data || { listings: [] };
      } catch (error) {
        if (error?.response?.status === 404) return { listings: [] };
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const { data: orderData } = useQuery({
    queryKey: ["landing", "hero", "paid-order-recipe-matches", accountId],
    queryFn: () => listOrders({ page: 1, limit: 30 }),
    enabled: personalize,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  const featuredRecipes = useMemo(
    () => (Array.isArray(featuredData?.recipes) ? featuredData.recipes : []),
    [featuredData]
  );
  const publicRecipes = useMemo(
    () => (Array.isArray(publicData?.recipes) ? publicData.recipes : []),
    [publicData]
  );
  const hostListings = useMemo(
    () => (Array.isArray(approvedData?.listings) ? approvedData.listings : []),
    [approvedData]
  );

  const catalog = useMemo(
    () =>
      normalizeRecipeSources({
        publicRecipes,
        featuredRecipes,
        hostListings,
      }),
    [publicRecipes, featuredRecipes, hostListings]
  );

  const personalizedRecipes = useMemo(
    () =>
      selectHeroRecipes({
        catalog,
        orders:
          personalize && Array.isArray(orderData?.orders)
            ? orderData.orders
            : [],
        recentViews: personalize ? recentViews : [],
        maxItems: 30,
      }),
    [catalog, orderData, recentViews, personalize]
  );

  const recipeDetails = useMemo(() => {
    const details = new Map();
    for (const item of publicRecipes) {
      const slug = String(item?.dish?.slug || "").trim();
      if (!slug) continue;
      details.set(`recipe:${slug}`, {
        diet: publicRecipeDietaryKind(item),
        recipeVersionId: String(item?.recipe?.id || ""),
        description: item?.dish?.description || item?.recipe?.description || "",
        minutes: isDevelopmentSeedRecipe(item)
          ? null
          : verifiedMinutes(
              item?.recipe?.preparationTimeMinutes,
              item?.recipe?.cookingTimeMinutes
            ),
        servings:
          Number(item?.recipe?.baseServings) > 0
            ? Number(item.recipe.baseServings)
            : null,
        kind: recipeKind([
          item?.dish?.course,
          item?.recipe?.course,
          item?.dish?.mealType,
          item?.recipe?.mealType,
          item?.dish?.category,
          item?.recipe?.category,
          ...(Array.isArray(item?.dish?.tags) ? item.dish.tags : []),
          ...(Array.isArray(item?.recipe?.tags) ? item.recipe.tags : []),
          item?.dish?.name,
          item?.recipe?.title,
        ]),
      });
    }
    for (const item of featuredRecipes) {
      const slug = String(item?.slug || "").trim();
      if (!slug || details.has(`recipe:${slug}`)) continue;
      details.set(`recipe:${slug}`, {
        // /landing/featured uses dietaryType for course/difficulty; it cannot
        // prove Veg/Non-Veg classification for these legacy cards.
        diet: "unknown",
        description: item?.description || "",
        // Featured totalTime is a derived summary with no source metadata;
        // the primary /recipes response supplies source-backed timings.
        minutes: null,
        servings: Number(item?.servings) > 0 ? Number(item.servings) : null,
        kind: recipeKind([
          item?.cuisine,
          item?.course,
          item?.name,
          item?.title,
        ]),
      });
    }
    for (const item of hostListings) {
      if (!item?.id) continue;
      details.set(`host:${item.id}`, {
        diet: declaredDietaryKind([item?.dietary]),
        description: item?.description || "",
        minutes: verifiedMinutes(
          item?.preparationMinutes,
          item?.cookingMinutes
        ),
        servings:
          Number(item?.baseServings) > 0 ? Number(item.baseServings) : null,
        kind: recipeKind([item?.category, item?.type, item?.title]),
      });
    }
    return details;
  }, [publicRecipes, featuredRecipes, hostListings]);

  // Only one bounded read-only Food Intelligence batch. Shared results are
  // reused for both switch modes and every carousel; no writes to the catalog.
  const unresolvedIds = useMemo(() => {
    const ids = [];
    const prioritized = personalizedRecipes.concat(
      catalog.filter(
        (item) =>
          !personalizedRecipes.some((priority) => priority.id === item.id)
      )
    );
    // Bounded and balanced: verify up to 8 meal, 8 drink and 8 sweet
    // versions, instead of making a request for every published recipe.
    const firstPass = ["meal", "drink", "sweet"].flatMap((kind) =>
      prioritized
        .filter((item) => recipeDetails.get(item.id)?.kind === kind)
        .slice(0, 8)
    );
    for (const recipe of firstPass.concat(prioritized)) {
      if (ids.length >= 24) break;
      const details = recipeDetails.get(recipe.id);
      const id = details?.recipeVersionId;
      if (id && details?.diet === "unknown" && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [personalizedRecipes, catalog, recipeDetails]);
  const unresolvedKey = unresolvedIds.join("|");

  useEffect(() => {
    const pending = unresolvedIds.filter(
      (id) => !checkedDietaryIds.current.has(id)
    );
    if (!pending.length) {
      setCheckingDietary(false);
      return undefined;
    }
    let cancelled = false;
    setCheckingDietary(true);
    async function verifyDietary() {
      for (let index = 0; index < pending.length; index += 3) {
        if (cancelled) return;
        const batch = pending.slice(index, index + 3);
        const settled = await Promise.allSettled(
          batch.map((id) => getRecipeFoodIntelligence(id))
        );
        if (cancelled) return;
        const results = {};
        settled.forEach((result, position) => {
          checkedDietaryIds.current.add(batch[position]);
          results[batch[position]] =
            result.status === "fulfilled" ? result.value : null;
        });
        setIntelligenceById((current) => ({ ...current, ...results }));
      }
      if (!cancelled) setCheckingDietary(false);
    }
    void verifyDietary();
    return () => {
      cancelled = true;
    };
  }, [unresolvedKey]);

  const recipes = useMemo(() => {
    const hostShared = new Set(
      hostListings
        .filter((item) => item?.shareRecipe === true)
        .map((item) => `host:${item.id}`)
    );
    return catalog
      .filter(
        (item) => item.id.startsWith("recipe:") || hostShared.has(item.id)
      )
      .map((item) => {
        const details = recipeDetails.get(item.id) || {};
        const diet =
          details.diet === "unknown" && details.recipeVersionId
            ? intelligenceDietaryKind(intelligenceById[details.recipeVersionId])
            : details.diet || "unknown";
        return { ...item, ...details, diet, kind: details.kind || "meal" };
      });
  }, [catalog, recipeDetails, intelligenceById, hostListings]);

  const displayed = useMemo(() => {
    const eligible = recipes.filter((recipe) => recipe.diet === selectedDiet);
    const featuredIds = new Set(
      featuredRecipes.map((item) => `recipe:${item.slug}`)
    );
    const priorityIds = personalizedRecipes.map((item) => item.id);
    const rank = (items) =>
      rankRecipes(items, {
        featuredIds,
        recentViews,
        priorityIds,
        personalized: personalize,
        allRecipes: recipes,
      });

    // Only the main course and fresh recipe recommendations depend on the
    // Veg/Non-Veg switch. Drinks are a shared discovery rail in BOTH modes,
    // so changing to Non-Veg never makes existing drinks disappear.
    const main = rank(eligible.filter((item) => item.kind === "meal")).slice(
      0,
      ROTATION_LIMIT
    );
    const drink = rank(recipes.filter((item) => item.kind === "drink")).slice(
      0,
      ROTATION_LIMIT
    );

    // New approved Host recipe shares take priority when they arrive; until
    // then show already published recipes. Never leave the slot empty merely
    // because every eligible recipe is also in the main carousel.
    const otherRecipes = eligible.filter((item) => item.kind !== "drink");
    const latestFirst = (a, b) =>
      publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt) ||
      a.id.localeCompare(b.id);
    const newestPublished = [...otherRecipes].sort(latestFirst);
    // A newly approved Host listing has approvedAt as publishedAt and rises to
    // the top automatically. Before another listing arrives, the currently
    // approved recipe pool remains available as a stable fallback.
    const alternatives = newestPublished.filter(
      (item) => !main.some((mainItem) => mainItem.id === item.id)
    );
    const freshest = newestPublished[0];
    const hasNewHost =
      freshest?.id.startsWith("host:") &&
      publishedTimestamp(freshest.publishedAt) > 0;
    const source = hasNewHost
      ? newestPublished
      : alternatives.length
      ? alternatives
      : newestPublished;
    const rankedNew =
      personalize && recentViews.length ? rank(source.slice(0, 12)) : source;
    // A newly approved Host recipe stays in the fresh rail even when recent
    // views would otherwise push it outside the top four recommendations.
    const newest = (
      hasNewHost &&
      !rankedNew
        .slice(0, ROTATION_LIMIT)
        .some((item) => item.id === freshest.id)
        ? [freshest, ...rankedNew.filter((item) => item.id !== freshest.id)]
        : rankedNew
    ).slice(0, ROTATION_LIMIT);

    // If no alternate recipe exists, the one approved available recipe remains
    // visible until another Host or public recipe is published.
    return { main, drink, new: newest };
  }, [
    recipes,
    selectedDiet,
    featuredRecipes,
    personalizedRecipes,
    recentViews,
    personalize,
  ]);

  const mainRecipe = useRotatingIndex(
    displayed.main,
    ROTATION_DELAYS.main,
    shouldReduceMotion,
    paused
  );
  const drinkRecipe = useRotatingIndex(
    displayed.drink,
    ROTATION_DELAYS.drink,
    shouldReduceMotion,
    paused
  );
  const newRecipe = useRotatingIndex(
    displayed.new,
    ROTATION_DELAYS.new,
    shouldReduceMotion,
    paused
  );
  const catalogLoading =
    featuredLoading || publicLoading || approvedLoading || checkingDietary;

  const handleCookTodaySubmit = (event) => {
    event.preventDefault();
    const query = cookInput.trim();
    if (!query) {
      setCookInputError("Enter a dish or ingredient to get started.");
      return;
    }
    setCookInputError("");
    try {
      window.sessionStorage.setItem(LANDING_COOK_QUERY_KEY, query);
    } catch {
      /* route state is enough */
    }
    navigate("/cook-today", { state: { landingCookQuery: query } });
  };

  return (
    <motion.section
      aria-label="Discover recipes, drinks and food ideas"
      className="epantry-recipe-hero relative isolate w-full overflow-hidden border-b border-[#DDE4DA] bg-[#F7F6F2] text-[#202421]"
      initial={false}
      animate={{
        backgroundColor: selectedDiet === "veg" ? "#F2F6F0" : "#F9F0EB",
      }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: "easeInOut" }}
    >
      <style>{`
        .epantry-recipe-hero { font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif; }
        .epantry-recipe-hero .epantry-hero-title {
          font-size: clamp(40px, 4.5vw, 68px) !important;
          line-height: 1.06 !important;
          letter-spacing: -.051em !important;
          font-weight: 800 !important;
          text-transform: none !important;
        }
        .epantry-recipe-hero .epantry-hero-recipe-title {
          font-size: clamp(18px, 1.65vw, 23px) !important;
          line-height: 1.18 !important;
          letter-spacing: -.025em !important;
          font-weight: 750 !important;
          text-transform: none !important;
        }
        /* Desktop: the three annotated areas have independent, predictable
           geometry. A: full recipe image, B: heading/search/links, C: two
           complete suggestion rows. Never let A consume C's space. */
        @media (min-width: 768px) {
          .epantry-recipe-hero { height: 100svh; min-height: 0; }
          .epantry-hero-shell {
            box-sizing: border-box;
            display: grid;
            grid-template-rows: 40px minmax(0, 1fr);
            row-gap: clamp(9px, 1.3svh, 14px);
            height: 100%;
            min-height: 0;
            padding-top: calc(70px + clamp(10px, 1.6svh, 16px));
            padding-bottom: clamp(12px, 2svh, 20px);
          }
          .epantry-hero-toggle-row { margin-bottom: 0; align-items: center; }
          .epantry-hero-layout {
            display: grid;
            grid-template-columns: minmax(0, .94fr) minmax(0, 1.06fr);
            column-gap: clamp(28px, 4.6vw, 78px);
            min-height: 0;
            height: 100%;
            align-items: stretch;
          }
          /* B: align near the start of the recipe composition, not at the
             bottom or vertically centred inside an oversized grid cell. */
          .epantry-hero-copy {
            align-self: start;
            margin-top: clamp(28px, 5.2svh, 52px);
            padding-top: 0;
          }
          /* A + C: centred as one unit. Height stays inside the viewport and
             the mini-card row gets its own space regardless of image size. */
          .epantry-hero-feature-column {
            display: flex;
            flex-direction: column;
            flex-wrap: nowrap;
            justify-content: center;
            align-self: stretch;
            min-height: 0;
            height: 100%;
            gap: clamp(10px, 1.4svh, 14px);
          }
          .epantry-hero-visual {
            display: block;
            flex: 0 0 clamp(290px, 51svh, 465px);
            width: 100%;
            height: clamp(290px, 51svh, 465px) !important;
            min-height: 0;
          }
          .epantry-hero-related {
            flex: 0 0 clamp(98px, 12svh, 112px);
            height: clamp(98px, 12svh, 112px);
            min-height: 0;
            margin-top: 0;
            align-items: stretch;
          }
          .epantry-hero-related-slot { height: 100%; min-height: 0; }
          .epantry-hero-related-content { min-height: 0; }
        }
        @media (min-width: 768px) and (max-width: 1100px) {
          .epantry-recipe-hero .epantry-hero-title { font-size: clamp(36px, 4.5vw, 54px) !important; }
          .epantry-hero-layout { column-gap: clamp(20px, 3vw, 34px); }
        }
        @media (max-width: 767px) {
          /* The landing navbar is FIXED and 60px tall on mobile. Keep the
             entire hero (including both suggestions) within one small
             viewport; don't add 100svh worth of content under the navbar. */
          .epantry-recipe-hero {
            box-sizing: border-box;
            height: 100svh !important;
            min-height: 0 !important;
            max-height: 100svh;
          }
          .epantry-hero-shell {
            box-sizing: border-box;
            height: 100%;
            min-height: 0;
            padding-top: 68px;
            /* Reserve room for the existing floating Why EPANTRY control. */
            padding-bottom: max(58px, calc(env(safe-area-inset-bottom, 0px) + 52px));
          }
          .epantry-hero-toggle-row {
            flex: 0 0 auto;
            margin: 0 0 5px;
          }
          .epantry-hero-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr);
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
            gap: clamp(7px, 1.25svh, 12px);
            align-items: stretch;
          }
          .epantry-hero-copy {
            align-self: start;
            min-width: 0;
            margin: 0;
          }
          .epantry-hero-copy > p:first-child { font-size: 11px !important; line-height: 1.3; }
          .epantry-recipe-hero .epantry-hero-title {
            margin-top: 7px !important;
            font-size: clamp(29px, 8.1vw, 40px) !important;
            line-height: 1.055 !important;
          }
          .epantry-hero-copy form { margin-top: 11px; }
          .epantry-hero-copy form > div:first-child {
            min-height: 44px;
            padding-block: 3px;
          }
          .epantry-hero-copy form button { min-height: 35px; padding-inline: 11px; }
          .epantry-hero-copy > div:last-child { margin-top: 7px; font-size: 13px; }

          .epantry-hero-feature-column {
            display: grid;
            grid-template-rows: minmax(0, 1fr) 152px;
            min-height: 0;
            height: 100%;
            align-self: stretch;
            gap: 7px;
          }
          /* Image receives exactly the height left after the small cards;
             the 295px/345px Tailwind fallback is for other breakpoints. */
          .epantry-hero-visual {
            width: 100%;
            height: 100% !important;
            min-height: 0;
            max-height: none;
          }
          .epantry-hero-visual .absolute.bottom-3.right-3 {
            bottom: 8px;
            right: 8px;
            width: min(73%, 225px);
            padding: 9px;
          }
          .epantry-hero-visual .absolute.bottom-3.right-3 > p:first-child {
            font-size: 10px;
            line-height: 1.25;
          }
          .epantry-recipe-hero .epantry-hero-recipe-title {
            font-size: clamp(15px, 3.7vw, 18px) !important;
            margin-top: 4px;
            margin-bottom: 4px;
          }
          .epantry-hero-visual .absolute.bottom-3.right-3 > div { margin-bottom: 5px; }
          .epantry-hero-visual .absolute.bottom-3.right-3 > a {
            min-height: 31px;
            padding: 6px 8px;
            font-size: 12px;
          }
          .epantry-recipe-hero .epantry-hero-related {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: repeat(2, minmax(0, 1fr));
            min-height: 0;
            height: 152px;
            margin-top: 0;
            gap: 6px;
            align-items: stretch;
          }
          .epantry-hero-related-slot {
            height: 100%;
            min-height: 0;
            min-width: 0;
            padding-top: 4px;
          }
          .epantry-hero-related-content {
            height: 100%;
            min-height: 0 !important;
            flex: 1 1 auto;
          }
          .epantry-hero-related-content > div { width: 100%; }
          .epantry-hero-related-content a { height: 100%; }
          .epantry-hero-related-content img { height: 43px; width: 43px; }
          .epantry-hero-related-slot span span:first-child { font-size: 10px; line-height: 1.1; }
          .epantry-hero-related-slot span span:nth-child(2) {
            font-size: 12px;
            line-height: 1.2;
            margin-top: 2px;
          }
        }
        @media (max-width: 767px) and (max-height: 700px) {
          .epantry-hero-shell {
            padding-top: 65px;
            padding-bottom: max(51px, calc(env(safe-area-inset-bottom, 0px) + 46px));
          }
          .epantry-hero-toggle-row { margin-bottom: 3px; }
          .epantry-hero-layout { gap: 6px; }
          .epantry-recipe-hero .epantry-hero-title {
            font-size: clamp(27px, 7.5vw, 35px) !important;
            margin-top: 4px !important;
          }
          .epantry-hero-copy form { margin-top: 8px; }
          .epantry-hero-copy > div:last-child { margin-top: 5px; }
          .epantry-hero-feature-column {
            grid-template-rows: minmax(0, 1fr) 126px;
            gap: 5px;
          }
          .epantry-recipe-hero .epantry-hero-related { height: 126px; gap: 4px; }
          .epantry-hero-related-content img { height: 40px; width: 40px; }
          .epantry-hero-visual .absolute.bottom-3.right-3 { padding: 7px; }
          .epantry-recipe-hero .epantry-hero-recipe-title { font-size: 14px !important; }
          .epantry-hero-visual .absolute.bottom-3.right-3 > a { min-height: 28px; padding-block: 4px; }
        }
        @media (min-width: 768px) and (max-height: 670px) {
          .epantry-hero-shell {
            grid-template-rows: 36px minmax(0, 1fr);
            row-gap: 8px;
            padding-top: 78px;
            padding-bottom: 10px;
          }
          .epantry-hero-copy { margin-top: clamp(16px, 2.4svh, 24px); }
          .epantry-hero-feature-column { gap: 9px; }
          .epantry-hero-visual {
            flex-basis: clamp(240px, 49svh, 325px);
            height: clamp(240px, 49svh, 325px) !important;
          }
          .epantry-hero-related { flex-basis: 96px; height: 96px; }
          .epantry-recipe-hero .epantry-hero-title { font-size: clamp(34px, 3.8vw, 54px) !important; }
        }
      `}</style>

      {/* A restrained editorial wash, rather than a flat colour swap. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 78% at 82% 37%, rgba(112,171,123,.24), transparent 78%), radial-gradient(ellipse 55% 70% at 4% 95%, rgba(206,225,202,.54), transparent 80%), linear-gradient(112deg, #F9FAF6 2%, #EEF4ED 98%)",
        }}
        initial={false}
        animate={{ opacity: selectedDiet === "veg" ? 1 : 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.7,
          ease: "easeInOut",
        }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 82% at 82% 38%, rgba(218,135,104,.22), transparent 78%), radial-gradient(ellipse 50% 65% at 3% 96%, rgba(241,208,191,.55), transparent 80%), linear-gradient(112deg, #FBF8F5 2%, #F8EAE2 98%)",
        }}
        initial={false}
        animate={{ opacity: selectedDiet === "nonveg" ? 1 : 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.7,
          ease: "easeInOut",
        }}
      />

      <div className="epantry-hero-shell page-shell relative z-10 mx-auto flex w-full min-h-0 flex-col">
        {/* Keep the video's sliding + rotating thumb, at a compact size. */}
        <div className="epantry-hero-toggle-row mb-2 flex w-full shrink-0 justify-end sm:mb-3">
          <div
            className="relative h-[40px] w-[112px] rounded-full border border-[#D6DDD3] bg-white/90 shadow-[0_4px_12px_rgba(23,63,53,.09)]"
            role="group"
            aria-label="Choose Veg or Non-Veg recipes"
          >
            <div
              className="absolute inset-0 grid grid-cols-2 items-center justify-items-center"
              aria-hidden="true"
            >
              <span className="opacity-40">
                <DietaryThumbIcon kind="veg" />
              </span>
              <span className="opacity-40">
                <DietaryThumbIcon kind="nonveg" />
              </span>
            </div>
            <motion.div
              aria-hidden="true"
              initial={false}
              animate={{
                x: selectedDiet === "veg" ? 0 : 56,
                rotate: selectedDiet === "veg" ? 0 : 360,
                backgroundColor: selectedDiet === "veg" ? "#E0F1E5" : "#FAE5DE",
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.53, ease: [0.2, 0.8, 0.2, 1] }
              }
              className="pointer-events-none absolute left-[12px] top-[4px] flex h-[30px] w-[30px] items-center justify-center rounded-full shadow-[0_2px_7px_rgba(23,63,53,.12)] ring-1 ring-white"
            >
              <DietaryThumbIcon kind={selectedDiet} />
            </motion.div>
            <button
              type="button"
              onClick={() => setSelectedDiet("veg")}
              aria-label="Show vegetarian recipes"
              aria-pressed={selectedDiet === "veg"}
              title="Veg"
              className="focus-ring absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-full outline-offset-2"
            >
              <span className="sr-only">Veg</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDiet("nonveg")}
              aria-label="Show non-vegetarian recipes"
              aria-pressed={selectedDiet === "nonveg"}
              title="Non-Veg"
              className="focus-ring absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-full outline-offset-2"
            >
              <span className="sr-only">Non-Veg</span>
            </button>
          </div>
        </div>

        <div className="epantry-hero-layout grid min-w-0 items-center gap-5 md:items-stretch md:grid-cols-[minmax(0,.83fr)_minmax(0,1.17fr)] md:gap-7 lg:gap-[clamp(30px,4.8vw,82px)]">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="epantry-hero-copy min-w-0"
          >
            <p className="text-[12px] font-bold uppercase tracking-[.09em] text-[#173F35] sm:text-[13px]">
              Recipes for every moment
            </p>
            <h1 className="epantry-hero-title mb-0 mt-4 max-w-[570px] text-[#173F35] lg:mt-5">
              Discover what
              <br className="hidden sm:block" /> to make next.
            </h1>

            <form
              onSubmit={handleCookTodaySubmit}
              className="mt-6 max-w-[500px] sm:mt-8"
            >
              <label className="sr-only" htmlFor="landing-cook-today-input">
                What would you like to make?
              </label>
              <div className="flex min-h-[54px] items-center gap-2 rounded-[12px] border border-[#CFDAD0] bg-white/95 px-2.5 py-1.5 shadow-[0_8px_22px_rgba(23,63,53,.07)]">
                <Search
                  size={18}
                  aria-hidden="true"
                  className="ml-1 shrink-0 text-[#173F35]"
                />
                <input
                  id="landing-cook-today-input"
                  type="search"
                  autoComplete="off"
                  value={cookInput}
                  onChange={(event) => {
                    setCookInput(event.target.value);
                    if (cookInputError) setCookInputError("");
                  }}
                  placeholder="Search recipes or ingredients"
                  aria-invalid={Boolean(cookInputError)}
                  aria-describedby={
                    cookInputError ? "landing-cook-error" : undefined
                  }
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[14px] text-[#202421] outline-none placeholder:text-[#69756E] sm:text-[15px]"
                />
                <button
                  type="submit"
                  className="focus-ring inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[8px] bg-[#173F35] px-3.5 text-[14px] font-bold text-white transition-colors hover:bg-[#225846]"
                >
                  Search <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
              {cookInputError && (
                <p
                  id="landing-cook-error"
                  role="alert"
                  className="mt-2 text-[14px] font-semibold text-[#A23524]"
                >
                  {cookInputError}
                </p>
              )}
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] font-semibold text-[#173F35]">
              <Link
                to="/cook-today"
                className="focus-ring underline-offset-4 hover:underline"
              >
                Use what I have
              </Link>
            </div>
          </motion.div>

          <div
            className="epantry-hero-feature-column min-w-0"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setPaused(false);
            }}
          >
            {mainRecipe ? (
              <div
                className={`epantry-hero-visual relative isolate h-[295px] overflow-hidden rounded-[15px] border bg-[#E5EADD] shadow-[0_18px_44px_rgba(23,63,53,.16)] sm:h-[345px] ${
                  selectedDiet === "veg"
                    ? "border-[#BBD1C0]"
                    : "border-[#E5BDAB]"
                }`}
              >
                <AnimatePresence initial={false}>
                  <motion.div
                    key={`${selectedDiet}:${mainRecipe.id}`}
                    initial={
                      shouldReduceMotion ? false : { opacity: 0, scale: 1.025 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      shouldReduceMotion ? undefined : { opacity: 0, scale: 1 }
                    }
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.75,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0"
                  >
                    <RecipePhoto
                      recipe={mainRecipe}
                      loading="eager"
                      className="absolute inset-0 h-full w-full"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    <div className="absolute bottom-3 right-3 w-[min(80%,280px)] rounded-[13px] border border-white/75 bg-[#F7F6F2]/95 p-3 shadow-[0_12px_30px_rgba(22,40,32,.21)] backdrop-blur-md sm:bottom-4 sm:right-4 sm:p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[.055em] text-[#A84F28]">
                        {personalize && recentViews.length
                          ? "Picked for you"
                          : "Featured recipe"}
                      </p>
                      <h2 className="epantry-hero-recipe-title mb-1.5 mt-1.5 line-clamp-2 text-[#202421]">
                        {mainRecipe.name}
                      </h2>
                      {mainRecipe.servings && (
                        <div className="mb-2.5 text-[12px] text-[#61716A]">
                          {mainRecipe.servings} servings
                        </div>
                      )}
                      <Link
                        to={mainRecipe.path}
                        className="focus-ring inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[9px] bg-[#173F35] px-3 py-2 text-center text-[13px] font-bold text-white transition-colors hover:bg-[#225846]"
                      >
                        Let&apos;s make this{" "}
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : (
              <div className="epantry-hero-visual flex h-[295px] flex-col items-center justify-center rounded-[15px] border border-[#D7DED5] bg-[#EDF0E9] px-6 py-5 text-center sm:h-[345px]">
                <CookingPot
                  size={34}
                  aria-hidden="true"
                  className="text-[#527161]"
                />
                <h2 className="mt-3 text-[18px] font-bold text-[#173F35]">
                  {catalogLoading
                    ? "Finding published recipes..."
                    : `No ${
                        selectedDiet === "veg" ? "Veg" : "Non-Veg"
                      } recipes available yet`}
                </h2>
                <p className="mt-2 max-w-sm text-[13px] leading-5 text-[#536559]">
                  {catalogLoading
                    ? "Checking available recipes and their dietary information."
                    : "Only approved, publicly shared recipes with a declared dietary type can appear here."}
                </p>
                {!catalogLoading && (
                  <Link
                    to="/recipes"
                    className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-[#173F35] px-5 text-[13px] font-bold text-white hover:bg-[#225846]"
                  >
                    Browse recipes <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
            <div
              className="epantry-hero-related mt-3 grid grid-cols-2 gap-3 sm:gap-4"
              aria-label="More recipe discoveries"
            >
              <SmallRecipeSlot
                item={drinkRecipe}
                slot="drink"
                isLoading={catalogLoading}
                reduceMotion={shouldReduceMotion}
              />
              <SmallRecipeSlot
                key={`new:${selectedDiet}`}
                item={newRecipe}
                slot="new"
                isLoading={catalogLoading}
                reduceMotion={shouldReduceMotion}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
