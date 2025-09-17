import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import { db } from '../../db';   // ✅ import db.js
import '../../../css/pages/default/home.css';
import Footer from '../../components/footer';

function PharmacyItem({ documentId, name_th, address, time_open, time_close, phone_store, photo_front, pharmacists, onDelete }) {
  const navigate = useNavigate();

  const getImageUrl = (photo) => {
    if (!photo) return null;
    if (typeof photo === "string") return photo;
    
    // ⚠️ แก้ไขสำหรับ API format ใหม่
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
          onClick={() => navigate(`/drug_store_admin/${documentId}`)}
        >
          รายละเอียดร้านยา
        </button>

        <button
          className="detail-button"
          style={{ background: '#4CAF50' }}
          onClick={() => navigate(`/add_pharmacy_admin/${documentId}`)}
        >
          เภสัชกร<br />ประจำร้านยา
        </button>

        <button
          className="detail-button"
          style={{ background: '#f44336' }}
          onClick={() => onDelete(documentId)}
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
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigate = useNavigate();

  const jwt = localStorage.getItem('jwt');

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    const loadData = async () => {
      if (!jwt) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        navigate('/login');
        return;
      }

      try {
        // 1. ดึงข้อมูล user ปัจจุบัน
        const userRes = await fetch('http://localhost:1337/api/users/me', {
          headers: { Authorization: `Bearer ${jwt}` }
        });

        if (!userRes.ok) throw new Error("ไม่สามารถดึงข้อมูล user ได้");

        const userData = await userRes.json();
        // ใช้ documentId ของ user แทน id
        const userDocumentId = userData.documentId;

        // 2. ดึง admin_profile + drug_stores ที่ผูกกับ user.documentId
        const query = new URLSearchParams({
          'filters[users_permissions_user][documentId][$eq]': userDocumentId,
          'populate[drug_stores][populate]': '*'
        });

        const res = await fetch(
          `http://localhost:1337/api/admin-profiles?${query.toString()}`,
          {
            headers: { Authorization: `Bearer ${jwt}` }
          }
        );

        if (!res.ok) throw new Error("ไม่สามารถโหลดร้านยาได้");

        const data = await res.json();
        const myDrugStores = data.data[0]?.drug_stores || [];

        // แปลงข้อมูลให้ง่ายต่อการ render
        const pharmaciesFromAPI = myDrugStores.map(store => ({
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
        toast.success(`โหลดข้อมูลร้านยาของคุณสำเร็จ ${pharmaciesFromAPI.length} ร้าน`);
      } catch (err) {
        console.error("API error:", err);
        toast.error("ไม่สามารถโหลดข้อมูลร้านยาได้");
        setPharmacies([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [jwt, navigate]);


  const handleDelete = async (documentId) => {
    if (!window.confirm("คุณต้องการลบร้านยานี้หรือไม่?")) return;
    
    if (!jwt) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    
    try {
      console.log('🗑️ กำลังลบร้านยา ID:', documentId);
      
      // ลบจาก API
      const deleteRes = await fetch(`http://localhost:1337/api/drug-stores/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (deleteRes.ok) {
        // ลบจาก state เมื่อ API สำเร็จ
        setPharmacies(prev => prev.filter(p => p.documentId !== documentId && p.id !== documentId));
        
        // ลบจาก IndexedDB ด้วย
        try {
          await db.pharmacies.delete(documentId);
        } catch (dbErr) {
          console.log('Warning: Could not delete from IndexedDB:', dbErr);
        }
        
        toast.success("ลบร้านยาเรียบร้อยแล้ว!");
      } else {
        const errorData = await deleteRes.json();
        console.error('Delete error:', errorData);
        
        if (deleteRes.status === 403) {
          toast.error("คุณไม่มีสิทธิ์ลบร้านยานี้");
        } else if (deleteRes.status === 404) {
          toast.error("ไม่พบร้านยาที่ต้องการลบ");
        } else {
          toast.error("ลบไม่สำเร็จ กรุณาตรวจสอบ");
        }
      }

    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการลบ:', err);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>ร้านยาของฉัน:</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="detail-button"
              style={{ padding: '8px 16px', width: 120 }}
              onClick={() => navigate("/add_store_admin")}
            >
              เพิ่มร้านยา
            </button>
          </div>
        </div>
        {loading ? (
          <div>กำลังโหลดข้อมูล...</div>
        ) : filteredPharmacies.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
            {pharmacies.length === 0 ? (
              <>
                <h3>🏪 คุณยังไม่มีร้านยา</h3>
                <p>เริ่มต้นธุรกิจร้านยาของคุณวันนี้!</p>
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
                onDelete={handleDelete}
              />
            ))}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default AdminHome;
