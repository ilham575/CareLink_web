import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../images/image 3.png';

function HomeHeader({ pharmacyName, isLoggedIn, onLogout, onSearch }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState('');

  const isPharmacyDetail = location.pathname.startsWith('/pharmacy/');
  const isSignup = location.pathname === '/signup';

  if (isSignup) {
    return (
      <header className="app-header" style={{ background: '#00ff4c', height: 50, display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
        <img
          src={logo}
          alt="Logo"
          className="app-logo"
          style={{ width: '65px', height: '65px', marginRight: '20px', borderRadius: 8, background: '#fff' 
            , cursor: 'pointer'
          }}
          onClick={() => navigate('/login')}
        />
        <div style={{ fontSize: '2em', color: '#1a3d1a', fontWeight: 600, letterSpacing: 1 }}>สร้างบัญชี</div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <img src={logo} alt="Logo" className="app-logo" style={{ width: '70px', height: '70px', marginRight: '10px' }} />
      {isPharmacyDetail ? (
        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#0B5827', flexGrow: 1 }}>
          {"ร้านยา " + (pharmacyName || 'ชื่อร้านยา')}
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
          onClick={onLogout}
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
