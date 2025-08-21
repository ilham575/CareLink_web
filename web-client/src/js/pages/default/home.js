import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css';

function PharmacyItem({ id, name_th, address, time_open, time_close, phone_store, photo_front, pharmacists }) {
  const navigate = useNavigate();

  const getImageUrl = (photo) => {
    if (!photo) return null;
    if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
    if (photo.url) return photo.url;
    return null;
  };

  const imageUrl = getImageUrl(photo_front);

  const handleClick = () => {
    navigate(`/drug_store/${id}`);
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
        <p>เวลาเปิดทำการ: {formatTime(time_open) || '-'} - {formatTime(time_close) || '-'} เบอร์โทรศัพท์: {phone_store || '-'}</p>
      </div>
      <button className="detail-button" onClick={handleClick}>กด<br />เพื่อดูรายละเอียด</button>
    </div>
  );
}

function Home() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:1337/api/drug-stores?populate=pharmacy_profiles').then(res => res.json()),
      fetch('http://localhost:1337/api/pharmacy-profiles?populate=users_permissions_user').then(res => res.json())
    ]).then(([drugStoresRes, pharmacyProfilesRes]) => {
      const drugStores = drugStoresRes.data || [];
      const pharmacyProfiles = pharmacyProfilesRes.data || [];
      // map profile id -> user
      const profileIdToUser = {};
      pharmacyProfiles.forEach(profile => {
        profileIdToUser[profile.id] = profile.users_permissions_user || null;
      });

      // inject pharmacists array เข้าแต่ละร้าน
      const pharmaciesWithPharmacists = drugStores.map(store => {
        const pps = store.pharmacy_profiles || store.attributes?.pharmacy_profiles?.data || [];
        const pharmacists = (pps.data || pps) // รองรับได้ทั้ง 2 แบบ (เผื่อโครงสร้างเปลี่ยน)
          .map(profile => profileIdToUser[profile.id])
          .filter(u => !!u); // remove null
        return {
          id: store.id,
          name_th: store.name_th || store.attributes?.name_th,
          address: store.address || store.attributes?.address,
          time_open: store.time_open || store.attributes?.time_open,
          time_close: store.time_close || store.attributes?.time_close,
          phone_store: store.phone_store || store.attributes?.phone_store,
          photo_front: (store.photo_front && store.photo_front.formats) ? store.photo_front : (store.attributes?.photo_front?.data?.attributes || null),
          pharmacists,
        };
      });

      setPharmacies(pharmaciesWithPharmacists);
      setLoading(false);
    }).catch(() => setLoading(false));
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
            <PharmacyItem {...pharmacy} key={pharmacy.id} />
          ))
        )}
      </main>
    </div>
  );
}

export default Home;
