import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../css/pages/default/signin.css';
import logo from '../../../images/image 3.png';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Mock user database
const mockUsers = [
  { username: 'admin1', password: 'adminpass', role: 'admin' },
  { username: 'doctor1', password: 'doctorpass', role: 'doctor' },
  { username: 'nurse1', password: 'nursepass', role: 'nurse' },
  { username: 'patient1', password: 'patientpass', role: 'patient' },
];

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const user = mockUsers.find(
      u => u.username === username && u.password === password
    );
    if (user) {
      if (onLogin) onLogin(user.role);
      setError('');
      // Redirect based on role first
      if (user.role === 'admin') navigate('/page1', { state: { showToast: true } });
      else if (user.role === 'doctor') navigate('/page2', { state: { showToast: true } });
      else if (user.role === 'nurse') navigate('/page3', { state: { showToast: true } });
      else if (user.role === 'patient') navigate('/page4', { state: { showToast: true } });
      // ไม่ต้องเรียก toast ที่นี่ เพราะ component จะ unmount
    } else {
      toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', { autoClose: 2500 });
    }
  };

  return (
    <div className="login-page-container">
      <ToastContainer />
      <div className="login-background-image">
        <div className="login-header-logo" onClick={() => navigate('/') } style={{ cursor: 'pointer' }}>
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