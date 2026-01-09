import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import App from './App.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import './index.css';

function RootRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Simulation pages - accessible to all (authenticated or guest) */}
      <Route path="/simulation" element={<App />} />
      <Route path="/heart-age" element={<App />} />
      <Route path="/what-if" element={<App />} />
      <Route path="/history" element={<App />} />

      {/* Default route - redirect based on authentication */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/simulation" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RootRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
