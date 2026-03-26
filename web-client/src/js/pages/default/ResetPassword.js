import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../../../css/pages/default/signin.css';
import '../../../css/pages/default/forgotPassword.css';
import logo from '../../../images/image 3.png';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API } from '../../../utils/apiConfig';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!code) {
      toast.error('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ');
      return;
    }

    if (!password) {
      toast.error('กรุณากรอกรหัสผ่านใหม่');
      return;
    }

    if (password.length < 6) {
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (password !== passwordConfirmation) {
      toast.error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API.auth.resetPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password, passwordConfirmation }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ตั้งรหัสผ่านใหม่สำเร็จ');
        navigate('/login', { state: { toast: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาลงชื่อเข้าใช้' } });
      } else {
        const msg = data?.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
        toast.error(msg);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    } finally {
      setIsLoading(false);
    }
  };

  if (!code) {
    return (
      <div className="login-page-container">
        <div className="login-background-image">
          <div className="login-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src={logo} alt="CareLink Logo" className="carelink-logo" />
          </div>
          <div className="login-content">
            <div className="welcome-section">
              <h1>ตั้งรหัสผ่านใหม่</h1>
              <h2>CareLink</h2>
            </div>
            <div className="login-form-section">
              <div className="forgot-sent-box">
                <div className="forgot-sent-icon">⚠️</div>
                <h3>ลิงก์ไม่ถูกต้อง</h3>
                <p>ลิงก์รีเซ็ตรหัสผ่านนี้ไม่ถูกต้องหรือหมดอายุแล้ว<br />กรุณาขอลิงก์ใหม่อีกครั้ง</p>
                <button className="login-button" onClick={() => navigate('/forgot-password')}>
                  ขอลิงก์ใหม่
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page-container">
      <div className="login-background-image">
        <div className="login-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src={logo} alt="CareLink Logo" className="carelink-logo" />
        </div>

        <div className="login-content">
          <div className="welcome-section">
            <h1>ตั้งรหัสผ่านใหม่</h1>
            <h2>CareLink</h2>
          </div>

          <div className="login-form-section">
            <form onSubmit={handleSubmit} className="login-form">
              <p className="forgot-description">
                กรอกรหัสผ่านใหม่ของคุณ<br />
                รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร
              </p>

              <div className="input-group">
                <label htmlFor="password">รหัสผ่านใหม่</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="**********"
                  disabled={isLoading}
                />
              </div>

              <div className="input-group">
                <label htmlFor="passwordConfirmation">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="passwordConfirmation"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  autoComplete="new-password"
                  placeholder="**********"
                  disabled={isLoading}
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

              <button type="submit" className="login-button" disabled={isLoading}>
                {isLoading ? 'กำลังบันทึก...' : 'ยืนยันรหัสผ่านใหม่'}
              </button>

              <div className="forgot-password" style={{ marginTop: 16, marginBottom: 0 }}>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); navigate('/login'); }}
                >
                  ← กลับสู่หน้าลงชื่อเข้าใช้
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
