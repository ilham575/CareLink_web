import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../css/pages/default/home.css';
import HomeHeader from '../../components/HomeHeader';

function PharmacyItem({ id, name_th, address, time_open, time_close, phone_store }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/pharmacy/${id}`);
  };

  return (
    <div className="pharmacy-item">
      <div className="pharmacy-image-placeholder">รูปภาพร้านยา</div>
      <div className="pharmacy-details">
        <p>ชื่อร้านยา: {name_th || 'ไม่พบข้อมูล'}</p>
        <p>ที่อยู่: {address || 'ไม่พบข้อมูล'}</p>
        <p>
          เวลาเปิดทำการ: {time_open || '-'} - {time_close || '-'} เบอร์โทรศัพท์: {phone_store || '-'}
        </p>
      </div>
      <button className="detail-button" onClick={handleClick}>กด<br/>เพื่อดูรายละเอียด</button>
    </div>
  );
}

function Home({ isLoggedIn, onLogout }) {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetch('http://localhost:1337/api/drug-stores')
      .then(res => res.json())
      .then(data => {
        setPharmacies(Array.isArray(data.data) ? data.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredPharmacies = pharmacies.filter(pharmacy =>
    pharmacy.name_th?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="app-container">
      <HomeHeader onSearch={setSearchText} isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <main className="main-content">
        <h2>ร้านยา:</h2>
        {loading ? (
          <div>กำลังโหลดข้อมูล...</div>
        ) : (
          filteredPharmacies.map(pharmacy => (
            <PharmacyItem
              key={pharmacy.id}
              id={pharmacy.id}
              name_th={pharmacy.name_th}
              address={pharmacy.address}
              time_open={pharmacy.time_open}
              time_close={pharmacy.time_close}
              phone_store={pharmacy.phone_store}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default Home;
