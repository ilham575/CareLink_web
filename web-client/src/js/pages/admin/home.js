import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
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
    navigate(`/drug_store_admin/${id}`);
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
        <p>เวลาเปิดทำการ: {time_open || '-'} - {time_close || '-'} เบอร์โทรศัพท์: {phone_store || '-'}</p>
      </div>
      <button className="detail-button" onClick={handleClick}>กด<br />เพื่อดูรายละเอียด</button>
    </div>
  );
}

function AdminHome() {
  const location = useLocation();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // ดึง jwt ที่ login ปัจจุบัน (อย่าลืมเซ็ตใน localStorage ด้วย!)
  const jwt = localStorage.getItem('jwt');

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    fetch('http://localhost:1337/api/drug-stores?populate=*', {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
    })
      .then(res => res.json())
      .then(drugStoresRes => {
        const drugStores = drugStoresRes.data || [];

        const pharmaciesWithPharmacists = drugStores.map(store => {
          const attrs = store.attributes || {};
          const ap = attrs.admin_profile?.data || null;
          let pharmacists = [];
          if (ap && ap.attributes?.users_permissions_user?.data) {
            const user = ap.attributes.users_permissions_user.data;
            pharmacists = [{
              ...user.attributes,
              id: user.id
            }];
          }
          const result = {
            id: store.id,
            name_th: store.name_th,
            address: store.address,
            time_open: formatTime(store.time_open),
            time_close: formatTime(store.time_close),
            phone_store: store.phone_store,
            photo_front:
              (store.photo_front && store.photo_front.formats) ? store.photo_front
              : (attrs.photo_front?.data?.attributes || store.photo_front || null),
            pharmacists,
            createdBy: store.createdBy
              ? (typeof store.createdBy === "object"
                  ? (store.createdBy.id
                      ? { ...store.createdBy, id: store.createdBy.id }
                      : store.createdBy)
                  : { id: store.createdBy })
              : (attrs.createdBy?.data
                  ? { ...attrs.createdBy.data.attributes, id: attrs.createdBy.data.id }
                  : null),
          };
          return result;
        });

        setPharmacies(pharmaciesWithPharmacists);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, [jwt]);

  const filteredPharmacies = pharmacies.filter(pharmacy =>
    pharmacy.name_th?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="app-container">
      <ToastContainer />
      <HomeHeader isLoggedIn={true} onSearch={setSearchText} />
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' , marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>ร้านยาของฉัน:</h2>
          <button
            className="detail-button"
            style={{
              padding: '8px 16px',
              width: 120,
            }}
            onClick={() => {
              // ไปหน้าสร้างร้านยาใหม่
              console.log("ไปหน้าสร้างร้านยาใหม่");
            }}
          >
            เพิ่มร้านยา
          </button>
        </div>
        {loading ? (
          <div>กำลังโหลดข้อมูล...</div>
        ) : filteredPharmacies.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
            ไม่พบข้อมูลร้านยา
          </div>
        ) : (
          filteredPharmacies.map(pharmacy => {
            return <PharmacyItem {...pharmacy} key={pharmacy.id} />;
          })
        )}
      </main>
    </div>
  );
}

export default AdminHome;
