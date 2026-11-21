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
      description={<span className="hidden sm:inline">Review public content, creator requests and promotions.</span>}
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => load(true)}
          className="focus-ring inline-flex items-center gap-2 border border-[#D7DDCF] bg-[#F7F6F2] px-4 py-2 text-sm font-semibold text-[#173F35] transition hover:border-[#C56C42] disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <div className="min-w-0 w-full pb-5 text-[#202421]">
        {/* A clear first-scan introduction; the live queues remain the source of truth. */}
        <section aria-label="Review desk summary" className="grid min-w-0 overflow-hidden rounded-[22px] border border-[#D7DDCF] lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
          <div className="relative min-w-0 border-l-[7px] border-[#C56C42] bg-[#F7F6F2] px-5 py-6 text-[#202421] sm:px-9 sm:py-8">
            <span className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[.10em] text-[#C56C42]">
              <ShieldCheck size={17} /> EPANTRY / Content review
            </span>
            <h2 className="mt-3 max-w-[660px] text-[23px] font-extrabold leading-[1.18] tracking-tight sm:text-[38px] sm:leading-[1.12]">
              Make every approval count.
            </h2>
            <p className="mt-3 hidden max-w-xl text-[15px] font-medium leading-6 text-[#173F35] sm:block">
              Public recipes, creator verification and paid promotions—all checked in one place.
            </p>
            <a href="#review-requests" className="focus-ring mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#173F35] px-5 py-2 text-sm font-bold text-[#F7F6F2] transition hover:bg-[#202421]">
              Review submissions <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-px bg-[#D7DDCF] lg:grid-cols-1">
            <div className="flex min-w-0 flex-col justify-center bg-[#D7DDCF]/65 px-5 py-5 sm:px-7 lg:py-6">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#173F35]"><FileSearch size={17} /> Public recipes</span>
              <span className="mt-3 text-[27px] font-extrabold leading-none tabular-nums text-[#202421] sm:text-[43px]">{loading ? "—" : recipes.length}</span>
              <span className="mt-1 hidden text-sm text-[#173F35] sm:block">awaiting a decision</span>
            </div>
            <div className="flex min-w-0 flex-col justify-center bg-[#D7DDCF]/90 px-5 py-5 sm:px-7 lg:py-6">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#173F35]"><BadgeCheck size={17} /> Creator profiles</span>
              <span className="mt-3 text-[27px] font-extrabold leading-none tabular-nums text-[#202421] sm:text-[43px]">{loading ? "—" : creators.length}</span>
              <span className="mt-1 hidden text-sm text-[#173F35] sm:block">awaiting verification</span>
            </div>
          </div>
        </section>

        <section id="review-requests" className="mt-8 min-w-0 scroll-mt-28 sm:mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.10em] text-[#C56C42]">01 / Decisions</p>
              <h2 className="mt-1 text-[21px] font-bold leading-tight tracking-tight text-[#202421] sm:text-[31px]">Your review desk</h2>
            </div>
            <span className="hidden text-sm font-medium text-[#173F35] sm:inline">{loading ? "Checking submissions…" : `${recipes.length + creators.length} requests waiting`}</span>
          </div>

          <div role="group" aria-label="Review type" className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              onClick={() => { setTab("recipes"); setSelectedCreator(null); setNotice(""); }}
              aria-pressed={tab === "recipes"}
              className={`focus-ring flex min-h-[80px] min-w-0 items-center gap-4 rounded-[14px] border px-4 py-4 text-left transition sm:px-6 ${tab === "recipes" ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2] shadow-[0_8px_22px_rgba(23,63,53,.13)]" : "border-[#D7DDCF] bg-[#F7F6F2] text-[#202421] hover:border-[#C56C42] hover:bg-[#D7DDCF]/35"}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${tab === "recipes" ? "bg-[#F7F6F2]/15" : "bg-[#D7DDCF] text-[#173F35]"}`}><FileSearch size={18} className="sm:h-[23px] sm:w-[23px]" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold leading-tight">Public recipes</span><span className={`mt-1 block text-sm ${tab === "recipes" ? "text-[#F7F6F2]/80" : "text-[#173F35]"}`}>Review submissions</span></span>
              <span className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-full px-2 text-sm sm:h-9 sm:min-w-9 font-extrabold tabular-nums ${tab === "recipes" ? "bg-[#C56C42] text-[#202421]" : "bg-[#D7DDCF] text-[#202421]"}`}>{recipes.length}</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab("creators"); setSelectedRecipe(null); setNotice(""); }}
              aria-pressed={tab === "creators"}
              className={`focus-ring flex min-h-[80px] min-w-0 items-center gap-4 rounded-[14px] border px-4 py-4 text-left transition sm:px-6 ${tab === "creators" ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2] shadow-[0_8px_22px_rgba(23,63,53,.13)]" : "border-[#D7DDCF] bg-[#F7F6F2] text-[#202421] hover:border-[#C56C42] hover:bg-[#D7DDCF]/35"}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${tab === "creators" ? "bg-[#F7F6F2]/15" : "bg-[#D7DDCF] text-[#173F35]"}`}><BadgeCheck size={18} className="sm:h-[23px] sm:w-[23px]" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold leading-tight">Creator verification</span><span className={`mt-1 block text-sm ${tab === "creators" ? "text-[#F7F6F2]/80" : "text-[#173F35]"}`}>Check creator profiles</span></span>
              <span className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-full px-2 text-sm sm:h-9 sm:min-w-9 font-extrabold tabular-nums ${tab === "creators" ? "bg-[#C56C42] text-[#202421]" : "bg-[#D7DDCF] text-[#202421]"}`}>{creators.length}</span>
            </button>
          </div>

          <div className="mt-3 min-w-0 rounded-[16px] border border-[#D7DDCF] bg-[#F7F6F2] px-4 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7DDCF] pb-4">
              <h3 className="text-[16px] font-bold text-[#202421] sm:text-xl">{tab === "recipes" ? "Public recipe requests" : "Creator verification requests"}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D7DDCF] px-3 py-1.5 text-xs font-bold text-[#173F35]">{tab === "recipes" ? recipes.length : creators.length} pending</span>
            </div>
          {error ? (
            <div role="alert" className="mt-4 flex items-start gap-3 border-l-4 border-red-700 bg-[#F7F6F2] px-4 py-3 text-sm font-semibold text-red-800"><CircleAlert size={18} className="shrink-0" />{error}</div>
          ) : null}

          {loading ? (
            <div className="mt-4 flex items-center gap-3 border border-[#D7DDCF] bg-[#F7F6F2] p-6 text-sm text-[#173F35]"><LoaderCircle size={18} className="animate-spin" /> Loading review requests…</div>
          ) : (tab === "recipes" ? recipes.length === 0 : creators.length === 0) && !queueErrors[tab] ? (
            <div className="mt-5 flex min-w-0 flex-col items-start gap-4 rounded-[14px] bg-[#D7DDCF]/60 px-5 py-6 sm:flex-row sm:items-center sm:px-7">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-14 sm:w-14 bg-[#173F35] text-[#F7F6F2]">{tab === "recipes" ? <FileSearch size={18} className="sm:h-[25px] sm:w-[25px]" /> : <ChefHat size={18} className="sm:h-[25px] sm:w-[25px]" />}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-extrabold leading-tight text-[#202421] sm:text-[20px]">All clear for now.</p>
                <p className="mt-1 hidden text-[15px] leading-6 text-[#173F35] sm:block">{tab === "recipes" ? "No public recipes are waiting for review." : "No creators are waiting for verification."}</p>
              </div>
              <span className="hidden shrink-0 rounded-full border border-[#173F35]/25 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#173F35] sm:inline-flex">Queue empty</span>
            </div>
          ) : (
            <div className="mt-5 grid min-w-0 overflow-hidden rounded-[12px] border border-[#D7DDCF] bg-[#F7F6F2] lg:grid-cols-[minmax(240px,32%)_minmax(0,1fr)]">
              <div className="min-w-0 border-b border-[#D7DDCF] lg:border-b-0 lg:border-r">
                <div className="border-b border-[#D7DDCF] bg-[#D7DDCF] px-4 py-3 sm:px-5">
                  <p className="text-sm font-bold text-[#173F35]">{tab === "recipes" ? "Public recipe submissions" : "Creator requests"}</p>
                </div>
                <div className="max-h-[560px] overflow-y-auto overscroll-contain">
                  {queueErrors[tab] ? (
                    <p role="alert" className="p-4 text-sm font-semibold text-red-800">{queueErrors[tab]}</p>
                  ) : tab === "recipes" ? recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => openRecipe(recipe.id)}
                      className={`focus-ring block w-full border-b border-[#D7DDCF] px-4 py-4 text-left transition last:border-b-0 hover:bg-[#D7DDCF]/60 ${selectedRecipe?.communityRecipe?.id === recipe.id ? "border-l-4 border-l-[#C56C42] bg-[#D7DDCF]" : "border-l-4 border-l-transparent"}`}
                    >
                      <p className="text-sm font-bold text-[#202421]">Public recipe · {String(recipe.recipeVersionId || recipe.id || "").slice(-6)}</p>
                      <p className="mt-1 text-xs text-[#173F35]">{labelize(recipe.sourceClassification)} · {labelize(recipe.moderationState)}</p>
                    </button>
                  )) : creators.map((creator) => (
                    <button
                      key={creator.id}
                      type="button"
                      onClick={() => { setSelectedCreator(creator); setReason(""); setNotice(""); }}
                      className={`focus-ring block w-full border-b border-[#D7DDCF] px-4 py-4 text-left transition last:border-b-0 hover:bg-[#D7DDCF]/60 ${selectedCreator?.id === creator.id ? "border-l-4 border-l-[#C56C42] bg-[#D7DDCF]" : "border-l-4 border-l-transparent"}`}
                    >
                      <p className="text-sm font-bold text-[#202421]">{creator.displayName}</p>
                      <p className="mt-1 text-xs text-[#173F35]">@{creator.slug} · {labelize(creator.verificationStatus)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0 px-3 py-5 sm:px-6 sm:py-6">
                {detailBusy ? (
                  <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-[#173F35]"><LoaderCircle size={18} className="animate-spin" /> Opening details…</div>
                ) : tab === "recipes" && selectedRecipe ? (
                  <>
                    <div className="flex items-start justify-between gap-4 border-b border-[#D7DDCF] pb-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#C56C42]">Public recipe review · {labelize(selectedRecipe.communityRecipe?.moderationState)}</p>
                        <h3 className="mt-1 text-xl font-bold text-[#202421] sm:text-2xl">{recipeVersion?.title || dish?.name || "Community Recipe"}</h3>
                        <p className="mt-1 text-sm text-[#173F35]">Submitted by {selectedRecipe.creator?.displayName || "Community creator"}</p>
                      </div>
                      <button type="button" aria-label="Close recipe details" onClick={() => setSelectedRecipe(null)} className="focus-ring grid h-9 w-9 shrink-0 place-items-center border border-[#D7DDCF] text-[#173F35]"><X size={17} /></button>
                    </div>
                    <div className={`mt-4 flex items-start gap-3 border-l-4 px-4 py-3 ${foodState?.state === "approved_calculation_available" ? "border-[#173F35] bg-[#D7DDCF]" : "border-[#C56C42] bg-[#F7F6F2]"}`}>
                      {foodState?.state === "approved_calculation_available" ? <ShieldCheck size={19} className="mt-0.5 shrink-0" /> : <ShieldAlert size={19} className="mt-0.5 shrink-0" />}
                      <div>
                        <p className="text-sm font-bold text-[#202421]">Food information: {labelize(foodState?.state || "unknown")}</p>
                        <p className="mt-1 text-xs text-[#173F35]">Approved calculation reused: {foodState?.copiedFromParent ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    {selectedRecipe.communityRecipe.creatorStatement ? (
                      <div className="mt-4 border-b border-[#D7DDCF] pb-4">
                        <p className="text-xs font-bold uppercase text-[#C56C42]">Creator statement</p>
                        <p className="mt-2 text-sm leading-6 text-[#202421]">{selectedRecipe.communityRecipe.creatorStatement}</p>
                      </div>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 divide-x divide-[#D7DDCF] border-y border-[#D7DDCF] py-3">
                      <div><p className="text-xs text-[#173F35]">Ingredients</p><p className="mt-1 text-xl font-bold tabular-nums">{recipeDetail?.ingredients?.length || 0}</p></div>
                      <div className="pl-5"><p className="text-xs text-[#173F35]">Method steps</p><p className="mt-1 text-xl font-bold tabular-nums">{recipeDetail?.steps?.length || 0}</p></div>
                    </div>
                    {canRecipeMutate ? (
                      <div className="mt-5">
                        <label htmlFor="community-recipe-review-reason" className="block text-sm font-bold text-[#173F35]">Reason for decision</label>
                        <textarea id="community-recipe-review-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="focus-ring mt-2 w-full resize-y border border-[#D7DDCF] bg-white px-3 py-3 text-sm text-[#202421] outline-none" />
                        {notice ? <p role="status" className="mt-3 border-l-4 border-[#C56C42] bg-[#D7DDCF] px-3 py-2 text-sm text-[#202421]">{notice}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" disabled={actionBusy || !canApproveRecipe} onClick={() => decideRecipe("approve")} className="focus-ring inline-flex items-center gap-2 bg-[#173F35] px-4 py-2.5 text-sm font-bold text-[#F7F6F2] disabled:opacity-40"><BadgeCheck size={16} /> Approve recipe</button>
                          <button type="button" disabled={actionBusy} onClick={() => decideRecipe("request_changes")} className="focus-ring border border-[#C56C42] bg-[#F7F6F2] px-4 py-2.5 text-sm font-semibold text-[#202421] disabled:opacity-50">Request changes</button>
                          <button type="button" disabled={actionBusy} onClick={() => decideRecipe("reject")} className="focus-ring border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50">Reject</button>
                        </div>
                        {!canRecipePublish ? <p className="mt-2 text-sm text-[#173F35]">Publishing permission is required to approve.</p> : foodState?.state !== "approved_calculation_available" ? <p className="mt-2 text-sm text-[#173F35]">Verified food information is needed before approval.</p> : null}
                      </div>
                    ) : null}
                  </>
                ) : tab === "creators" && selectedCreator ? (
                  <>
                    <div className="flex items-start justify-between gap-3 border-b border-[#D7DDCF] pb-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#C56C42]">Creator verification</p>
                        <h3 className="mt-1 text-xl font-bold text-[#202421] sm:text-2xl">{selectedCreator.displayName}</h3>
                        <p className="mt-1 text-sm text-[#173F35]">@{selectedCreator.slug} · {labelize(selectedCreator.creatorType)}</p>
                      </div>
                      <button type="button" aria-label="Close creator details" onClick={() => setSelectedCreator(null)} className="focus-ring grid h-9 w-9 shrink-0 place-items-center border border-[#D7DDCF] text-[#173F35]"><X size={17} /></button>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#202421]">{selectedCreator.biography || "No biography supplied."}</p>
                    <div className="mt-5 flex items-start gap-3 border-l-4 border-[#173F35] bg-[#D7DDCF] px-4 py-3 text-sm text-[#202421]"><ShieldCheck size={18} className="shrink-0" /><span>Verification confirms the creator profile; it does not grant new account access.</span></div>
                    {canCreatorMutate ? (
                      <div className="mt-5 border-t border-[#D7DDCF] pt-4">
                        <label htmlFor="community-creator-review-reason" className="block text-sm font-bold text-[#173F35]">Reason for decision</label>
                        <textarea id="community-creator-review-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="focus-ring mt-2 w-full resize-y border border-[#D7DDCF] bg-white px-3 py-3 text-sm text-[#202421] outline-none" placeholder="Evidence and decision reason" />
                        {notice ? <p role="status" className="mt-3 border-l-4 border-[#C56C42] bg-[#D7DDCF] px-3 py-2 text-sm text-[#202421]">{notice}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" disabled={actionBusy} onClick={() => decideCreator("verified")} className="focus-ring inline-flex items-center gap-2 bg-[#173F35] px-4 py-2.5 text-sm font-bold text-[#F7F6F2] disabled:opacity-40"><BadgeCheck size={16} /> Verify creator</button>
                          <button type="button" disabled={actionBusy} onClick={() => decideCreator("rejected")} className="focus-ring border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50">Reject verification</button>
                        </div>
                      </div>
                    ) : <p className="mt-5 text-sm text-[#173F35]">Approval permission is required to take action.</p>}
                  </>
                ) : (
                  <div className="flex min-h-[130px] items-center gap-4 text-[#173F35] sm:min-h-[190px]">
                    <div className="grid h-12 w-12 shrink-0 place-items-center bg-[#D7DDCF]">{tab === "recipes" ? <FileSearch size={23} /> : <ChefHat size={23} />}</div>
                    <div><p className="text-base font-bold text-[#202421]">Select a request to view its details</p><p className="mt-1 text-sm">Decision options will appear here.</p></div>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </section>

        <section id="community-content-checks" className="mt-10 scroll-mt-24 pt-3 sm:mt-12">
          <AdminExpansionTrustPanel />
        </section>
      </div>
    </AdminShell>
  );
}
