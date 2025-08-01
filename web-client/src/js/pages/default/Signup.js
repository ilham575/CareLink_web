import React, { useRef, useState } from 'react';
import '../../../css/pages/default/signup.css';
import HomeHeader from '../../components/HomeHeader';
import logo from '../../../images/image 3.png';

function Signup() {
  const [profileImage, setProfileImage] = useState(null);
  const fileInputRef = useRef();

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProfileImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: handle signup logic
    alert('สมัครบัญชีสำเร็จ (Demo)');
  };

  return (
    <div className="signup-page-container">
      <HomeHeader />
      <div className="signup-content">
        <div className="signup-note">
          หมายเหตุ: บัญชีที่ถูกสร้างขึ้นนี้จะได้รับสิทธิ์เป็น <b>ผู้ดูแลระบบ (ADMIN)</b> โดยอัตโนมัติ
        </div>
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-row">
            <div className="signup-col">
              <label>ชื่อ<span className="required">*</span></label>
              <input type="text" required />
            </div>
            <div className="signup-col">
              <label>เบอร์โทรศัพท์</label>
              <input type="text" />
            </div>
          </div>
          <div className="signup-row">
            <div className="signup-col">
              <label>นามสกุล<span className="required">*</span></label>
              <input type="text" required />
            </div>
            <div className="signup-col">
              <label>เพิ่มรูปภาพตัวเอง<span className="required">*</span></label>
              <div className="signup-upload-box" onClick={handleUploadClick}>
                {profileImage ? (
                  <img src={profileImage} alt="profile" className="signup-profile-preview" />
                ) : (
                  <span className="signup-upload-icon">&#8682;</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                  required
                />
              </div>
            </div>
          </div>
          <label>USERNAME<span className="required">*</span></label>
          <input type="text" required />
          <label>PASSWORD<span className="required">*</span></label>
          <input type="password" required />
          <label>EMAIL<span className="required">*</span></label>
          <input type="email" required />
          <button type="submit" className="signup-submit-btn">
            บันทึกและลงชื่อเข้าใช้
          </button>
        </form>
        <div className="signup-footer-note">
          <span>“ * “ หมายถึง จำเป็นต้องใส่</span>
        </div>
      </div>
    </div>
  );
}

export default Signup;
