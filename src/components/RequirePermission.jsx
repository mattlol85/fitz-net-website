import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NoPage from './NoPage.jsx';

/**
 * Route guard: sends logged-out users to /login and shows the 404 page to
 * users without the permission. UI gating only - the API enforces access.
 */
function RequirePermission({ permission, children }) {
  const { loading, isAuthenticated, hasPermission } = useAuth();

  if (loading) return null;
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <NoPage />;

  return children;
}

export default RequirePermission;
