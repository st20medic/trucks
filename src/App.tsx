import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TruckProvider } from './contexts/TruckContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  console.log('ProtectedRoute: isAuthenticated =', isAuthenticated, 'loading =', loading);

  if (loading) {
    console.log('ProtectedRoute: Showing loading screen');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ems-blue mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute: Rendering protected content');
  return <>{children}</>;
};

// Main App Component
const AppContent: React.FC = () => {
  // Only use basename in production (when deployed to /trucks subdirectory)
  const basename = import.meta.env.PROD ? "/trucks" : undefined;
  
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

// Root App Component with Providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <TruckProvider>
        <AppContent />
      </TruckProvider>
    </AuthProvider>
  );
};

export default App;
