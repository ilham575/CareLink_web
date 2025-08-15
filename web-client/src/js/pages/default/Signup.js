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
    e.preventDefault();

    try {
      // 1. Register user (เฉพาะ username, email, password)
      const registerRes = await fetch('http://localhost:1337/api/auth/local/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });
      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        alert(registerData.error?.message || "สมัครไม่สำเร็จ");
        return;
      }

      // ได้ userId และ jwt
      const userId = registerData.user.id;
      const jwt = registerData.jwt;

      // 2. Upload image (profileImage ต้องเป็นไฟล์)
      let profileImageId = null;
      if (form.profileImage) {
        const imageData = new FormData();
        imageData.append('files', form.profileImage);
        const uploadRes = await fetch('http://localhost:1337/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${jwt}` },
          body: imageData,
        });
        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult && uploadResult[0]?.id) {
          profileImageId = uploadResult[0].id;
        }
      }

      // 3. PATCH user: เพิ่ม full_name, phone, profileimage, role
      // ถ้าอยาก set role เป็นค่าเฉพาะ ต้องใช้ roleId จริงจากตาราง role (ดูใน Strapi admin > Users & Permissions > Roles)
      const targetRoleId = 3; // แทน id จริง เช่น admin = 3 (กรณีอยากเปลี่ยน role)
      const patchUser = {
        full_name: `${form.firstName} ${form.lastName}`,
        phone: form.phone,
        confirmed: true,
        ...(profileImageId ? { profileimage: profileImageId } : {}),
        role: targetRoleId,   
      };
      // ถ้าอยากเปลี่ยน role ให้ uncomment บรรทัดข้างบน

      const patchRes = await fetch(`http://localhost:1337/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify(patchUser),
      });
      const patchData = await patchRes.json();

      if (patchRes.ok) {
        alert('✅ สมัครบัญชีสำเร็จ!');
      } else {
        alert(patchData.error?.message || "เกิดข้อผิดพลาดในการอัปเดต user");
      }

    } catch (err) {
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      console.error(err);
    }
  };

  return (
    <div className="signup-page-container">
      {/* <div className="signup-header">
        <img src={logo} alt="CareLink Logo" className="signup-logo" />
        <div className="signup-title">สมัครสมาชิกผู้ดูแลระบบ</div>
      </div> */}
      <HomeHeader />
      <div className="signup-content">
        <div className="signup-note">
          หมายเหตุ: บัญชีที่ถูกสร้างขึ้นนี้จะได้รับสิทธิ์เป็น <b>ผู้ดูแลระบบ (ADMIN)</b> โดยอัตโนมัติ
        </div>
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-form-flex">
            <div className="signup-form-left">
              <label>ชื่อ<span className="required">*</span></label>
              <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required />
              <label>นามสกุล<span className="required">*</span></label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required />
              <label>เบอร์โทรศัพท์</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange} />
              <label>USERNAME<span className="required">*</span></label>
              <input type="text" name="username" value={form.username} onChange={handleChange} required />
              <label>PASSWORD<span className="required">*</span></label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required />
              <label>EMAIL<span className="required">*</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="signup-form-right">
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
