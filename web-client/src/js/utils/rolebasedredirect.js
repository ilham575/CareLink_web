import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Home from '../pages/default/home';

function RoleBasedRedirect () {
  const navigate = useNavigate();
  
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const role = localStorage.getItem('role');
    
    if (!isLoggedIn) {
      return;
    }
    
    // ถ้า login แล้ว ให้ redirect ตาม role
    switch (role) {
      case 'admin':
        navigate('/adminHome', { replace: true });
        break;
      case 'pharmacy':
        navigate('/pharmacyHome', { replace: true });
        break;
      case 'staff':
        navigate('/staffHome', { replace: true });
        break;
      case 'customer':
        navigate('/customerHome', { replace: true });
        break;
      default:
        console.warn('⚠️ Unknown role or no role found:', role);
        // ถ้าไม่มี role ให้แสดงหน้า Home ปกติ
    }
  }, [navigate]);
  
  // แสดงหน้า Home ปกติขณะรอการ redirect
  return <Home />;
};

export default RoleBasedRedirect;