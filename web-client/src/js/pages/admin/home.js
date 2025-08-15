import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';

function AdminHome() {
  const location = useLocation();
  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={true}/>
      <h2>Page 1 (Role: admin)</h2>
    </>
  );
}

export default AdminHome;
