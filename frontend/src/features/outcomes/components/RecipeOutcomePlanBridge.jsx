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
    <section className="bg-[#f4efe6] pb-10">
      <div className="page-shell">
        <div className="overflow-hidden rounded-[28px] border border-[#d9cbb3] bg-[#fffdf8] text-stone-900 shadow-[0_16px_42px_rgba(92,70,38,0.08)]">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-amber-700">
                <ClipboardList size={18} aria-hidden="true" />

                <p className="text-xs font-black uppercase tracking-[0.16em]">
                  M10 · Outcome Plan
                </p>
              </div>

              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#163b2a]">
                Turn this Recipe into a genuine missing list
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                EPANTRY scales the Recipe, reconciles your household Pantry and
                creates a requirement-first plan. Confirmed Pantry quantity is
                subtracted deterministically; likely or uncertain Pantry is not
                converted into fake exact stock.
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-stone-500">
                <ShieldCheck size={15} aria-hidden="true" />
                Product, price, seller and checkout selection remain outside
                this step.
              </div>
            </div>

            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm sm:min-w-[250px]">
              <label className="block text-xs font-black uppercase tracking-[0.12em] text-emerald-800">
                Servings
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={targetServings}
                  onChange={(event) => setTargetServings(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-base font-black text-stone-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#194d38] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123b2b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Building plan…" : "Create Outcome Plan"}

                {!creating && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="border-t border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-800 sm:px-8">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
