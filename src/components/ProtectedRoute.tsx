import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // If false, allow guests but show message
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = false
}) => {
  const { isAuthenticated } = useAuth();

  // If route requires auth and user is not authenticated, redirect to login
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Otherwise, render the children (component)
  return <>{children}</>;
};
