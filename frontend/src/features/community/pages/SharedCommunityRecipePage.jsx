import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Users,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  claimSharedCommunityRecipe,
  getCommunityErrorMessage,
  getSharedCommunityRecipe,
} from '../services/community.service'

export default function SharedCommunityRecipePage() {
  const {
    shareToken,
  } = useParams()

  const {
    isAuthenticated,
    customerEnabled,
    activeMode,
    switchMode,
  } = useAuth()

  const [
    data,
    setData,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    claiming,
    setClaiming,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    notice,
    setNotice,
  ] = useState('')

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          setData(
            await getSharedCommunityRecipe(
              shareToken,
            ),
          )
        } catch (
          requestError
        ) {
          setError(
            getCommunityErrorMessage(
              requestError,
              'This private recipe link is not available.',
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        shareToken,
      ],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
      isAuthenticated,
    ],
  )

  async function acceptShare() {
    setClaiming(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await claimSharedCommunityRecipe(
          shareToken,
        )

      setData(
        result,
      )

      setNotice(
        'Friend access confirmed. This recipe is now available in Shared with me.',
      )
    } catch (
      requestError
    ) {
      setError(
        getCommunityErrorMessage(
          requestError,
          'Unable to open this private recipe.',
        ),
      )
    } finally {
      setClaiming(
        false,
      )
    }
  }

  if (loading) {
    return (
      <main className="page-shell grid min-h-[420px] place-items-center py-10">
        <LoaderCircle className="animate-spin text-violet-700" />
      </main>
    )
  }

  if (
    error &&
    !data
  ) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] bg-red-50 p-6 text-red-800">
          {error}
        </div>
      </main>
    )
  }

  const returnTo =
    `/community/shared/${encodeURIComponent(
      shareToken ||
        '',
    )}`

  const detail =
    data?.detail ||
    null

  const recipe =
    detail?.recipe ||
    {}

  const version =
    recipe.recipeVersion ||
    {}

  const dish =
    recipe.dish ||
    {}

  return (
    <main className="page-shell py-8 sm:py-10">
      <Link
        to="/community"
        className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-violet-800"
      >
        <ArrowLeft size={17} />
        My Recipes & Friends
      </Link>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-violet-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-violet-100 via-white to-sky-100 p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-2 text-violet-800">
            <LockKeyhole size={18} />
            <span className="text-xs font-black uppercase tracking-[0.12em]">
              Private friend recipe
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
            {data?.recipe?.name ||
              'Shared recipe'}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            <strong className="text-stone-900">
              {data?.owner?.name ||
                'A friend'}
            </strong>{' '}
            shared this personal recipe with you. It is not a public Community recipe.
          </p>

          {data?.share?.friendEmailMasked ? (
            <p className="mt-3 text-xs font-bold text-violet-700">
              Shared for: {data.share.friendEmailMasked}
            </p>
          ) : null}
        </div>
      </section>

      {notice ? (
        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
          <CircleAlert
            size={18}
            className="mt-0.5 shrink-0"
          />
          {error}
        </div>
      ) : null}

      {!isAuthenticated ? (
        <section className="mt-6 rounded-[28px] border border-sky-200 bg-sky-50 p-6 shadow-sm">
          <h2 className="text-xl font-black text-stone-950">
            Log in to open the recipe
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            Use the Customer account that matches the email your friend shared this recipe with. New to EPANTRY? Create a Customer account with that email and you will return here.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={`/login?returnTo=${encodeURIComponent(
                returnTo,
              )}`}
              className="focus-ring rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white"
            >
              Log in
            </Link>

            <Link
              to={`/register?returnTo=${encodeURIComponent(
                returnTo,
              )}`}
              className="focus-ring rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-black text-sky-800"
            >
              Create Customer account
            </Link>
          </div>
        </section>
      ) : customerEnabled !==
        true ? (
        <section className="mt-6 rounded-[28px] bg-red-50 p-6 text-sm font-bold text-red-800">
          This private recipe was shared with a Customer account.
        </section>
      ) : activeMode !==
        'customer' ? (
        <section className="mt-6 rounded-[28px] border border-sky-200 bg-sky-50 p-6 shadow-sm">
          <h2 className="text-xl font-black text-stone-950">
            Switch to Customer mode
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            Friend-shared recipes belong to your personal Customer space, not your Host workspace.
          </p>

          <button
            type="button"
            onClick={() =>
              switchMode(
                'customer',
              )
            }
            className="focus-ring mt-5 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white"
          >
            Switch to Customer mode
          </button>
        </section>
      ) : data?.access
          ?.wrongAccount ? (
        <section className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-xl font-black text-stone-950">
            This link is for another Customer account
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            Sign in with the email address your friend selected when creating this private share link.
          </p>
        </section>
      ) : !detail &&
        data?.access?.canClaim ? (
        <section className="mt-6 rounded-[28px] border border-violet-200 bg-violet-50 p-6 shadow-sm">
          <h2 className="text-xl font-black text-stone-950">
            Open this friend recipe
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            Confirm access once and this recipe will also appear under Shared with me.
          </p>

          <button
            type="button"
            disabled={
              claiming
            }
            onClick={
              acceptShare
            }
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {claiming ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <Users size={16} />
            )}
            Accept & open recipe
          </button>
        </section>
      ) : detail ? (
        <>
          <section className="mt-6 rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">
              Shared by {data?.owner?.name ||
                'your friend'}
            </span>

            <h2 className="mt-4 text-2xl font-black text-stone-950">
              {version.title ||
                dish.name ||
                data?.recipe?.name}
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              {version.description ||
                dish.description ||
                'Personal recipe shared with you.'}
            </p>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-stone-950">
                Ingredients
              </h2>

              <div className="mt-4 space-y-2">
                {(recipe.ingredients || []).map(
                  (
                    ingredient,
                  ) => (
                    <div
                      key={
                        ingredient.id
                      }
                      className="flex items-center justify-between gap-4 rounded-2xl bg-stone-50 px-4 py-3"
                    >
                      <p className="text-sm font-bold text-stone-800">
                        {ingredient.canonicalIngredientName ||
                          ingredient.displayName ||
                          'Ingredient'}
                      </p>

                      <p className="shrink-0 text-sm font-black text-stone-950">
                        {ingredient.quantity}{' '}
                        {ingredient.unit}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-stone-950">
                Method
              </h2>

              <div className="mt-4 space-y-3">
                {(recipe.steps || []).map(
                  (
                    step,
                  ) => (
                    <div
                      key={
                        step.id
                      }
                      className="flex gap-3 rounded-2xl border border-stone-200 p-4"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-800">
                        {step.stepNumber}
                      </div>

                      <p className="text-sm leading-6 text-stone-700">
                        {step.instruction}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </main>
  )
}
