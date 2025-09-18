import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css'; // ใช้ CSS ของหน้า /default/home

function StaffHome() {
  const location = useLocation();
  const [pharmacy, setPharmacy] = useState([]);

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId'); // <-- ต้องเก็บหลัง login

        if (!userDocumentId) throw new Error('ไม่พบ DocumentId ของผู้ใช้');

        // ดึงเฉพาะ staff-profiles ของ user นี้
        const response = await fetch(
          `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][documentId][$eq]=${userDocumentId}&populate[drug_store]=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลร้านยาได้');

        const data = await response.json();

        // map เอา drug_store จากแต่ละ profile
        const pharmacies = (data?.data || []).map(profile => profile.drug_store).filter(Boolean);

        setPharmacy(pharmacies);
      } catch (error) {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านยา');
      }
    };

    fetchStaffData();
  }, []);

  return (
    <div className="app-container">
      <ToastContainer />
      <HomeHeader isLoggedIn={true} />
      <main className="main-content">
        <h2>ร้านยาที่คุณทำงานอยู่:</h2>
        <div className="home-content">
          {pharmacy.length > 0 ? (
            pharmacy.map((ph, idx) => (
              <div className="pharmacy-item" key={idx}>
                {(() => {
                  let imageUrl = null;
                  if (ph.image && ph.image.url) {
                    imageUrl = ph.image.url;
                  } else if (ph.image_url) {
                    imageUrl = ph.image_url;
                  }
                  return (
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
                  );
                })()}
                <div className="pharmacy-details">
                  <p><b>ชื่อร้าน:</b> {ph.name_th || 'ไม่ระบุ'}</p>
                  <p><b>ที่อยู่:</b> {ph.address || 'ไม่ระบุ'}</p>
                  <p>
                    <b>เวลาเปิดทำการ:</b> {formatTime(ph.time_open) || '-'} - {formatTime(ph.time_close) || '-'} <b>เบอร์โทรศัพท์:</b> {ph.phone_store || '-'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="home-loading">กำลังโหลดข้อมูลร้านยา...</div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default StaffHome;
