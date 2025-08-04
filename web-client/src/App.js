import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
// import logo from './logo.svg';
import Home from './js/pages/default/home';
import PharmacyDetail from './js/pages/default/PharmacyDetail';
import LoginPage from './js/pages/default/signin';
import Signup from './js/pages/default/Signup';
import './App.css';
import HomeHeader from './js/components/HomeHeader';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Mock pages
function Page1({ onLogout, isLoggedIn }) {
  const location = useLocation();
  React.useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <h2>Page 1 (Role: admin)</h2>
    </>
  );
}
function Page2({ onLogout, isLoggedIn }) {
  const location = useLocation();
  React.useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <h2>Page 2 (Role: doctor)</h2>
    </>
  );
}
function Page3({ onLogout, isLoggedIn }) {
  const location = useLocation();
  React.useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <h2>Page 3 (Role: nurse)</h2>
    </>
  );
}
function Page4({ onLogout, isLoggedIn }) {
  const location = useLocation();
  React.useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);
  return (
    <>
      <ToastContainer />
      <HomeHeader isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <h2>Page 4 (Role: patient)</h2>
    </>
  );
}

// Protected route component
function ProtectedRoute({ children, allowedRoles, userRole }) {
  if (!userRole) return <Navigate to="/login" />;
  if (!allowedRoles.includes(userRole)) return <Navigate to="/login" />;
  return children;
}

function App() {
  const [userRole, setUserRole] = useState(null);

  const handleLogout = () => {
    setUserRole(null);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home isLoggedIn={!!userRole} onLogout={handleLogout} />} />
          <Route path="/login" element={<LoginPage onLogin={setUserRole} />} />
          <Route path="/pharmacy/:id" element={<PharmacyDetail />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/page1"
            element={
              <ProtectedRoute allowedRoles={['admin']} userRole={userRole}>
                <Page1 onLogout={handleLogout} isLoggedIn={!!userRole} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page2"
            element={
              <ProtectedRoute allowedRoles={['doctor']} userRole={userRole}>
                <Page2 onLogout={handleLogout} isLoggedIn={!!userRole} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page3"
            element={
              <ProtectedRoute allowedRoles={['nurse']} userRole={userRole}>
                <Page3 onLogout={handleLogout} isLoggedIn={!!userRole} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page4"
            element={
              <ProtectedRoute allowedRoles={['patient']} userRole={userRole}>
                <Page4 onLogout={handleLogout} isLoggedIn={!!userRole} />
              </ProtectedRoute>
            }
          />
          {/* Optional: redirect unknown routes to home */}
          {/* <Route path="*" element={<Navigate to="/" />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
