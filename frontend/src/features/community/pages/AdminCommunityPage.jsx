import {
  BadgeCheck,
  ChefHat,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { useSearchParams } from "react-router-dom";

import AdminShell from "../../admin/components/AdminShell";

import { useAdmin } from "../../admin/context/AdminContext";

import AdminExpansionTrustPanel from "../../communityExpansion/components/AdminExpansionTrustPanel";

import {
  getCommunityErrorMessage,
  getCommunityModerationDetail,
  listCommunityModerationQueue,
  listCreatorVerificationQueue,
  moderateCommunityRecipe,
  verifyCreatorProfile,
} from "../services/community.service";

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminCommunityPage() {
  const { hasAdminPermission } = useAdmin();

  const [searchParams] = useSearchParams();

  const canRecipeMutate = hasAdminPermission("recipe.mutate");

  const canRecipePublish = hasAdminPermission("recipe.publish");

  const canCreatorMutate = hasAdminPermission("trust_safety.mutate");

  const [tab, setTab] = useState(
    searchParams.get("tab") === "creators" ? "creators" : "recipes"
  );

  const [recipes, setRecipes] = useState([]);

  const [creators, setCreators] = useState([]);

  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const [selectedCreator, setSelectedCreator] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [detailBusy, setDetailBusy] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);

  const [error, setError] = useState("");

  const [queueErrors, setQueueErrors] = useState({});

  const [notice, setNotice] = useState("");

  const [reason, setReason] = useState("");

  const load = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      // Each review queue must render independently if the other API is unavailable.
      const [recipeState, creatorState] = await Promise.allSettled([
        listCommunityModerationQueue({ page: 1, limit: 50 }),
        listCreatorVerificationQueue({ page: 1, limit: 50, status: "pending" }),
      ]);
      const nextErrors = {};
      if (recipeState.status === "fulfilled") {
        setRecipes(recipeState.value?.recipes || []);
      } else {
        nextErrors.recipes = getCommunityErrorMessage(
          recipeState.reason,
          "Recipe reviews could not be loaded. Please try again."
        );
      }
      if (creatorState.status === "fulfilled") {
        setCreators(creatorState.value?.creators || []);
      } else {
        nextErrors.creators = getCommunityErrorMessage(
          creatorState.reason,
          "Creator verification requests could not be loaded. Please try again."
        );
      }
      setQueueErrors(nextErrors);
    } finally {
      setLoading(false);

      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("tab") === "creators") {
      setTab("creators");
    }
  }, [searchParams]);

  async function openRecipe(recipeId) {
    setDetailBusy(true);

    setError("");

    setNotice("");

    setReason("");

    try {
      setSelectedRecipe(await getCommunityModerationDetail(recipeId));

      setSelectedCreator(null);
    } catch (requestError) {
      setError(
        getCommunityErrorMessage(
          requestError,
          "Could not load this recipe review."
        )
      );
    } finally {
      setDetailBusy(false);
    }
  }

  async function decideRecipe(decision) {
    const recipeId = selectedRecipe?.communityRecipe?.id;

    if (!recipeId || !reason.trim()) {
      setNotice("A moderation reason is required.");

      return;
    }

    setActionBusy(true);

    setNotice("");

    try {
      const result = await moderateCommunityRecipe({
        communityRecipeId: recipeId,

        decision,

        reason: reason.trim(),
      });

      setSelectedRecipe(result);

      setNotice(
        decision === "approve"
          ? "Community Recipe published through existing M07 governance after M08 approval checks."
          : decision === "request_changes"
          ? "Changes requested; broad public discovery remains blocked."
          : "Community Recipe rejected; broad public discovery remains blocked."
      );

      await load(true);
    } catch (requestError) {
      setNotice(
        getCommunityErrorMessage(
          requestError,
          "Unable to record moderation decision."
        )
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function decideCreator(decision) {
    if (!selectedCreator?.id || !reason.trim()) {
      setNotice("A verification reason is required.");

      return;
    }

    setActionBusy(true);

    setNotice("");

    try {
      const result = await verifyCreatorProfile({
        creatorProfileId: selectedCreator.id,

        decision,

        reason: reason.trim(),
      });

      setSelectedCreator(result?.creator || selectedCreator);

      setNotice(
        decision === "verified"
          ? "Creator profile verified. No Customer/Host/Super Admin capability was changed."
          : `Creator verification ${decision}.`
      );

      await load(true);
    } catch (requestError) {
      setNotice(
        getCommunityErrorMessage(
          requestError,
          "Unable to record Creator verification decision."
        )
      );
    } finally {
      setActionBusy(false);
    }
  }

  const recipeDetail = selectedRecipe?.recipe || null;

  const recipeVersion = recipeDetail?.recipeVersion || null;

  const dish = recipeDetail?.dish || null;

  const foodState = selectedRecipe?.foodIntelligence || null;

  const canApproveRecipe =
    canRecipeMutate &&
    canRecipePublish &&
    foodState?.state === "approved_calculation_available";

  return (
    <AdminShell
      title="Community & Creator Reviews"
      description="Review community reports, check creator requests and manage content before it goes public."
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => load(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <section className="overflow-hidden rounded-[22px] border border-emerald-200 bg-[#e6f3ec]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-800">Community & creator safety</p>
            <h2 className="mt-1 text-xl font-bold leading-tight text-[#164838] sm:text-2xl">Review content before it reaches people.</h2>
            <p className="mt-1 text-sm leading-5 text-stone-700">Check reported content, verify creators and review professional courses or promotions.</p>
          </div>
          <div className="flex shrink-0 gap-3 rounded-xl bg-white/85 px-4 py-2.5 text-center">
            <div><p className="text-lg font-bold text-[#164838]">{recipes.length}</p><p className="text-xs text-stone-600">Recipe reviews</p></div>
            <div className="border-l border-stone-200 pl-3"><p className="text-lg font-bold text-[#164838]">{creators.length}</p><p className="text-xs text-stone-600">Creator requests</p></div>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-emerald-200 bg-white/45 text-center text-xs font-semibold text-[#245847] sm:text-sm">
          <div className="min-w-0 px-1.5 py-3 sm:px-4">01 · Open a report</div>
          <div className="min-w-0 border-x border-emerald-200 px-1.5 py-3 sm:px-4">02 · Check the facts</div>
          <div className="min-w-0 px-1.5 py-3 sm:px-4">03 · Save a decision</div>
        </div>
      </section>

      <AdminExpansionTrustPanel />

      <div className="flex items-start gap-2 border-l-4 border-amber-400 bg-amber-50 px-3 py-3 text-amber-950 sm:px-4">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <p className="text-sm leading-5">Private and friend-shared recipes do not need approval. The recipe queue below is only for older public community submissions. Creator verification does not grant new account permissions.</p>
      </div>
      <div className="mt-5 border-b border-stone-200 pb-3">
        <h2 className="text-lg font-bold text-[#164838]">Recipe and creator requests</h2>
        <p className="mt-1 text-sm text-stone-600">Choose a pending item to read its details and make a decision.</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setTab("recipes");

            setSelectedCreator(null);

            setNotice("");
          }}
          className={[
            "focus-ring rounded-full px-4 py-2 text-xs font-black",

            tab === "recipes"
              ? "bg-emerald-700 text-white"
              : "bg-white text-stone-600",
          ].join(" ")}
        >
          Public recipe reviews ({recipes.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setTab("creators");

            setSelectedRecipe(null);

            setNotice("");
          }}
          className={[
            "focus-ring rounded-full px-4 py-2 text-xs font-black",

            tab === "creators"
              ? "bg-emerald-700 text-white"
              : "bg-white text-stone-600",
          ].join(" ")}
        >
          Creator verification ({creators.length})
        </button>
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />

          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-72 place-items-center">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(260px,31%)_minmax(0,1fr)]">
          <section className="min-w-0 overflow-hidden rounded-[18px] border border-sky-100 bg-[#edf5f8]">
            <div className="border-b border-stone-200 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                {tab === "recipes" ? "Older public recipe requests" : "Creators waiting for verification"}
              </p>
            </div>

            <div className="max-h-[700px] overflow-y-auto p-3">
              {queueErrors[tab] ? (
                <div className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-800" role="alert">
                  {queueErrors[tab]}
                </div>
              ) : tab === "recipes" ? (
                recipes.length ? (
                  recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => openRecipe(recipe.id)}
                      className="focus-ring mb-2 block w-full rounded-2xl border border-stone-200 p-4 text-left last:mb-0 hover:border-emerald-300 hover:bg-emerald-50/30"
                    >
                      <p className="text-sm font-black text-stone-900">
                        Public recipe · {String(recipe.recipeVersionId || recipe.id || "").slice(-6)}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {recipe.sourceClassification} · {recipe.moderationState}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <FileSearch size={28} className="mx-auto text-stone-300" />

                    <p className="mt-3 text-sm font-black text-stone-600">
                      No older public recipes waiting for review
                    </p>
                  </div>
                )
              ) : creators.length ? (
                creators.map((creator) => (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => {
                      setSelectedCreator(creator);

                      setReason("");

                      setNotice("");
                    }}
                    className="focus-ring mb-2 block w-full rounded-2xl border border-stone-200 p-4 text-left last:mb-0 hover:border-emerald-300 hover:bg-emerald-50/30"
                  >
                    <p className="text-sm font-black text-stone-900">
                      {creator.displayName}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      @{creator.slug} · {creator.verificationStatus}
                    </p>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center">
                  <ChefHat size={28} className="mx-auto text-stone-300" />

                  <p className="mt-3 text-sm font-black text-stone-600">
                    No creator verification requests right now
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-[18px] border border-stone-200 bg-white p-4 sm:p-6">
            {detailBusy ? (
              <div className="grid min-h-72 place-items-center">
                <LoaderCircle className="animate-spin text-emerald-700" />
              </div>
            ) : tab === "recipes" && selectedRecipe ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                        Creator-provided content
                      </span>

                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-600">
                        {selectedRecipe.communityRecipe.moderationState}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-black text-stone-950">
                      {recipeVersion?.title || dish?.name || "Community Recipe"}
                    </h2>

                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      By{" "}
                      {selectedRecipe.creator?.displayName ||
                        "Community creator"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRecipe(null)}
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-500"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div
                  className={[
                    "mt-5 flex items-start gap-3 rounded-2xl border p-4",

                    foodState?.state === "approved_calculation_available"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-950",
                  ].join(" ")}
                >
                  {foodState?.state === "approved_calculation_available" ? (
                    <ShieldCheck size={19} className="mt-0.5 shrink-0" />
                  ) : (
                    <ShieldAlert size={19} className="mt-0.5 shrink-0" />
                  )}

                  <div>
                    <p className="text-xs font-black">
                      Food Intelligence:{" "}
                      {labelize(foodState?.state || "unknown")}
                    </p>

                    <p className="mt-1 text-[13px] leading-5 opacity-80">
                      Using an existing approved calculation:{" "}
                      {foodState?.copiedFromParent ? "yes" : "no"}.
                    </p>
                  </div>
                </div>

                {selectedRecipe.communityRecipe.creatorStatement ? (
                  <div className="mt-4 rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                      Creator statement
                    </p>

                    <p className="mt-2 text-sm leading-6 text-stone-700">
                      {selectedRecipe.communityRecipe.creatorStatement}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-black uppercase text-stone-400">
                      Ingredients
                    </p>

                    <p className="mt-2 text-xl font-black text-stone-950">
                      {recipeDetail?.ingredients?.length || 0}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-black uppercase text-stone-400">
                      Method steps
                    </p>

                    <p className="mt-2 text-xl font-black text-stone-950">
                      {recipeDetail?.steps?.length || 0}
                    </p>
                  </div>
                </div>

                {canRecipeMutate ? (
                  <div className="mt-6 border-t border-stone-200 pt-5">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                        Moderation reason
                      </span>

                      <textarea
                        rows={4}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
                      />
                    </label>

                    {notice ? (
                      <p className="mt-3 rounded-2xl bg-stone-100 p-3 text-xs font-bold leading-5 text-stone-600">
                        {notice}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={actionBusy || !canApproveRecipe}
                        onClick={() => decideRecipe("approve")}
                        className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <BadgeCheck size={15} />
                        Approve public recipe
                      </button>

                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => decideRecipe("request_changes")}
                        className="focus-ring rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800"
                      >
                        Request changes
                      </button>

                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => decideRecipe("reject")}
                        className="focus-ring rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700"
                      >
                        Reject
                      </button>
                    </div>

                    {!canRecipePublish ? (
                      <p className="mt-3 text-[13px] font-semibold text-stone-400">
                        Publishing access is required for approval.
                        Read/reject workflows do not create Super Admin
                        authority.
                      </p>
                    ) : foodState?.state !==
                      "approved_calculation_available" ? (
                      <p className="mt-3 text-[13px] font-semibold text-amber-700">
                        This recipe needs verified food information before it can be published.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : tab === "creators" && selectedCreator ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ChefHat size={20} className="text-emerald-700" />

                      <h2 className="text-2xl font-black text-stone-950">
                        {selectedCreator.displayName}
                      </h2>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      @{selectedCreator.slug} ·{" "}
                      {labelize(selectedCreator.creatorType)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCreator(null)}
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-500"
                  >
                    <X size={16} />
                  </button>
                </div>

                <p className="mt-5 text-sm leading-7 text-stone-600">
                  {selectedCreator.biography || "No biography supplied."}
                </p>

                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />

                    <p className="text-xs font-semibold leading-5">
                      Verifying a creator confirms their profile only. It does not change account access.
                    </p>
                  </div>
                </div>

                {canCreatorMutate ? (
                  <div className="mt-6 border-t border-stone-200 pt-5">
                    <textarea
                      rows={4}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Verification evidence / decision reason"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
                    />

                    {notice ? (
                      <p className="mt-3 rounded-2xl bg-stone-100 p-3 text-xs font-bold leading-5 text-stone-600">
                        {notice}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => decideCreator("verified")}
                        className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-xs font-black text-white"
                      >
                        <BadgeCheck size={15} />
                        Verify creator
                      </button>

                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => decideCreator("rejected")}
                        className="focus-ring rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700"
                      >
                        Reject verification
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-xs font-semibold text-stone-400">
                    You need permission to approve or reject creators.
                  </p>
                )}
              </>
            ) : (
              <div className="grid min-h-[210px] place-items-center text-center sm:min-h-[320px]">
                <div>
                  {tab === "recipes" ? (
                    <FileSearch size={34} className="mx-auto text-stone-300" />
                  ) : (
                    <ChefHat size={34} className="mx-auto text-stone-300" />
                  )}

                  <h2 className="mt-4 text-lg font-black text-stone-800">
                    Select a request to see its details
                  </h2>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}