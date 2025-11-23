import React, { useRef, useState, useEffect } from 'react';
import '../../../css/pages/default/signup.css';
import HomeHeader from '../../components/HomeHeader';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { API, fetchWithAuth } from '../../../utils/apiConfig';

function Signup() {
  const location = useLocation();
  const navigate = useNavigate();
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

  // ดึงข้อมูลผู้ใช้จาก backend ถ้ามี userId
  useEffect(() => {
    const userId = location.state?.userId;
    const jwt = localStorage.getItem('jwt');
    if (userId && jwt) {
      fetch(API.users.getById(userId), {
        headers: { Authorization: `Bearer ${jwt}` }
      })
        .then(res => res.json())
        .then(user => {
          console.log('User data:', user); // Debug เพื่อดูโครงสร้างข้อมูล
          setForm(f => ({
            ...f,
            firstName: user.full_name?.split(' ')[0] || '',
            lastName: user.full_name?.split(' ').slice(1).join(' ') || '',
            phone: user.phone || '',
            username: user.username || '',
            email: user.email || '',
            password: '', // รหัสผ่านไม่ถูกส่งมาจาก API เพื่อความปลอดภัย
          }));

          // ✅ ดึงรูปโปรไฟล์จาก admin profile หรือ user profile
          if (userId) {
            // ดึงจาก admin-profiles แทน
            fetch(API.adminProfiles.list(`filters[users_permissions_user][id][$eq]=${userId}&populate=profileimage`), {
              headers: { Authorization: `Bearer ${jwt}` }
            })
              .then(res => res.json())
              .then(adminData => {
                console.log('Admin profile data:', adminData); // Debug
                const profile = adminData.data?.[0];
                if (profile?.profileimage) {
                  let imgUrl = null;
                  const img = Array.isArray(profile.profileimage) ? profile.profileimage[0] : profile.profileimage;
                  if (img?.url) {
                    imgUrl = API.getImageUrl(img.url);
                  }
                  if (imgUrl) setProfileImage(imgUrl);
                }
              })
              .catch(err => console.log('Admin profile fetch error:', err));
          }
        })
        .catch(err => console.log('User fetch error:', err));
    }
  }, [location.state]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm(f => ({ ...f, profileImage: e.target.files[0] }));
      setProfileImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isEditMode = !!location.state?.userId;

    try {
      if (isEditMode) {
        // โหมดแก้ไขโปรไฟล์
        const currentUserId = location.state.userId;
        const jwt = localStorage.getItem('jwt');

        // 1. Upload profile image ถ้ามีการเปลี่ยน
        let profileImageId = null;
        if (form.profileImage) {
          const imageData = new FormData();
          imageData.append('files', form.profileImage);
          const uploadRes = await fetch(API.upload(), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${jwt}` },
            body: imageData,
          });
          const uploadResult = await uploadRes.json();
          if (uploadRes.ok && uploadResult && uploadResult[0]?.id) {
            profileImageId = uploadResult[0].id;
          }
        }

        // 2. Update user data
        const updateData = {
          full_name: `${form.firstName} ${form.lastName}`,
          phone: form.phone,
          username: form.username,
          email: form.email,
        };

        // เพิ่มรหัสผ่านเฉพาะเมื่อมีการกรอก
        if (form.password && form.password.trim() !== '') {
          updateData.password = form.password;
        }

        const userRes = await fetch(API.users.update(currentUserId), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify(updateData),
        });

        if (!userRes.ok) {
          const error = await userRes.json();
          toast.error(error.error?.message || "อัปเดตข้อมูลไม่สำเร็จ");
          return;
        }

        // 3. Update admin profile image ถ้ามี
        if (profileImageId) {
          const adminProfileRes = await fetch(API.adminProfiles.list(`filters[users_permissions_user][id][$eq]=${currentUserId}`), {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          const adminProfileData = await adminProfileRes.json();
          
          if (adminProfileData.data?.[0]?.id) {
            await fetch(API.adminProfiles.update(adminProfileData.data[0].id), {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
              },
              body: JSON.stringify({
                data: { profileimage: profileImageId }
              }),
            });
          }
        }

        toast.success('อัปเดตข้อมูลเรียบร้อย!');
        navigate('/adminHome');
        return;
      }

      // โหมดสมัครใหม่ (existing code)
      const registerRes = await fetch(API.auth.register, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });
      const registerData = await registerRes.json();

      if (!registerRes.ok || !registerData.user) {
        toast.error(registerData.error?.message || "สมัครไม่สำเร็จ");
        return;
      }

      const userId = registerData.user.id;
      const jwt = registerData.jwt;

      // 2. Upload profile image
      let profileImageId = null;
      if (form.profileImage) {
        const imageData = new FormData();
        imageData.append('files', form.profileImage);
        const uploadRes = await fetch(API.upload(), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${jwt}` },
          body: imageData,
        });
        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult && uploadResult[0]?.id) {
          profileImageId = uploadResult[0].id;
        }
      }

      // 3. Get role ID for 'Admin'
      const roleRes = await fetch(API.roles.list(), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const roleData = await roleRes.json();
      const adminRole = roleData.roles.find(r => r.name === 'admin');
      const targetRoleId = adminRole?.id;

      // 4. Patch user (full_name, phone, profileimage, role)
      const patchUser = {
        full_name: `${form.firstName} ${form.lastName}`,
        phone: form.phone,
        confirmed: true,
        ...(profileImageId ? { profileimage: profileImageId } : {}),
        ...(targetRoleId ? { role: targetRoleId } : {}),
      };
      const patchRes = await fetch(API.users.update(userId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify(patchUser),
      });
      const patchData = await patchRes.json();

      if (!patchRes.ok) {
        toast.error(patchData.error?.message || "เกิดข้อผิดพลาดในการอัปเดต user");
        return;
      }

      // 5. Login ใหม่เพื่อรับ JWT ของ role admin
      const loginRes = await fetch(API.auth.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: form.username,
          password: form.password,
        }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.jwt) {
        toast.error(loginData.error?.message || "เข้าสู่ระบบไม่สำเร็จหลังสมัคร");
        return;
      }

      const adminJwt = loginData.jwt;

      // 6. Create admin_profile (ใช้ JWT ใหม่)
      const adminProfileRes = await fetch(API.adminProfiles.create(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminJwt}`,
        },
        body: JSON.stringify({
          data: {
            users_permissions_user: userId,
            ...(profileImageId ? { profileimage: profileImageId } : {}),
          }
        }),
      });
      const adminProfileData = await adminProfileRes.json();

      if (!adminProfileRes.ok) {
        toast.error(adminProfileData.error?.message || "เกิดข้อผิดพลาดในการสร้างโปรไฟล์แอดมิน");
        return;
      }

      navigate('/login', { state: { toast: 'สมัครบัญชีสำเร็จ! กรุณาเข้าสู่ระบบ' } });
    } catch (err) {
      toast.error('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      console.error(err);
    }
  };

  // เพิ่มเติม: ถ้ามี profileUrl ให้แสดงรูป preview
  React.useEffect(() => {
    if (location.state?.user?.profileUrl) {
      setProfileImage(location.state.user.profileUrl);
    }
  }, [location.state]);

  // เช็คว่าเป็นการแก้ไขโปรไฟล์หรือการสมัครใหม่
  const isEditMode = !!location.state?.userId;

  return (
    <div className="signup-page-container">
      <HomeHeader />
      <ToastContainer />
      <div className="signup-content">
        <div className="signup-note">
          {isEditMode ? (
            <>หมายเหตุ: คุณกำลังแก้ไขข้อมูลโปรไฟล์ <b>ผู้ดูแลระบบ (ADMIN)</b></>
          ) : (
            <>หมายเหตุ: บัญชีที่ถูกสร้างขึ้นนี้จะได้รับสิทธิ์เป็น <b>ผู้ดูแลระบบ (ADMIN)</b> โดยอัตโนมัติ</>
          )}
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
              <label>PASSWORD<span className="required">{isEditMode ? '' : '*'}</span></label>
              <input 
                type="password" 
                name="password" 
                value={form.password} 
                onChange={handleChange} 
                required={!isEditMode}
                placeholder={isEditMode ? "เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน" : ""}
              />
              <label>EMAIL<span className="required">*</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="signup-form-right">
              <label>เพิ่มรูปภาพตัวเอง<span className="required">{isEditMode ? '' : '*'}</span></label>
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
                  required={!isEditMode}
                />
              </div>
            </div>
          </div>
          <button type="submit" className="signup-submit-btn">
            {isEditMode ? "บันทึกการแก้ไข" : "บันทึกและลงชื่อเข้าใช้"}
          </button>
          <button 
            type="button" 
            className="signup-submit-btn" 
            onClick={() => navigate(-1)}
            style={{ marginTop: '8px', backgroundColor: '#6c757d' }}
          >
            กลับ
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
