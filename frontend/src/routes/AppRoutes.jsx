import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  ArrowLeft,
  Minus,
  ShieldAlert,
  ShoppingCart,
  X,
} from 'lucide-react'

import {
  API_CUSTOMER_ACCESS_REQUIRED_EVENT,
  API_NETWORK_ISSUE_EVENT,
  API_NETWORK_RECOVERED_EVENT,
  apiClient,
} from '../api/apiClient'

import EmptyState from '../components/common/EmptyState'
import ScrollToTop from '../components/common/ScrollToTop'
import Footer from '../components/layout/Footer'
import Navbar from '../components/layout/Navbar'

import {
  ADMIN_ACCESS_STATUSES,
  useAdmin,
} from '../features/admin/context/AdminContext'

import {
  useAuth,
} from '../features/auth/context/AuthContext'

import {
  updateDirectMarketplaceCartItem,
} from '../features/commerce/services/commerce.service'

import HospitalityShell from '../features/hospitality/components/HospitalityShell'
import HostShell from '../features/host/components/HostShell'
import CustomerShell from '../features/customer/components/CustomerShell'
import RouteLoading from '../features/system/components/RouteLoading'


const RECIPE_CART_PENDING_KEY =
  'epantry-pending-recipe-cart'

const FLOATING_MARKETPLACE_CART_KEY =
  'epantry-floating-marketplace-cart'

const FLOATING_CART_HIDDEN_KEY =
  'epantry-floating-cart-hidden'

const FLOATING_CART_UPDATE_EVENT =
  'epantry-cart-updated'

const FLOATING_CART_FLY_EVENT =
  'epantry-cart-fly'

function readSessionJson(
  key,
) {
  try {
    const raw =
      window.sessionStorage.getItem(
        key,
      )

    return raw
      ? JSON.parse(raw)
      : null
  } catch {
    return null
  }
}

function readFloatingCartSnapshot() {
  const recipeCart =
    readSessionJson(
      RECIPE_CART_PENDING_KEY,
    )

  const marketplaceCart =
    readSessionJson(
      FLOATING_MARKETPLACE_CART_KEY,
    )

  return {
    recipeCart:
      recipeCart &&
      Array.isArray(
        recipeCart.items,
      )
        ? recipeCart
        : null,

    marketplaceCart:
      marketplaceCart &&
      Array.isArray(
        marketplaceCart.items,
      )
        ? marketplaceCart
        : null,
  }
}

function writeRecipeCartFromFloating(
  recipeCart,
) {
  try {
    if (
      !recipeCart ||
      !Array.isArray(
        recipeCart.items,
      ) ||
      recipeCart.items.length ===
        0
    ) {
      window.sessionStorage.removeItem(
        RECIPE_CART_PENDING_KEY,
      )
    } else {
      window.sessionStorage.setItem(
        RECIPE_CART_PENDING_KEY,
        JSON.stringify(
          recipeCart,
        ),
      )
    }
  } catch {
    // Session persistence is best-effort UX state only.
  }
}

function GlobalFloatingCartCompanion() {
  const {
    isAuthenticated,
    customerEnabled,
    superAdminEnabled,
    activeMode,
  } = useAuth()

  const [
    snapshot,
    setSnapshot,
  ] =
    useState(
      () =>
        readFloatingCartSnapshot(),
    )

  const [
    hidden,
    setHidden,
  ] =
    useState(
      () => {
        try {
          return (
            window.sessionStorage.getItem(
              FLOATING_CART_HIDDEN_KEY,
            ) === '1'
          )
        } catch {
          return false
        }
      },
    )

  const [
    flyingItem,
    setFlyingItem,
  ] =
    useState(
      null,
    )

  const [
    updatingItemKey,
    setUpdatingItemKey,
  ] =
    useState(
      '',
    )

  const [
    collapsed,
    setCollapsed,
  ] =
    useState(
      true,
    )

  const collapseTimerRef =
    useRef(
      null,
    )

  function scheduleCollapse() {
    if (
      collapseTimerRef.current
    ) {
      window.clearTimeout(
        collapseTimerRef.current,
      )
    }

    collapseTimerRef.current =
      window.setTimeout(
        () => {
          setCollapsed(
            true,
          )

          collapseTimerRef.current =
            null
        },
        5000,
      )
  }

  useEffect(
    () => {
      function refreshCart(
        event,
      ) {
        setSnapshot(
          readFloatingCartSnapshot(),
        )

        if (
          event?.detail?.show !==
          false
        ) {
          setHidden(
            false,
          )
          setCollapsed(
            false,
          )
          scheduleCollapse()

          try {
            window.sessionStorage.removeItem(
              FLOATING_CART_HIDDEN_KEY,
            )
          } catch {
            // Session persistence is best-effort UX state only.
          }
        }
      }

      function handleStorage(
        event,
      ) {
        if (
          event.key ===
            RECIPE_CART_PENDING_KEY ||
          event.key ===
            FLOATING_MARKETPLACE_CART_KEY
        ) {
          refreshCart({
            detail: {
              show: false,
            },
          })
        }
      }

      function handleFly(
        event,
      ) {
        const detail =
          event?.detail ||
          {}

        const startRect =
          detail.startRect ||
          {}

        const startLeft =
          Number(
            startRect.left ||
              window.innerWidth /
                2,
          )

        const startTop =
          Number(
            startRect.top ||
              window.innerHeight /
                2,
          )

        const targetLeft =
          Math.max(
            window.innerWidth -
              220,
            32,
          )

        const targetTop =
          Math.max(
            window.innerHeight -
              115,
            48,
          )

        setFlyingItem({
          key:
            `${Date.now()}-${Math.random()}`,
          name:
            detail.name ||
            'Item',
          startLeft,
          startTop,
          dx:
            targetLeft -
            startLeft,
          dy:
            targetTop -
            startTop,
        })

        window.setTimeout(
          () =>
            setFlyingItem(
              null,
            ),
          850,
        )
      }

      window.addEventListener(
        FLOATING_CART_UPDATE_EVENT,
        refreshCart,
      )
      window.addEventListener(
        FLOATING_CART_FLY_EVENT,
        handleFly,
      )
      window.addEventListener(
        'storage',
        handleStorage,
      )

      return () => {
        if (
          collapseTimerRef.current
        ) {
          window.clearTimeout(
            collapseTimerRef.current,
          )
          collapseTimerRef.current =
            null
        }

        window.removeEventListener(
          FLOATING_CART_UPDATE_EVENT,
          refreshCart,
        )
        window.removeEventListener(
          FLOATING_CART_FLY_EVENT,
          handleFly,
        )
        window.removeEventListener(
          'storage',
          handleStorage,
        )
      }
    },
    [],
  )

  const recipeItems =
    snapshot.recipeCart
      ?.items ||
    []

  const marketplaceItems =
    snapshot.marketplaceCart
      ?.items ||
    []

  const items = [
    ...recipeItems.map(
      (item) => ({
        ...item,
        cartKind:
          'recipe',
        itemKey:
          item.canonicalIngredientId ||
          item.id ||
          item.name,
      }),
    ),
    ...marketplaceItems.map(
      (item) => ({
        ...item,
        cartKind:
          'marketplace',
        itemKey:
          item.id ||
          item.packId ||
          item.name,
      }),
    ),
  ]

  const cartHref =
    recipeItems.length >
    0
      ? '/cart/recipe'
      : snapshot.marketplaceCart
          ?.cartId
        ? `/cart/${snapshot.marketplaceCart.cartId}`
        : '/grocery'

  function closeCompanion() {
    setHidden(
      true,
    )

    try {
      window.sessionStorage.setItem(
        FLOATING_CART_HIDDEN_KEY,
        '1',
      )
    } catch {
      // Session persistence is best-effort UX state only.
    }
  }

  function syncMarketplaceCartResult(
    result,
  ) {
    const cartId =
      result?.cart?.id ||
      snapshot.marketplaceCart?.cartId ||
      ''

    const nextItems =
      Array.isArray(
        result?.items,
      )
        ? result.items.map(
            (
              cartItem,
            ) => ({
              id:
                cartItem.id ||
                cartItem.packId ||
                cartItem.displayName,

              packId:
                cartItem.packId ||
                '',

              offerId:
                cartItem.offerId ||
                '',

              organizationId:
                cartItem.organizationId ||
                '',

              sellerName:
                cartItem.sellerName ||
                'Marketplace Host',

              name:
                cartItem.displayName ||
                'Product',

              quantity:
                Number(
                  cartItem.packCount ||
                  1,
                ),
            }),
          )
        : []

    try {
      if (
        nextItems.length ===
          0 ||
        !cartId
      ) {
        window.sessionStorage.removeItem(
          FLOATING_MARKETPLACE_CART_KEY,
        )
      } else {
        window.sessionStorage.setItem(
          FLOATING_MARKETPLACE_CART_KEY,
          JSON.stringify({
            cartId,
            items:
              nextItems,
            pincode:
              result?.cart?.pincode ||
              snapshot.marketplaceCart?.pincode ||
              '',
            fulfillmentType:
              result?.cart?.fulfillmentType ||
              snapshot.marketplaceCart?.fulfillmentType ||
              'delivery',
            updatedAt:
              new Date().toISOString(),
          }),
        )
      }
    } catch {
      // Session persistence is best-effort UX state only.
    }

    window.dispatchEvent(
      new CustomEvent(
        FLOATING_CART_UPDATE_EVENT,
        {
          detail: {
            show: true,
          },
        },
      ),
    )
  }

  function removeStaleMarketplaceItemLocally(
    item,
  ) {
    const currentCart =
      snapshot.marketplaceCart

    const nextItems =
      marketplaceItems.filter(
        (candidate) =>
          String(
            candidate.id ||
              candidate.packId ||
              candidate.name,
          ) !==
          String(
            item.itemKey,
          ),
      )

    try {
      if (
        nextItems.length ===
          0 ||
        !currentCart?.cartId
      ) {
        window.sessionStorage.removeItem(
          FLOATING_MARKETPLACE_CART_KEY,
        )
      } else {
        window.sessionStorage.setItem(
          FLOATING_MARKETPLACE_CART_KEY,
          JSON.stringify({
            ...currentCart,
            items:
              nextItems,
            updatedAt:
              new Date().toISOString(),
          }),
        )
      }
    } catch {
      // Session persistence is best-effort UX state only.
    }

    setSnapshot(
      readFloatingCartSnapshot(),
    )
  }

  async function updateMarketplaceItem(
    item,
    operation,
  ) {
    const cartId =
      snapshot.marketplaceCart?.cartId

    if (
      !cartId ||
      !item?.itemKey ||
      updatingItemKey
    ) {
      return
    }

    const actionKey =
      `${item.itemKey}:${operation}`

    setUpdatingItemKey(
      actionKey,
    )

    try {
      const result =
        await updateDirectMarketplaceCartItem({
          cartId,
          itemId:
            item.itemKey,
          operation,
        })

      syncMarketplaceCartResult(
        result,
      )
    } catch (error) {
      const status =
        Number(
          error?.response?.status ||
            0,
        )

      const errorCodes =
        Array.isArray(
          error?.response?.data?.errors,
        )
          ? error.response.data.errors.map(
              (entry) =>
                entry?.code,
            )
          : []

      const staleRemoval =
        operation ===
          'remove' &&
        (
          status ===
            404 ||
          errorCodes.includes(
            'DIRECT_CART_NOT_FOUND',
          ) ||
          errorCodes.includes(
            'DIRECT_CART_ITEM_NOT_FOUND',
          )
        )

      if (
        staleRemoval
      ) {
        removeStaleMarketplaceItemLocally(
          item,
        )
      } else {
        setSnapshot(
          readFloatingCartSnapshot(),
        )
      }
    } finally {
      setUpdatingItemKey(
        '',
      )
    }
  }

  function removeRecipeItem(
    item,
  ) {
    const nextItems =
      recipeItems.filter(
        (candidate) =>
          String(
            candidate.canonicalIngredientId ||
              candidate.id ||
              candidate.name,
          ) !==
          String(
            item.itemKey,
          ),
      )

    writeRecipeCartFromFloating({
      ...(snapshot.recipeCart || {}),
      items:
        nextItems,
    })

    window.dispatchEvent(
      new CustomEvent(
        FLOATING_CART_UPDATE_EVENT,
        {
          detail: {
            show: true,
          },
        },
      ),
    )
  }

  const customerContextActive =
    isAuthenticated === true &&
    customerEnabled === true &&
    superAdminEnabled !== true &&
    activeMode !== 'host'

  if (!customerContextActive) {
    return null
  }

  if (
    items.length ===
      0 &&
    !flyingItem
  ) {
    return null
  }

  return (
    <>
      <style>{`
        @keyframes epantryCartWalkIn {
          0% { opacity: 0; transform: translate3d(140px, 0, 0); }
          35% { opacity: 1; transform: translate3d(78px, -3px, 0); }
          52% { transform: translate3d(51px, 2px, 0); }
          70% { transform: translate3d(27px, -2px, 0); }
          86% { transform: translate3d(10px, 1px, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }

        @keyframes epantryCartItemFly {
          0% { opacity: 0; transform: translate3d(0, 0, 0) scale(.72); }
          14% { opacity: 1; transform: translate3d(0, -10px, 0) scale(1); }
          82% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--epantry-fly-x), var(--epantry-fly-y), 0) scale(.28); }
        }
      `}</style>

      {flyingItem && (
        <div
          key={
            flyingItem.key
          }
          className="pointer-events-none fixed z-[90] max-w-48 rounded-full border border-emerald-200 bg-emerald-700 px-3.5 py-2 text-[11px] font-black text-white shadow-[0_14px_35px_rgba(6,78,59,0.28)]"
          style={{
            left:
              flyingItem.startLeft,
            top:
              flyingItem.startTop,
            '--epantry-fly-x':
              `${flyingItem.dx}px`,
            '--epantry-fly-y':
              `${flyingItem.dy}px`,
            animation:
              'epantryCartItemFly 820ms cubic-bezier(.2,.78,.2,1) forwards',
          }}
        >
          {flyingItem.name}
        </div>
      )}

      {items.length >
        0 &&
        !hidden &&
        collapsed && (
        <Link
          to={
            cartHref
          }
          className="focus-ring fixed bottom-5 right-5 z-[80] grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-700 text-white shadow-[0_16px_38px_rgba(6,78,59,0.28)] transition hover:scale-[1.03] hover:bg-emerald-800 lg:right-8"
          aria-label="Open EPANTRY cart"
          title="Open cart"
        >
          <ShoppingCart
            size={24}
            strokeWidth={2.4}
            aria-hidden="true"
          />
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-none text-white">
            {items.reduce(
              (total, item) =>
                total +
                Math.max(
                  1,
                  Number(
                    item.quantity ||
                    1,
                  ),
                ),
              0,
            )}
          </span>
        </Link>
      )}

      {items.length >
        0 &&
        !hidden &&
        !collapsed && (
        <aside
          className="pointer-events-none fixed bottom-4 right-3 z-[80] w-[min(285px,calc(100vw-1.5rem))] sm:bottom-5 sm:right-5 lg:right-8"
          style={{
            animation:
              'epantryCartWalkIn 720ms cubic-bezier(.2,.78,.2,1) both',
          }}
          aria-label="EPANTRY floating cart"
        >
          <div className="pointer-events-auto relative min-h-[225px]">
            <button
              type="button"
              onClick={
                closeCompanion
              }
              className="focus-ring absolute right-1 top-1 z-30 grid h-8 w-8 place-items-center rounded-full border border-stone-200/80 bg-white/80 text-stone-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-950"
              aria-label="Hide floating cart"
            >
              <X
                size={15}
                aria-hidden="true"
              />
            </button>

            <Link
              to={
                cartHref
              }
              className="focus-ring absolute bottom-0 right-0 z-0 block h-[208px] w-[255px] rounded-[24px]"
              aria-label="Open EPANTRY cart"
              title="Open cart"
            >
              <img
                src="/video/cart.png"
                alt="EPANTRY shopping cart companion"
                className="pointer-events-none h-full w-full select-none object-contain object-right-bottom"
                draggable="false"
              />
            </Link>

            <div className="absolute bottom-[50px] left-[18px] z-20 flex h-[82px] w-[132px] flex-col justify-end gap-1 overflow-hidden px-0.5 pb-0.5">
              {items
                .slice(
                  -3,
                )
                .map(
                  (item) => (
                    <div
                      key={`${item.cartKind}-${item.itemKey}`}
                      className="flex min-h-[22px] items-center gap-1 rounded-[7px] border border-emerald-700/20 bg-white/95 px-1.5 py-1 shadow-[0_3px_9px_rgba(15,23,42,0.14)] backdrop-blur-sm"
                    >
                      <p
                        className="min-w-0 flex-1 overflow-hidden break-words pr-0.5 text-[7px] font-black leading-[9px] text-emerald-950"
                        title={item.name || 'Cart item'}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {item.name || 'Cart item'}
                      </p>

                      {item.cartKind ===
                        'marketplace' ? (
                        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50/95 p-0.5 shadow-sm">
                          <button
                            type="button"
                            onClick={() =>
                              updateMarketplaceItem(
                                item,
                                'decrement',
                              )
                            }
                            disabled={
                              Number(
                                item.quantity ||
                                1,
                              ) <= 1 ||
                              Boolean(
                                updatingItemKey,
                              )
                            }
                            className="focus-ring grid h-4 w-4 place-items-center rounded-full text-emerald-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label={`Decrease ${item.name || 'item'} quantity`}
                          >
                            <Minus
                              size={9}
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          </button>

                          <span className="min-w-[18px] text-center text-[7px] font-black leading-none text-emerald-950">
                            {Number(
                              item.quantity ||
                              1,
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateMarketplaceItem(
                                item,
                                'remove',
                              )
                            }
                            disabled={Boolean(
                              updatingItemKey,
                            )}
                            className="focus-ring grid h-4 w-4 place-items-center rounded-full bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Remove ${item.name || 'item'} from Cart`}
                          >
                            <X
                              size={9}
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            removeRecipeItem(
                              item,
                            )
                          }
                          className="focus-ring grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/90 text-rose-600 shadow-sm transition hover:bg-rose-50"
                          aria-label={`Remove ${item.name || 'item'} from Recipe Cart`}
                        >
                          <X
                            size={9}
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>
                  ),
                )}

              {items.length >
                3 && (
                <p className="px-1 text-[7px] font-black leading-none text-emerald-950">
                  +{items.length - 3} more
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}

// Frozen M13 source contract. Keep the exact formatting below.
// prettier-ignore
const APPLICATION_ACCESS_TYPES =
  Object.freeze({
    CUSTOMER:
      'customer',

    HOST:
      'host',

    SUPER_ADMIN:
      'super_admin',
  })

const LandingPage = lazy(() => import('../features/landing/pages/LandingPage'))
const AboutPage = lazy(() => import('../features/about/pages/AboutPage'))
const GroceryPage = lazy(() => import('../features/grocery/pages/GroceryPage'))
const CategoryPage = lazy(() => import('../features/grocery/pages/CategoryPage'))
const ProductDetailPage = lazy(() => import('../features/grocery/pages/ProductDetailPage'))
const ProductFoodIntelligenceBridge = lazy(() => import('../features/foodIntelligence/components/ProductFoodIntelligenceBridge'))
const BrandsPage = lazy(() => import('../features/brands/pages/BrandsPage'))
const BrandDetailPage = lazy(() => import('../features/brands/pages/BrandDetailPage'))
const BrandProductHistoryPage = lazy(() => import('../features/brands/pages/BrandProductHistoryPage'))
const RecipesPage = lazy(() => import('../features/recipes/pages/RecipesPage'))
const RecipeDetailPage = lazy(() => import('../features/recipes/pages/RecipeDetailPage'))
const RecipeHistoryPage = lazy(() => import('../features/recipes/pages/RecipeHistoryPage'))
const WhatShouldWeCookPage = lazy(() => import('../features/recipes/pages/WhatShouldWeCookPage'))
const AiCookTodayPage = lazy(() => import('../features/recipes/pages/AiCookTodayPage'))
const RecipeFoodIntelligenceBridge = lazy(() => import('../features/foodIntelligence/components/RecipeFoodIntelligenceBridge'))
const RecipePantryBridge = lazy(() => import('../features/pantry/components/RecipePantryBridge'))
const RecipeOutcomePlanBridge = lazy(() => import('../features/outcomes/components/RecipeOutcomePlanBridge'))
const OutcomePlanPage = lazy(() => import('../features/outcomes/pages/OutcomePlanPage'))
const RequirementBasketCommerceBridge = lazy(() => import('../features/commerce/components/RequirementBasketCommerceBridge'))
const FulfillmentComparePage = lazy(() => import('../features/commerce/pages/FulfillmentComparePage'))
const MarketplaceCartPage = lazy(() => import('../features/commerce/pages/MarketplaceCartPage'))
const ExternalHandoffPage = lazy(() => import('../features/commerce/pages/ExternalHandoffPage'))
const CheckoutPage = lazy(() => import('../features/commerce/pages/CheckoutPage'))
const OrdersPage = lazy(() => import('../features/commerce/pages/OrdersPage'))
const OrderDetailPage = lazy(() => import('../features/commerce/pages/OrderDetailPage'))
const PantryPage = lazy(() => import('../features/pantry/pages/PantryPage'))
const PantryItemHistoryPage = lazy(() => import('../features/pantry/pages/PantryItemHistoryPage'))
const MealPlanPage = lazy(() => import('../features/planning/pages/MealPlanPage'))
const NextBasketPage = lazy(() => import('../features/planning/pages/NextBasketPage'))
const WasteReductionPage = lazy(() => import('../features/planning/pages/WasteReductionPage'))
const ScanAnythingPage = lazy(() => import('../features/universalProduct/pages/ScanAnythingPage'))
const ProductPassportPage = lazy(() => import('../features/universalProduct/pages/ProductPassportPage'))
const CommunityRecipesPage = lazy(() => import('../features/community/pages/CommunityRecipesPage'))
const CreatorProfilePage = lazy(() => import('../features/community/pages/CreatorProfilePage'))
const LearnProPage = lazy(() => import('../features/community/pages/LearnProPage'))
const CourseDetailPage = lazy(() => import('../features/learning/pages/CourseDetailPage'))
const CoursePlayerPage = lazy(() => import('../features/learning/pages/CoursePlayerPage'))
const MyLearningPage = lazy(() => import('../features/learning/pages/MyLearningPage'))
const CreatorCourseBuilderPage = lazy(() => import('../features/learning/pages/CreatorCourseBuilderPage'))
const SearchPage = lazy(() => import('../features/search/pages/SearchPage'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('../features/auth/pages/ForgotPasswordPage'))
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage'))
const MfaEnrollmentPage = lazy(() => import('../features/auth/pages/MfaEnrollmentPage'))
const HouseholdPage = lazy(() => import('../features/households/pages/HouseholdPage'))
const HouseholdInvitationPage = lazy(() => import('../features/households/pages/HouseholdInvitationPage'))
const AccountSettingsPage = lazy(() => import('../features/account/pages/AccountSettingsPage'))
const EditProfilePage = lazy(() => import('../features/account/pages/EditProfilePage'))
const CustomerPrivacyPage = lazy(() => import('../features/hardening/pages/CustomerPrivacyPage'))
const PublicDishPassportPage = lazy(() => import('../features/hospitality/pages/PublicDishPassportPage'))
const NotificationCenterPage = lazy(() => import('../features/notifications/pages/NotificationCenterPage'))
const CustomerDashboardPage = lazy(() => import('../features/customer/pages/CustomerDashboardPage'))
const CustomerSpendingPage = lazy(() => import('../features/customer/pages/CustomerSpendingPage'))
const PurchaseIntelligencePage = lazy(() => import('../features/purchaseSources/pages/PurchaseIntelligencePage'))
const DeliveryAddressPage = lazy(() => import('../features/deliveryAddresses/pages/DeliveryAddressPage'))

const HostMarketplacePage = lazy(() => import('../features/marketplace/pages/HostMarketplacePage'))
const HostBrandAuthorityPage = lazy(() => import('../features/brands/pages/HostBrandAuthorityPage'))
const HostNpiPage = lazy(() => import('../features/universalProduct/pages/HostNpiPage'))
const HostDashboardPage = lazy(() => import('../features/host/pages/HostDashboardPage'))
const HostEarningsPage = lazy(() => import('../features/host/pages/HostEarningsPage'))
const HostOrdersPage = lazy(() => import('../features/host/pages/HostOrdersPage'))
const HostOrderDetailPage = lazy(() => import('../features/host/pages/HostOrderDetailPage'))
const HostOperationsPage = lazy(() => import('../features/hostOperations/pages/HostOperationsPage'))
const HostBusinessProfilePage = lazy(() => import('../features/hostOperations/pages/HostBusinessProfilePage'))
const HostFulfillmentPage = lazy(() => import('../features/hostOperations/pages/HostFulfillmentPage'))
const HospitalityPage = lazy(() => import('../features/hospitality/pages/HospitalityPage'))
const HostAnalyticsPage = lazy(() => import('../features/analytics/pages/HostAnalyticsPage'))
const HostListingHistoryPage = lazy(() => import('../features/listingHistory/pages/HostListingHistoryPage'))

const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage'))
const AdminCatalogPage = lazy(() => import('../features/admin/pages/AdminCatalogPage'))
const AdminProductEditorPage = lazy(() => import('../features/admin/pages/AdminProductEditorPage'))
const AdminIngredientsPage = lazy(() => import('../features/admin/pages/AdminIngredientsPage'))
const AdminBrandAuthorityPage = lazy(() => import('../features/admin/pages/AdminBrandAuthorityPage'))
const AdminRecipesPage = lazy(() => import('../features/admin/pages/AdminRecipesPage'))
const AdminRecipeEditorPage = lazy(() => import('../features/admin/pages/AdminRecipeEditorPage'))
const AdminFoodIntelligencePage = lazy(() => import('../features/admin/pages/AdminFoodIntelligencePage'))
const AdminNpiReviewPage = lazy(() => import('../features/universalProduct/pages/AdminNpiReviewPage'))
const AdminBulkNpiReviewPage = lazy(() => import('../features/universalProduct/pages/AdminBulkNpiReviewPage'))
const AdminCommunityPage = lazy(() => import('../features/community/pages/AdminCommunityPage'))
const AdminMarketplaceOpsPage = lazy(() => import('../features/admin/pages/AdminMarketplaceOpsPage'))
const AdminHostReviewPage = lazy(() => import('../features/admin/pages/AdminHostReviewPage'))
const AdminHostOperationsPage = lazy(() => import('../features/hostOperations/pages/AdminHostOperationsPage'))
const AdminGovernancePage = lazy(() => import('../features/adminGovernance/pages/AdminGovernancePage'))
const AdminRolesPage = lazy(() => import('../features/admin/pages/AdminRolesPage'))
const AdminAuditPage = lazy(() => import('../features/admin/pages/AdminAuditPage'))
const AdminAnalyticsPage = lazy(() => import('../features/analytics/pages/AdminAnalyticsPage'))
const AdminListingHistoryPage = lazy(() => import('../features/listingHistory/pages/AdminListingHistoryPage'))

const SystemDebugPage = lazy(() => import('../features/system/pages/SystemDebugPage'))

function getSafeReturnTo(
  search,
) {
  const params =
    new URLSearchParams(
      search,
    )

  const returnTo =
    String(
      params.get(
        'returnTo',
      ) ||
        '',
    ).trim()

  if (
    !returnTo.startsWith(
      '/',
    ) ||
    returnTo.startsWith(
      '//',
    )
  ) {
    return null
  }

  return returnTo
}

function getAuthenticatedHomePath({
  customerEnabled,
  hostEnabled,
  hostAccessStatus,
  superAdminEnabled,
}) {
  /*
  |--------------------------------------------------------------------------
  | Authenticated landing priority
  |--------------------------------------------------------------------------
  |
  | Super Admin is a separate governance identity and must never fall through
  | to Customer or Host presentation routes, even if a legacy record carries
  | customerEnabled/hostEnabled state.
  |
  | Host access is derived only from Host capability plus active Host status.
  | Presentation mode is intentionally not an authorization input here.
  */

  if (
    superAdminEnabled ===
    true
  ) {
    return '/admin'
  }

  const hasActiveHostAccess =
    hostEnabled === true &&
    hostAccessStatus ===
      'active'

  if (
    customerEnabled ===
    true
  ) {
    return '/dashboard'
  }

  if (hasActiveHostAccess) {
    return '/host'
  }

  return '/'
}

function GuestOnlyRoute({
  children,
}) {
  const location =
    useLocation()

  const {
    isAuthenticated,
    isBootstrapping,
    customerEnabled,
    hostEnabled,
    hostAccessStatus,
    superAdminEnabled,
  } =
    useAuth()

  if (isBootstrapping) {
    return <RouteLoading />
  }

  if (isAuthenticated) {
    const authenticatedHome =
      getAuthenticatedHomePath({
        customerEnabled,
        hostEnabled,
        hostAccessStatus,
        superAdminEnabled,
      })

    /*
    | Super Admin always enters the governance console. A stale returnTo such
    | as /dashboard must not route a privileged identity into Customer UX.
    */
    const safeReturnTo =
      superAdminEnabled ===
      true
        ? null
        : getSafeReturnTo(
            location.search,
          )

    return (
      <Navigate
        to={
          safeReturnTo ||
          authenticatedHome
        }
        replace
      />
    )
  }

  return children
}

function AuthenticatedRoute({
  children,
}) {
  const {
    isAuthenticated,
    isBootstrapping,
  } =
    useAuth()

  if (isBootstrapping) {
    return <RouteLoading />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return children
}

function CustomerAccessRequiredPage() {
  const location =
    useLocation()

  const {
    customerEnabled,
    hostEnabled,
    hostAccessStatus,
    superAdminEnabled,
    activeMode,
  } = useAuth()

  const requestedPath =
    getSafeReturnTo(
      location.search,
    ) ||
    '/'

  const isActiveHostContext =
    superAdminEnabled !== true &&
    hostEnabled === true &&
    hostAccessStatus === 'active' &&
    activeMode === 'host'

  const canSwitchToCustomer =
    isActiveHostContext &&
    customerEnabled === true

  const title =
    superAdminEnabled === true
      ? 'Sign in as Customer first'
      : canSwitchToCustomer
        ? 'Switch to Customer mode first'
        : 'Customer access required'

  const message =
    superAdminEnabled === true
      ? 'Cart, checkout, orders and Pantry are Customer-only actions. Sign in with a Customer account to continue.'
      : canSwitchToCustomer
        ? 'You are currently in Host mode. Switch to Customer from your account menu to continue.'
        : 'This action is available only in the Customer experience.'

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,#fbfaf7_0%,#f4f1e8_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[520px] max-w-3xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[30px] border border-emerald-200/80 bg-white shadow-[0_24px_80px_rgba(20,83,60,0.12)]">
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-7 py-9 text-white sm:px-10 sm:py-11">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">
              <ShieldAlert size={14} aria-hidden="true" />
              Customer-only action
            </div>

            <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              {title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-emerald-50/90 sm:text-base">
              {message}
            </p>
          </div>

          <div className="flex flex-col gap-4 px-7 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            {requestedPath !== '/' ? (
              <p className="max-w-xl text-sm font-semibold leading-6 text-stone-600">
                Switch or sign in as Customer, then return to continue.
              </p>
            ) : (
              <p className="max-w-xl text-sm font-semibold leading-6 text-stone-600">
                Customer actions stay separate from Host and Super Admin workspaces.
              </p>
            )}

            <Link
              to="/"
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-800 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function ApplicationAccessRoute({
  access,
  children,
}) {
  const location =
    useLocation()

  const {
    isAuthenticated,
    isBootstrapping,
    customerEnabled,
    hostEnabled,
    hostAccessStatus,
    superAdminEnabled,
    activeMode,
  } =
    useAuth()

  if (isBootstrapping) {
    return <RouteLoading />
  }

  if (!isAuthenticated) {
    const returnTo =
      `${location.pathname}${location.search}${location.hash}`

    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(
          returnTo,
        )}`}
        replace
      />
    )
  }

  let hasAccess =
    false

  switch (access) {
    case APPLICATION_ACCESS_TYPES.CUSTOMER:
      hasAccess =
        superAdminEnabled !==
          true &&
        customerEnabled ===
          true &&
        activeMode !==
          'host'
      break

    case APPLICATION_ACCESS_TYPES.HOST:
      // prettier-ignore
      hasAccess = superAdminEnabled !== true && hostEnabled === true && hostAccessStatus === 'active'
      break

    case APPLICATION_ACCESS_TYPES.SUPER_ADMIN:
      hasAccess =
        superAdminEnabled ===
        true
      break

    default:
      hasAccess =
        false
  }

  if (!hasAccess) {
    if (
      access ===
        APPLICATION_ACCESS_TYPES.CUSTOMER
    ) {
      return (
        <CustomerAccessRequiredPage />
      )
    }

    return (
      <Navigate
        to={
          getAuthenticatedHomePath({
            customerEnabled,
            hostEnabled,
            hostAccessStatus,
            superAdminEnabled,
          })
        }
        replace
      />
    )
  }

  return children
}

function AdminAccessRoute({
  children,
}) {
  const {
    isAuthenticated,
    isBootstrapping,
  } =
    useAuth()

  const {
    adminStatus,
    hasAdminAccess,
    isAdminMfaRequired,
  } =
    useAdmin()

  if (isBootstrapping) {
    return <RouteLoading />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if (
    adminStatus ===
      ADMIN_ACCESS_STATUSES.IDLE ||
    adminStatus ===
      ADMIN_ACCESS_STATUSES.LOADING
  ) {
    return <RouteLoading />
  }

  if (isAdminMfaRequired) {
    return (
      <Navigate
        to="/account/security/mfa"
        replace
      />
    )
  }

  if (
    !hasAdminAccess ||
    adminStatus !==
      ADMIN_ACCESS_STATUSES.READY
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  return children
}

function AdminPermissionBoundary({
  permission,
  anyPermissions = [],
  allPermissions = [],
  rootOnly = false,
  children,
}) {
  const {
    isRootSuperAdmin,
    hasAdminPermission,
    hasAnyAdminPermission,
    hasAllAdminPermissions,
  } =
    useAdmin()

  if (
    rootOnly &&
    !isRootSuperAdmin
  ) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    )
  }

  if (
    permission &&
    !hasAdminPermission(
      permission,
    )
  ) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    )
  }

  if (
    Array.isArray(
      anyPermissions,
    ) &&
    anyPermissions.length >
      0 &&
    !hasAnyAdminPermission(
      anyPermissions,
    )
  ) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    )
  }

  if (
    Array.isArray(
      allPermissions,
    ) &&
    allPermissions.length >
      0 &&
    !hasAllAdminPermissions(
      allPermissions,
    )
  ) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    )
  }

  return children
}

function AdminPermissionRoute({
  permission,
  anyPermissions = [],
  allPermissions = [],
  rootOnly = false,
  children,
}) {
  return (
    <AdminAccessRoute>
      <AdminPermissionBoundary
        permission={permission}
        anyPermissions={anyPermissions}
        allPermissions={allPermissions}
        rootOnly={rootOnly}
      >
        {children}
      </AdminPermissionBoundary>
    </AdminAccessRoute>
  )
}


function CustomerWorkspacePresentation({
  children,
}) {
  const {
    customerEnabled,
    superAdminEnabled,
    activeMode,
  } = useAuth()

  if (
    superAdminEnabled === true ||
    customerEnabled !== true ||
    activeMode === 'host'
  ) {
    return children
  }

  return (
    <CustomerShell>
      {children}
    </CustomerShell>
  )
}

function HospitalityRoute({
  section,
}) {
  return (
    <ApplicationAccessRoute
      access={APPLICATION_ACCESS_TYPES.HOST}
    >
      <HospitalityShell>
        <HospitalityPage
          section={section}
        />
      </HospitalityShell>
    </ApplicationAccessRoute>
  )
}


function NetworkIssueScreen() {
  return (
    <div className="epantry-network-page">
      <style>{`
        .epantry-network-page {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: white;
        }

        .main_wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30em;
          height: 30em;
        }

        .main {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 5em;
        }

        .antenna {
          width: 5em;
          height: 5em;
          border-radius: 50%;
          border: 2px solid black;
          background-color: #f27405;
          margin-bottom: -6em;
          margin-left: 0em;
          z-index: -1;
        }

        .antenna_shadow {
          position: absolute;
          background-color: transparent;
          width: 50px;
          height: 56px;
          margin-left: 1.68em;
          border-radius: 45%;
          transform: rotate(140deg);
          border: 4px solid transparent;
          box-shadow:
            inset 0px 16px #a85103,
            inset 0px 16px 1px 1px #a85103;
          -moz-box-shadow:
            inset 0px 16px #a85103,
            inset 0px 16px 1px 1px #a85103;
        }

        .antenna::after {
          content: "";
          position: absolute;
          margin-top: -9.4em;
          margin-left: 0.4em;
          transform: rotate(-25deg);
          width: 1em;
          height: 0.5em;
          border-radius: 50%;
          background-color: #f69e50;
        }

        .antenna::before {
          content: "";
          position: absolute;
          margin-top: 0.2em;
          margin-left: 1.25em;
          transform: rotate(-20deg);
          width: 1.5em;
          height: 0.8em;
          border-radius: 50%;
          background-color: #f69e50;
        }

        .a1 {
          position: relative;
          top: -102%;
          left: -130%;
          width: 12em;
          height: 5.5em;
          border-radius: 50px;
          background-image: linear-gradient(
            #171717,
            #171717,
            #353535,
            #353535,
            #171717
          );
          transform: rotate(-29deg);
          clip-path: polygon(50% 0%, 49% 100%, 52% 100%);
        }

        .a1d {
          position: relative;
          top: -211%;
          left: -35%;
          transform: rotate(45deg);
          width: 0.5em;
          height: 0.5em;
          border-radius: 50%;
          border: 2px solid black;
          background-color: #979797;
          z-index: 99;
        }

        .a2 {
          position: relative;
          top: -210%;
          left: -10%;
          width: 12em;
          height: 4em;
          border-radius: 50px;
          background-color: #171717;
          background-image: linear-gradient(
            #171717,
            #171717,
            #353535,
            #353535,
            #171717
          );
          margin-right: 5em;
          clip-path: polygon(
            47% 0,
            47% 0,
            34% 34%,
            54% 25%,
            32% 100%,
            29% 96%,
            49% 32%,
            30% 38%
          );
          transform: rotate(-8deg);
        }

        .a2d {
          position: relative;
          top: -294%;
          left: 94%;
          width: 0.5em;
          height: 0.5em;
          border-radius: 50%;
          border: 2px solid black;
          background-color: #979797;
          z-index: 99;
        }

        .notfound_text {
          background-color: black;
          padding-left: 0.3em;
          padding-right: 0.3em;
          font-size: 0.75em;
          color: white;
          letter-spacing: 0;
          border-radius: 5px;
          z-index: 10;
        }

        .tv {
          width: 17em;
          height: 9em;
          margin-top: 3em;
          border-radius: 15px;
          background-color: #d36604;
          display: flex;
          justify-content: center;
          border: 2px solid #1d0e01;
          box-shadow: inset 0.2em 0.2em #e69635;
        }

        .tv::after {
          content: "";
          position: absolute;
          width: 17em;
          height: 9em;
          border-radius: 15px;
          background:
            repeating-radial-gradient(#d36604 0 0.0001%, #00000070 0 0.0002%) 50% 0/2500px 2500px,
            repeating-conic-gradient(#d36604 0 0.0001%, #00000070 0 0.0002%) 60% 60%/2500px 2500px;
          background-blend-mode: difference;
          opacity: 0.09;
        }

        .curve_svg {
          position: absolute;
          margin-top: 0.25em;
          margin-left: -0.25em;
          height: 12px;
          width: 12px;
        }

        .display_div {
          display: flex;
          align-items: center;
          align-self: center;
          justify-content: center;
          border-radius: 15px;
          box-shadow: 3.5px 3.5px 0px #e69635;
        }

        .screen_out {
          width: auto;
          height: auto;
          border-radius: 10px;
        }

        .screen_out1 {
          width: 11em;
          height: 7.75em;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }

        .screen {
          width: 13em;
          height: 7.85em;
          font-family: Montserrat;
          border: 2px solid #1d0e01;
          background:
            repeating-radial-gradient(#000 0 0.0001%, #ffffff 0 0.0002%) 50% 0/2500px 2500px,
            repeating-conic-gradient(#000 0 0.0001%, #ffffff 0 0.0002%) 60% 60%/2500px 2500px;
          background-blend-mode: difference;
          animation: b 0.2s infinite alternate;
          border-radius: 10px;
          z-index: 99;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #252525;
          letter-spacing: 0.15em;
          text-align: center;
        }

        @keyframes b {
          100% {
            background-position:
              50% 0,
              60% 50%;
          }
        }

        .lines {
          display: flex;
          column-gap: 0.1em;
          align-self: flex-end;
        }

        .line1,
        .line3 {
          width: 2px;
          height: 0.5em;
          background-color: black;
          border-radius: 25px 25px 0px 0px;
          margin-top: 0.5em;
        }

        .line2 {
          flex-grow: 1;
          width: 2px;
          height: 1em;
          background-color: black;
          border-radius: 25px 25px 0px 0px;
        }

        .buttons_div {
          width: 4.25em;
          align-self: center;
          height: 8em;
          background-color: #e69635;
          border: 2px solid #1d0e01;
          padding: 0.6em;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          row-gap: 0.75em;
          box-shadow: 3px 3px 0px #e69635;
        }

        .b1 {
          width: 1.65em;
          height: 1.65em;
          border-radius: 50%;
          background-color: #7f5934;
          border: 2px solid black;
          box-shadow:
            inset 2px 2px 1px #b49577,
            -2px 0px #513721,
            -2px 0px 0px 1px black;
        }

        .b1::before {
          content: "";
          position: absolute;
          margin-top: 1em;
          margin-left: 0.5em;
          transform: rotate(47deg);
          border-radius: 5px;
          width: 0.1em;
          height: 0.4em;
          background-color: #000000;
        }

        .b1::after {
          content: "";
          position: absolute;
          margin-top: 0.9em;
          margin-left: 0.8em;
          transform: rotate(47deg);
          border-radius: 5px;
          width: 0.1em;
          height: 0.55em;
          background-color: #000000;
        }

        .b1 div {
          content: "";
          position: absolute;
          margin-top: -0.1em;
          margin-left: 0.65em;
          transform: rotate(45deg);
          width: 0.15em;
          height: 1.5em;
          background-color: #000000;
        }

        .b2 {
          width: 1.65em;
          height: 1.65em;
          border-radius: 50%;
          background-color: #7f5934;
          border: 2px solid black;
          box-shadow:
            inset 2px 2px 1px #b49577,
            -2px 0px #513721,
            -2px 0px 0px 1px black;
        }

        .b2::before {
          content: "";
          position: absolute;
          margin-top: 1.05em;
          margin-left: 0.8em;
          transform: rotate(-45deg);
          border-radius: 5px;
          width: 0.15em;
          height: 0.4em;
          background-color: #000000;
        }

        .b2::after {
          content: "";
          position: absolute;
          margin-top: -0.1em;
          margin-left: 0.65em;
          transform: rotate(-45deg);
          width: 0.15em;
          height: 1.5em;
          background-color: #000000;
        }

        .speakers {
          display: flex;
          flex-direction: column;
          row-gap: 0.5em;
        }

        .speakers .g1 {
          display: flex;
          column-gap: 0.25em;
        }

        .speakers .g1 .g11,
        .g12,
        .g13 {
          width: 0.65em;
          height: 0.65em;
          border-radius: 50%;
          background-color: #7f5934;
          border: 2px solid black;
          box-shadow: inset 1.25px 1.25px 1px #b49577;
        }

        .speakers .g {
          width: auto;
          height: 2px;
          background-color: #171717;
        }

        .bottom {
          width: 100%;
          height: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          column-gap: 8.7em;
        }

        .base1,
        .base2 {
          height: 1em;
          width: 2em;
          border: 2px solid #171717;
          background-color: #4d4d4d;
          margin-top: -0.15em;
          z-index: -1;
        }

        .base3 {
          position: absolute;
          height: 0.15em;
          width: 17.5em;
          background-color: #171717;
          margin-top: 0.8em;
        }

        .text_404 {
          position: absolute;
          display: flex;
          flex-direction: row;
          column-gap: 6em;
          z-index: -5;
          margin-bottom: 2em;
          align-items: center;
          justify-content: center;
          opacity: 0.5;
          font-family: Montserrat;
        }

        .text_4041 {
          transform: scaleY(24.5) scaleX(9);
        }

        .text_4042 {
          transform: scaleY(24.5) scaleX(9);
        }

        .text_4043 {
          transform: scaleY(24.5) scaleX(9);
        }
      `}</style>

      <div className="main_wrapper">
        <div className="main">
          <div className="antenna">
            <div className="antenna_shadow"></div>
            <div className="a1"></div>
            <div className="a1d"></div>
            <div className="a2"></div>
            <div className="a2d"></div>
            <div className="a_base"></div>
          </div>

          <div className="tv">
            <div className="cruve">
              <svg
                className="curve_svg"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 189.929 189.929"
                xmlSpace="preserve"
              >
                <path d="M70.343,70.343c-30.554,30.553-44.806,72.7-39.102,115.635l-29.738,3.951C-5.442,137.659,11.917,86.34,49.129,49.13 C86.34,11.918,137.664-5.445,189.928,1.502l-3.95,29.738C143.041,25.54,100.895,39.789,70.343,70.343z"></path>
              </svg>
            </div>

            <div className="display_div">
              <div className="screen_out">
                <div className="screen_out1">
                  <div className="screen">
                    <span className="notfound_text">
                      Check Your Network :(
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lines">
              <div className="line1"></div>
              <div className="line2"></div>
              <div className="line3"></div>
            </div>

            <div className="buttons_div">
              <div className="b1">
                <div></div>
              </div>
              <div className="b2"></div>
              <div className="speakers">
                <div className="g1">
                  <div className="g11"></div>
                  <div className="g12"></div>
                  <div className="g13"></div>
                </div>
                <div className="g"></div>
                <div className="g"></div>
              </div>
            </div>
          </div>

          <div className="bottom">
            <div className="base1"></div>
            <div className="base2"></div>
            <div className="base3"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppRoutes() {
  const navigate =
    useNavigate()

  const [
    networkIssueActive,
    setNetworkIssueActive,
  ] = useState(
    () =>
      typeof navigator !==
        'undefined' &&
      navigator.onLine ===
        false,
  )

  useEffect(
    () => {
      function handleOffline() {
        setNetworkIssueActive(
          true,
        )
      }

      function handleOnline() {
        setNetworkIssueActive(
          false,
        )
      }

      function handleApiNetworkIssue() {
        setNetworkIssueActive(
          true,
        )
      }

      function handleApiNetworkRecovered() {
        if (
          typeof navigator ===
            'undefined' ||
          navigator.onLine !==
            false
        ) {
          setNetworkIssueActive(
            false,
          )
        }
      }

      window.addEventListener(
        'offline',
        handleOffline,
      )

      window.addEventListener(
        'online',
        handleOnline,
      )

      window.addEventListener(
        API_NETWORK_ISSUE_EVENT,
        handleApiNetworkIssue,
      )

      window.addEventListener(
        API_NETWORK_RECOVERED_EVENT,
        handleApiNetworkRecovered,
      )

      return () => {
        window.removeEventListener(
          'offline',
          handleOffline,
        )

        window.removeEventListener(
          'online',
          handleOnline,
        )

        window.removeEventListener(
          API_NETWORK_ISSUE_EVENT,
          handleApiNetworkIssue,
        )

        window.removeEventListener(
          API_NETWORK_RECOVERED_EVENT,
          handleApiNetworkRecovered,
        )
      }
    },
    [],
  )

  useEffect(
    () => {
      if (!networkIssueActive) {
        return undefined
      }

      let cancelled =
        false

      async function probeConnection() {
        if (
          cancelled ||
          (
            typeof navigator !==
              'undefined' &&
            navigator.onLine ===
              false
          )
        ) {
          return
        }

        try {
          await apiClient.get(
            '/health',
            {
              timeout: 3000,
              skipAuthSessionInvalidation: true,
            },
          )
        } catch {
          // The global API interceptor keeps the network screen active.
        }
      }

      probeConnection()

      const intervalId =
        window.setInterval(
          probeConnection,
          3000,
        )

      return () => {
        cancelled =
          true

        window.clearInterval(
          intervalId,
        )
      }
    },
    [
      networkIssueActive,
    ],
  )

  useEffect(
    () => {
      function handleCustomerAccessRequired(
        event,
      ) {
        const returnTo =
          String(
            event?.detail?.returnTo ||
              '',
          ).trim()

        const safeReturnTo =
          returnTo.startsWith('/') &&
          !returnTo.startsWith('//')
            ? returnTo
            : '/'

        navigate(
          `/customer-access-required?returnTo=${encodeURIComponent(
            safeReturnTo,
          )}`,
        )
      }

      window.addEventListener(
        API_CUSTOMER_ACCESS_REQUIRED_EVENT,
        handleCustomerAccessRequired,
      )

      return () => {
        window.removeEventListener(
          API_CUSTOMER_ACCESS_REQUIRED_EVENT,
          handleCustomerAccessRequired,
        )
      }
    },
    [
      navigate,
    ],
  )

  if (networkIssueActive) {
    return (
      <NetworkIssueScreen />
    )
  }

  return (
    <div className="app-frame text-stone-900">
      <ScrollToTop />
      <Navbar />
      <GlobalFloatingCartCompanion />

      <div className="app-content">
        <Suspense
          fallback={
            <RouteLoading />
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/grocery" element={<GroceryPage />} />
            <Route path="/grocery/category/:slug" element={<CategoryPage />} />

            <Route
              path="/grocery/product/:slug"
              element={
                <>
                  <ProductDetailPage />
                  <ProductFoodIntelligenceBridge />
                </>
              }
            />

            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/brands/:brandKey" element={<BrandDetailPage />} />
            <Route path="/brands/:brandKey/products/:packId/history" element={<BrandProductHistoryPage />} />

            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/what-should-we-cook" element={<WhatShouldWeCookPage />} />

            <Route
              path="/recipes/:slug"
              element={
                <>
                  <RecipeDetailPage />
                  <RecipeFoodIntelligenceBridge />
                  <RecipePantryBridge />
                  <RecipeOutcomePlanBridge />
                </>
              }
            />

            <Route path="/recipes/:slug/history" element={<RecipeHistoryPage />} />

            <Route path="/community" element={<CommunityRecipesPage />} />
            <Route path="/community/:communityRecipeId" element={<CommunityRecipesPage />} />
            <Route path="/creators/:creatorProfileId" element={<CreatorProfilePage />} />

            <Route
              path="/creator-studio"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CreatorProfilePage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/creator-studio/courses/:courseId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CreatorCourseBuilderPage />
                </ApplicationAccessRoute>
              }
            />

            <Route path="/learn" element={<LearnProPage />} />

            <Route
              path="/learn/courses/:courseId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CourseDetailPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/learn/courses/:courseId/lessons/:lessonId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CoursePlayerPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/scan"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <ScanAnythingPage mode="customer" />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/products/:productVersionId/passport"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <ProductPassportPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/dish-passports/:publicId"
              element={<PublicDishPassportPage />}
            />

            <Route path="/search" element={<SearchPage />} />

            <Route
              path="/login"
              element={
                <GuestOnlyRoute>
                  <LoginPage />
                </GuestOnlyRoute>
              }
            />

            <Route
              path="/forgot-password"
              element={
                <GuestOnlyRoute>
                  <ForgotPasswordPage />
                </GuestOnlyRoute>
              }
            />

            <Route path="/register" element={<RegisterPage />} />

            <Route
              path="/customer-access-required"
              element={
                <AuthenticatedRoute>
                  <CustomerAccessRequiredPage />
                </AuthenticatedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <CustomerDashboardPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/account/spending"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <CustomerSpendingPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/cook-today"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <AiCookTodayPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/account/profile"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <EditProfilePage audience="customer" />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/account/settings"
              element={
                <AuthenticatedRoute>
                  <CustomerWorkspacePresentation>
                    <AccountSettingsPage />
                  </CustomerWorkspacePresentation>
                </AuthenticatedRoute>
              }
            />

            <Route
              path="/account/security/mfa"
              element={
                <AuthenticatedRoute>
                  <MfaEnrollmentPage />
                </AuthenticatedRoute>
              }
            />

            <Route
              path="/account/household"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <HouseholdPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/account/purchase-intelligence"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <PurchaseIntelligencePage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/account/privacy"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <CustomerPrivacyPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/delivery-addresses"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <DeliveryAddressPage />
                </ApplicationAccessRoute>
              }
            />


            <Route
              path="/account/learning"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <MyLearningPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/household-invitations/:token"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <HouseholdInvitationPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/notifications"
              element={
                <AuthenticatedRoute>
                  <NotificationCenterPage />
                </AuthenticatedRoute>
              }
            />

            <Route
              path="/account/settings/notifications"
              element={
                <AuthenticatedRoute>
                  <NotificationCenterPage />
                </AuthenticatedRoute>
              }
            />

            <Route
              path="/pantry"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <PantryPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/pantry/items/:itemId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <PantryItemHistoryPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/meal-plan"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <MealPlanPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/next-basket"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <NextBasketPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/waste-reduction"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <WasteReductionPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/next-possibility"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <WasteReductionPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/outcome-plans/:planId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <OutcomePlanPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/outcome-plans/:planId/basket"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <>
                    <OutcomePlanPage view="basket" />
                    <RequirementBasketCommerceBridge />
                  </>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/outcome-plans/:planId/compare"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <FulfillmentComparePage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/outcome-plans/:planId/handoff/:quoteId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <ExternalHandoffPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/cart/:cartId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <MarketplaceCartPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/checkout/:cartId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CheckoutPage />
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/orders"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <OrdersPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/orders/:orderId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.CUSTOMER}>
                  <CustomerShell>
                    <OrderDetailPage />
                  </CustomerShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host"
              element={
                <Navigate
                  to="/host/operations"
                  replace
                />
              }
            />

            <Route
              path="/host/operations"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostDashboardPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/operations-center"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="dashboard" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/business-profile"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostBusinessProfilePage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/profile"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <EditProfilePage audience="host" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/catalog"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="catalog" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/scan"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <ScanAnythingPage mode="host" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/data-quality"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="quality" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/earnings"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostEarningsPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/finance"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="finance" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/brand-recipes"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="recipes" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/listing-history"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostListingHistoryPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/campaigns"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="campaigns" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/settings"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOperationsPage section="settings" />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/marketplace"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostMarketplacePage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/brands"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostBrandAuthorityPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/product-intelligence"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostNpiPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/orders"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOrdersPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/orders/:orderId"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostOrderDetailPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/fulfillment"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostFulfillmentPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route
              path="/host/analytics"
              element={
                <ApplicationAccessRoute access={APPLICATION_ACCESS_TYPES.HOST}>
                  <HostShell>
                    <HostAnalyticsPage />
                  </HostShell>
                </ApplicationAccessRoute>
              }
            />

            <Route path="/host/hospitality" element={<HospitalityRoute section="dashboard" />} />
            <Route path="/host/hospitality/outlets" element={<HospitalityRoute section="outlets" />} />
            <Route path="/host/hospitality/suppliers" element={<HospitalityRoute section="suppliers" />} />
            <Route path="/host/hospitality/products" element={<HospitalityRoute section="products" />} />
            <Route path="/host/hospitality/recipes" element={<HospitalityRoute section="recipes" />} />
            <Route path="/host/hospitality/menus" element={<HospitalityRoute section="menus" />} />
            <Route path="/host/hospitality/procurement" element={<HospitalityRoute section="procurement" />} />
            <Route path="/host/hospitality/costing" element={<HospitalityRoute section="costing" />} />
            <Route path="/host/hospitality/dish-passports" element={<HospitalityRoute section="passports" />} />
            <Route path="/host/hospitality/grey-book" element={<HospitalityRoute section="greyBook" />} />
            <Route path="/host/hospitality/change-management" element={<HospitalityRoute section="changeManagement" />} />

            <Route
              path="/admin"
              element={
                <AdminAccessRoute>
                  <AdminDashboardPage />
                </AdminAccessRoute>
              }
            />

            <Route
              path="/admin/analytics"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'admin.dashboard.read',
                    'admin.audit.read',
                    'marketplace.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminAnalyticsPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/users-organizations"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'admin.dashboard.read',
                    'host.review.read',
                    'marketplace.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminGovernancePage section="users" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/catalog"
              element={
                <AdminPermissionRoute permission="catalog.read">
                  <AdminCatalogPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/catalog/products/:versionId"
              element={
                <AdminPermissionRoute permission="catalog.read">
                  <AdminProductEditorPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/catalog/ingredients"
              element={
                <AdminPermissionRoute permission="catalog.read">
                  <AdminIngredientsPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/brands"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'catalog.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminBrandAuthorityPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/data-quality"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'catalog.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminGovernancePage section="dataQuality" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/recipes"
              element={
                <AdminPermissionRoute permission="recipe.read">
                  <AdminRecipesPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/listing-history"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'catalog.read',
                    'recipe.read',
                  ]}
                >
                  <AdminListingHistoryPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/recipes/:versionId"
              element={
                <AdminPermissionRoute permission="recipe.read">
                  <AdminRecipeEditorPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/recipe-review"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'recipe.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminGovernancePage section="recipeReview" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/food-intelligence"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'catalog.read',
                    'recipe.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminFoodIntelligencePage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/product-intelligence"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'catalog.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminNpiReviewPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/bulk-product-review"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'catalog.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminBulkNpiReviewPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/community"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'recipe.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminCommunityPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/marketplace"
              element={
                <AdminPermissionRoute permission="marketplace.read">
                  <AdminMarketplaceOpsPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/orders-disputes"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'marketplace.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminGovernancePage section="orders" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/hosts"
              element={
                <AdminPermissionRoute permission="host.review.read">
                  <AdminHostReviewPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/host-operations"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'marketplace.read',
                    'finance.read',
                    'recipe.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminHostOperationsPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/finance-ops"
              element={
                <AdminPermissionRoute permission="finance.read">
                  <AdminGovernancePage section="finance" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/integrations"
              element={
                <AdminPermissionRoute permission="marketplace.read">
                  <AdminGovernancePage section="integrations" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/policy"
              element={
                <AdminPermissionRoute permission="admin.dashboard.read">
                  <AdminGovernancePage section="policy" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/cms"
              element={
                <AdminPermissionRoute permission="cms.read">
                  <AdminGovernancePage section="cms" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/trust-safety"
              element={
                <AdminPermissionRoute permission="trust_safety.read">
                  <AdminGovernancePage section="trustSafety" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/privacy"
              element={
                <AdminPermissionRoute permission="trust_safety.read">
                  <AdminGovernancePage section="privacy" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/ad-review"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'marketplace.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminGovernancePage section="adReview" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/ai-quality"
              element={
                <AdminPermissionRoute
                  anyPermissions={[
                    'admin.audit.read',
                    'catalog.read',
                    'trust_safety.read',
                  ]}
                >
                  <AdminGovernancePage section="aiQuality" />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/roles"
              element={
                <AdminPermissionRoute rootOnly>
                  <AdminRolesPage />
                </AdminPermissionRoute>
              }
            />

            <Route
              path="/admin/audit"
              element={
                <AdminPermissionRoute permission="admin.audit.read">
                  <AdminAuditPage />
                </AdminPermissionRoute>
              }
            />

            {import.meta.env.DEV ? (
              <Route
                path="/__debug"
                element={<SystemDebugPage />}
              />
            ) : null}

            <Route
              path="*"
              element={
                <main className="page-shell py-12">
                  <EmptyState
                    title="Page not found"
                    description="The page you requested does not exist."
                  />
                </main>
              }
            />
          </Routes>
        </Suspense>
      </div>

      <Footer />
    </div>
  )
}