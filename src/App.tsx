import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useAppStore } from './stores/appStore'
import AppLayout from './components/layout/AppLayout'
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
  const { currentBrand, isLoading: appLoading } = useAppStore()

  // Wait for BOTH auth session AND app data (bootstrap) to finish loading
  if (authLoading || (user && appLoading)) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
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
                <Route path="/briefs" element={<DailyBrief />} />
                <Route path="/briefs/history" element={<BriefHistory />} />
                <Route path="/settings/brand" element={<BrandSettings />} />
                <Route path="/settings/integrations" element={<IntegrationsSettings />} />
                <Route path="/settings/warehouses" element={<WarehousesSettings />} />
                <Route path="/settings/team" element={<TeamSettings />} />
                <Route path="/settings/billing" element={<BillingSettings />} />
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
