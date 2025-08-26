import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../images/image 3.png';
import '../../css/component/HomeHeader.css'; // เพิ่มบรรทัดนี้

function HomeHeader({ pharmacyName, onSearch }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('isLoggedIn') === 'true'
  );
  const [profileUrl, setProfileUrl] = useState(null);
  const [profileFullName, setProfileFullName] = useState('');

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
        const userId = user.id;
        const role = user.role?.name || localStorage.getItem('role');
        // ดึง full_name จาก user โดยตรง
        setProfileFullName(user.full_name || '');
        if (!userId || !role) {
          setProfileUrl(null);
          return;
        }

        let profileApi = '';
        let imagePath = '';
        if (role === 'admin') {
          profileApi = `http://localhost:1337/api/admin-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=profileimage`;
          imagePath = 'profileimage';
        } else if (role === 'pharmacy') {
          profileApi = `http://localhost:1337/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=profileimage`;
          imagePath = 'profileimage';
        } else if (role === 'staff') {
          profileApi = `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=profileimage`;
          imagePath = 'profileimage';
        } else {
          setProfileUrl(null);
          return;
        }

        fetch(profileApi, { headers: { Authorization: `Bearer ${jwt}` } })
          .then(res => res.json())
          .then(profileRes => {
            const profile = profileRes.data && profileRes.data[0];
            const img =
              profile?.[imagePath]?.formats?.thumbnail?.url ||
              profile?.[imagePath]?.url ||
              null;
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
      });
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('jwt');
    localStorage.removeItem('role');
    localStorage.removeItem('jwt_issued_at');
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

  if (isSignup) {
    return (
      <header className="app-header">
        <img
          src={logo}
          alt="Logo"
          className="app-logo"
          onClick={() => navigate('/login')}
        />
        <div className="signup-title">สร้างบัญชี</div>
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
      {isPharmacyDetail ? (
        <div className="detail-title">
          {(pharmacyName || 'ชื่อร้านยา')}
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
        // เพิ่ม div ครอบ avatar กับปุ่ม เพื่อจัดให้อยู่แถวเดียวกันตอน responsive
        <div className="profile-and-btn-row">
          <div
            className="profile-avatar"
            title={profileFullName || "โปรไฟล์"}
          >
            {profileUrl ? (
              <img
                src={profileUrl}
                alt="profile"
                className="profile-avatar-img"
              />
            ) : (
              <span>
                {localStorage.getItem('profileInitial') ||
                  (localStorage.getItem('username') &&
                    localStorage.getItem('username')[0].toUpperCase()) ||
                  'U'}
              </span>
            )}
          </div>
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
