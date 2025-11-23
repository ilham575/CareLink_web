import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import { API } from '../../../utils/apiConfig';
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
            src={imageUrl.startsWith('/') ? API.getImageUrl(imageUrl) : imageUrl}
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
      fetch(API.drugStores.list()).then(res => res.json()),
      fetch(API.pharmacyProfiles.list()).then(res => res.json())
    ])
      .then(([drugStoresRes, pharmacyProfilesRes]) => {
        const drugStores = drugStoresRes.data || [];
        const pharmacyProfiles = pharmacyProfilesRes.data || [];

        const profileIdToUser = {};
        pharmacyProfiles.forEach(profile => {
          profileIdToUser[profile.id] =
            profile.attributes?.users_permissions_user?.data?.attributes || null;
        });

        const pharmaciesWithPharmacists = drugStores.map(store => {
          const attrs = store.attributes || {};
          const pharmacists = (attrs.pharmacy_profiles?.data || [])
            .map(profile => profileIdToUser[profile.id])
            .filter(u => !!u);

          return {
            id: store.id,
            name_th: attrs.name_th || store.name_th,
            address: attrs.address || store.address,
            time_open: attrs.time_open || store.time_open,
            time_close: attrs.time_close || store.time_close,
            phone_store: attrs.phone_store || store.phone_store,
            photo_front: store.photo_front || attrs.photo_front || null, // ✅ fix ตรงนี้
            pharmacists,
          };
        });

        setPharmacies(pharmaciesWithPharmacists);
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
            <PharmacyItem {...pharmacy} key={pharmacy.id} />
          ))
        )}
      </main>
    </div>
  );
}

export default Home;
