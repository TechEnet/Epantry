import { useState } from "react";

import { ArrowRight, ClipboardList, ShieldCheck } from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import {
  createOutcomePlanIdempotencyKey,
  createRecipeOutcomePlan,
  getOutcomePlanErrorMessage,
} from "../services/outcomePlan.service";

export default function RecipeOutcomePlanBridge() {
  const { slug } = useParams();

  const navigate = useNavigate();

  const { isAuthenticated, customerEnabled } = useAuth();

  const [targetServings, setTargetServings] = useState(2);

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");

  const canCreate = isAuthenticated && customerEnabled === true;

  if (!canCreate) {
    return null;
  }

  const handleCreate = async () => {
    if (!slug || creating) {
      return;
    }

    setCreating(true);

    setError("");

    try {
      const result = await createRecipeOutcomePlan(
        slug,

        {
          targetServings,

          idempotencyKey: createOutcomePlanIdempotencyKey(
            "recipe-outcome-plan"
          ),
        }
      );

      const planId = result?.plan?.id;

      if (!planId) {
        throw new Error(
          "Outcome Plan was created but its identity was not returned."
        );
      }

      navigate(`/outcome-plans/${planId}`);
    } catch (createError) {
      setError(
        getOutcomePlanErrorMessage(
          createError,

          "Unable to build this Recipe Outcome Plan."
        )
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="bg-[#f4efe6] pb-6 sm:pb-10">
      <div className="page-shell">
        <div className="overflow-hidden rounded-[18px] border border-[#d9cbb3] bg-[#fffdf8] text-stone-900 shadow-[0_8px_24px_rgba(92,70,38,0.07)] sm:rounded-[28px] sm:shadow-[0_16px_42px_rgba(92,70,38,0.08)]">
          <div className="grid gap-3 p-3 sm:gap-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-1.5 text-amber-700 sm:gap-2">
                <ClipboardList size={18} aria-hidden="true" />

                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] sm:text-xs sm:font-black sm:tracking-[0.16em]">
                  Recipe plan
                </p>
              </div>

              <h2 className="mt-1.5 font-sans text-[15px] font-semibold tracking-normal text-[#163b2a] sm:mt-3 sm:font-serif sm:text-3xl sm:font-semibold sm:tracking-tight">
                Turn this Recipe into a genuine missing list
              </h2>

              <p className="mt-1.5 max-w-2xl text-[10px] font-medium leading-4 text-stone-600 sm:mt-3 sm:text-base sm:font-normal sm:leading-6">
                EPANTRY adjusts the ingredients for your selected servings, checks
                what is confirmed in your Living Pantry, and shows what you still
                need. Items that are only likely or uncertain stay unconfirmed
                instead of being guessed as exact stock.
              </p>

              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold leading-4 text-stone-500 sm:mt-4 sm:gap-2 sm:text-xs sm:font-bold">
                <ShieldCheck size={15} aria-hidden="true" />
                Product, price, seller and checkout selection remain outside
                this step.
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 shadow-sm sm:min-w-[250px] sm:rounded-[22px] sm:p-4">
              <label className="block text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-800 sm:text-xs sm:font-black sm:tracking-[0.12em]">
                Servings
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={targetServings}
                  onChange={(event) => setTargetServings(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:mt-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-base sm:font-black"
                />
              </label>

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#194d38] px-3 py-2 text-[10px] font-semibold text-white shadow-sm transition hover:bg-[#123b2b] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-3 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm sm:font-black"
              >
                {creating ? "Building plan…" : "Create Outcome Plan"}

                {!creating && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="border-t border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold text-rose-800 sm:px-8 sm:py-4 sm:text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
