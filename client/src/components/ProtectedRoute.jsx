import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — wraps a page and checks:
 * 1. User is logged in (redirect to /login if not).
 * 2. If `role` prop is set, user must have that role (redirect to their home if not).
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="state-box">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    // Send to correct home
    return <Navigate to={user.role === 'admin' ? '/admin' : '/tickets'} replace />;
  }

  return children;
}
