import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../../css/pages/default/signin.css';
import logo from '../../../images/image 3.png';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API } from '../../../utils/apiConfig';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    setError('');

    // Client-side validation
    if (!username.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้');
      toast.error('กรุณากรอกชื่อผู้ใช้');
      return;
    }

    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      toast.error('กรุณากรอกรหัสผ่าน');
      return;
    }

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API.auth.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: username,
          password: password
        }),
        credentials: 'include', // สำคัญ! เพื่อรับ refresh token จาก httpOnly cookie
      });

      const data = await response.json();

      if (response.ok) {
        // ได้ Access Token + User
        const accessToken = data.accessToken || data.jwt;
        const userId = data.user.id;
        const userDocumentId = data.user.documentId;

        // ตรวจสอบให้แน่ใจว่าเก็บทั้งคู่
        localStorage.setItem('jwt', accessToken);
        localStorage.setItem('jwt_issued_at', Date.now().toString());
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user_documentId', userDocumentId);
        
        // ดึง user พร้อม role
        const userRes = await fetch(API.users.getById(userId), {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userData = await userRes.json();

        const role = userData.role?.name || '';
        localStorage.setItem('role', role);

        setError('');
        toast.success('ลงชื่อเข้าใช้สำเร็จ', { autoClose: 1500 });

        // route ตาม role
        setTimeout(() => {
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

          setError('ไม่พบ role นี้ในระบบ');
        }, 100);

      } else {
        // ดีลกับ error responses
        let errorMsg = '';
        const statusCode = response.status;

        // Priority 1: Try to get message from server error object (should be Thai)
        if (data.error?.message) {
          errorMsg = data.error.message;
        } else if (data.message) {
          // Priority 2: Try data.message directly from server
          errorMsg = data.message;
        } else if (Array.isArray(data.error?.details?.errors)) {
          // Priority 3: Try detailed error messages
          errorMsg = data.error.details.errors.map(e => e.message).join('\n');
        } else if (data.error?.details && typeof data.error.details === 'string') {
          // Priority 4: Try error details string
          errorMsg = data.error.details;
        } else {
          // Priority 5: Fallback to status-code specific messages
          if (statusCode === 400) {
            errorMsg = 'ข้อมูลที่ส่งมานั้นไม่ถูกต้อง';
          } else if (statusCode === 401) {
            errorMsg = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
          } else if (statusCode === 404) {
            errorMsg = 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
          } else if (statusCode === 500) {
            errorMsg = 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์';
          } else {
            errorMsg = 'เกิดข้อผิดพลาดในการลงชื่อเข้าใช้';
          }
        }

        // Log full error details for debugging
        console.error('🔴 Server Error Details:', {
          statusCode,
          errorMessage: errorMsg,
          fullErrorObject: data.error,
          fullResponse: data
        });

        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.message === 'Failed to fetch' 
        ? 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
        : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
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

              {error && (
                <div style={{ 
                  color: '#ff4d4f', 
                  marginTop: 10, 
                  marginBottom: 10,
                  padding: '10px', 
                  backgroundColor: '#fff1f0', 
                  borderRadius: '4px', 
                  border: '1px solid #ffccc7',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

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

              <button type="submit" className="login-button" disabled={isLoading}>
                {isLoading ? 'กำลังลงชื่อเข้าใช้...' : 'ลงชื่อเข้าใช้'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
