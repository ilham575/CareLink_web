import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import { db } from '../../db';   // ✅ import db.js
import '../../../css/pages/default/home.css';

function PharmacyItem({ id, name_th, address, time_open, time_close, phone_store, photo_front, pharmacists, onDelete }) {
  const navigate = useNavigate();

  const getImageUrl = (photo) => {
    if (!photo) return null;
    if (typeof photo === "string") return photo;
    if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
    if (photo.url) return photo.url;
    return null;
  };

  const imageUrl = getImageUrl(photo_front);

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
        <p>ชื่อร้านยา: {name_th || 'ไม่พบข้อมูล'}</p>
        <p>ที่อยู่: {address || 'ไม่พบข้อมูล'}</p>
        <p>
          เวลาเปิดทำการ: {time_open || '-'} - {time_close || '-'} เบอร์โทรศัพท์: {phone_store || '-'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button
          className="detail-button"
          style={{ background: '#2196F3' }}
          onClick={() => navigate(`/drug_store_admin/${id}`)}
        >
          รายละเอียดร้านยา
        </button>

        <button
          className="detail-button"
          style={{ background: '#4CAF50' }}
          onClick={() => navigate(`/add_pharmacy_admin/${id}`)}
        >
          เภสัชกร<br />ประจำร้านยา
        </button>

        <button
          className="detail-button"
          style={{ background: '#f44336' }}
          onClick={() => onDelete(id)}
        >
          กดเพื่อลบร้านยา
        </button>
      </div>
    </div>
  );
}

function AdminHome() {
  const location = useLocation();
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const jwt = localStorage.getItem('jwt');

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // ✅ ดึง mock pharmacies จาก IndexedDB
        const mockPharmacies = await db.pharmacies.toArray();

        // ✅ fetch จาก API จริง
        const res = await fetch('http://localhost:1337/api/drug-stores?populate=*', {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
        });
        const drugStoresRes = await res.json();
        const drugStores = drugStoresRes.data || [];

        const pharmaciesFromAPI = drugStores.map(store => {
          const attrs = store.attributes || {};
          return {
            id: store.id,
            name_th: store.name_th,
            address: store.address,
            time_open: formatTime(store.time_open),
            time_close: formatTime(store.time_close),
            phone_store: store.phone_store,
            photo_front: (store.photo_front && store.photo_front.formats) ? store.photo_front : (attrs.photo_front?.data?.attributes || store.photo_front || null),
            pharmacists: [],
          };
        });

        setPharmacies([...pharmaciesFromAPI, ...mockPharmacies]);
        setLoading(false);
      } catch (err) {
        console.error("loadData error:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [jwt]);

  const handleDelete = async (id) => {
    if (!window.confirm("คุณต้องการลบร้านยานี้หรือไม่?")) return;
    try {
      // ✅ ลบจาก IndexedDB
      await db.pharmacies.delete(id);

      // ลบจาก state
      setPharmacies(prev => prev.filter(p => p.id !== id));

      // ลบจาก API ถ้ามี
      await fetch(`http://localhost:1337/api/drug-stores/${id}`, {
        method: "DELETE",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
      });

      toast.success("ลบร้านยาเรียบร้อยแล้ว!");
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการลบ");
    }
  };

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
              navigate("/add_store_admin");
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
          filteredPharmacies.map(pharmacy => (
            <PharmacyItem
              {...pharmacy}
              key={pharmacy.id}
              onDelete={handleDelete}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default AdminHome;
