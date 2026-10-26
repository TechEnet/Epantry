import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { recordApprovedFoodView } from "../../recipes/utils/recipeEngagement";
import {
  getPublicHostListing,
  listPublicHostListings,
} from "../services/hostUnifiedListing.service";

const label = {
  grocery: "Grocery",
  brand_recipe: "Brand recipe",
  kitchen_recipe: "Kitchen recipe",
  prepared_food: "Ready-made food",
};
function displayError(cause) {
  return (
    cause?.response?.data?.message ||
    cause?.message ||
    "Unable to load approved listings."
  );
}
export default function PublicApprovedHostListingsPage() {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const [params, setParams] = useSearchParams();
  const focus = params.get("item");
  const category = params.get("category") || "";
  const [list, setList] = useState([]);
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      listPublicHostListings(category),
      focus ? getPublicHostListing(focus) : Promise.resolve(null),
    ])
      .then(([rows, detail]) => {
        if (alive) {
          setList(rows?.listings || []);
          setItem(detail?.listing || null);
        }
      })
      .catch((cause) => {
        if (alive) setError(displayError(cause));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category, focus]);
  // Only record an actual open of a published food listing, not a thumbnail.
  useEffect(() => {
    if (isBootstrapping || !item?.id || item.type === "grocery") return;
    recordApprovedFoodView(
      item,
      isAuthenticated ? user?.id || user?._id || user?.uid : ""
    );
  }, [
    item?.id,
    isBootstrapping,
    isAuthenticated,
    user?.id,
    user?._id,
    user?.uid,
  ]);
  return (
    <main className="min-h-[70vh] bg-[#F7F6F2] px-3 py-6 text-[#202421] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1400px]">
        <Link
          to="/recipes"
          className="text-sm font-semibold text-[#173F35] underline"
        >
          Back to recipes
        </Link>
        <div className="mt-5 border-b border-[#D7DDCF] pb-5">
          <p className="text-sm font-semibold text-[#C86C42]">
            EPANTRY · Approved Host submissions
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            Explore food from our Hosts
          </h1>
          <p className="mt-2 text-base">
            Only Super Admin-approved submissions appear here. Product buying
            remains subject to separate verified marketplace availability.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-5 border-l-4 border-red-600 bg-red-50 p-4"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="mt-5">
            Loading approved listings…
          </p>
        ) : (
          <>
            <label className="mt-5 block text-sm font-semibold">
              Category{" "}
              <select
                className="ml-3 rounded-lg border border-[#CDD5C9] bg-white p-2"
                value={category}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  if (event.target.value)
                    next.set("category", event.target.value);
                  else next.delete("category");
                  next.delete("item");
                  setParams(next);
                }}
              >
                {[
                  ["", "All"],
                  ["grocery", "Grocery"],
                  ["breakfast", "Breakfast"],
                  ["lunch", "Lunch"],
                  ["dinner", "Dinner"],
                  ["snacks", "Snacks"],
                  ["drinks", "Drinks"],
                  ["sweets", "Sweets"],
                  ["desserts", "Desserts"],
                  ["bakery", "Bakery"],
                  ["main_course", "Main course"],
                  ["side_dish", "Side dish"],
                  ["other", "Other food"],
                ].map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {item && (
              <section className="mt-6 border-t-4 border-[#C86C42] bg-white p-4 sm:p-7">
                <Link
                  to={
                    category
                      ? `/explore/host-listings?category=${encodeURIComponent(
                          category
                        )}`
                      : "/explore/host-listings"
                  }
                  className="text-sm font-semibold text-[#173F35] underline"
                >
                  All approved listings
                </Link>
                <h2 className="mt-3 text-3xl font-semibold">{item.title}</h2>
                <p className="mt-2 text-base">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {item.images.map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      alt={`${item.title} ${index + 1}`}
                      src={url}
                      className="h-36 w-48 rounded-lg object-cover"
                    />
                  ))}
                </div>
                {item.ingredients?.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold">Ingredients</h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {item.ingredients.map((row, index) => (
                        <li
                          className="flex items-center gap-3 border-b border-[#D7DDCF] py-2"
                          key={index}
                        >
                          <Link
                            to={`/ingredients/${encodeURIComponent(row.canonicalIngredientId || row.name)}?listing=${encodeURIComponent(item.id)}`}
                            title={`Explore ${row.name}`}
                            aria-label={`Explore ${row.name} ingredient details`}
                            className="group/ingredient relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] text-[#173F35] transition duration-200 hover:scale-105 hover:border-[#C86C42] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#C86C42]"
                          >
                            {row.imageUrl ? (
                              <img src={row.imageUrl} alt={row.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover/ingredient:scale-110" />
                            ) : <span className="text-xl" aria-hidden="true">✳</span>}
                            <span className="absolute bottom-0 right-0 rounded-tl bg-white/95 px-1 text-xs text-[#C86C42]" aria-hidden="true">↗</span>
                          </Link>
                          <div className="min-w-0">
                            <Link to={`/ingredients/${encodeURIComponent(row.canonicalIngredientId || row.name)}?listing=${encodeURIComponent(item.id)}`} className="font-semibold text-[#173F35] underline-offset-2 hover:underline">{row.name}</Link>
                            <span className="text-[#57665B]"> · {row.quantity} {row.unit}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.shareRecipe && item.steps?.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold">How to make it</h3>
                    <ol className="mt-3 list-inside list-decimal space-y-3">
                      {item.steps.map((row, index) => (
                        <li key={index}>{row.instruction}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {item.offer && (
                  <p className="mt-6 bg-[#E6EDE4] p-4">
                    Host-declared price:{" "}
                    {item.offer.declaredPrice === null
                      ? "Not available"
                      : `₹${item.offer.declaredPrice}`}
                    . Purchase is available only through an independently
                    approved, live EPANTRY marketplace offer. This submission is
                    not itself a checkout item.
                  </p>
                )}
                <p className="mt-4 text-sm text-[#79543D]">
                  Ingredient, nutrition, allergy and dietary information was
                  declared by the Host and is not independently verified by this
                  listing review.
                </p>
              </section>
            )}
            {!item && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((row) => (
                  <Link
                    key={row.id}
                    to={`/explore/host-listings?${new URLSearchParams({
                      ...(category ? { category } : {}),
                      item: row.id,
                    })}`}
                    className="block overflow-hidden border border-[#D7DDCF] bg-white transition hover:border-[#173F35]"
                  >
                    {row.images[0] && (
                      <img
                        src={row.images[0]}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                      />
                    )}
                    <div className="p-4">
                      <p className="text-sm font-semibold text-[#C86C42]">
                        {label[row.type] || row.type} ·{" "}
                        {row.category.replaceAll("_", " ")}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold">
                        {row.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm">
                        {row.description}
                      </p>
                    </div>
                  </Link>
                ))}
                {!list.length && (
                  <p className="col-span-full py-10 text-base">
                    No approved Host listings in this category yet.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
