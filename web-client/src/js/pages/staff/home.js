import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import { formatTime } from '../../utils/time';
import '../../../css/pages/default/home.css';
import '../../../css/pages/staff/home.css';

function StaffHome() {
  const location = useLocation();
  const [pharmacyData, setPharmacyData] = useState([]);

  useEffect(() => {
    if (location.state?.showToast) {
      toast.success('เข้าสู่ระบบสำเร็จ!', { autoClose: 2000 });
    }
  }, [location.state]);

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId');

        if (!userDocumentId) throw new Error('ไม่พบ DocumentId ของผู้ใช้');

        // ดึงข้อมูล staff-profiles พร้อมข้อมูลร้านยาและรูปภาพ
        const response = await fetch(
          `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][documentId][$eq]=${userDocumentId}&populate[drug_store][populate]=photo_front`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลร้านยาได้');

        const data = await response.json();

        // เก็บข้อมูลทั้ง drug_store และ staff profile
        const pharmaciesWithStaffInfo = (data?.data || [])
          .filter(profile => profile.drug_store)
          .map(profile => ({
            pharmacy: profile.drug_store,
            staffProfile: profile
          }));

        setPharmacyData(pharmaciesWithStaffInfo);
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
          {pharmacyData.length > 0 ? (
            pharmacyData.map((item, idx) => {
              const { pharmacy: ph, staffProfile } = item;
              return (
                <div className="pharmacy-item" key={idx}>
                  {(() => {
                    // ใช้ logic เดียวกับ pharmacy home
                    const getImageUrl = (photo) => {
                      if (!photo) return null;
                      if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
                      if (photo.url) return photo.url;
                      return null;
                    };
                    
                    // ลองหาฟิลด์รูปภาพต่างๆ
                    let imageUrl = null;
                    if (ph.photo_front) {
                      imageUrl = getImageUrl(ph.photo_front);
                    } else if (ph.image) {
                      imageUrl = getImageUrl(ph.image);
                    } else if (ph.image_url) {
                      imageUrl = ph.image_url;
                    }
                    
                    return (
                      <div className="pharmacy-image-placeholder staff-pharmacy-image">
                        {imageUrl ? (
                          <img
                            src={imageUrl.startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:1337'}${imageUrl}` : imageUrl}
                            alt="รูปภาพร้านยา"
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
                      <b>เวลาเปิดร้าน:</b> {formatTime(ph.time_open) || '-'} - {formatTime(ph.time_close) || '-'} <b>เบอร์โทรศัพท์:</b> {ph.phone_store || '-'}
                    </p>
                    {staffProfile && (
                      <div className="staff-work-info">
                        <p className="staff-work-time">
                          <b>เวลาทำงานของคุณ:</b>
                          {staffProfile.work_schedule && Array.isArray(staffProfile.work_schedule) ? (
                            <span style={{ marginLeft: '10px' }}>
                              {staffProfile.work_schedule.map(schedule => 
                                `${schedule.day}: ${schedule.start_time}-${schedule.end_time}`
                              ).join(', ')}
                            </span>
                          ) : (
                            <span style={{ marginLeft: '10px' }}>
                              {formatTime(staffProfile.time_start) || '-'} - {formatTime(staffProfile.time_end) || '-'}
                              {staffProfile.working_days && (
                                <span style={{ marginLeft: '15px' }}>
                                  <b>วันทำงาน:</b> {Array.isArray(staffProfile.working_days) 
                                    ? staffProfile.working_days.join(', ')
                                    : staffProfile.working_days
                                  }
                                </span>
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
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