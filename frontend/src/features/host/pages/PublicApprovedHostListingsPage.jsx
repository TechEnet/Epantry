import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { recordApprovedFoodView } from "../../recipes/utils/recipeEngagement";
import { hostDetailPath } from "../services/approvedHostDetail.adapter";
import BookmarkButton from "../../bookmarks/components/BookmarkButton";
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
      focus ? Promise.resolve({ listings: [] }) : listPublicHostListings(category),
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
  // A Host submission must use the EXISTING customer recipe/grocery detail design.
  if (item) return <Navigate to={hostDetailPath(item)} replace />;

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
            {!item && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((row) => (
                  <div key={row.id} className="relative min-w-0">
                  <Link
                    to={hostDetailPath(row)}
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
                  <BookmarkButton kind={row.type === 'grocery' ? 'grocery' : 'recipe'} slug={hostDetailPath(row).split('/').pop()} title={row.title} className="absolute right-2 top-2" />
                  </div>
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
