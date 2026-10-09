import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import DashboardLayout from './components/DashboardLayout';
import { ToastContainer } from './components/ui';

// Lazy-loaded pages for optimal bundle splitting
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const BaglogManagement = lazy(() => import('./pages/BaglogManagement'));
const KumbungGrid = lazy(() => import('./pages/KumbungGrid'));
const HarvestManagement = lazy(() => import('./pages/HarvestManagement'));
const SalesManagement = lazy(() => import('./pages/SalesManagement'));

// Elegant loading fallback matching the theme
const PageLoadingFallback = () => (
  <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-8">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
      <span className="text-xs font-semibold text-slate-500 dark:text-[#a3c9b4]">
        Memuat modul...
      </span>
    </div>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Guest Route Wrapper (if logged in, redirect to dashboard)
const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />

          {/* Protected Routes inside Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Outlet Children */}
            <Route index element={<Dashboard />} />
            <Route path="baglogs" element={<BaglogManagement />} />
            <Route path="kumbung" element={<KumbungGrid />} />
            <Route path="harvests" element={<HarvestManagement />} />
            <Route path="sales" element={<SalesManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch all 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
