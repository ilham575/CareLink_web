import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import { API } from '../../../utils/apiConfig';
import '../../../css/pages/default/home.css';

function PharmacyItem({ id, name_th, address, time_open, time_close, phone_store, photo_front, pharmacists }) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  // ดึง image URL จาก file ID
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!photo_front) return;
      
      if (photo_front.documentId) {
        // ใช้ custom serve endpoint ที่หาไฟล์ที่มีอยู่จริง
        const serveUrl = `${API.BASE_URL}/api/upload/files/${photo_front.documentId}/serve`;
        setImageUrl(serveUrl);
      } else {
        // Fallback สำหรับข้อมูลเก่า
        let imgUrl = null;
        if (photo_front.formats?.thumbnail?.url) {
          imgUrl = photo_front.formats.thumbnail.url;
        } else if (photo_front.url) {
          imgUrl = photo_front.url;
        }
        
        if (imgUrl) {
          const fullUrl = imgUrl.startsWith('/') ? `${API.BASE_URL}${imgUrl}` : imgUrl;
          setImageUrl(fullUrl);
        }
      }
    };
    
    fetchImageUrl();
  }, [photo_front, name_th]);

  const handleClick = () => {
    navigate(`/drug_store/${id}`);
  };

  return (
    <div className="pharmacy-item">
      <div className="pharmacy-image-placeholder" style={{ padding: 0, background: 'none' }}>
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt="รูปภาพร้านยา"
            style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 5, display: 'block' }}
            onError={() => {
              console.warn(`Image load failed for pharmacy ${name_th}:`, imageUrl);
              setImageError(true);
            }}
            onLoad={() => console.log(`Image loaded successfully: ${imageUrl}`)}
          />
        ) : (
          <div style={{ 
            width: '100%', 
            height: '100px', 
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 5,
            color: '#666',
            fontSize: '14px'
          }}>
            {imageError ? 'โหลดรูปไม่ได้' : 'ไม่มีรูปภาพ'}
          </div>
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
      fetch(API.drugStores.listWithPhotos()).then(res => res.json()),
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
          // Strapi v5: ไม่มี attributes nested structure
          const pharmacists = (store.pharmacy_profiles || [])
            .map(profile => profileIdToUser[profile.id])
            .filter(u => !!u);

          return {
            id: store.id,
            name_th: store.name_th,
            address: store.address,
            time_open: store.time_open,
            time_close: store.time_close,
            phone_store: store.phone_store,
            photo_front: store.photo_front || null, // Strapi v5: รูปภาพอยู่ที่ระดับเดียวกับข้อมูลอื่น
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
