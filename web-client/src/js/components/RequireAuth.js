import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// ตัวอย่างการเช็ค token ใน localStorage (ปรับตามระบบ auth ที่ใช้จริง)
function isAuthenticated() {
  return !!localStorage.getItem('jwt');
}

const RequireAuth = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    // redirect ไปหน้า login และส่ง path เดิมไปด้วย
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default RequireAuth;
