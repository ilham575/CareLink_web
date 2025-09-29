import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../images/image 3.png';
import '../../css/component/HomeHeader.css'; // เพิ่มบรรทัดนี้
import ProfileAvatar from "./ProfileAvatar";

function HomeHeader({ pharmacyName, onSearch }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('isLoggedIn') === 'true'
  );
  const [profileUrl, setProfileUrl] = useState(null);
  const [profileFullName, setProfileFullName] = useState('');
  const [userId, setUserId] = useState(null); // เพิ่ม state สำหรับ userId
  const [formStaffPharmacyName, setFormStaffPharmacyName] = useState(''); // เพิ่ม state สำหรับชื่อร้านในหน้า form staff
  const [formCustomerPharmacyName, setFormCustomerPharmacyName] = useState(''); // เพิ่ม state สำหรับชื่อร้านในหน้า form customer

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
  }, [location]);

  useEffect(() => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) return;

    fetch('http://localhost:1337/api/users/me', {
      headers: { Authorization: `Bearer ${jwt}` }
    })
      .then(res => res.json())
      .then(user => {
        const userIdFromApi = user.id;
        setUserId(userIdFromApi); // เก็บ userId ใน state
        const role = user.role?.name || localStorage.getItem('role');
        setProfileFullName(user.full_name || '');
        if (!userIdFromApi || !role) {
          setProfileUrl(null);
          return;
        }

        let profileApi = '';
        let imagePath = '';
        if (role === 'admin') {
          profileApi = `http://localhost:1337/api/admin-profiles?filters[users_permissions_user][id][$eq]=${userIdFromApi}&populate=profileimage`;
          imagePath = 'profileimage';
        } else if (role === 'pharmacy') {
          profileApi = `http://localhost:1337/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${userIdFromApi}&populate=profileimage`;
          imagePath = 'profileimage';
        } else if (role === 'staff') {
          profileApi = `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][id][$eq]=${userIdFromApi}&populate=profileimage`;
          imagePath = 'profileimage';
        } else {
          setProfileUrl(null);
          return;
        }

        fetch(profileApi, { headers: { Authorization: `Bearer ${jwt}` } })
          .then(res => res.json())
          .then(profileRes => {
            const profile = profileRes.data && profileRes.data[0];
            // แก้ตรงนี้
            let img = null;
            if (profile?.[imagePath]) {
              // ถ้าเป็น array ให้ใช้ index 0
              const imageObj = Array.isArray(profile[imagePath]) ? profile[imagePath][0] : profile[imagePath];
              img =
                imageObj?.formats?.thumbnail?.url ||
                imageObj?.url ||
                null;
            }
            if (img) {
              setProfileUrl(
                img.startsWith('/')
                  ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${img}`
                  : img
              );
            } else {
              setProfileUrl(null);
            }
          })
          .catch(() => {
            setProfileUrl(null);
          });
      })
      .catch(() => {
        setProfileUrl(null);
        setProfileFullName('');
        setUserId(null); // เคลียร์ userId เมื่อเกิดข้อผิดพลาด
      });
  }, [isLoggedIn]);

  // เพิ่ม useEffect สำหรับดึงชื่อร้านเมื่ออยู่ในหน้า form_staff หรือ form_customer
  useEffect(() => {
    // เช็คว่าอยู่ในหน้า form_staff หรือ form_customer หรือไม่
    if (location.pathname === '/form_staff' || location.pathname === '/form_customer') {
      const searchParams = new URLSearchParams(location.search);
      const pharmacyId = searchParams.get('pharmacyId');
      
      if (pharmacyId) {
        // ดึงข้อมูลร้านยาจาก pharmacyId
        fetch(`http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${pharmacyId}`)
          .then(res => res.json())
          .then(json => {
            const store = json.data?.find(item => item.documentId === pharmacyId);
            if (store) {
              const storeName = store.name_th || store.attributes?.name_th || '';
              if (location.pathname === '/form_staff') {
                setFormStaffPharmacyName(storeName);
              } else if (location.pathname === '/form_customer') {
                setFormCustomerPharmacyName(storeName);
              }
            }
          })
          .catch(() => {
            if (location.pathname === '/form_staff') {
              setFormStaffPharmacyName('');
            } else if (location.pathname === '/form_customer') {
              setFormCustomerPharmacyName('');
            }
          });
      }
    } else {
      // ถ้าไม่ใช่หน้า form ให้เคลียร์ชื่อร้าน
      setFormStaffPharmacyName('');
      setFormCustomerPharmacyName('');
    }
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('jwt');
    localStorage.removeItem('role');
    localStorage.removeItem('jwt_issued_at');
    localStorage.removeItem('user_documentId');
    setIsLoggedIn(false);
    navigate('/login');
  };

  // จะเป็น true ถ้า path เริ่มต้นด้วย /drug_store/ หรือ /drug_store_pharmacy/
  const isPharmacyDetail =
    location.pathname.startsWith('/drug_store/') ||
    location.pathname.startsWith('/drug_store_pharmacy/') ||
    location.pathname.startsWith('/drug_store_admin/') ||
    location.pathname.startsWith('/drug_store_staff/');
  
  const isSignup = location.pathname === '/signup';
  
  // เพิ่มการเช็คหน้า form_staff และ form_customer
  const isFormStaff = location.pathname === '/form_staff';
  const isFormCustomer = location.pathname === '/form_customer';

  // ฟังก์ชันสำหรับสร้างหัวข้อหน้า form_staff
  const getFormStaffTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const documentId = searchParams.get('documentId');
    const isEdit = !!documentId; // ถ้ามี documentId แสดงว่าเป็นการแก้ไข
    
    const action = isEdit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน';
    let storeName = '';
    if (formStaffPharmacyName) {
      // เช็คว่าชื่อร้านเริ่มต้นด้วย "ร้านยา" หรือไม่
      const needsPrefix = !formStaffPharmacyName.startsWith('ร้านยา');
      storeName = needsPrefix ? `ร้านยา${formStaffPharmacyName}` : formStaffPharmacyName;
    }
    
    return `${action}${storeName}`;
  };

  // ฟังก์ชันสำหรับสร้างหัวข้อหน้า form_customer
  const getFormCustomerTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const documentId = searchParams.get('documentId');
    const isEdit = !!documentId; // ถ้ามี documentId แสดงว่าเป็นการแก้ไข
    
    const action = isEdit ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า';
    let storeName = '';
    if (formCustomerPharmacyName) {
      // เช็คว่าชื่อร้านเริ่มต้นด้วย "ร้านยา" หรือไม่
      const needsPrefix = !formCustomerPharmacyName.startsWith('ร้านยา');
      storeName = needsPrefix ? `ร้านยา${formCustomerPharmacyName}` : formCustomerPharmacyName;
    }
    
    return `${action}${storeName}`;
  };

  if (isSignup) {
    const isEditMode = !!location.state?.userId;
    return (
      <header className="app-header">
        <img
          src={logo}
          alt="Logo"
          className="app-logo"
          onClick={() => navigate('/login')}
        />
        <div className="signup-title">
          {isEditMode ? "แก้ไขข้อมูลโปรไฟล์" : "สร้างบัญชี"}
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <img
        src={logo}
        alt="Logo"
        className="app-logo"
      />
      {isFormStaff ? (
        // แสดงหัวข้อสำหรับหน้า form_staff
        <div className="detail-title">
          {getFormStaffTitle()}
        </div>
      ) : isFormCustomer ? (
        // แสดงหัวข้อสำหรับหน้า form_customer
        <div className="detail-title">
          {getFormCustomerTitle()}
        </div>
      ) : isPharmacyDetail ? (
        <div className="detail-title">
          {(() => {
            const name = pharmacyName || 'ชื่อร้านยา';
            if (name === 'ชื่อร้านยา') return name;
            const needsPrefix = !name.startsWith('ร้านยา');
            return needsPrefix ? `ร้านยา${name}` : name;
          })()}
        </div>
      ) : (
        <div className="search-bar-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ค้นหา"
            className="search-input"
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value);
              if (onSearch) onSearch(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && onSearch) {
                onSearch(searchText);
              }
            }}
          />
        </div>
      )}
      {isLoggedIn ? (
        <div className="profile-and-btn-row">
          <ProfileAvatar
            profileUrl={profileUrl}
            profileFullName={profileFullName}
            userData={{
              id: userId, // ใช้ userId จาก state
            }}
          />
          <button
            className="home-button"
            onClick={handleLogout}
          >
            ออกจากระบบ
          </button>
        </div>
      ) : (
        <button
          className="home-button"
          onClick={() => navigate('/login')}
        >
          ลงชื่อเข้าใช้
        </button>
      )}
    </header>
  );
}

export default HomeHeader;