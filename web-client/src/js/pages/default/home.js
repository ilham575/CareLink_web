import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../css/pages/default/home.css';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';

function PharmacyItem({ id, name_th, address, time_open, time_close, phone_store, photo_front }) {
  const navigate = useNavigate();

  const getImageUrl = (photo) => {
    if (!photo) return null;
    if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
    if (photo.url) return photo.url;
    return null;
  };

  const imageUrl = getImageUrl(photo_front);

  const handleClick = () => {
    navigate(`/pharmacy/${id}`);
  };

  return (
    <div className="pharmacy-item">
      <div className="pharmacy-image-placeholder" style={{ padding: 0, background: 'none' }}>
        {imageUrl ? (
          <img
            src={imageUrl.startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imageUrl}` : imageUrl}
            alt="รูปภาพร้านยา"
            style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 5, display: 'block' }}
          />
        ) : (
          'รูปภาพร้านยา'
        )}
      </div>
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

function Home() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetch('http://localhost:1337/api/drug-stores?populate=*')
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
      <HomeHeader onSearch={setSearchText} />
      <main className="main-content">
        <h2>ร้านยา:</h2>
        {loading ? (
          <div>กำลังโหลดข้อมูล...</div>
        ) : filteredPharmacies.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
            ไม่พบข้อมูลร้านยา
          </div>
        ) : (
          filteredPharmacies.map(pharmacy => (
            <PharmacyItem
              key={pharmacy.id}
              id={pharmacy.id}
              name_th={pharmacy.name_th}
              address={pharmacy.address}
              time_open={formatTime(pharmacy.time_open)}
              time_close={formatTime(pharmacy.time_close)}
              phone_store={pharmacy.phone_store}
              photo_front={pharmacy.photo_front}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default Home;