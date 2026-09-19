import {
  Navigate,
  useLocation,
} from 'react-router-dom'

import ScrollToTop from './components/common/ScrollToTop'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'

import {
  ADMIN_ACCESS_STATUSES,
  useAdmin,
} from './features/admin/context/AdminContext'

import {
  useAuth,
} from './features/auth/context/AuthContext'

import AdminObservabilityPage from './features/hardening/pages/AdminObservabilityPage'
import AdminPrivacyOpsPage from './features/hardening/pages/AdminPrivacyOpsPage'
import CustomerPrivacyPage from './features/hardening/pages/CustomerPrivacyPage'
import RouteLoading from './features/system/components/RouteLoading'
import AppRoutes from './routes/AppRoutes'

const M20_ROUTES =
  Object.freeze({
    customerPrivacy:
      '/account/privacy',

    adminPrivacy:
      '/admin/privacy',

    adminObservability:
      '/admin/observability',
  })

function M20ApplicationFrame({
  children,
}) {
  return (
    <div className="app-frame text-stone-900">
      <ScrollToTop />

      <Navbar />

      <div className="app-content">
        {children}
      </div>

      <Footer />
    </div>
  )
}

export default function App() {
  const location =
    useLocation()

  const {
    isAuthenticated,
    isBootstrapping,
    customerEnabled,
  } =
    useAuth()

  const {
    adminStatus,
    hasAdminAccess,
    isAdminMfaRequired,
    hasAnyAdminPermission,
  } =
    useAdmin()

  if (
    location.pathname ===
    M20_ROUTES.customerPrivacy
  ) {
    if (
      isBootstrapping
    ) {
      return (
        <RouteLoading />
      )
    }

    if (
      !isAuthenticated
    ) {
      return (
        <Navigate
          to="/login"
          replace
        />
      )
    }

    if (
      customerEnabled !==
      true
    ) {
      return (
        <Navigate
          to="/"
          replace
        />
      )
    }

    return (
      <M20ApplicationFrame>
        <CustomerPrivacyPage />
      </M20ApplicationFrame>
    )
  }

  const isM20AdminRoute =
    location.pathname ===
      M20_ROUTES.adminPrivacy ||
    location.pathname ===
      M20_ROUTES.adminObservability

  if (
    isM20AdminRoute
  ) {
    if (
      isBootstrapping ||
      adminStatus ===
        ADMIN_ACCESS_STATUSES.IDLE ||
      adminStatus ===
        ADMIN_ACCESS_STATUSES.LOADING
    ) {
      return (
        <RouteLoading />
      )
    }

    if (
      !isAuthenticated
    ) {
      return (
        <Navigate
          to="/login"
          replace
        />
      )
    }

    if (
      isAdminMfaRequired
    ) {
      return (
        <Navigate
          to="/account/security/mfa"
          replace
        />
      )
    }

    const canReadM20Ops =
      hasAdminAccess &&
      hasAnyAdminPermission([
        'admin.audit.read',
        'trust_safety.read',
      ])

    if (
      !canReadM20Ops
    ) {
      return (
        <Navigate
          to="/admin"
          replace
        />
      )
    }

    return (
      <M20ApplicationFrame>
        {location.pathname ===
        M20_ROUTES.adminPrivacy ? (
          <AdminPrivacyOpsPage />
        ) : (
          <AdminObservabilityPage />
        )}
      </M20ApplicationFrame>
    )
  }

  return (
    <AppRoutes />
  )
}