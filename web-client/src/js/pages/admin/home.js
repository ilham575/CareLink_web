import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css';
import Footer from '../../components/footer';

function PharmacyItem({ documentId, name_th, address, time_open, time_close, phone_store, photo_front, onDelete }) {
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

      <div className="pharmacy-actions">
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
          onClick={() => navigate(`/pharmacist_detail_admin/${documentId}`, {
            state: { from: "adminHome" }
          })}
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
  const navigate = useNavigate();

  const jwt = localStorage.getItem('jwt');

  // เพิ่ม function สำหรับ refresh ข้อมูล
  const refreshData = async () => {
    setLoading(true);
    setPharmacies([]);
    
    // Clear cache
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  };

  // เพิ่ม auto refresh เมื่อกลับมาที่หน้า
  useEffect(() => {
    const handleFocus = () => {
      refreshData();
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
    // เพิ่มการตรวจสอบ forceRefresh
    if (location.state?.forceRefresh) {
      refreshData();
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
        const timestamp = Date.now();
        const userRes = await fetch(`http://localhost:1337/api/users/me?_=${timestamp}&nocache=${Math.random()}`, {
          headers: { 
            Authorization: `Bearer ${jwt}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });

        if (!userRes.ok) throw new Error("ไม่สามารถดึงข้อมูล user ได้");

        const userData = await userRes.json();
        const userDocumentId = userData.documentId;

        // 2. ดึง admin_profile เพื่อหา id
        const adminProfileQuery = new URLSearchParams({
          'filters[users_permissions_user][documentId][$eq]': userDocumentId
        });
        const adminProfileRes = await fetch(
          `http://localhost:1337/api/admin-profiles?${adminProfileQuery.toString()}`,
          {
            headers: { 
              Authorization: `Bearer ${jwt}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          }
        );
        if (!adminProfileRes.ok) throw new Error("ไม่สามารถโหลดโปรไฟล์แอดมินได้");
        const adminProfileData = await adminProfileRes.json();
        const adminProfile = adminProfileData.data[0];
        if (!adminProfile) throw new Error("ไม่พบโปรไฟล์แอดมิน");

        const adminProfileDocumentId = adminProfile.attributes?.documentId || adminProfile.documentId;
        const adminProfileId = adminProfile.id;

        // DEBUG: log adminProfile ที่ได้
        console.log("DEBUG: adminProfileId", adminProfileId);
        console.log("DEBUG: adminProfileDocumentId", adminProfileDocumentId);
        console.log("DEBUG: adminProfile", adminProfile);

        // 3. ดึง drug-stores ทั้งหมด (แก้ไข populate query)
        const drugStoreQuery = new URLSearchParams({
          'populate': '*', // ใช้ populate=* เพื่อดึงข้อมูลทั้งหมด
          '_': timestamp,
          'nocache': Math.random(),
          'publicationState': 'preview'
        });

        const drugStoreRes = await fetch(
          `http://localhost:1337/api/drug-stores?${drugStoreQuery.toString()}`,
          {
            headers: { 
              Authorization: `Bearer ${jwt}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          }
        );

        if (!drugStoreRes.ok) {
          console.error("API error: ไม่สามารถดึงข้อมูล drug-stores ได้", await drugStoreRes.text());
          throw new Error("ไม่สามารถดึงข้อมูล drug-stores ได้");
        }

        const drugStoreData = await drugStoreRes.json();
        const allDrugStores = drugStoreData.data || [];
        // DEBUG: log ข้อมูล drug_store ที่ได้จาก API
        console.log("DEBUG: allDrugStores", allDrugStores);

        // filter ใน frontend ด้วย admin_profile.id ทั้งใน attributes และ root
        const myDrugStores = allDrugStores.filter(store => {
          const adminProfileField = store.attributes?.admin_profile || store.admin_profile;
          if (!adminProfileField) {
            console.warn(`⚠️ ไม่มี admin_profile ใน store: ${store.id} (${store.name_th || store.name_en || 'ไม่ทราบชื่อ'})`);
            return false;
          }
          return adminProfileField.id === adminProfileId || adminProfileField.documentId === adminProfileDocumentId;
        });

        // DEBUG: log ร้านยาที่ filter ได้
        console.log("DEBUG: myDrugStores", myDrugStores);

        // 4. แปลงข้อมูลให้ง่ายต่อการ render
        const pharmaciesFromAPI = myDrugStores.map(store => {
          const docId = store.documentId || store.attributes?.documentId || store.id;
          return {
            documentId: docId,
            id: store.id,
            name_th: store.name_th || store.attributes?.name_th,
            name_en: store.name_en || store.attributes?.name_en,
            address: store.address || store.attributes?.address,
            time_open: formatTime(store.time_open || store.attributes?.time_open),
            time_close: formatTime(store.time_close || store.attributes?.time_close),
            phone_store: store.phone_store || store.attributes?.phone_store,
            photo_front: store.photo_front || store.attributes?.photo_front,
            photo_in: store.photo_in || store.attributes?.photo_in,
            photo_staff: store.photo_staff || store.attributes?.photo_staff,
            services: store.services || store.attributes?.services || {},
            type: store.type || store.attributes?.type,
            license_number: store.license_number || store.attributes?.license_number,
            license_doc: store.license_doc || store.attributes?.license_doc,
            link_gps: store.link_gps || store.attributes?.link_gps,
            admin_profile: store.admin_profile || store.attributes?.admin_profile,
          };
        });

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
  }, [jwt, navigate, loading, location.state?.forceRefresh]); // เพิ่ม forceRefresh dependency

  const handleDelete = async (documentId) => {
    if (!window.confirm("คุณต้องการลบร้านยานี้หรือไม่?")) return;

    if (!jwt) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }

    try {
      console.log('🗑️ กำลังลบร้านยา DocumentID:', documentId);

      const deleteRes = await fetch(`http://localhost:1337/api/drug-stores/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (deleteRes.ok) {
        setPharmacies(prev => prev.filter(p => p.documentId !== documentId));
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
              style={{ padding: '8px 16px', width: 120, backgroundColor: '#2196F3' }}
              onClick={refreshData}
            >
              🔄 รีเฟรช
            </button>
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
