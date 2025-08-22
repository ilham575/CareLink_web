import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../../css/pages/default/signin.css';
import logo from '../../../images/image 3.png';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.toast) {
      toast.success(location.state.toast, { autoClose: 2500 });
      // Clear the toast state so it doesn't show again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);


  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:1337/api/auth/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: username,
          password: password
        }),
        credentials: 'include', // <<== สำคัญ! เพื่อรับ refresh token จาก httpOnly cookie
      });

      const data = await response.json();

      if (response.ok) {
        // ได้ Access Token + User
        const accessToken = data.accessToken || data.jwt; // ถ้า backend ยังใช้ชื่อ jwt
        const userId = data.user.id;

        // เก็บ Access Token และเวลาที่ได้
        localStorage.setItem('jwt', accessToken);
        localStorage.setItem('jwt_issued_at', Date.now().toString());
        localStorage.setItem('isLoggedIn', 'true');

        // ดึง user พร้อม role
        const userRes = await fetch(`http://localhost:1337/api/users/${userId}?populate=role`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userData = await userRes.json();

        const role = userData.role?.name || '';
        localStorage.setItem('role', role);

        setError('');

        // route ตาม role
        if (role === 'admin') {
          navigate('/adminHome', { state: { showToast: true } });
          return;
        }
        if (role === 'pharmacy') {
          navigate('/pharmacyHome', { state: { showToast: true } });
          return;
        }
        if (role === 'staff') {
          navigate('/staffHome', { state: { showToast: true } });
          return;
        }
        if (role === 'customer') {
          navigate('/customerHome', { state: { showToast: true } });
          return;
        }

        toast.error('ไม่พบ role นี้ในระบบ', { autoClose: 2500 });

      } else {
        let errorMsg = data.error?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        if (Array.isArray(data.error?.details?.errors)) {
          errorMsg = data.error.details.errors.map(e => e.message).join('\n');
        }
        toast.error(errorMsg, { autoClose: 2500 });
      }
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', { autoClose: 2500 });
    }
  };

  return (
    <div className="login-page-container">
      <ToastContainer />
      <div className="login-background-image">
        <div className="login-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src={logo} alt="CareLink Logo" className="carelink-logo" />
        </div>

        <div className="login-content" >
          <div className="welcome-section">
            <h1>ยินดีต้อนรับ</h1>
            <h2>CareLink</h2>
          </div>

          <div className="login-form-section">
            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <label htmlFor="username">USERNAME</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="USERNAME"
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">PASSWORD</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="**********"
                />
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="show-password"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                />
                <label htmlFor="show-password">แสดงรหัสผ่าน</label>
              </div>

              {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

              <div className="forgot-password">
                <span>หากยังไม่มีบัญชี</span>
                <a
                  href="#"
                  style={{ marginLeft: 5 }}
                  onClick={e => {
                    e.preventDefault();
                    navigate('/signup');
                  }}
                >
                  สร้างบัญชี
                </a>
              </div>

              <button type="submit" className="login-button">
                ลงชื่อเข้าใช้
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
