import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../css/pages/default/home.css';
import HomeHeader from '../../components/HomeHeader';

function PharmacyItem({id}) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/pharmacy/${id}`);
  };

  return (
    <div className="pharmacy-item">
      <div className="pharmacy-image-placeholder">รูปภาพร้านยา</div>
      <div className="pharmacy-details">
        <p>ชื่อร้านยา: .....................................................</p>
        <p>ที่อยู่: .........................................................</p>
        <p>เวลาเปิดทำการ: 17.00-21.00 เบอร์โทรศัพท์: .......................</p>
      </div>
      <button className="detail-button" onClick={handleClick}>กด<br/>เพื่อดูรายละเอียด</button>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <HomeHeader />
      <main className="main-content">
        <h2>ร้านยา:</h2>
        <PharmacyItem />
        <PharmacyItem />
        {/* You can add more PharmacyItem components as needed */}
      </main>
    </div>
  );
}

export default Home;