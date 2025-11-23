import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../images/image 3.png';
import '../../css/component/HomeHeader.css'; // เพิ่มบรรทัดนี้
import ProfileAvatar from "./ProfileAvatar";
import { API } from '../../utils/apiConfig';

function HomeHeader({ pharmacyName, pharmacistName, onSearch }) {
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

    const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:1337';
    fetch(`${BASE_URL}/api/users/me?populate=role`, {
      headers: { Authorization: `Bearer ${jwt}` }
    })
      .then(res => {
        if (res.status === 401) {
          console.warn('⚠️ Token expired/invalid - redirecting to login');
          localStorage.removeItem('jwt');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('role');
          navigate('/login');
          return null;
        }
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
      })
      .then(user => {
        if (!user) return;
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
          profileApi = API.adminProfiles.list('filters[users_permissions_user][id][$eq]=' + userIdFromApi + '&populate=profileimage');
          imagePath = 'profileimage';
        } else if (role === 'pharmacy') {
          profileApi = API.pharmacyProfiles.list('filters[users_permissions_user][id][$eq]=' + userIdFromApi + '&populate=profileimage');
          imagePath = 'profileimage';
        } else if (role === 'staff') {
          profileApi = API.staffProfiles.list('filters[users_permissions_user][id][$eq]=' + userIdFromApi + '&populate=profileimage');
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
                  ? API.getImageUrl(img)
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

  // เพิ่ม useEffect สำหรับดึงชื่อร้านเมื่ออยู่ในหน้า form_staff, form_customer หรือหน้า add/edit staff (admin)
  useEffect(() => {
    const isFormStaffRoute = location.pathname === '/form_staff';
    const isFormCustomerRoute = location.pathname === '/form_customer';
    const isAddStaffAdmin = location.pathname.startsWith('/add_staff_admin');
    const isEditStaffAdmin = location.pathname.startsWith('/edit_staff_admin');

    // ฟังก์ชันช่วยดึงชื่อร้านจาก pharmacyId
    const fetchStoreName = (pharmacyId, forStaff) => {
      if (!pharmacyId) return;
      fetch(API.drugStores.getByDocumentId(pharmacyId))
        .then(res => res.json())
        .then(json => {
          const store = json.data?.[0];
          const storeName = store?.attributes?.name_th || store?.name_th || '';
          if (forStaff) {
            setFormStaffPharmacyName(storeName);
          } else {
            setFormCustomerPharmacyName(storeName);
          }
        })
        .catch(() => {
          if (forStaff) setFormStaffPharmacyName('');
          else setFormCustomerPharmacyName('');
        });
    };

    if (isFormStaffRoute || isFormCustomerRoute || isAddStaffAdmin || isEditStaffAdmin) {
      const searchParams = new URLSearchParams(location.search);
      // pharmacyId might be in query (e.g. ?pharmacyId=...) or in the pathname for add_admin
      let pharmacyId = searchParams.get('pharmacyId');

      if (!pharmacyId && isAddStaffAdmin) {
        const m = location.pathname.match(/\/add_staff_admin\/([^/?#]+)/);
        if (m) pharmacyId = m[1];
      }

      if (!pharmacyId && isEditStaffAdmin) {
        // edit route often has ?pharmacyId=..., try search params already handled
        const m = location.pathname.match(/\/edit_staff_admin\/([^/?#]+)/);
        if (m && !pharmacyId) {
          // we don't have the pharmacyId in the edit path itself, typically it's provided in query
          pharmacyId = searchParams.get('pharmacyId');
        }
      }

      if (isFormStaffRoute || isAddStaffAdmin || isEditStaffAdmin) {
        fetchStoreName(pharmacyId, true);
      }

      if (isFormCustomerRoute) {
        fetchStoreName(pharmacyId, false);
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
    location.pathname.startsWith('/drug_store_staff/') ||
    location.pathname.startsWith('/staff_detail_admin/') ||
    location.pathname.startsWith('/customer_detail/') ||
    location.pathname.startsWith('/pharmacist_detail_admin/') ||
    location.pathname.startsWith('/add_pharmacy_admin/') ||
    location.pathname.startsWith('/edit_pharmacist_admin/'); // เพิ่มบรรทัดนี้

  const isSignup = location.pathname === '/signup';
  
  // เพิ่มการเช็คหน้า form_staff และ form_customer
  const isFormStaff = location.pathname === '/form_staff';
  const isFormCustomer = location.pathname === '/form_customer';
  const isAddStaffAdmin = location.pathname.startsWith('/add_staff_admin');
  const isEditStaffAdmin = location.pathname.startsWith('/edit_staff_admin');

  // ฟังก์ชันสำหรับสร้างหัวข้อหน้า form_staff
  const getFormStaffTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const documentId = searchParams.get('documentId');
    // For admin routes, edit is indicated by pathname like /edit_staff_admin/:documentId
    const isEditPath = location.pathname.startsWith('/edit_staff_admin');
    const isEdit = !!documentId || isEditPath; // ถ้ามี documentId หรือเป็น edit path => แก้ไข
    
    const action = isEdit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน';
    let storeName = '';
    // prefer fetched formStaffPharmacyName, then prop pharmacyName
    const resolvedName = formStaffPharmacyName || pharmacyName || '';
    if (resolvedName) {
      // เช็คว่าชื่อร้านเริ่มต้นด้วย "ร้านยา" หรือไม่
      const needsPrefix = !resolvedName.startsWith('ร้านยา');
      storeName = needsPrefix ? `ร้านยา${resolvedName}` : resolvedName;
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
      {(isFormStaff || isAddStaffAdmin || isEditStaffAdmin) ? (
        // แสดงหัวข้อสำหรับหน้า form_staff และหน้าเพิ่ม/แก้ไขพนักงานของแอดมิน
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
            let displayName = name;
            if (name !== 'ชื่อร้านยา') {
              const needsPrefix = !name.startsWith('ร้านยา');
              displayName = needsPrefix ? `ร้านยา${name}` : name;
            }
            
            // เพิ่มชื่อเภสัชกรถ้ามี
            if (pharmacistName) {
              displayName += ` - เภสัชกร ${pharmacistName}`;
            }
            
            // เช็คถ้าเป็นหน้า add_pharmacy_admin ให้แสดงข้อความเพิ่มเภสัชกร
            if (location.pathname.startsWith('/add_pharmacy_admin/')) {
              displayName = `เพิ่มเภสัชกร${displayName}`;
            }
            
            // เช็คถ้าเป็นหน้า edit_pharmacist_admin ให้แสดงข้อความแก้ไขเภสัชกร
            if (location.pathname.startsWith('/edit_pharmacist_admin/')) {
              // ถ้าไม่มี pharmacyName (กรณี pharmacy แก้ไขตัวเอง) ให้แสดงข้อความทั่วไป
              if (name === 'ชื่อร้านยา') {
                displayName = 'แก้ไขโปรไฟล์ของฉัน';
              } else {
                displayName = `แก้ไขเภสัชกร${displayName}`;
              }
            }
            
            return displayName;
          })()}
        </div>
      ) : (
        <div className="home-search-bar-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ค้นหา"
            className="home-search-input"
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