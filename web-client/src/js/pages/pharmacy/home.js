import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import '../../../css/pages/default/home.css';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import Footer from '../../components/footer';

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
    navigate(`/drug_store_pharmacy/${id}`);
  };
  const handleDrugList = () => {
    navigate(`/drug_store_pharmacy/${id}/drugs`);
  };
  const handleFollowUp = () => {
    navigate(`/drug_store_pharmacy/${id}/followup-customers`);
  };

  return (
    <div className="pharmacy-item">
      <div className="pharmacy-image-placeholder" style={{ padding: 0, background: 'none' }}>
        {imageUrl ? (
          <img
            src={imageUrl.startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imageUrl}` : imageUrl}
            alt="รูปภาพร้านยา"
            style={{
              width: '100%',
              height: '100px',
              objectFit: 'cover',
              borderRadius: 5,
              display: 'block'
            }}
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

      <div
        className="pharmacy-actions"
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          flexWrap: 'wrap'
        }}
      >
        <button className="detail-button" onClick={handleClick}>
          กด<br />เพื่อดูรายละเอียด
        </button>
        <button className="detail-button" onClick={handleDrugList}>
          รายการยา
        </button>
        <button className="detail-button" onClick={handleFollowUp}>
          ลูกค้าที่ติดตามอาการ
        </button>
      </div>
    </div>
  );
}

function PharmacyHome() {
  const location = useLocation();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userId, setUserId] = useState(null); // เพิ่ม state สำหรับ user.id

  const token = localStorage.getItem('jwt');

  // ขั้นตอนที่ 1: ดึง user.id จาก /api/users/me
  useEffect(() => {
    if (!token) {
      setProfileLoading(false);
      setLoading(false);
      return;
    }

    fetch('http://localhost:1337/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(userData => {
        setUserId(userData.id);
      })
      .catch(err => {
        console.error('❌ Error fetching user:', err);
        setProfileLoading(false);
        setLoading(false);
      });
  }, [token]);

  // ขั้นตอนที่ 2: ดึง pharmacy profile โดยใช้ user.id
  useEffect(() => {
    if (!token || !userId) {
      return;
    }

    fetch(`http://localhost:1337/api/pharmacy-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=profileimage`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          const activeProfile = data.data.find(p => p.publishedAt) || data.data[0];
          setUserProfile(activeProfile);
        }
        setProfileLoading(false);
      })
      .catch(err => {
        console.error('❌ Error fetching user profile:', err);
        setProfileLoading(false);
      });
  }, [token, userId]);

  // ขั้นตอนที่ 3: ดึงข้อมูลร้านยาและ filter ใน frontend
  useEffect(() => {
    if (profileLoading || !userProfile) {
      return;
    }

    fetch(`http://localhost:1337/api/drug-stores?populate=*`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        const allStores = Array.isArray(data.data) ? data.data : [];
        
        const myStores = allStores.filter(store => {
          const hasMyProfile = store.pharmacy_profiles?.some(profile => 
            profile.id === userProfile.id || profile.documentId === userProfile.documentId
          );
          
          return hasMyProfile;
        });
        
        setPharmacies(myStores);
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ Drug Stores Error:', err);
        setPharmacies([]);
        setLoading(false);
      });
  }, [token, userProfile, profileLoading]);

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  const filteredPharmacies = pharmacies.filter(pharmacy =>
    pharmacy.name_th?.toLowerCase().includes(searchText.toLowerCase())
  );

  if (loading || profileLoading) {
    return (
      <div className="app-container">
        <HomeHeader onSearch={setSearchText} isLoggedIn={true} />
        <main className="main-content">
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            กำลังโหลดข้อมูล...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="app-container">
        <ToastContainer />
        <HomeHeader onSearch={setSearchText} isLoggedIn={true} />
        <main className="main-content">
          <div style={{ color: '#e57373', textAlign: 'center', marginTop: '40px' }}>
            ไม่พบข้อมูลโปรไฟล์เภสัชกร<br />
            กรุณาติดต่อผู้ดูแลระบบ
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app-container">
      <ToastContainer />
      <HomeHeader onSearch={setSearchText} isLoggedIn={true} />
      <main className="main-content">
        <h2>ร้านยาของฉัน:</h2>

        {filteredPharmacies.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
            {pharmacies.length === 0 
              ? 'ยังไม่มีร้านยาที่คุณรับผิดชอบ' 
              : 'ไม่พบร้านยาที่ตรงกับการค้นหา'
            }
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
      <Footer />
    </div>
  );
}

export default PharmacyHome;
