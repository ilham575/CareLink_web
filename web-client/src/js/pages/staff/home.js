import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css'; // ใช้ CSS ของหน้า /default/home



function StaffHome() {
  const location = useLocation();
  const [pharmacy, setPharmacy] = useState(null);
  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const token = localStorage.getItem('jwt');

        const staffResponse = await fetch('http://localhost:1337/api/staff-profiles', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!staffResponse.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลพนักงานได้');
        }

        const staffData = await staffResponse.json();
        const staff = staffData?.data?.[0];
        const staffId = staff?.id;
        const staffDocumentId = staff?.documentId;

        if (!staffId) {
          throw new Error('ไม่พบ ID ของพนักงาน');
        }

        const response = await fetch(`http://localhost:1337/api/staff-profiles/${staffDocumentId}?populate= `, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลร้านยาได้');
        }

        const data = await response.json();
        const drugStoresArr = data?.data?.drug_stores;
        const pharmacy = drugStoresArr?.[0] || null;

        setPharmacy(pharmacy);
      } catch (error) {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน');
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
          {pharmacy ? (
            <div className="pharmacy-item">
              {(() => {
                // Try to extract image URL from pharmacy object, adjust the path as needed
                let imageUrl = null;
                if (pharmacy.image && pharmacy.image.url) {
                  imageUrl = pharmacy.image.url;
                } else if (pharmacy.image_url) {
                  imageUrl = pharmacy.image_url;
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
                <p><b>ชื่อร้าน:</b> {pharmacy.name_th || 'ไม่ระบุ'}</p>
                <p><b>ที่อยู่:</b> {pharmacy.address || 'ไม่ระบุ'}</p>
                <p>
                  <b>เวลาเปิดทำการ:</b> {formatTime(pharmacy.time_open) || '-'} - {formatTime(pharmacy.time_close) || '-'} <b>เบอร์โทรศัพท์:</b> {pharmacy.phone_store || '-'}
                </p>
              </div>
            </div>
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
