import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { ACCOUNT_FOOD_PREFERENCES_CHANGED_EVENT, getAccountPreferences } from "../services/account.service";

// Explicit food mode is independent of recommendation/marketing consent.
export function resolveSavedFoodDiet(preferences, defaultDiet) {
  const values = preferences?.dietaryLifestyles;
  if (!Array.isArray(values)) throw new Error("Invalid saved food preference response.");
  const lifestyles = new Set(values.map((value) => String(value).trim().toLowerCase()));
  if (lifestyles.has("non_vegetarian")) return "nonveg";
  if (lifestyles.has("vegetarian") || lifestyles.has("vegan")) return "veg";
  return defaultDiet;
}

function PreferenceLoading() {
  return (
    <div className="flex min-h-[50svh] items-center justify-center bg-[#F7F6F2] px-5 text-center text-[#173F35]" role="status" aria-live="polite">
      Loading your food preferences...
    </div>
  );
}

function PreferenceError({ retry }) {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-4 bg-[#F7F6F2] px-5 text-center text-[#202421]" role="alert">
      <p>We couldn't load your saved food preferences.</p>
      <button type="button" className="focus-ring rounded-lg bg-[#C56C42] px-5 py-3 font-semibold text-[#202421]" onClick={retry}>Retry</button>
    </div>
  );
}

export default function SavedFoodPreferenceGate({ defaultDiet, children }) {
  const { user, currentUser, isAuthenticated, isBootstrapping, activeMode } = useAuth();
  const location = useLocation();
  const identity = currentUser || user;
  const accountId = String(identity?.id || identity?._id || identity?.uid || "");
  if (isBootstrapping) return <PreferenceLoading />;
  // Account preferences are available to authenticated accounts on the
  // existing account API; don't skip them based on optional capability flags.
  // Keep the existing Host browsing behavior separate.
  if (!isAuthenticated || activeMode === "host") return children(defaultDiet, "public");
  if (!accountId) return <PreferenceLoading />;
  // Every actual route entry gets a fresh authoritative GET, even after
  // changing settings and navigating back to a cached discovery route.
  const scope = JSON.stringify([accountId, location.key, location.pathname, defaultDiet]);
  return (
    <CustomerFoodPreference key={scope} scope={scope} defaultDiet={defaultDiet}>
      {children}
    </CustomerFoodPreference>
  );
}

function CustomerFoodPreference({ scope, defaultDiet, children }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function refresh(block = false) {
      const request = ++generation;
      if (block) setResult(null);
      try {
        const preferences = await getAccountPreferences();
        const diet = resolveSavedFoodDiet(preferences, defaultDiet);
        if (active && request === generation) setResult({ diet, failed: false });
      } catch {
        if (active && request === generation) setResult({ failed: true });
      }
    }
    const onSaved = () => { void refresh(true); };
    const onPageShow = (event) => { if (event.persisted) void refresh(true); };
    const onFocus = () => { void refresh(); };
    window.addEventListener(ACCOUNT_FOOD_PREFERENCES_CHANGED_EVENT, onSaved);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    void refresh(true);
    return () => {
      active = false;
      window.removeEventListener(ACCOUNT_FOOD_PREFERENCES_CHANGED_EVENT, onSaved);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [scope, defaultDiet, attempt]);
  if (!result) return <PreferenceLoading />;
  // Never silently render Veg when a signed-in account's GET failed.
  if (result.failed) return <PreferenceError retry={() => { setResult(null); setAttempt((value) => value + 1); }} />;
  // The actual discovery state is initialized from the resolved mode. A
  // different saved mode remounts the screen, while ordinary focus refreshes
  // of the same preference leave a customer's temporary filters intact.
  return children(result.diet, `${scope}:${result.diet}`);
}
