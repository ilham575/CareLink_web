import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

function RequireRole({ role, children }) {
  const jwt = localStorage.getItem('jwt');
  const userRole = localStorage.getItem('role');
  const location = useLocation();

  if (!jwt || userRole !== role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default RequireRole;
