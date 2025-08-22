import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

// ฟังก์ชันตรวจสอบหมดอายุของ jwt
function isJwtExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false; // ถ้าไม่มี exp ให้ถือว่ายังไม่หมดอายุ
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now; // เปรียบเทียบกับเวลาปัจจุบัน
  } catch {
    return true;
  }
}

export const MAX_TOKEN_AGE = 30 * 60 * 1000; // 30 นาที

// ฟังก์ชัน logout และ redirect
function logoutAndRedirect(navigate, message) {
  localStorage.removeItem('jwt');
  localStorage.removeItem('role');
  localStorage.removeItem('jwt_issued_at');
  localStorage.removeItem('isLoggedIn');
  navigate('/login', { replace: true, state: { toast: message } });
}

// ฟังก์ชันขอ access token ใหม่จาก refresh token
async function refreshAccessToken() {
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // <<== ส่ง httpOnly cookie refresh token ไปด้วย
    });
    if (!res.ok) throw new Error('Refresh token invalid');
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('jwt', data.accessToken);
      localStorage.setItem('jwt_issued_at', Date.now().toString());
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

function RequireRole({ role, children }) {
  const jwt = localStorage.getItem('jwt');
  const userRole = localStorage.getItem('role');
  const issuedAt = localStorage.getItem('jwt_issued_at');
  const location = useLocation();
  const navigate = useNavigate();

  // ตั้ง auto refresh/logout
  useEffect(() => {
    if (!jwt || !issuedAt) return;

    const expireIn = MAX_TOKEN_AGE - (Date.now() - parseInt(issuedAt, 10));
    if (expireIn <= 0) {
      // ถ้า access token หมดแล้ว → พยายาม refresh
      refreshAccessToken().then(newToken => {
        if (!newToken) {
          logoutAndRedirect(navigate, 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
        }
      });
      return;
    }

    // ตั้ง timer ไว้ refresh ก่อนหมดจริงเล็กน้อย
    const timer = setTimeout(async () => {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        logoutAndRedirect(navigate, 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
      }
    }, expireIn - 2000);

    return () => clearTimeout(timer);
  }, [jwt, issuedAt, navigate]);

  // ตรวจสอบ role และการหมดอายุ
  if (!jwt || userRole !== role || isJwtExpired(jwt)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default RequireRole;
