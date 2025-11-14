import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css';
import Footer from '../../components/footer';

function PharmacyItem({ id, documentId, name_th, address, time_open, time_close, phone_store, photo_front }) {
  const navigate = useNavigate();

  const getImageUrl = (photo) => {
    if (!photo) return null;
    if (typeof photo === "string") return photo;
    if (photo.formats?.large?.url) return photo.formats.large.url;
    if (photo.formats?.medium?.url) return photo.formats.medium.url;
    if (photo.url) return photo.url;
    if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
    return null;
  };

  const imageUrl = getImageUrl(photo_front);

  const handleClick = () => {
    navigate(`/drug_store_customer/${documentId || id}`);
  };

  return (
    <div className="pharmacy-item">
      <div className="pharmacy-image-placeholder" style={{ padding: 0, background: 'none' }}>
        {imageUrl ? (
          <img
            src={imageUrl.startsWith('/')
              ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imageUrl}`
              : imageUrl}
            alt="รูปภาพร้านยา"
            style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 5, display: 'block' }}
          />
        ) : (
          'รูปภาพร้านยา'
        )}
      </div>

      <div className="pharmacy-details">
        <p><strong>ชื่อร้านยา:</strong> {name_th || 'ไม่พบข้อมูล'}</p>
        <p><strong>ที่อยู่:</strong> {address || 'ไม่พบข้อมูล'}</p>
        <p>
          <strong>เวลาเปิดทำการ:</strong> {time_open || '-'} - {time_close || '-'} 
          <strong> เบอร์โทรศัพท์:</strong> {phone_store || '-'}
        </p>
      </div>

      <div className="pharmacy-actions">
        <button
          className="detail-button"
          style={{ background: '#4CAF50', width: '120px' }}
          onClick={handleClick}
        >
          ดู<br />ข้อมูลของร้าน
        </button>
      </div>
    </div>
  );
}

function CustomerHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [userId, setUserId] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);

  const token = localStorage.getItem('jwt');

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  // ขั้นตอนที่ 1: ดึง user.id จาก /api/users/me
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`http://localhost:1337/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(userData => {
        setUserId(userData.id);
      })
      .catch(err => {
        console.error('❌ Error fetching user:', err);
        setLoading(false);
      });
  }, [token]);

  // ขั้นตอนที่ 2: ดึง customer profile โดยใช้ user.id
  useEffect(() => {
    if (!token || !userId) {
      return;
    }

    const profilesUrl = `http://localhost:1337/api/customer-profiles?filters[users_permissions_user][id][$eq]=${userId}&populate=drug_stores`;

    fetch(profilesUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { 
        if (data.data && data.data.length > 0) {
          setCustomerProfile(data.data[0]);
        }
      })
      .catch(err => {
        console.error('❌ Error fetching customer profile:', err);
      });
  }, [token, userId]);

  // ขั้นตอนที่ 3: ดึงข้อมูลร้านยาที่ลูกค้าติดตาม
  useEffect(() => {
    if (!customerProfile || !customerProfile.drug_stores) {
      setLoading(false);
      return;
    }

    const loadFollowedPharmacies = async () => {
      try {
        // ดึงข้อมูลร้านยาที่อยู่ใน customer profile
        const followedStoreIds = customerProfile.drug_stores.map(store => store.id);
        
        if (followedStoreIds.length === 0) {
          setPharmacies([]);
          setLoading(false);
          return;
        }

        // ดึงข้อมูลร้านยาเฉพาะที่ติดตาม
        const res = await fetch(`http://localhost:1337/api/drug-stores?populate=*&filters[id][$in]=${followedStoreIds.join(',')}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!res.ok) throw new Error("ไม่สามารถโหลดร้านยาได้");

        const data = await res.json();
        const pharmaciesFromAPI = (data.data || []).map(store => ({
          documentId: store.documentId,
          id: store.id,
          name_th: store.name_th,
          name_en: store.name_en,
          address: store.address,
          time_open: formatTime(store.time_open),
          time_close: formatTime(store.time_close),
          phone_store: store.phone_store,
          photo_front: store.photo_front,
          photo_in: store.photo_in,
          photo_staff: store.photo_staff,
          services: store.services || {},
          type: store.type,
          license_number: store.license_number,
          license_doc: store.license_doc,
          link_gps: store.link_gps,
        }));

        setPharmacies(pharmaciesFromAPI);
      } catch (err) {
        console.error("API error:", err);
        toast.error("ไม่สามารถโหลดข้อมูลร้านยาได้");
        setPharmacies([]);
      } finally {
        setLoading(false);
      }
    };

    loadFollowedPharmacies();
  }, [token, customerProfile]);

  const filteredPharmacies = pharmacies.filter(pharmacy =>
    pharmacy.name_th?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="app-container">
      <ToastContainer />
      <HomeHeader isLoggedIn={true} onSearch={setSearchText} />
      <main className="main-content">
        <h2 style={{ margin: '20px 0', color: '#333' }}>ร้านยาที่กำลังติดตามคุณ:</h2>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            กำลังโหลดข้อมูล...
          </div>
        ) : filteredPharmacies.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
            {pharmacies.length === 0 ? (
              <>
                <h3>🏪 คุณยังไม่ได้ติดตามร้านยาใดเลย</h3>
                <p>เริ่มต้นหาร้านยาที่ใช่สำหรับคุณ</p>
              </>
            ) : (
              <>ไม่พบร้านยาที่ค้นหา "{searchText}"</>
            )}
          </div>
        ) : (
          <>
            {filteredPharmacies.map(pharmacy => (
              <PharmacyItem
                {...pharmacy}
                key={pharmacy.documentId || pharmacy.id}
              />
            ))}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default CustomerHome;
