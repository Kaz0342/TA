import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import BaglogManagement from './pages/BaglogManagement';
import HarvestManagement from './pages/HarvestManagement';
import SalesManagement from './pages/SalesManagement';
import DashboardLayout from './components/DashboardLayout';

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

import { ToastContainer } from './components/ui';

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
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
          <Route path="harvests" element={<HarvestManagement />} />
          <Route path="sales" element={<SalesManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Catch all 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
