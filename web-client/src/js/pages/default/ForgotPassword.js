import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../css/pages/default/signin.css';
import '../../../css/pages/default/forgotPassword.css';
import logo from '../../../images/image 3.png';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API } from '../../../utils/apiConfig';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('กรุณากรอกอีเมลของคุณ');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API.auth.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      // Strapi returns 200 even if email doesn't exist (security by design)
      if (response.ok) {
        setIsSent(true);
        toast.success('ส่งอีเมลสำเร็จ กรุณาตรวจสอบกล่องจดหมาย');
      } else {
        const data = await response.json();
        const msg = data?.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
        toast.error(msg);
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      toast.error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
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

        <div className="login-content">
          <div className="welcome-section">
            <h1>ลืมรหัสผ่าน</h1>
            <h2>CareLink</h2>
          </div>

          <div className="login-form-section">
            {isSent ? (
              <div className="forgot-sent-box">
                <div className="forgot-sent-icon">✉️</div>
                <h3>ตรวจสอบอีเมลของคุณ</h3>
                <p>
                  เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่<br />
                  <strong>{email}</strong><br />
                  แล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึง Spam)
                </p>
                <button
                  className="login-button"
                  onClick={() => navigate('/login')}
                >
                  กลับสู่หน้าลงชื่อเข้าใช้
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                <p className="forgot-description">
                  กรอกอีเมลที่ผูกกับบัญชีของคุณ<br />
                  เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
                </p>

                <div className="input-group">
                  <label htmlFor="email">อีเมล</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="example@email.com"
                    disabled={isLoading}
                  />
                </div>

                <button type="submit" className="login-button" disabled={isLoading}>
                  {isLoading ? 'กำลังส่งอีเมล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
