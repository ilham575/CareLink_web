import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css';
import Footer from '../../components/footer';
import { API } from '../../../utils/apiConfig';

function PharmacyItem({ id, documentId, name_th, address, time_open, time_close, phone_store, photo_front, customerProfileDoc, onViewProfile }) {
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
              ? API.getImageUrl(imageUrl)
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
        <button
          className="detail-button"
          style={{ background: '#2196F3', width: '120px' }}
          onClick={() => {
            if (customerProfileDoc && onViewProfile) {
              onViewProfile();
            }
          }}
        >
          ดู<br />ข้อมูลของฉัน
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
  const [customerProfile, setCustomerProfile] = useState(null);

  const token = localStorage.getItem('jwt');

  const handleViewProfile = () => {
    if (customerProfile) {
      const profileDoc = customerProfile.attributes || customerProfile;
      navigate(`/customer_detail_view/${profileDoc.documentId}`);
    }
  };

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  // ขั้นตอนที่ 1: ดึงข้อมูลลูกค้าและเก็บ customer profile
  useEffect(() => {
    if (!token) {
      console.warn('⚠️ No token found');
      setLoading(false);
      return;
    }

    const fetchCustomerData = async () => {
      try {
        // ดึง user ปัจจุบัน
        console.log('📡 Fetching current user...');
        const userRes = await fetch(API.users.me(), {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!userRes.ok) throw new Error(`User fetch failed: ${userRes.status}`);
        const userData = await userRes.json();
        console.log('✅ User data:', userData);
        
        const currentUserId = userData.id;
        if (!currentUserId) throw new Error('No user ID found');
        
        // ดึง customer profile พร้อม drug_stores
        console.log('📡 Fetching customer profile for userId:', currentUserId);
        const profileRes = await fetch(
          `${API.BASE_URL}/api/customer-profiles?filters[users_permissions_user][id][$eq]=${currentUserId}&populate[0]=drug_stores&populate[1]=drug_stores.photo_front`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
        const profileData = await profileRes.json();
        console.log('📊 Profile response:', profileData);
        
        if (profileData.data && profileData.data.length > 0) {
          const profile = profileData.data[0];
          console.log('✅ Found customer profile');
          console.log('🏪 Followed stores:', profile.drug_stores || profile.attributes?.drug_stores);
          setCustomerProfile(profile);
        } else {
          console.warn('⚠️ No customer profile found for this user');
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Error fetching customer data:', err);
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [token]);

  // ขั้นตอนที่ 3: ดึงข้อมูลร้านยาที่ลูกค้าติดตาม
  useEffect(() => {
    if (!customerProfile) {
      setLoading(false);
      return;
    }

    const loadFollowedPharmacies = async () => {
      try {
        // Handle both nested (attributes) and flattened structure
        const profileData = customerProfile.attributes || customerProfile;
        const followedStores = profileData.drug_stores;
        
        console.log('🏪 Followed stores from profile:', followedStores);

        if (!followedStores || followedStores.length === 0) {
          console.warn('⚠️ No followed stores found');
          setPharmacies([]);
          setLoading(false);
          return;
        }

        // ดึงข้อมูลร้านยาเฉพาะที่ติดตาม
        const pharmaciesData = followedStores.map(store => {
          // Handle both nested data structure and flattened structure
          const storeData = store.attributes || store;
          console.log('🏬 Processing store:', storeData.name_th, 'photo_front:', storeData.photo_front);
          return {
            documentId: store.documentId || storeData.documentId,
            id: store.id,
            name_th: storeData.name_th,
            name_en: storeData.name_en,
            address: storeData.address,
            time_open: formatTime(storeData.time_open),
            time_close: formatTime(storeData.time_close),
            phone_store: storeData.phone_store,
            photo_front: storeData.photo_front,
            photo_in: storeData.photo_in,
            photo_staff: storeData.photo_staff,
            services: storeData.services || {},
            type: storeData.type,
            license_number: storeData.license_number,
            license_doc: storeData.license_doc,
            link_gps: storeData.link_gps,
          };
        });

        console.log('✅ Processed pharmacies:', pharmaciesData.length, 'stores');
        setPharmacies(pharmaciesData);
      } catch (err) {
        console.error("❌ Error loading followed pharmacies:", err);
        toast.error("ไม่สามารถโหลดข้อมูลร้านยาได้");
        setPharmacies([]);
      } finally {
        setLoading(false);
      }
    };

    loadFollowedPharmacies();
  }, [customerProfile]);

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
                customerProfileDoc={customerProfile}
                onViewProfile={handleViewProfile}
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
