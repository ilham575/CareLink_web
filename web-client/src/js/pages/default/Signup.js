import React, { useRef, useState } from 'react';
import '../../../css/pages/default/signup.css';
import HomeHeader from '../../components/HomeHeader';
import logo from '../../../images/image 3.png';

function Signup() {
  const [profileImage, setProfileImage] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    username: '',
    password: '',
    email: '',
    profileImage: null,
  });
  const fileInputRef = useRef();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm(f => ({ ...f, profileImage: e.target.files[0] }));
      setProfileImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault()

    const formData = new FormData();

    // 1. เตรียมข้อมูลแบบ JSON string และแนบเข้า key 'data'
    const data = {
      full_name: `${form.firstName} ${form.lastName}`,
      phone: form.phone,
      username: form.username,
      password: form.password,
      email: form.email,
      role: 'admin',
    };
    formData.append('data', JSON.stringify(data));
    formData.append('files.profileImage', form.profileImage);

    // 3. ทดสอบว่า formData มี key ชื่อ data และไฟล์จริง
    for (let [key, value] of formData.entries()) {
      console.log(key, value); // ✅ สำคัญ: ตรวจดูใน console
    }

    try {
      const res = await fetch('http://localhost:1337/api/user-inters', {
        method: 'POST',
        body: formData, // ✅ Content-Type ถูกตั้งอัตโนมัติ
      });

      const result = await res.json();

      if (res.ok) {
        alert('✅ สมัครบัญชีสำเร็จ!');
      } else {
        console.error(result);
        alert('❌ เกิดข้อผิดพลาด: ' + (result?.error?.message || 'ไม่สามารถสมัครบัญชีได้'));
      }
    } catch (err) {
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      console.error(err);
    }
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
              <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required />
            </div>
            <div className="signup-col">
              <label>เบอร์โทรศัพท์</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>
          <div className="signup-row">
            <div className="signup-col">
              <label>นามสกุล<span className="required">*</span></label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required />
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
          <input type="text" name="username" value={form.username} onChange={handleChange} required />
          <label>PASSWORD<span className="required">*</span></label>
          <input type="password" name="password" value={form.password} onChange={handleChange} required />
          <label>EMAIL<span className="required">*</span></label>
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
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
