import {
  BadgeCheck,
  BookOpenText,
  ChefHat,
  CookingPot,
  PackageCheck,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

export const landingHero = {
  eyebrow: "Grocery • Brands • Recipes",

  title:
    "From food discovery to cooking, everything stays connected.",

  description:
    "EPANTRY is a food intelligence and commerce platform that connects grocery products, trusted brands, recipes, ingredients and shopping into one seamless experience.",

  primaryAction: {
    label: "Explore Grocery",
    path: "/grocery",
  },

  secondaryAction: {
    label: "Discover Recipes",
    path: "/recipes",
  },

  searchPlaceholder:
    "Search products, brands or recipes...",

  quickSearches: [
    "Milk",
    "Amul",
    "Paneer",
    "Pasta Recipe",
  ],
};

export const landingCategories = [
  {
    id: "grocery",

    title: "Grocery",

    description:
      "Explore grocery products, compare available options and find the right products for your everyday needs.",

    buttonText: "Explore Grocery",

    path: "/grocery",

    icon: ShoppingBasket,
  },

  {
    id: "brands",

    title: "Brands",

    description:
      "Discover trusted brands and explore all of their verified products from one connected brand experience.",

    buttonText: "Explore Brands",

    path: "/brands",

    icon: BadgeCheck,
  },

  {
    id: "recipes",

    title: "Recipes",

    description:
      "Discover recipes, understand required ingredients and add the products you need directly to your basket.",

    buttonText: "Explore Recipes",

    path: "/recipes",

    icon: CookingPot,
  },
];

export const landingJourneySteps = [
  {
    id: "discover",
    step: "01",
    title: "Discover",

    description:
      "Search or explore grocery products, brands and recipes from one connected platform.",

    icon: Search,
  },

  {
    id: "understand",
    step: "02",
    title: "Understand",

    description:
      "View structured product information, recipe ingredients, brand details and relevant food intelligence.",

    icon: BookOpenText,
  },

  {
    id: "build-basket",
    step: "03",
    title: "Build Your Basket",

    description:
      "Select individual products or add the ingredients required for a recipe to your shopping basket.",

    icon: ShoppingCart,
  },

  {
    id: "cook",
    step: "04",
    title: "Buy & Cook",

    description:
      "Complete your purchase and continue the journey from shopping to cooking.",

    icon: ChefHat,
  },
];

export const landingBenefits = [
  {
    id: "search",
    title: "Smart Discovery",

    description:
      "Discover products, brands and recipes through one connected search experience.",

    icon: Search,
  },

  {
    id: "trusted-data",
    title: "Trusted Product Data",

    description:
      "Understand products through structured brand, ingredient and verified product information.",

    icon: PackageCheck,
  },

  {
    id: "food-intelligence",
    title: "Food Intelligence",

    description:
      "Use AI, recipe intelligence and pantry intelligence to make smarter food decisions.",

    icon: Sparkles,
  },
];