import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuthStore } from './stores/authStore'
import { useAppStore } from './stores/appStore'
import AppLayout from './components/layout/AppLayout'
import SettingsLayout from './components/layout/SettingsLayout'
import LandingPage from './pages/landing/LandingPage'
import CustomCursor from './components/layout/CustomCursor'
import ToastProvider from './components/layout/ToastProvider'
import ConfirmDialog from './components/layout/ConfirmDialog'
import ErrorBoundary from './components/layout/ErrorBoundary'
import NotFound from './pages/NotFound'

// Location listener for route transition fade-in
function RouteTransitionEffect() {
  const location = useLocation()
  useEffect(() => {
    // Trigger page-enter animation on route change by adding class to body
    document.documentElement.style.animation = 'none'
    // Force reflow to restart animation
    void document.documentElement.offsetHeight
    document.documentElement.style.animation = ''
  }, [location.pathname])
  return null
}

// ── Lazy-loaded route pages (code-split per route) ───────────────────────────
const Login = lazy(() => import('./pages/auth/Login'))
const Signup = lazy(() => import('./pages/auth/Signup'))
const Onboarding = lazy(() => import('./pages/auth/Onboarding'))
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const OrderList = lazy(() => import('./pages/orders/OrderList'))
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'))
const NewOrder = lazy(() => import('./pages/orders/NewOrder'))
const Fulfillment = lazy(() => import('./pages/fulfillment/Fulfillment'))
const Payments = lazy(() => import('./pages/payments/Payments'))
const Exceptions = lazy(() => import('./pages/exceptions/Exceptions'))
const CustomerList = lazy(() => import('./pages/customers/CustomerList'))
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail'))
const Products = lazy(() => import('./pages/products/Products'))
const Analytics = lazy(() => import('./pages/analytics/Analytics'))
const DailyBrief = lazy(() => import('./pages/briefs/DailyBrief'))
const BriefHistory = lazy(() => import('./pages/briefs/BriefHistory'))
const BrandSettings = lazy(() => import('./pages/settings/Brand'))
const IntegrationsSettings = lazy(() => import('./pages/settings/Integrations'))
const WarehousesSettings = lazy(() => import('./pages/settings/Warehouses'))
const TeamSettings = lazy(() => import('./pages/settings/Team'))
const BillingSettings = lazy(() => import('./pages/settings/Billing'))
const Returns = lazy(() => import('./pages/returns/Returns'))
const FoundingAccess = lazy(() => import('./pages/landing/FoundingAccess'))
const Checkout = lazy(() => import('./pages/landing/Checkout'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const Reconciliation = lazy(() => import('./pages/reconciliation/Reconciliation'))
const AuditLog = lazy(() => import('./pages/audit/AuditLog'))
const ReturnPortal = lazy(() => import('./pages/portal/ReturnPortal'))

// ── Shared loading spinner ───────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )
}

// ── Root route: landing page for guests, dashboard for authed users ──────────
function RootRoute() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )
  if (user) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

// ── Auth guard for protected app routes ──────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuthStore()
  const { currentBrand, isLoading: appLoading, bootstrapError } = useAppStore()

  // Wait for BOTH auth session AND app data (bootstrap) to finish loading
  if (authLoading || (user && appLoading)) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (bootstrapError) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Failed to load workspace</h2>
            <p className="text-sm text-gray-500 mt-1">{bootstrapError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!currentBrand) return <Navigate to="/onboarding" replace />

  return <>{children}</>
}

export default function App() {
  const { initialize, user } = useAuthStore()
  const { bootstrap } = useAppStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (user) bootstrap(user.id, user.email)
  }, [user, bootstrap])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <CustomCursor />
        <ToastProvider />
        <ConfirmDialog />
        <RouteTransitionEffect />
        <div className="page-enter">
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/founding" element={<FoundingAccess />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/portal/returns" element={<ReturnPortal />} />

              {/* Protected app routes — layout wrapper (no path, just wraps) */}
              <Route
                element={
                  <AuthGuard>
                    <AppLayout />
                  </AuthGuard>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/orders" element={<OrderList />} />
                <Route path="/orders/new" element={<NewOrder />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/fulfillment" element={<Fulfillment />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/exceptions" element={<Exceptions />} />
                <Route path="/customers" element={<CustomerList />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/products" element={<Products />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/returns" element={<Returns />} />
                <Route path="/reconciliation" element={<Reconciliation />} />
                <Route path="/audit-log" element={<AuditLog />} />
                <Route path="/briefs" element={<DailyBrief />} />
                <Route path="/briefs/history" element={<BriefHistory />} />
                <Route path="/settings" element={<Navigate to="/settings/brand" replace />} />
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route path="brand" element={<BrandSettings />} />
                  <Route path="integrations" element={<IntegrationsSettings />} />
                  <Route path="warehouses" element={<WarehousesSettings />} />
                  <Route path="team" element={<TeamSettings />} />
                  <Route path="billing" element={<BillingSettings />} />
                </Route>
              </Route>

              {/* 404 catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
