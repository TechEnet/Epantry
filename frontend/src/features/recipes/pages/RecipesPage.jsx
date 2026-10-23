import {
  ChefHat,
  ChevronRight,
  ChevronDown,
  ArrowDown,
  ArrowUpRight,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import { listPublicRecipes } from "../services/recipe.service";

import { getRecipeFoodIntelligence } from "../../foodIntelligence/services/foodIntelligence.service";

import { recordCustomerSearchDemand } from "../../search/services/search.service";

import SponsoredCampaignSlot from "../../retailMedia/components/SponsoredCampaignSlot";
import { listPublicHostListings } from "../../host/services/hostUnifiedListing.service";

function recipeKey(item, index = 0) {
  return (
    item?.recipe?.id || item?.dish?.id || item?.dish?.slug || `recipe-${index}`
  );
}

function recipeName(item) {
  return item?.dish?.name || item?.recipe?.title || "Recipe";
}

function recipePath(item) {
  return item?.path || `/recipes/${item?.dish?.slug || ""}`;
}

function recipeCuisine(item) {
  return item?.dish?.cuisine || item?.recipe?.cuisine || "";
}

function recipeCourse(item) {
  return (
    item?.dish?.course ||
    item?.recipe?.course ||
    item?.dish?.mealType ||
    item?.recipe?.mealType ||
    "Recipe"
  );
}

function recipeDietaryKindFromIntelligence(foodIntelligence) {
  const dietary = Array.isArray(foodIntelligence?.dietary)
    ? foodIntelligence.dietary
    : [];

  const eligibleKeys = dietary
    .filter((item) => {
      const status = String(item?.status || "")
        .trim()
        .toLowerCase();

      return item?.eligible === true || status === "eligible";
    })
    .map((item) =>
      String(item?.key || "")
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/g, "_")
    )
    .filter(Boolean);

  if (
    eligibleKeys.includes("non_vegetarian") ||
    eligibleKeys.includes("eggitarian")
  ) {
    return "nonveg";
  }

  if (eligibleKeys.includes("vegetarian") || eligibleKeys.includes("vegan")) {
    return "veg";
  }

  return "unknown";
}

function recipeDietaryKind(item, foodIntelligence = null) {
  const values = [
    item?.dish?.dietaryType,
    item?.recipe?.dietaryType,
    item?.dish?.dietaryClassification,
    item?.recipe?.dietaryClassification,
    ...(Array.isArray(item?.dish?.tags) ? item.dish.tags : []),
    ...(Array.isArray(item?.recipe?.tags) ? item.recipe.tags : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/[_-]+/g, " "));

  if (
    values.some(
      (value) =>
        value === "non veg" ||
        value === "non vegetarian" ||
        value === "eggitarian" ||
        value.includes("non vegetarian") ||
        value.includes("non veg")
    )
  ) {
    return "nonveg";
  }

  if (
    values.some(
      (value) =>
        value === "veg" ||
        value === "vegetarian" ||
        value === "vegan" ||
        value.includes("vegetarian")
    )
  ) {
    return "veg";
  }

  return recipeDietaryKindFromIntelligence(foodIntelligence);
}

// The main browsing categories remain visible even if a category has no
// published recipes yet. Extra course labels from real backend records are
// appended without duplicating these common groups.
const PRIMARY_RECIPE_TABS = [
  { id: "all", label: "All Recipes" },
  { id: "restaurant", label: "Restaurant Picks" },
  { id: "course:breakfast", label: "Breakfast" },
  { id: "course:brunch", label: "Brunch" },
  { id: "course:lunch", label: "Lunch" },
  { id: "course:dinner", label: "Dinner" },
  { id: "course:snacks", label: "Snacks" },
  { id: "course:starters", label: "Starters" },
  { id: "course:mains", label: "Main Course" },
  { id: "course:sides", label: "Side Dishes" },
  { id: "course:soups", label: "Soups" },
  { id: "course:salads", label: "Salads" },
  { id: "course:street-food", label: "Street Food" },
  { id: "course:bakery", label: "Bakery" },
  { id: "drinks", label: "Drinks" },
  { id: "desserts", label: "Desserts & Sweets" },
];

// Match only genuine category metadata; don't guess a course just because
// a dish title happens to include a word such as "lunch" or "tea".
const COLLECTION_TERMS = {
  "course:breakfast": ["breakfast", "morning meal"],
  "course:brunch": ["brunch"],
  "course:lunch": ["lunch", "midday meal"],
  "course:dinner": ["dinner", "supper", "evening meal"],
  "course:snacks": ["snack", "snacks", "quick bites", "tiffin"],
  "course:starters": [
    "starter",
    "starters",
    "appetizer",
    "appetizers",
    "appetiser",
    "appetisers",
  ],
  "course:mains": [
    "main course",
    "main dish",
    "main dishes",
    "mains",
    "entree",
    "entrees",
  ],
  "course:sides": [
    "side",
    "sides",
    "side dish",
    "side dishes",
    "accompaniment",
  ],
  "course:soups": ["soup", "soups", "broth"],
  "course:salads": ["salad", "salads"],
  "course:street-food": ["street food", "streetfood", "chaat"],
  "course:bakery": [
    "bakery",
    "baking",
    "bread",
    "breads",
    "pastry",
    "pastries",
  ],
  drinks: [
    "drink",
    "drinks",
    "beverage",
    "beverages",
    "mocktail",
    "mocktails",
    "cocktail",
    "cocktails",
    "smoothie",
    "smoothies",
    "juice",
    "juices",
    "shake",
    "shakes",
    "tea",
    "coffee",
  ],
  desserts: [
    "dessert",
    "desserts",
    "sweet",
    "sweets",
    "mithai",
    "cake",
    "cakes",
    "pudding",
    "puddings",
  ],
};

function normalizeCollectionText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recipeCategoryMetadata(item) {
  const dish = item?.dish || {};
  const recipe = item?.recipe || {};
  return [
    dish.course,
    recipe.course,
    dish.mealType,
    recipe.mealType,
    dish.category,
    recipe.category,
    dish.categoryName,
    recipe.categoryName,
    ...(Array.isArray(dish.categories) ? dish.categories : []),
    ...(Array.isArray(recipe.categories) ? recipe.categories : []),
    ...(Array.isArray(dish.tags) ? dish.tags : []),
    ...(Array.isArray(recipe.tags) ? recipe.tags : []),
  ]
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map(normalizeCollectionText)
    .filter(Boolean);
}

function matchesRecipeCollection(item, collection) {
  if (
    collection === "all" ||
    collection === "veg" ||
    collection === "nonveg" ||
    collection === "restaurant"
  )
    return true;
  const metadata = recipeCategoryMetadata(item);
  const terms =
    COLLECTION_TERMS[collection] ||
    (collection.startsWith("course:")
      ? [collection.slice("course:".length)]
      : []);
  return terms.some((term) => {
    const wanted = normalizeCollectionText(term);
    if (!wanted) return false;
    // Word-boundary comparison lets "breakfast and brunch" match Breakfast,
    // but avoids accidentally matching "tea" inside a word like "steak".
    return metadata.some((value) => ` ${value} `.includes(` ${wanted} `));
  });
}

function formatRestaurantPrice(price) {
  const amountMinor = Number(price?.amountMinor);

  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: price?.currency || "INR",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function recipeImage(item) {
  return item?.dish?.heroImageUrl || item?.recipe?.heroImageUrl || "";
}

// A restrained image-first card: only the dish name, cuisine/restaurant and a
// clear navigation affordance. Keep all existing recipe destinations intact.
function RecipeTile({ item, restaurant = false }) {
  const title = recipeName(item);
  const cuisine = recipeCuisine(item);
  const venue = item?.restaurant?.restaurantName || "From Restaurants";
  const price = restaurant
    ? formatRestaurantPrice(item?.restaurant?.pricePerServing)
    : "";
  const subtitle = restaurant ? venue : cuisine || recipeCourse(item);

  return (
    <Link
      to={recipePath(item)}
      aria-label={`Explore recipe: ${title}`}
      className="focus-ring group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#DCE0CF] bg-[#F7F6F2] shadow-[0_8px_28px_rgba(32,36,33,0.07)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#173F35]/35 hover:shadow-[0_18px_44px_rgba(32,36,33,0.13)] focus-visible:ring-2 focus-visible:ring-[#173F35]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#DCE0CF] lg:aspect-[3/2]">
        {recipeImage(item) ? (
          <img
            src={recipeImage(item)}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#DCE0CF] text-[#173F35]">
            <ChefHat size={40} aria-label="Image not available" />
          </div>
        )}
        {restaurant ? (
          <span className="absolute left-3 top-3 rounded-full bg-[#F7F6F2] px-3 py-1.5 text-[13px] font-semibold text-[#173F35] shadow-sm">
            Restaurant Pick
          </span>
        ) : null}
      </div>
      <div className="flex min-h-[86px] flex-1 items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#173F35]">
            {subtitle}
          </p>
          <h3 className="mt-1 line-clamp-2 text-[18px] font-bold leading-tight tracking-[-0.025em] text-[#202421]">
            {title}
          </h3>
          {price ? (
            <p className="mt-1 text-sm font-medium text-[#173F35]">
              {price} / serving
            </p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173F35] text-[#F7F6F2] transition-transform duration-200 group-hover:translate-x-0.5"
        >
          <ArrowUpRight size={18} />
        </span>
      </div>
    </Link>
  );
}

const STANDARD_PAGE_SIZE = 48;
const RESTAURANT_PAGE_SIZE = 24;
const DESKTOP_REVEAL_SIZE = 12;
const MOBILE_REVEAL_SIZE = 4;

const MORE_TYPE_GROUPS = [
  {
    label: "Meal times",
    ids: ["course:breakfast", "course:brunch", "course:lunch", "course:dinner"],
  },
  {
    label: "Meal courses",
    ids: [
      "course:snacks",
      "course:starters",
      "course:mains",
      "course:sides",
      "course:soups",
      "course:salads",
      "course:street-food",
    ],
  },
  {
    label: "Bakery, drinks & sweets",
    ids: ["course:bakery", "drinks", "desserts"],
  },
];

function groupMoreTypes(tabs) {
  const mappedIds = new Set(MORE_TYPE_GROUPS.flatMap((group) => group.ids));
  const groups = MORE_TYPE_GROUPS.map(({ label, ids }) => ({
    label,
    tabs: tabs.filter((tab) => ids.includes(tab.id)),
  })).filter((group) => group.tabs.length > 0);
  const extra = tabs.filter((tab) => !mappedIds.has(tab.id));
  if (extra.length) groups.push({ label: "More categories", tabs: extra });
  return groups;
}

// Keep the native, keyboard-accessible select, but render its chosen label as
// normal text. Native select text is not measured consistently by every
// browser, which previously clipped labels such as "Brunch".
function AdaptiveRecipeTypeSelect({
  groups,
  options,
  currentId,
  onSelect,
  mobile = false,
}) {
  const selectedTab = options.find((tab) => tab.id === currentId);
  const displayLabel = selectedTab?.label || "More types…";

  return (
    <label
      className={`relative inline-flex min-h-11 w-max max-w-none shrink-0 items-center rounded-full border transition-colors duration-200 focus-within:border-[#173F35] focus-within:ring-2 focus-within:ring-[#173F35]/25 ${
        mobile ? "lg:hidden" : "hidden lg:inline-flex"
      } ${
        selectedTab
          ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2]"
          : "border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`block whitespace-nowrap py-2.5 pl-3.5 pr-9 font-semibold leading-5 ${
          mobile ? "text-[13px]" : "text-[14px]"
        }`}
      >
        {displayLabel}
      </span>
      <select
        value={selectedTab ? currentId : ""}
        onChange={(event) => {
          if (event.target.value) onSelect(event.target.value);
        }}
        aria-label="More recipe types"
        className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full border-0 opacity-0"
      >
        <option value="">More types…</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.tabs.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={15}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
      />
    </label>
  );
}

const SEARCH_SUGGESTIONS = {
  all: [
    "Paneer tikka for tonight...",
    "Easy recipes for a busy day...",
    "What can I cook with rice?",
  ],
  veg: [
    "Paneer and tomato dinner...",
    "Simple vegetable lunch...",
    "Quick plant-based meals...",
  ],
  nonveg: [
    "Chicken curry ideas...",
    "Easy fish dinner...",
    "Weekend egg recipes...",
  ],
  restaurant: [
    "Signature restaurant dishes...",
    "Chef-made favourites...",
    "Explore restaurant recipes...",
  ],
  "course:breakfast": [
    "Start with a warm breakfast...",
    "Oats, eggs or morning favourites...",
    "Something quick before work...",
  ],
  "course:brunch": [
    "Lazy weekend brunch...",
    "Make a savoury brunch...",
    "Brunch ideas for friends...",
  ],
  "course:lunch": [
    "What is for lunch today?",
    "Simple midday meals...",
    "Lunchbox favourites...",
  ],
  "course:dinner": [
    "Dinner for tonight...",
    "Comforting evening meals...",
    "Make a special dinner...",
  ],
  "course:snacks": [
    "Something to snack on...",
    "Easy afternoon bites...",
    "Quick savoury snacks...",
  ],
  "course:starters": [
    "Start the meal beautifully...",
    "Small plates to share...",
    "Party starters...",
  ],
  "course:mains": [
    "A satisfying main course...",
    "One memorable dish...",
    "Family-style meals...",
  ],
  "course:sides": [
    "Sides for your favourite dish...",
    "Complete your plate...",
    "Simple vegetable sides...",
  ],
  "course:soups": [
    "A comforting bowl of soup...",
    "Warming broths...",
    "Fresh seasonal soups...",
  ],
  "course:salads": [
    "Fresh and colourful salads...",
    "A lighter lunch...",
    "Simple salad ideas...",
  ],
  "course:street-food": [
    "Favourite street food...",
    "Make a chaat at home...",
    "Something spicy and fun...",
  ],
  "course:bakery": [
    "Freshly baked favourites...",
    "Bread from your kitchen...",
    "Pastry ideas...",
  ],
  drinks: [
    "A refreshing mango shake...",
    "Cooling summer mocktails...",
    "Coffee and smoothie recipes...",
  ],
  desserts: [
    "Something sweet after dinner...",
    "Easy homemade desserts...",
    "Cakes and festive sweets...",
  ],
};

function searchableRecipeText(item) {
  return [
    recipeName(item),
    recipeCuisine(item),
    recipeCourse(item),
    item?.dish?.description,
    item?.recipe?.description,
    ...(Array.isArray(item?.dish?.tags) ? item.dish.tags : []),
    ...(Array.isArray(item?.recipe?.tags) ? item.recipe.tags : []),
    item?.restaurant?.restaurantName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasNextPage(payload, rows, page, limit) {
  const pages = Number(payload?.pagination?.pages);
  if (Number.isFinite(pages)) return page < pages;
  return rows.length >= limit;
}

function mergedById(existing, incoming) {
  const seen = new Set(existing.map((item, index) => recipeKey(item, index)));
  return [
    ...existing,
    ...incoming.filter((item, index) => {
      const key = recipeKey(item, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function RecipeGridCard({ item, restaurant = false }) {
  return <RecipeTile item={item} restaurant={restaurant} />;
}

export default function RecipesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [collectionQuery, setCollectionQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [hint, setHint] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [selectedDiet, setSelectedDiet] = useState("all");
  const [recipes, setRecipes] = useState([]);
  const [restaurantRecipes, setRestaurantRecipes] = useState([]);
  const [approvedHostListings, setApprovedHostListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restaurantError, setRestaurantError] = useState("");
  const [standardPage, setStandardPage] = useState(1);
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [standardHasMore, setStandardHasMore] = useState(false);
  const [restaurantHasMore, setRestaurantHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalDietaryByRecipeId, setModalDietaryByRecipeId] = useState({});
  const [dietaryLoading, setDietaryLoading] = useState(false);
  const [revealSize, setRevealSize] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
      ? MOBILE_REVEAL_SIZE
      : DESKTOP_REVEAL_SIZE
  );
  const [visibleCount, setVisibleCount] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
      ? MOBILE_REVEAL_SIZE
      : DESKTOP_REVEAL_SIZE
  );
  const browseRef = useRef(null);
  const requestGenerationRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      const step = query.matches ? MOBILE_REVEAL_SIZE : DESKTOP_REVEAL_SIZE;
      setRevealSize(step);
      setVisibleCount((value) => (value <= DESKTOP_REVEAL_SIZE ? step : value));
    };
    query.addEventListener?.("change", apply);
    return () => query.removeEventListener?.("change", apply);
  }, []);

  // Approved unified Host listings are a separate governed read model; they
  // never pretend to be canonical recipe records or sellable marketplace offers.
  useEffect(() => {
    let active = true;
    listPublicHostListings()
      .then((data) => {
        if (active) setApprovedHostListings(data?.listings || []);
      })
      .catch(() => {
        if (active) setApprovedHostListings([]);
      });
    return () => {
      active = false;
    };
  }, []);
  const visibleHostListings = useMemo(() => {
    if (selectedDiet !== "all") return []; // Host-declared diet is not verified Food Intelligence.
    const categoriesForTab = {
      drinks: ["drinks"],
      desserts: ["desserts", "sweets"],
      "course:mains": ["main_course"],
      "course:sides": ["side_dish"],
    };
    const categories =
      categoriesForTab[selectedCollection] ||
      (selectedCollection.startsWith("course:")
        ? [selectedCollection.slice(7)]
        : null);
    const query = collectionQuery.trim().toLowerCase();
    return approvedHostListings
      .filter((item) => {
        if (item.type === "grocery") return false;
        if (
          selectedCollection === "restaurant" &&
          !["prepared_food", "kitchen_recipe"].includes(item.type)
        )
          return false;
        if (
          selectedCollection !== "restaurant" &&
          categories &&
          !categories.includes(item.category)
        )
          return false;
        return (
          !query ||
          `${item.title} ${item.description}`.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [approvedHostListings, selectedCollection, selectedDiet, collectionQuery]);

  // Search the selected category, not an unrelated set of recipes.
  // A small debounce avoids an API request for every character typed.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setServerSearch(collectionQuery.trim()),
      380
    );
    return () => window.clearTimeout(timer);
  }, [collectionQuery]);

  useEffect(() => {
    const generation = ++requestGenerationRef.current;
    let cancelled = false;
    setLoading(true);
    setLoadingMore(false);
    loadMoreInFlightRef.current = false;
    setError("");
    setRestaurantError("");
    setVisibleCount(revealSize);

    const standardRequest = listPublicRecipes({
      page: 1,
      limit: STANDARD_PAGE_SIZE,
      search: serverSearch,
      sourceScope: "standard",
    });
    const restaurantRequest = listPublicRecipes({
      page: 1,
      limit: RESTAURANT_PAGE_SIZE,
      search: serverSearch,
      sourceScope: "restaurant",
    });

    Promise.allSettled([standardRequest, restaurantRequest]).then(
      ([standard, restaurant]) => {
        if (cancelled || requestGenerationRef.current !== generation) return;
        if (standard.status === "fulfilled") {
          const rows = Array.isArray(standard.value?.recipes)
            ? standard.value.recipes
            : [];
          setRecipes(rows);
          setStandardHasMore(
            hasNextPage(standard.value, rows, 1, STANDARD_PAGE_SIZE)
          );
        } else {
          setRecipes([]);
          setStandardHasMore(false);
          setError(standard.reason?.message || "Unable to load recipes.");
        }
        if (restaurant.status === "fulfilled") {
          const rows = Array.isArray(restaurant.value?.recipes)
            ? restaurant.value.recipes
            : [];
          setRestaurantRecipes(rows);
          setRestaurantHasMore(
            hasNextPage(restaurant.value, rows, 1, RESTAURANT_PAGE_SIZE)
          );
        } else {
          setRestaurantRecipes([]);
          setRestaurantHasMore(false);
          setRestaurantError(
            restaurant.reason?.message || "Unable to load restaurant recipes."
          );
        }
        setStandardPage(1);
        setRestaurantPage(1);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [serverSearch]);

  const categories = useMemo(() => {
    const counts = new Map();
    recipes.forEach((item) => {
      const course = recipeCourse(item);
      if (!course || course.toLowerCase() === "recipe") return;
      counts.set(course, (counts.get(course) || 0) + 1);
    });
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [recipes]);

  const recipeTabs = useMemo(() => {
    const known = new Set([
      ...PRIMARY_RECIPE_TABS.map(({ label }) => normalizeCollectionText(label)),
      ...Object.values(COLLECTION_TERMS).flat().map(normalizeCollectionText),
      "dessert",
      "drink",
      "beverage",
      "sweet",
      "bakery",
      "vegetarian",
      "non vegetarian",
      "non veg",
      "veg",
    ]);
    const additional = categories
      .filter(({ name }) => !known.has(normalizeCollectionText(name)))
      .map(({ name }) => ({ id: `course:${name}`, label: name }));
    if (
      selectedCollection.startsWith("course:") &&
      ![...PRIMARY_RECIPE_TABS, ...additional].some(
        (tab) => tab.id === selectedCollection
      )
    ) {
      additional.push({
        id: selectedCollection,
        label: selectedCollection.slice(7),
      });
    }
    return [...PRIMARY_RECIPE_TABS, ...additional];
  }, [categories, selectedCollection]);

  const selectedLabel =
    recipeTabs.find((tab) => tab.id === selectedCollection)?.label || "Recipes";

  // Real dietary evidence only: a Lunch + Vegetarian selection must not
  // silently classify recipes with unknown dietary information as vegetarian.
  useEffect(() => {
    if (selectedDiet === "all") {
      setDietaryLoading(false);
      return undefined;
    }
    const eligible =
      selectedCollection === "restaurant"
        ? restaurantRecipes
        : selectedCollection === "all"
        ? [...recipes, ...restaurantRecipes]
        : recipes;
    const unresolved = eligible
      .map((item) => ({
        item,
        id: String(item?.recipe?.id || "").trim(),
      }))
      .filter(
        ({ item, id }) =>
          id &&
          recipeDietaryKind(item) === "unknown" &&
          !Object.hasOwn(modalDietaryByRecipeId, id)
      );
    if (!unresolved.length) {
      setDietaryLoading(false);
      return undefined;
    }
    let cancelled = false;
    setDietaryLoading(true);
    const check = async () => {
      const collected = {};
      for (let index = 0; index < unresolved.length; index += 3) {
        if (cancelled) break;
        const batch = unresolved.slice(index, index + 3);
        const results = await Promise.allSettled(
          batch.map(async ({ id }) => [id, await getRecipeFoodIntelligence(id)])
        );
        if (cancelled) break;
        results.forEach((result, offset) => {
          const id = batch[offset]?.id;
          if (id)
            collected[id] =
              result.status === "fulfilled" ? result.value[1] : null;
        });
      }
      if (!cancelled && Object.keys(collected).length)
        setModalDietaryByRecipeId((current) => ({ ...current, ...collected }));
    };
    check().finally(() => {
      if (!cancelled) setDietaryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    selectedCollection,
    selectedDiet,
    recipes,
    restaurantRecipes,
    modalDietaryByRecipeId,
  ]);

  const matchedRecipes = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    const source =
      selectedCollection === "restaurant"
        ? restaurantRecipes.map((item) => ({ item, restaurant: true }))
        : selectedCollection === "all"
        ? [
            ...recipes.map((item) => ({ item, restaurant: false })),
            // Don't reshuffle visible tiles: show Restaurant records only after
            // all preceding standard catalogue pages have been loaded.
            ...(standardHasMore
              ? []
              : restaurantRecipes.map((item) => ({ item, restaurant: true }))),
          ]
        : recipes.map((item) => ({ item, restaurant: false }));
    return source.filter(({ item, restaurant }) => {
      if (query && !searchableRecipeText(item).includes(query)) return false;
      if (
        selectedCollection !== "all" &&
        selectedCollection !== "restaurant" &&
        !matchesRecipeCollection(item, selectedCollection)
      )
        return false;
      if (selectedDiet !== "all") {
        const intel =
          modalDietaryByRecipeId[String(item?.recipe?.id || "")] || null;
        if (recipeDietaryKind(item, intel) !== selectedDiet) return false;
      }
      return true;
    });
  }, [
    recipes,
    restaurantRecipes,
    collectionQuery,
    selectedCollection,
    selectedDiet,
    modalDietaryByRecipeId,
    standardHasMore,
  ]);

  const visibleRecipes = matchedRecipes.slice(0, visibleCount);
  const moreFromServer =
    selectedCollection === "restaurant"
      ? restaurantHasMore
      : selectedCollection === "all"
      ? standardHasMore || restaurantHasMore
      : standardHasMore;
  const canViewMore = visibleCount < matchedRecipes.length || moreFromServer;

  function chooseCollection(id) {
    setSelectedCollection(id);
    setVisibleCount(revealSize);
  }

  function chooseDiet(id) {
    setSelectedDiet(id);
    setVisibleCount(revealSize);
  }

  const desktopMainTabs = [
    "all",
    "restaurant",
    "course:breakfast",
    "course:lunch",
    "course:dinner",
    "course:snacks",
  ];
  const mobileMainTabs = ["all", "restaurant"];
  const desktopExtraTabs = recipeTabs.filter(
    (tab) => !desktopMainTabs.includes(tab.id)
  );
  const mobileExtraTabs = recipeTabs.filter(
    (tab) => !mobileMainTabs.includes(tab.id)
  );
  const desktopMoreGroups = groupMoreTypes(desktopExtraTabs);
  const mobileMoreGroups = groupMoreTypes(mobileExtraTabs);
  const searchScope =
    selectedLabel +
    (selectedDiet === "veg"
      ? " · Vegetarian"
      : selectedDiet === "nonveg"
      ? " · Non-Vegetarian"
      : "");

  async function handleViewMore() {
    if (loadingMore || loading) return;
    const nextCount = visibleCount + revealSize;
    setVisibleCount(nextCount);
    if (matchedRecipes.length >= nextCount || !moreFromServer) return;
    // Load only the next real API page on demand, never create placeholder duplicates.
    const useRestaurant =
      selectedCollection === "restaurant" ||
      (selectedCollection === "all" && !standardHasMore);
    const nextPage = useRestaurant ? restaurantPage + 1 : standardPage + 1;
    const limit = useRestaurant ? RESTAURANT_PAGE_SIZE : STANDARD_PAGE_SIZE;
    const sourceScope = useRestaurant ? "restaurant" : "standard";
    if (loadMoreInFlightRef.current) return;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    const generation = requestGenerationRef.current;
    try {
      const payload = await listPublicRecipes({
        page: nextPage,
        limit,
        search: serverSearch,
        sourceScope,
      });
      if (generation !== requestGenerationRef.current) return;
      const rows = Array.isArray(payload?.recipes) ? payload.recipes : [];
      if (useRestaurant) {
        setRestaurantRecipes((previous) => mergedById(previous, rows));
        setRestaurantPage(nextPage);
        setRestaurantHasMore(hasNextPage(payload, rows, nextPage, limit));
      } else {
        setRecipes((previous) => mergedById(previous, rows));
        setStandardPage(nextPage);
        setStandardHasMore(hasNextPage(payload, rows, nextPage, limit));
      }
    } catch (loadError) {
      if (generation === requestGenerationRef.current) {
        if (useRestaurant)
          setRestaurantError(
            loadError?.message || "Unable to load more restaurant recipes."
          );
        else setError(loadError?.message || "Unable to load more recipes.");
      }
    } finally {
      if (generation === requestGenerationRef.current) setLoadingMore(false);
      loadMoreInFlightRef.current = false;
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    const query = searchInput.trim();
    if (query.length >= 2)
      void recordCustomerSearchDemand({ query, surface: "recipes" });
    setCollectionQuery(query);
    browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCollectionSearch(event) {
    const query = event.target.value;
    setCollectionQuery(query);
    setVisibleCount(revealSize);
  }

  // Type short category-specific suggestions, one at a time, only when idle.
  useEffect(() => {
    if (collectionQuery || searchFocused) {
      setHint("");
      return undefined;
    }
    const suggestions =
      selectedDiet !== "all"
        ? [
            `${
              selectedDiet === "veg" ? "Vegetarian" : "Non-vegetarian"
            } ${selectedLabel.toLowerCase()} ideas...`,
            `Find a ${
              selectedDiet === "veg" ? "vegetarian" : "non-vegetarian"
            } favourite...`,
            `Try something for ${selectedLabel.toLowerCase()}...`,
          ]
        : SEARCH_SUGGESTIONS[selectedCollection] || [
            `Explore ${selectedLabel.toLowerCase()} recipes...`,
            `Find your next ${selectedLabel.toLowerCase()} favourite...`,
            `Search ${selectedLabel.toLowerCase()} ideas...`,
          ];
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setHint(suggestions[0]);
      return undefined;
    }
    let current = 0;
    let characters = 0;
    let removing = false;
    let timeoutId;
    const tick = () => {
      const phrase = suggestions[current % suggestions.length];
      setHint(phrase.slice(0, characters));
      if (!removing && characters < phrase.length) {
        characters += 1;
        timeoutId = window.setTimeout(tick, 65);
        return;
      }
      if (!removing) {
        removing = true;
        timeoutId = window.setTimeout(tick, 1700);
        return;
      }
      if (characters > 0) {
        characters -= 1;
        timeoutId = window.setTimeout(tick, 30);
        return;
      }
      current += 1;
      removing = false;
      timeoutId = window.setTimeout(tick, 320);
    };
    tick();
    return () => window.clearTimeout(timeoutId);
  }, [
    selectedCollection,
    selectedLabel,
    selectedDiet,
    collectionQuery,
    searchFocused,
  ]);

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#202421]">
      <section
        className="relative flex h-[100svh] min-h-0 items-center overflow-hidden bg-[#F7F6F2] bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/hero/recipe.png')" }}
      >
        <div className="page-shell relative z-10 w-full">
          {/* Featured Grocery-style SOLID Porcelain reading panel. The image is
              untouched: no gradient, blur, tint or overlay on the photograph. */}
          <div className="w-full max-w-[620px] border-l-[5px] border-[#173F35] bg-[#F7F6F2] px-5 py-6 text-[#202421] shadow-[0_14px_36px_rgba(32,36,33,0.15)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <span className="inline-flex items-center border-l-[3px] border-[#C86C42] pl-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#173F35]">
              EPANTRY Recipes
            </span>
            <h1 className="mt-5 max-w-[15ch] text-[36px] font-semibold leading-[1.08] tracking-[-0.05em] text-[#202421] sm:text-[48px] lg:text-[56px]">
              Discover <span className="text-[#173F35]">something good</span> to
              cook.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-[#202421]">
              Explore real recipes, find a favourite and make it your own.
            </p>
            <form
              onSubmit={handleSearch}
              className="mt-6 flex max-w-[620px] flex-col gap-2 rounded-[16px] border border-[#DCE0CF] bg-[#F7F6F2] p-2 shadow-[0_16px_40px_rgba(32,36,33,0.11)] sm:flex-row"
            >
              <label className="relative flex-1">
                <span className="sr-only">Search recipes</span>
                <Search
                  size={19}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#173F35]"
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  maxLength={160}
                  placeholder="Search recipes and cuisines"
                  className="focus-ring h-[50px] w-full min-w-0 rounded-[12px] bg-[#F7F6F2] pl-12 pr-4 text-base text-[#202421] outline-none placeholder:text-[#202421]/65"
                />
              </label>
              <button
                type="submit"
                className="focus-ring min-h-[50px] rounded-[12px] bg-[#173F35] px-6 text-[15px] font-semibold text-[#F7F6F2] hover:bg-[#202421]"
              >
                Search recipes
              </button>
            </form>
            <Link
              to="/recipes/what-should-we-cook"
              className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#173F35] bg-[#DCE0CF] px-5 text-[15px] font-semibold text-[#173F35] transition hover:bg-[#F7F6F2]"
            >
              <ChefHat size={18} aria-hidden="true" /> What should we cook?{" "}
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            browseRef.current?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
              block: "start",
            })
          }
          aria-label="Scroll down to explore recipes"
          className="focus-ring absolute bottom-5 right-5 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent bg-[#F7F6F2] px-3.5 py-2.5 text-[14px] font-semibold text-[#173F35] shadow-[0_6px_22px_rgba(32,36,33,0.16)] transition-colors hover:border-[#173F35] focus-visible:border-[#173F35] sm:bottom-8 sm:right-8"
        >
          <span className="hidden sm:inline">Scroll to explore</span>
          <ArrowDown size={17} aria-hidden="true" />
        </button>
      </section>

      <SponsoredCampaignSlot placement="recipe" slotKey="recipe_hero" />

      <section
        ref={browseRef}
        className="scroll-mt-[70px] border-t border-[#DCE0CF] bg-[#F7F6F2] py-10 sm:py-14"
        aria-label="Explore recipes by type"
      >
        <div className="page-shell">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#173F35]">
              EPANTRY recipe collection
            </p>
            <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.04em] text-[#202421] sm:text-[36px]">
              Find your next favourite.
            </h2>
          </div>

          {/* Meal/collection selection. The first line stays one row. All other
              types live in a native keyboard-accessible dropdown. */}
          <div className="mt-7 rounded-[16px] border border-[#DCE0CF] bg-[#DCE0CF]/45 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-[#173F35]">
              <SlidersHorizontal size={18} aria-hidden="true" />
              <h3 className="text-[15px] font-bold uppercase tracking-[0.08em]">
                Explore by type
              </h3>
            </div>
            <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2">
              {recipeTabs
                .filter((tab) => desktopMainTabs.includes(tab.id))
                .map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selectedCollection === id}
                    onClick={() => chooseCollection(id)}
                    className={`focus-ring hidden min-h-11 shrink-0 items-center justify-center rounded-full border px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors lg:inline-flex ${
                      selectedCollection === id
                        ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2]"
                        : "border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              {recipeTabs
                .filter((tab) => mobileMainTabs.includes(tab.id))
                .map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selectedCollection === id}
                    onClick={() => chooseCollection(id)}
                    aria-label={label}
                    className={`focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors lg:hidden ${
                      selectedCollection === id
                        ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2]"
                        : "border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]"
                    }`}
                  >
                    {id === "all" ? "All" : label}
                  </button>
                ))}
              <AdaptiveRecipeTypeSelect
                groups={desktopMoreGroups}
                options={desktopExtraTabs}
                currentId={selectedCollection}
                onSelect={chooseCollection}
              />
              <AdaptiveRecipeTypeSelect
                groups={mobileMoreGroups}
                options={mobileExtraTabs}
                currentId={selectedCollection}
                onSelect={chooseCollection}
                mobile
              />
            </div>
            {/* Diet is separate: Lunch + Vegetarian, Dinner + Non-Vegetarian,
                Restaurant Picks + Vegetarian, etc. all remain possible. */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#173F35]/15 pt-3">
              <span className="mr-1 text-[14px] font-semibold text-[#173F35]">
                Food preference
              </span>
              {[
                { id: "all", label: "Any" },
                { id: "veg", label: "Veg" },
                { id: "nonveg", label: "Non-Veg" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selectedDiet === id}
                  onClick={() => chooseDiet(id)}
                  className={`focus-ring min-h-10 rounded-full border px-4 text-[14px] font-semibold whitespace-nowrap transition-colors ${
                    selectedDiet === id
                      ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2]"
                      : "border-transparent bg-[#F7F6F2] text-[#202421] hover:border-[#173F35]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category-aware search; query and diet filter the same results. */}
          <div className="mt-4">
            <label className="flex min-h-[54px] items-center gap-3 rounded-[14px] border border-[#DCE0CF] bg-[#F7F6F2] px-4 transition-colors focus-within:border-[#173F35] focus-within:ring-2 focus-within:ring-[#173F35]/15">
              <Search
                size={21}
                className="shrink-0 text-[#173F35]"
                aria-hidden="true"
              />
              <span className="sr-only">Search in {searchScope}</span>
              <input
                type="search"
                value={collectionQuery}
                onChange={handleCollectionSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                maxLength={160}
                placeholder={hint || `Search ${searchScope.toLowerCase()}...`}
                className="focus-ring h-[52px] w-full min-w-0 flex-1 bg-transparent text-base text-[#202421] outline-none placeholder:text-[#202421]/60"
              />
              {collectionQuery && (
                <button
                  type="button"
                  aria-label="Clear recipe search"
                  onClick={() => {
                    setCollectionQuery("");
                    setSearchInput("");
                    setVisibleCount(revealSize);
                  }}
                  className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#DCE0CF] text-[#173F35] hover:bg-[#173F35] hover:text-[#F7F6F2]"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              )}
            </label>
          </div>

          {visibleHostListings.length > 0 && (
            <section
              aria-label="Approved Host food listings"
              className="mt-6 border-t border-[#D7DDCF] pt-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">From EPANTRY Hosts</h2>
                <Link
                  className="text-sm font-semibold text-[#173F35] underline"
                  to="/explore/host-listings"
                >
                  See all
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {visibleHostListings.map((item) => (
                  <Link
                    key={item.id}
                    to={`/explore/host-listings?item=${encodeURIComponent(
                      item.id
                    )}`}
                    className="overflow-hidden rounded-xl border border-[#D7DDCF] bg-white hover:border-[#173F35]"
                  >
                    {item.images?.[0] && (
                      <img
                        src={item.images[0]}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                      />
                    )}
                    <div className="p-3">
                      <p className="text-xs font-semibold text-[#C86C42]">
                        {item.category.replaceAll("_", " ")} · Host approved
                      </p>
                      <h3 className="mt-1 text-base font-semibold">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#56645C]">See details</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 border-y border-[#D7DDCF] bg-[#E7EDE3] p-4">
            <p className="text-sm font-semibold text-[#173F35]">
              Explore recently approved Host food, drink and bakery submissions.
            </p>
            <Link
              to="/explore/host-listings"
              className="shrink-0 rounded-lg bg-[#173F35] px-3 py-2 text-sm font-semibold text-white"
            >
              Explore Host listings
            </Link>
          </div>
          <SponsoredCampaignSlot
            placement="recipe"
            slotKey="recipe_collection"
          />

          {(error || restaurantError) && (
            <div
              role="alert"
              className="mt-5 rounded-[12px] border border-[#C86C42] bg-[#F7F6F2] p-4 text-sm text-[#202421]"
            >
              {[error, restaurantError].filter(Boolean).join(" ")}
            </div>
          )}
          {loading ? (
            <div
              className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5"
              role="status"
              aria-label="Loading recipes"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="aspect-[4/3] animate-pulse rounded-[16px] bg-[#DCE0CF] lg:aspect-[3/2]"
                />
              ))}
            </div>
          ) : dietaryLoading && selectedDiet !== "all" ? (
            <div
              className="mt-8 flex min-h-36 items-center gap-3 text-[#173F35]"
              role="status"
            >
              <ChefHat size={24} className="animate-pulse" /> Checking approved
              dietary information…
            </div>
          ) : visibleRecipes.length > 0 ? (
            <>
              <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
                {visibleRecipes.map(({ item, restaurant }, index) => (
                  <RecipeGridCard
                    key={`${restaurant ? "restaurant" : "standard"}-${recipeKey(
                      item,
                      index
                    )}`}
                    item={item}
                    restaurant={restaurant}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-[16px] border border-dashed border-[#173F35]/30 bg-[#DCE0CF]/45 px-6 py-12 text-center">
              <ChefHat
                size={36}
                className="mx-auto text-[#173F35]"
                aria-hidden="true"
              />
              <h3 className="mt-3 text-xl font-bold text-[#202421]">
                No matching recipes yet
              </h3>
              <p className="mt-2 text-base text-[#202421]">
                Try a different search or browse another category. Future
                collections will show published recipes here.
              </p>
            </div>
          )}
          {!loading && canViewMore && (
            <div className="mt-8 flex flex-col items-center gap-2 border-t border-[#DCE0CF] pt-7">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleViewMore}
                className="focus-ring inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#173F35] px-8 text-[15px] font-bold text-[#F7F6F2] transition hover:bg-[#202421] disabled:opacity-60"
              >
                {loadingMore
                  ? "Loading more recipes…"
                  : "View all · Show more recipes"}{" "}
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            </div>
          )}
          {(selectedCollection === "all" ||
            selectedCollection === "restaurant") && (
            <SponsoredCampaignSlot
              placement="recipe"
              slotKey="recipe_restaurants"
            />
          )}
        </div>
      </section>
    </main>
  );
}
