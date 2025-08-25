import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../images/image 3.png';

function HomeHeader({ pharmacyName, onSearch }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('isLoggedIn') === 'true'
  );

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
  }, [location]);

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
          style={{
            width: '65px',
            height: '65px',
            marginRight: '20px',
            borderRadius: 12,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer'
          }}
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
        style={{
          width: '70px',
          height: '70px',
          marginRight: '18px',
          borderRadius: 12,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
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
        <button
          className="home-button"
          onClick={handleLogout}
        >
          ออกจากระบบ
        </button>
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
