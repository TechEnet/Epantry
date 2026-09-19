import {
  BadgeCheck,
  BookOpen,
  ChefHat,
  CircleAlert,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Star,
  UserPlus,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import {
  createCreatorCourse,
  createCreatorProfile,
  followCreator,
  getCommunityErrorMessage,
  getCreatorProfile,
  getMyCreatorProfile,
  listCommunityRecipes,
  listCreatorCourses,
  requestCreatorVerification,
} from "../services/community.service";

function statusLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CreatorProfilePage() {
  const { creatorProfileId } = useParams();

  const { isAuthenticated, customerEnabled } = useAuth();

  const isOwnStudio = !creatorProfileId;

  const [profileData, setProfileData] = useState(null);

  const [recipes, setRecipes] = useState([]);

  const [courses, setCourses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [busy, setBusy] = useState(false);

  const [profileForm, setProfileForm] = useState({
    slug: "",

    displayName: "",

    biography: "",

    cuisineSpecialties: "",

    languages: "en",

    commercialDisclosure: "",
  });

  const [verificationStatement, setVerificationStatement] = useState("");

  const [courseForm, setCourseForm] = useState({
    linkedCommunityRecipeId: "",

    slug: "",

    title: "",

    summary: "",

    category: "",

    language: "en",

    accessType: "free",

    requiredEquipment: "",

    commercialDisclosure: "",

    sponsored: false,
  });

  const creator = profileData?.creator || null;

  const stats = profileData?.stats || {};

  const load = useCallback(async () => {
    setLoading(true);

    setError("");

    try {
      const data = isOwnStudio
        ? await getMyCreatorProfile()
        : await getCreatorProfile(creatorProfileId);

      setProfileData(data);

      const profile = data?.creator;

      if (profile?.id) {
        const [recipeResult, courseResult] = await Promise.all([
          listCommunityRecipes({
            creatorId: profile.id,

            page: 1,

            limit: 30,
          }),

          listCreatorCourses({
            creatorId: profile.id,

            page: 1,

            limit: 30,
          }),
        ]);

        setRecipes(recipeResult?.recipes || []);

        setCourses(courseResult?.courses || []);
      } else {
        setRecipes([]);

        setCourses([]);
      }
    } catch (requestError) {
      setError(
        getCommunityErrorMessage(
          requestError,
          "Unable to load Creator profile."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [creatorProfileId, isOwnStudio]);

  useEffect(() => {
    load();
  }, [load]);

  const publicRecipeOptions = useMemo(
    () =>
      recipes.map((item) => ({
        id: item.communityRecipe.id,

        label: item.dish.name,
      })),
    [recipes]
  );

  async function handleCreateProfile(event) {
    event.preventDefault();

    setBusy(true);

    setNotice("");

    setError("");

    try {
      await createCreatorProfile({
        slug: profileForm.slug,

        displayName: profileForm.displayName,

        biography: profileForm.biography,

        cuisineSpecialties: profileForm.cuisineSpecialties
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),

        languages: profileForm.languages
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),

        commercialDisclosure: profileForm.commercialDisclosure,
      });

      setNotice(
        "Creator profile created on your existing Customer identity. No new application role was created."
      );

      await load();
    } catch (requestError) {
      setError(
        getCommunityErrorMessage(
          requestError,
          "Unable to create Creator profile."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerification() {
    if (verificationStatement.trim().length < 10) {
      setNotice(
        "Add a short verification statement describing your professional/creator credentials."
      );

      return;
    }

    setBusy(true);

    setNotice("");

    try {
      await requestCreatorVerification(verificationStatement.trim());

      setVerificationStatement("");

      setNotice(
        "Verification request submitted. Trust & Safety review is required before Chef status is granted."
      );

      await load();
    } catch (requestError) {
      setNotice(
        getCommunityErrorMessage(
          requestError,
          "Unable to request Creator verification."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFollow() {
    if (!creator?.id) {
      return;
    }

    setBusy(true);

    setNotice("");

    try {
      await followCreator(creator.id);

      setNotice(
        "Creator followed. Friends-only visibility still requires mutual following."
      );
    } catch (requestError) {
      setNotice(
        getCommunityErrorMessage(requestError, "Unable to follow this Creator.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCourseCreate(event) {
    event.preventDefault();

    setBusy(true);

    setNotice("");

    setError("");

    try {
      await createCreatorCourse({
        linkedCommunityRecipeId: courseForm.linkedCommunityRecipeId,

        slug: courseForm.slug,

        title: courseForm.title,

        summary: courseForm.summary,

        category: courseForm.category,

        language: courseForm.language,

        accessType: courseForm.accessType,

        requiredEquipment: courseForm.requiredEquipment
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),

        commercialDisclosure: courseForm.commercialDisclosure,

        rights: {
          ownerOrLicensor: creator.displayName,

          allowedTerritories: [],

          downloadableMaterialsAllowed: false,

          sponsored: courseForm.sponsored,
        },
      });

      setNotice(
        "Learn / Pro course created. Open Course Builder to add modules, lessons, governed media and publication states. M22 live-session/payment flows remain separate."
      );

      setCourseForm({
        linkedCommunityRecipeId: "",

        slug: "",

        title: "",

        summary: "",

        category: "",

        language: "en",

        accessType: "free",

        requiredEquipment: "",

        commercialDisclosure: "",

        sponsored: false,
      });

      await load();
    } catch (requestError) {
      setError(
        getCommunityErrorMessage(
          requestError,
          "Unable to create Learn/Pro course placeholder."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell grid min-h-[420px] place-items-center py-10">
        <LoaderCircle className="animate-spin text-emerald-700" />
      </main>
    );
  }

  if (isOwnStudio && !isAuthenticated) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] border border-stone-200 bg-white p-8 text-center">
          <ChefHat size={34} className="mx-auto text-emerald-700" />

          <h1 className="mt-4 text-2xl font-black text-stone-950">
            Creator Studio requires Customer access
          </h1>

          <Link
            to="/login"
            className="focus-ring mt-5 inline-flex rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (error && !isOwnStudio) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] bg-red-50 p-6 text-red-800">{error}</div>
      </main>
    );
  }

  if (isOwnStudio && !creator) {
    return (
      <main className="page-shell py-8 sm:py-10">
        <section className="mx-auto max-w-3xl rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-700 text-white">
              <ChefHat size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                P30 · Creator Studio
              </p>

              <h1 className="text-3xl font-black text-stone-950">
                Create your Creator profile
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-stone-600">
            Creator is a profile on your existing Customer identity, not a new
            top-level access role. Verification is separately reviewed by Trust
            & Safety.
          </p>

          <form
            onSubmit={handleCreateProfile}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <label>
              <span className="text-xs font-black text-stone-500">
                Public handle
              </span>

              <input
                required
                value={profileForm.slug}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,

                    slug: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
              />
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">
                Display name
              </span>

              <input
                required
                value={profileForm.displayName}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,

                    displayName: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-black text-stone-500">
                Biography
              </span>

              <textarea
                rows={4}
                value={profileForm.biography}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,

                    biography: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">
                Cuisine specialties
              </span>

              <input
                value={profileForm.cuisineSpecialties}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,

                    cuisineSpecialties: event.target.value,
                  }))
                }
                placeholder="Indian, baking"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">
                Languages
              </span>

              <input
                value={profileForm.languages}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,

                    languages: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-black text-stone-500">
                Commercial disclosure
              </span>

              <textarea
                rows={3}
                value={profileForm.commercialDisclosure}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,

                    commercialDisclosure: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="focus-ring sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Create Creator profile
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              {notice}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell py-8 sm:py-10">
      <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-emerald-700 text-white">
                <ChefHat size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black text-stone-950">
                    {creator.displayName}
                  </h1>

                  {creator.verificationStatus === "verified" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                      <BadgeCheck size={13} />
                      Verified Chef/Creator
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black text-stone-600">
                      {statusLabel(creator.verificationStatus)}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs font-bold text-stone-500">
                  @{creator.slug} · {statusLabel(creator.creatorType)}
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-sm leading-7 text-stone-600">
              {creator.biography || "No biography supplied."}
            </p>

            {creator.commercialDisclosure ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
                  Commercial disclosure
                </p>

                <p className="mt-2 text-xs leading-5 text-blue-900">
                  {creator.commercialDisclosure}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {(creator.cuisineSpecialties || []).map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="border-t border-stone-200 bg-[#f7f5ef] p-6 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1">
              {[
                ["Recipes", stats.publishedRecipeCount || 0],

                ["Followers", stats.followerCount || 0],

                ["Courses", stats.listedCourseCount || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white p-4">
                  <p className="text-xl font-black text-stone-950">{value}</p>

                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {!isOwnStudio && isAuthenticated && customerEnabled ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleFollow}
                className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                <UserPlus size={16} />
                Follow creator
              </button>
            ) : null}
          </aside>
        </div>
      </section>

      {notice ? (
        <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {isOwnStudio && creator.verificationStatus !== "verified" ? (
        <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={19} className="text-emerald-700" />

            <h2 className="text-xl font-black text-stone-950">
              Creator verification
            </h2>
          </div>

          <p className="mt-2 text-sm leading-6 text-stone-500">
            Verification changes only CreatorProfile status. It does not set
            hostEnabled, superAdminEnabled or any application role.
          </p>

          <textarea
            rows={3}
            value={verificationStatement}
            onChange={(event) => setVerificationStatement(event.target.value)}
            placeholder="Describe credentials, professional experience, or other verification context."
            className="mt-4 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
          />

          <button
            type="button"
            disabled={busy || creator.verificationStatus === "pending"}
            onClick={handleVerification}
            className="focus-ring mt-3 inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
          >
            <BadgeCheck size={15} />

            {creator.verificationStatus === "pending"
              ? "Verification pending"
              : "Request verification"}
          </button>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-stone-950">
            Published Community Recipes
          </h2>

          <div className="mt-4 space-y-3">
            {recipes.length ? (
              recipes.map((item) => (
                <Link
                  key={item.communityRecipe.id}
                  to={`/community/${encodeURIComponent(
                    item.communityRecipe.id
                  )}`}
                  className="focus-ring block rounded-2xl border border-stone-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-stone-900">
                        {item.dish.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {item.dish.cuisine || "Community recipe"}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-black text-amber-700">
                      <Star size={13} className="fill-current" />

                      {item.ratings.average ?? "—"}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm font-semibold text-stone-400">
                No published Community Recipes yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen size={19} className="text-emerald-700" />

            <h2 className="text-xl font-black text-stone-950">
              Learn / Pro courses
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            {courses.length ? (
              courses.map((item) => (
                <Link
                  key={item.course.id}
                  to={
                    isOwnStudio
                      ? `/creator-studio/courses/${encodeURIComponent(item.course.id)}`
                      : `/learn/courses/${encodeURIComponent(item.course.id)}`
                  }
                  className="focus-ring block rounded-2xl border border-stone-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-stone-900">
                      {item.course.title}
                    </p>

                    <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-600">
                      {item.course.accessType}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {item.course.summary || "Structured EPANTRY learning course"}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm font-semibold text-stone-400">
                No Learn / Pro courses listed yet.
              </p>
            )}
          </div>
        </section>
      </div>

      {isOwnStudio &&
      creator.verificationStatus === "verified" &&
      creator.creatorType === "chef" ? (
        <section className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen size={19} className="text-emerald-700" />

            <h2 className="text-xl font-black text-stone-950">
              Create Learn / Pro course
            </h2>
          </div>

          <p className="mt-2 text-sm leading-6 text-stone-500">
            Create the governed course record here, then open Course Builder to add
            modules, lessons, captions/transcripts and media. Pro access remains
            CourseEntitlement-based; M22 live-session/payment handling stays separate.
          </p>

          <form
            onSubmit={handleCourseCreate}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <label className="sm:col-span-2">
              <span className="text-xs font-black text-stone-500">
                Linked moderated Community Recipe
              </span>

              <select
                required
                value={courseForm.linkedCommunityRecipeId}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    linkedCommunityRecipeId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
              >
                <option value="">Select recipe</option>

                {publicRecipeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">
                Course title
              </span>

              <input
                required
                value={courseForm.title}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    title: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
              />
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">Slug</span>

              <input
                required
                value={courseForm.slug}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    slug: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-black text-stone-500">Summary</span>

              <textarea
                rows={3}
                value={courseForm.summary}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    summary: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">Access</span>

              <select
                value={courseForm.accessType}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    accessType: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none"
              >
                <option value="free">Free learning</option>

                <option value="pro">Pro entitlement</option>
              </select>
            </label>

            <label>
              <span className="text-xs font-black text-stone-500">
                Category
              </span>

              <input
                value={courseForm.category}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    category: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-black text-stone-500">
                Required equipment, comma separated
              </span>

              <input
                value={courseForm.requiredEquipment}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    requiredEquipment: event.target.value,
                  }))
                }
                placeholder="Chef knife, saucepan"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="sm:col-span-2 flex items-center gap-2 text-xs font-bold text-stone-600">
              <input
                type="checkbox"
                checked={courseForm.sponsored}
                onChange={(event) =>
                  setCourseForm((current) => ({
                    ...current,

                    sponsored: event.target.checked,
                  }))
                }
              />
              Sponsored / branded learning content - disclosure required
            </label>

            <button
              type="submit"
              disabled={busy || !publicRecipeOptions.length}
              className="focus-ring sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <BookOpen size={16} />
              Create course
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
