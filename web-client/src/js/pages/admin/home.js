import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css';
import Footer from '../../components/footer';

function PharmacyItem({ documentId, name_th, address, time_open, time_close, phone_store, photo_front, pharmacists, onDelete }) {
  const navigate = useNavigate();

  const getImageUrl = (photo) => {
    if (!photo) return null;
    if (typeof photo === "string") {
      return photo;
    }
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

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('http://localhost:1337/api/drug-stores?populate=*', {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
        });
        const drugStoresRes = await res.json();
        const drugStores = drugStoresRes.data || [];

        const pharmaciesFromAPI = drugStores.map(store => ({
          documentId: store.documentId,
          name_th: store.name_th,
          address: store.address,
          time_open: formatTime(store.time_open),
          time_close: formatTime(store.time_close),
          phone_store: store.phone_store,
          photo_front: (store.photo_front && store.photo_front.formats) ? store.photo_front : (store.attributes?.photo_front?.data?.attributes || store.photo_front || null),
          pharmacists: [],
        }));

        setPharmacies(pharmaciesFromAPI);
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };

    loadData();
  }, [jwt]);

  const handleDelete = async (documentId) => {
    if (!window.confirm("คุณต้องการลบร้านยานี้หรือไม่?")) return;
    try {
      // ค้นหา record ที่มี documentId ตรงกัน
      const resFind = await fetch('http://localhost:1337/api/drug-stores?filters[documentId][$eq]=' + documentId + '&populate=*', {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
      });
      const findJson = await resFind.json();
      const stores = findJson.data || [];
      console.log('พบร้านยาที่จะลบ:', stores);
      if (stores.length === 0) {
        toast.error("ไม่พบร้านยานี้ในระบบ");
        return;
      }
      // ลบแค่ร้านแรกที่เจอ (ไม่ใช้ id โดยตรง)
      const storeToDelete = stores[0];
      console.log('ลบร้านยาที่มี id:', storeToDelete.id);
      // const deleteRes = await fetch(`http://localhost:1337/api/drug-stores/${documentId}`, {
      //   method: "DELETE",
      //   headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
      // });
      // const deleteJson = await deleteRes.json().catch(() => ({}));
      // console.log('ผลลัพธ์การลบร้านยา:', deleteRes.status, deleteJson);
      if (storeToDelete.ok) {
        toast.success("ลบร้านยาเรียบร้อยแล้ว!");
      } else {
        toast.error("ลบไม่สำเร็จ กรุณาตรวจสอบ");
      }
      // reload ข้อมูลใหม่จาก API
      setLoading(true);
      const res = await fetch('http://localhost:1337/api/drug-stores?populate=*', {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
      });
      const drugStoresRes = await res.json();
      const drugStores = drugStoresRes.data || [];
      const pharmaciesFromAPI = drugStores.map(store => ({
        documentId: store.documentId,
        name_th: store.name_th,
        address: store.address,
        time_open: formatTime(store.time_open),
        time_close: formatTime(store.time_close),
        phone_store: store.phone_store,
        photo_front: (store.photo_front && store.photo_front.formats) ? store.photo_front : (store.attributes?.photo_front?.data?.attributes || store.photo_front || null),
        pharmacists: [],
      }));
      setPharmacies(pharmaciesFromAPI);
      setLoading(false);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' , marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>ร้านยาของฉัน:</h2>
          <button
            className="detail-button"
            style={{
              padding: '8px 16px',
              width: 120,
            }}
            onClick={() => {
              navigate("/add_drug_store_admin");
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
            return (
              <PharmacyItem
                {...pharmacy}
                key={pharmacy.documentId}
                onDelete={handleDelete}
              />
            );
          })
        )}
      </main>
      <Footer />
    </div>
  );
}

export default AdminHome;
