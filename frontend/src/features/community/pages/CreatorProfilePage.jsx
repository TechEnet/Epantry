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

import { useCallback, useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import CreatorProTransactionsPanel from "../../expansionExecution/components/CreatorProTransactionsPanel";

import {
  createCreatorCourse,
  createCreatorProfile,
  followCreator,
  getCommunityErrorMessage,
  getCreatorProfile,
  getMyCreatorProfile,
  listCommunityRecipes,
  listCreatorCourses,
  listMyCreatorCourses,
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
        if (isOwnStudio) {
          const courseResult = await listMyCreatorCourses();

          setRecipes([]);
          setCourses(courseResult?.courses || []);
        } else {
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
        }
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
        "Professional Creator profile created inside your approved Chef + Restaurant Host workspace."
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
        "Course draft created. Build its modules, lessons and media, then submit it for Super Admin review before it can appear in Learn / Pro."
      );

      setCourseForm({
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
            Creator Studio requires Chef + Restaurant Host access
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

  if (isOwnStudio && !creator && error) {
    return (
      <main className="page-shell py-6 sm:py-9">
        <section className="overflow-hidden rounded-[18px] border border-[#DCE0CF] bg-[#F7F6F2]">
          <div className="h-1 bg-[#C86C42]" />
          <div className="px-5 py-7 sm:px-8 sm:py-9">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#F8E7DD] text-[#8A432A]">
              <ShieldCheck size={22} />
            </div>
            <p className="text-[12px] font-semibold tracking-[0.07em] text-[#A25231]">
              HOST / CREATOR STUDIO
            </p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight text-[#173F35] sm:text-[32px]">
              Creator Studio is unavailable
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#49564D]">
              {error}
            </p>
            <button
              type="button"
              onClick={load}
              className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#173F35] px-5 text-[15px] font-semibold text-white hover:bg-[#255548]"
            >
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (isOwnStudio && !creator) {
    return (
      <main className="page-shell creator-studio-mobile py-4 sm:py-7">
        <style>{`
          /* Creator Studio create form: mobile-only layout. All desktop styling remains unchanged. */
          @media (max-width: 767px) {
            .creator-studio-mobile { padding-top: 10px; padding-bottom: 12px; }
            .creator-studio-mobile .creator-create-panel { border-radius: 14px; }
            .creator-studio-mobile .creator-intro { padding: 18px 16px 16px; }
            .creator-studio-mobile .creator-intro-label { gap: 8px; }
            .creator-studio-mobile .creator-intro-label > span { width: 34px; height: 34px; border-radius: 10px; }
            .creator-studio-mobile .creator-intro-label > p { font-size: 12px; letter-spacing: 0.015em; }
            .creator-studio-mobile .creator-intro-accent { margin-top: 13px; width: 33px; }
            .creator-studio-mobile .creator-intro-title { margin-top: 10px; font-size: 24px; line-height: 1.19; letter-spacing: -0.025em; }
            .creator-studio-mobile .creator-intro-description { margin-top: 7px; font-size: 14px; line-height: 20px; }
            .creator-studio-mobile .creator-intro-steps { margin-top: 13px; padding-top: 11px; gap: 8px 14px; font-size: 12px; line-height: 18px; }
            .creator-studio-mobile .creator-preview { padding: 13px 16px 14px; }
            .creator-studio-mobile .creator-preview h2 { font-size: 15px; line-height: 21px; }
            .creator-studio-mobile .creator-preview > div:first-child > span { padding: 3px 9px; font-size: 11px; line-height: 16px; }
            .creator-studio-mobile .creator-preview-card { margin-top: 9px; padding: 12px; border-radius: 12px; }
            .creator-studio-mobile .creator-preview-icon { width: 42px; height: 42px; border-radius: 11px; }
            .creator-studio-mobile .creator-preview-icon svg { width: 21px; height: 21px; }
            .creator-studio-mobile .creator-preview-card > div:first-child { gap: 10px; }
            .creator-studio-mobile .creator-preview-card > div:first-child p:first-child { font-size: 16px; line-height: 22px; }
            .creator-studio-mobile .creator-preview-bio { margin-top: 9px; padding-top: 8px; font-size: 13px; line-height: 18px; overflow-wrap: anywhere; }
            .creator-studio-mobile .creator-preview-card > p:last-child:not(.creator-preview-bio) { margin-top: 7px; }
            .creator-studio-mobile .creator-preview-caption { margin-top: 8px; font-size: 12px; line-height: 17px; }
            .creator-studio-mobile .creator-public-details,
            .creator-studio-mobile .creator-expertise { padding: 16px 15px 17px; }
            .creator-studio-mobile .creator-section-heading { margin-bottom: 13px; gap: 9px; align-items: center; }
            .creator-studio-mobile .creator-section-number { width: 29px; height: 29px; border-radius: 8px; font-size: 12px; }
            .creator-studio-mobile .creator-section-heading h2 { font-size: 19px; line-height: 25px; }
            .creator-studio-mobile .creator-section-heading p { margin-top: 1px; font-size: 12px; line-height: 17px; }
            .creator-studio-mobile .creator-public-fields,
            .creator-studio-mobile .creator-expertise-fields,
            .creator-studio-mobile .creator-expertise-inline { gap: 12px; }
            .creator-studio-mobile label { min-width: 0; }
            .creator-studio-mobile label > span { font-size: 13px; line-height: 19px; }
            .creator-studio-mobile input { min-width: 0; height: 44px; margin-top: 5px; padding: 0 11px; font-size: 14px; }
            .creator-studio-mobile textarea { display: block; min-height: 78px; height: 82px; margin-top: 5px; padding: 9px 11px; font-size: 14px; line-height: 20px; resize: vertical; }
            .creator-studio-mobile .creator-comma-hint { margin-top: -5px; font-size: 12px; line-height: 17px; }
            .creator-studio-mobile .creator-submit-bar { padding: 14px 15px 16px; gap: 12px; }
            .creator-studio-mobile .creator-submit-note { align-items: center; gap: 9px; }
            .creator-studio-mobile .creator-submit-note > span { margin-top: 0; width: 30px; height: 30px; border-radius: 8px; }
            .creator-studio-mobile .creator-submit-title { display: none; }
            .creator-studio-mobile .creator-submit-description { margin-top: 0; font-size: 12px; line-height: 18px; }
            .creator-studio-mobile .creator-desktop-copy { display: none; }
            .creator-studio-mobile .creator-mobile-copy { display: inline; }
            .creator-studio-mobile .creator-submit-button { width: 100%; min-height: 46px; padding: 0 12px; font-size: 14px; }
          }
          @media (min-width: 768px) {
            .creator-studio-mobile .creator-mobile-copy { display: none; }
          }
          @media (min-width: 360px) and (max-width: 767px) {
            .creator-studio-mobile .creator-public-fields,
            .creator-studio-mobile .creator-expertise-inline { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .creator-studio-mobile .creator-public-fields > label:last-child { grid-column: 1 / -1; }
          }
        `}</style>
        <section className="creator-create-panel overflow-hidden rounded-[20px] border border-[#D5D9CF] bg-[#F7F6F2]">
          {/* A distinct editorial introduction and a read-only, live profile preview. */}
          <div className="grid lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <header className="creator-intro bg-[#173F35] px-5 py-7 text-[#F7F6F2] sm:px-9 sm:py-9">
              <div className="creator-intro-label flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-[#658376] bg-[#2A594A] text-[#F7F6F2]">
                  <ChefHat size={21} aria-hidden="true" />
                </span>
                <p className="text-[13px] font-semibold tracking-[0.035em] text-[#E2E9DE]">
                  Host / Creator Studio
                </p>
              </div>
              <div className="creator-intro-accent mt-6 h-[3px] w-11 rounded-full bg-[#D98D64]" aria-hidden="true" />
              <h1 className="creator-intro-title mt-4 max-w-[650px] text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-[#FFFFFF] sm:text-[34px]">
                Create your creator profile
              </h1>
              <p className="creator-intro-description mt-3 max-w-[570px] text-[15px] leading-6 text-[#D8E5DA]">
                Show customers who you are and what you love to cook.
              </p>
              <div className="creator-intro-steps mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-[#476B5F] pt-5 text-[13px] text-[#E3ECE2]">
                <span className="inline-flex items-center gap-2"><span className="font-semibold text-[#F4BE97]">01</span> Build your profile</span>
                <span className="inline-flex items-center gap-2"><span className="font-semibold text-[#F4BE97]">02</span> Request verification</span>
              </div>
            </header>

            <aside className="creator-preview border-t border-[#E5C8B8] bg-[#FBE8DE] px-5 py-6 sm:px-8 sm:py-8 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold leading-6 text-[#713F31]">Your public profile</h2>
                <span className="rounded-full border border-[#DDB6A1] bg-[#FFF6F0] px-3 py-1 text-[12px] font-medium text-[#814B37]">
                  Live preview
                </span>
              </div>
              <div className="creator-preview-card mt-4 rounded-[16px] border border-[#E1CEC1] bg-[#FFFFFF] px-4 py-5 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="creator-preview-icon grid h-14 w-14 shrink-0 place-items-center rounded-[15px] bg-[#DCE0CF] text-[#173F35]">
                    <ChefHat size={27} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-semibold leading-6 text-[#173F35]">
                      {profileForm.displayName.trim() || "Your display name"}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-[#647268]">
                      @{profileForm.slug.trim() || "your-handle"}
                    </p>
                  </div>
                </div>
                <p className="creator-preview-bio mt-4 border-t border-[#E8EAE4] pt-3 text-[14px] leading-5 break-words text-[#53645A]">
                  {profileForm.biography.trim() || "Your cooking story will appear here."}
                </p>
                {profileForm.cuisineSpecialties.trim() ? (
                  <p className="mt-3 text-[13px] font-medium leading-5 text-[#975333]">
                    {profileForm.cuisineSpecialties}
                  </p>
                ) : null}
              </div>
              <p className="creator-preview-caption mt-3 text-[13px] leading-5 text-[#805846]">
                Preview only. Your profile is published after the required review.
              </p>
            </aside>
          </div>

          <form onSubmit={handleCreateProfile}>
            <div className="grid lg:grid-cols-[minmax(0,1.09fr)_minmax(0,0.91fr)]">
              <section className="creator-public-details border-t border-[#E2E6E4] bg-[#EFF5F7] px-5 py-6 sm:px-9 sm:py-8">
                <div className="creator-section-heading mb-5 flex items-start gap-3">
                  <span className="creator-section-number grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#D3E6EC] text-[14px] font-semibold text-[#173F35]">01</span>
                  <div>
                    <h2 className="text-[22px] font-semibold leading-[30px] text-[#173F35]">Public details</h2>
                    <p className="mt-1 text-[14px] leading-5 text-[#53656A]">The name and story customers will see.</p>
                  </div>
                </div>
                <div className="creator-public-fields grid gap-4 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="text-[14px] font-semibold text-[#263E3A]">Public handle <span className="text-[#A24C34]">*</span></span>
                    <input
                      required
                      value={profileForm.slug}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, slug: event.target.value }))
                      }
                      placeholder="e.g. chef-alok"
                      autoComplete="off"
                      className="focus-ring mt-2 h-12 w-full rounded-[12px] border border-[#C9D9DD] bg-[#FFFFFF] px-4 text-[15px] text-[#202421] placeholder:text-[#7A8987]"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-[14px] font-semibold text-[#263E3A]">Display name <span className="text-[#A24C34]">*</span></span>
                    <input
                      required
                      value={profileForm.displayName}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, displayName: event.target.value }))
                      }
                      placeholder="Your public name"
                      className="focus-ring mt-2 h-12 w-full rounded-[12px] border border-[#C9D9DD] bg-[#FFFFFF] px-4 text-[15px] text-[#202421] placeholder:text-[#7A8987]"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-[14px] font-semibold text-[#263E3A]">About you</span>
                    <textarea
                      rows={4}
                      value={profileForm.biography}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, biography: event.target.value }))
                      }
                      placeholder="Your background, cooking style and what you share"
                      className="focus-ring mt-2 block min-h-[115px] w-full resize-y rounded-[12px] border border-[#C9D9DD] bg-[#FFFFFF] px-4 py-3 text-[15px] leading-6 text-[#202421] placeholder:text-[#7A8987]"
                    />
                  </label>
                </div>
              </section>

              <section className="creator-expertise border-t border-[#D9E1D7] bg-[#E8EEE0] px-5 py-6 sm:px-9 sm:py-8 lg:border-l">
                <div className="creator-section-heading mb-5 flex items-start gap-3">
                  <span className="creator-section-number grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#D0DFC8] text-[14px] font-semibold text-[#173F35]">02</span>
                  <div>
                    <h2 className="text-[22px] font-semibold leading-[30px] text-[#173F35]">Your expertise</h2>
                    <p className="mt-1 text-[14px] leading-5 text-[#586959]">Add specialties, languages and disclosures.</p>
                  </div>
                </div>
                <div className="creator-expertise-fields grid gap-4">
                  <div className="creator-expertise-inline grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="text-[14px] font-semibold text-[#263E33]">Cuisine specialties</span>
                      <input
                        value={profileForm.cuisineSpecialties}
                        onChange={(event) =>
                          setProfileForm((current) => ({ ...current, cuisineSpecialties: event.target.value }))
                        }
                        placeholder="Indian, baking"
                        className="focus-ring mt-2 h-12 w-full rounded-[12px] border border-[#CEDACA] bg-[#FFFFFF] px-4 text-[15px] text-[#202421] placeholder:text-[#7A8980]"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[14px] font-semibold text-[#263E33]">Languages</span>
                      <input
                        value={profileForm.languages}
                        onChange={(event) =>
                          setProfileForm((current) => ({ ...current, languages: event.target.value }))
                        }
                        placeholder="en, hi"
                        className="focus-ring mt-2 h-12 w-full rounded-[12px] border border-[#CEDACA] bg-[#FFFFFF] px-4 text-[15px] text-[#202421] placeholder:text-[#7A8980]"
                      />
                    </label>
                  </div>
                  <p className="creator-comma-hint text-[13px] leading-5 text-[#586B58]">Separate entries with commas.</p>
                  <label className="block">
                    <span className="text-[14px] font-semibold text-[#263E33]">Commercial disclosure</span>
                    <textarea
                      rows={3}
                      value={profileForm.commercialDisclosure}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, commercialDisclosure: event.target.value }))
                      }
                      placeholder="Mention brand or sponsor relationships, if any"
                      className="focus-ring mt-2 block min-h-[105px] w-full resize-y rounded-[12px] border border-[#CEDACA] bg-[#FFFFFF] px-4 py-3 text-[15px] leading-6 text-[#202421] placeholder:text-[#7A8980]"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="creator-submit-bar flex flex-col gap-4 border-t border-[#D4DDCA] bg-[#F7F6F2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9">
              <div className="creator-submit-note flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#DCE0CF] text-[#173F35]">
                  <ShieldCheck size={17} aria-hidden="true" />
                </span>
                <div>
                  <p className="creator-submit-title text-[14px] font-semibold leading-5 text-[#173F35]">Ready to create your profile?</p>
                  <p className="creator-submit-description mt-1 max-w-[460px] text-[13px] leading-5 text-[#526158]">
                    <span className="creator-desktop-copy">Super Admin verification is required before professional publishing.</span>
                    <span className="creator-mobile-copy">Publishing requires Super Admin approval.</span>
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="creator-submit-button focus-ring inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#173F35] px-6 text-[15px] font-semibold text-white transition hover:bg-[#255548] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}
                {busy ? "Creating profile..." : "Create creator profile"}
              </button>
            </div>
          </form>

          {notice ? (
            <p role="status" className="mx-5 mb-5 rounded-[12px] bg-[#E2F0E4] px-4 py-3 text-[14px] font-medium text-[#173F35] sm:mx-9">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mx-5 mb-5 rounded-[12px] bg-[#F9E8DF] px-4 py-3 text-[14px] font-medium text-[#863A25] sm:mx-9">
              {error}
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
            Verification confirms your professional Creator/Chef profile. It does not change your Host workspace type or grant Super Admin access.
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

      <div className={[
        "mt-6 grid gap-6",
        isOwnStudio ? "" : "xl:grid-cols-2",
      ].join(" ")}>
        {!isOwnStudio ? (
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
        ) : null}

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
                      ? `/host/creator-studio/courses/${encodeURIComponent(item.course.id)}`
                      : `/learn/courses/${encodeURIComponent(item.course.id)}`
                  }
                  className="focus-ring block rounded-2xl border border-stone-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-stone-900">
                      {item.course.title}
                    </p>

                    <div className="flex items-center gap-2">
                      {isOwnStudio ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">
                          {statusLabel(item.course.status)}
                        </span>
                      ) : null}

                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-600">
                        {item.course.accessType}
                      </span>
                    </div>
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
            Create the professional course record here, then open Course Builder to add modules, lessons, captions/transcripts and media. Public or premium content still requires EPANTRY governance before release.
          </p>

          <form
            onSubmit={handleCourseCreate}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
              A professional course can stand on its own. If a lesson teaches a specific EPANTRY recipe, link that published Recipe Version inside the Course Builder as a Recipe lesson.
            </div>

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
              disabled={busy}
              className="focus-ring sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <BookOpen size={16} />
              Create course
            </button>
          </form>
        </section>
      ) : null}

      {isOwnStudio ? (
        <CreatorProTransactionsPanel mode="creator" />
      ) : null}
    </main>
  );
}
