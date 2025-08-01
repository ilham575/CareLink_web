import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../../images/image 3.png';

function HomeHeader({ pharmacyName }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isPharmacyDetail = location.pathname.startsWith('/pharmacy/');

  return (
    <header className="app-header">
      <img src={logo} alt="Logo" className="app-logo" style={{ width: '70px', height: '70px', marginRight: '10px' }} />
      {isPharmacyDetail ? (
        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#0B5827', flexGrow: 1 }}>
          {pharmacyName || 'ชื่อร้านยา'}
        </div>
      ) : (
        <div className="search-bar-container">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="ค้นหา" className="search-input" />
        </div>
      )}
      <button
        className="home-button"
        onClick={() => navigate('/login')}
      >
        ลงชื่อเข้าใช้
      </button>
    </header>
  );
}

export default HomeHeader;
