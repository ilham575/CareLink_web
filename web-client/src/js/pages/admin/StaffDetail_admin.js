import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/default/home.css';
import '../../../css/component/StaffCard.css';
import { API } from '../../../utils/apiConfig';

function StaffCard({ staff, onEdit, onDelete, onDetail }) {
  const getImageUrl = (photo) => {
    if (!photo) return null;
    // ใช้ documentId บังคับสำหรับการดึงรูปผ่าน custom endpoint
    if (photo.documentId) {
      return `${API.BASE_URL}/api/upload/files/${photo.documentId}/serve`;
    }
    // Fallback สำหรับข้อมูลเก่า
    if (typeof photo === "string") return photo;
    if (photo.formats?.thumbnail?.url) return photo.formats.thumbnail.url;
    if (photo.formats?.medium?.url) return photo.formats.medium.url;
    if (photo.formats?.large?.url) return photo.formats.large.url;
    if (photo.url) return photo.url;
    return null;
  };

  const imageUrl = getImageUrl(staff.profileImage);

  // แปลงตารางเวลาทำงานให้อ่านง่าย
  const formatWorkSchedule = (workSchedule) => {
    if (!workSchedule || workSchedule.length === 0) {
      return 'ไม่มีข้อมูลเวลาทำงาน';
    }
    
    return workSchedule
      .filter(schedule => schedule.day && schedule.start_time && schedule.end_time)
      .map(schedule => `${schedule.day}: ${schedule.start_time}-${schedule.end_time}`)
      .join(', ');
  };

  return (
    <div className="staff-detail-card">
      <div className="staff-detail-card-content">
        <div className="staff-detail-avatar-section">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="รูปโปรไฟล์"
              className="staff-detail-avatar"
            />
          ) : (
            <div className="staff-detail-avatar-placeholder">
              👤
            </div>
          )}
        </div>

        <div className="staff-detail-info-section">
          <h3 className="staff-detail-name">
            {staff.firstName} {staff.lastName}
          </h3>
          
          <div className="staff-detail-details">
            <div className="staff-detail-detail-row">
              <span className="staff-detail-detail-label">ตำแหน่ง:</span>
              <span className="staff-detail-detail-value">{staff.position || 'ไม่ระบุ'}</span>
            </div>
            
            <div className="staff-detail-detail-row">
              <span className="staff-detail-detail-label">เบอร์โทร:</span>
              <span className="staff-detail-detail-value">{staff.phone || 'ไม่ระบุ'}</span>
            </div>
            
            <div className="staff-detail-detail-row">
              <span className="staff-detail-detail-label">Username:</span>
              <span className="staff-detail-detail-value">{staff.username || 'ไม่ระบุ'}</span>
            </div>
            
            <div className="staff-detail-detail-row">
              <span className="staff-detail-detail-label">เวลาทำงาน:</span>
              <span className="staff-detail-detail-value">{formatWorkSchedule(staff.workSchedule)}</span>
            </div>
          </div>
        </div>

        <div className="staff-detail-actions-section">
          <button
            className="staff-detail-action-btn staff-detail-edit-btn"
            onClick={() => onEdit(staff)}
          >
            <span>✏️</span>
            แก้ไข
          </button>
          
          <button
            className="staff-detail-action-btn staff-detail-delete-btn"
            onClick={() => onDelete(staff)}
          >
            <span>🗑️</span>
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffDetailAdmin() {
  const { pharmacyId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pharmacyInfo, setPharmacyInfo] = useState(null);
  const [searchText, setSearchText] = useState('');

  const jwt = localStorage.getItem('jwt');

  // แสดง toast message หากมี
  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage, { autoClose: 3000 });
    }
  }, [location.state]);

  // โหลดข้อมูลร้านยาและพนักงาน
  useEffect(() => {
    if (!jwt) {
      toast.error('กรุณาเข้าสู่ระบบใหม่');
      navigate('/login');
      return;
    }

    loadData();
  }, [jwt, pharmacyId, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. ดึงข้อมูลร้านยา
      const pharmacyRes = await fetch(
        API.drugStores.getByDocumentId(pharmacyId),
        {
          headers: { 
            Authorization: `Bearer ${jwt}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );

      if (!pharmacyRes.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลร้านยาได้');
      }

      const pharmacyData = await pharmacyRes.json();
      const pharmacy = pharmacyData.data?.[0];

      if (!pharmacy) {
        throw new Error('ไม่พบข้อมูลร้านยา');
      }

      setPharmacyInfo({
        id: pharmacy.id,
        documentId: pharmacy.documentId,
        name: pharmacy.name_th || pharmacy.attributes?.name_th || pharmacy.name_en || pharmacy.attributes?.name_en,
        address: pharmacy.address || pharmacy.attributes?.address,
        phone: pharmacy.phone_store || pharmacy.attributes?.phone_store
      });

      // 2. ดึงข้อมูลพนักงานของร้านยานี้
      const staffRes = await fetch(
        API.staffProfiles.list(`filters[drug_store][id][$eq]=${pharmacy.id}&populate[0]=users_permissions_user&populate[1]=profileimage&populate[2]=drug_store`),
        {
          headers: { 
            Authorization: `Bearer ${jwt}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );

      if (!staffRes.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลพนักงานได้');
      }

      const staffData = await staffRes.json();
      const staffProfiles = staffData.data || [];

      // 3. แปลงข้อมูลพนักงานให้ง่ายต่อการแสดงผล
      const formattedStaff = staffProfiles.map(staff => {
        const user = staff.users_permissions_user || staff.attributes?.users_permissions_user;
        const nameParts = user?.full_name ? user.full_name.split(' ') : ['', ''];
        
        // แปลงตารางเวลาทำงาน
        let workSchedule = [];
        if (staff.work_schedule && Array.isArray(staff.work_schedule)) {
          workSchedule = staff.work_schedule;
        } else if (staff.working_days && Array.isArray(staff.working_days)) {
          const startTime = staff.time_start ? staff.time_start.substring(0, 5) : '';
          const endTime = staff.time_end ? staff.time_end.substring(0, 5) : '';
          workSchedule = staff.working_days.map(day => ({
            day: day,
            start_time: startTime,
            end_time: endTime
          }));
        }

        return {
          id: staff.id,
          documentId: staff.documentId,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          position: staff.position,
          phone: user?.phone || '',
          username: user?.username || '',
          userId: user?.id,
          profileImage: staff.profileimage?.data || staff.profileimage,
          workSchedule: workSchedule
        };
      });

      setStaffList(formattedStaff);
      toast.success(`โหลดข้อมูลพนักงานสำเร็จ ${formattedStaff.length} คน`);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันแก้ไขพนักงาน
  const handleEdit = (staff) => {
    navigate(`/edit_staff_admin/${staff.documentId}?pharmacyId=${pharmacyId}`);
  };

  // ฟังก์ชันลบพนักงาน
  const handleDelete = async (staff) => {
    const confirmMessage = `คุณต้องการลบพนักงาน "${staff.firstName} ${staff.lastName}" หรือไม่?\n\nหมายเหตุ: การลบจะเป็นการลบข้อมูลพนักงานออกจากร้านยานี้เท่านั้น ไม่ได้ลบบัญชีผู้ใช้`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const deleteRes = await fetch(
        API.staffProfiles.delete(staff.documentId),
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!deleteRes.ok) {
        const errorData = await deleteRes.json();
        throw new Error(errorData.message || 'ไม่สามารถลบพนักงานได้');
      }

      // อัปเดต state ให้ลบพนักงานออกจาก list
      setStaffList(prev => prev.filter(s => s.documentId !== staff.documentId));
      toast.success(`ลบพนักงาน "${staff.firstName} ${staff.lastName}" สำเร็จ`);

    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบพนักงาน');
    }
  };

  // ฟังก์ชันเพิ่มพนักงาน
  const handleAddStaff = () => {
    navigate(`/add_staff_admin/${pharmacyId}`);
  };

  // ฟังก์ชันกลับหน้าก่อน
  const handleGoBack = () => {
    const from = location.state?.from;
    if (from === 'adminHome') {
      navigate('/admin');
    } else {
      navigate(-1);
    }
  };

  // กรองพนักงานตามคำค้นหา
  const filteredStaff = staffList.filter(staff => {
    const fullName = `${staff.firstName} ${staff.lastName}`.toLowerCase();
    const search = searchText.toLowerCase();
    return fullName.includes(search) || 
           (staff.position && staff.position.toLowerCase().includes(search)) ||
           (staff.username && staff.username.toLowerCase().includes(search));
  });

  return (
    <div className="staff-detail-page">
      <ToastContainer />
      <HomeHeader
        pharmacyName={pharmacyInfo?.name}
        pharmacistName={pharmacyInfo?.pharmacistName || ''}
        onSearch={setSearchText}
      />
      
      <main className="staff-detail-container">
        <div className="staff-detail-header">
          <div className="staff-detail-nav">
            <button className="staff-detail-back-btn" onClick={handleGoBack}>
              ← กลับ
            </button>
          </div>
          
          {pharmacyInfo && (
            <div className="staff-detail-pharmacy-info">
              <h1 className="staff-detail-pharmacy-title">
                จัดการพนักงาน - {pharmacyInfo.name}
              </h1>
              <div className="staff-detail-pharmacy-meta">
                <div className="staff-detail-pharmacy-meta-item">
                  {pharmacyInfo.address}
                </div>
                <div className="staff-detail-pharmacy-meta-item">
                  {pharmacyInfo.phone || 'ไม่ระบุ'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="staff-detail-actions">
          <div className="staff-detail-stats">
            <span className="staff-detail-stats-icon">👥</span>
            <h3 className="staff-detail-stats-text">
              พนักงานทั้งหมด
              <span className="staff-detail-stats-count">{filteredStaff.length} คน</span>
            </h3>
          </div>
          
          <button 
            className="staff-detail-add-btn"
            onClick={handleAddStaff}
          >
            <span>+</span>
            เพิ่มพนักงาน
          </button>
        </div>

        {loading ? (
          <div className="staff-detail-loading">
            <p className="staff-detail-loading-text">
              <span>⏳</span>
              กำลังโหลดข้อมูล...
            </p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="staff-detail-empty">
            {staffList.length === 0 ? (
              <div>
                <div className="staff-detail-empty-icon">🏪</div>
                <h2 className="staff-detail-empty-title">
                  ยังไม่มีพนักงานในร้านนี้
                </h2>
                <p className="staff-detail-empty-text">
                  เริ่มต้นเพิ่มพนักงานให้ร้านยาของคุณ
                </p>
                <button 
                  className="staff-detail-empty-action"
                  onClick={handleAddStaff}
                >
                  <span>+</span>
                  เพิ่มพนักงานคนแรก
                </button>
              </div>
            ) : (
              <p className="staff-detail-search-empty">
                ไม่พบพนักงานที่ตรงกับคำค้นหา "{searchText}"
              </p>
            )}
          </div>
        ) : (
          <div className="staff-detail-list">
            {filteredStaff.map(staff => (
              <StaffCard
                key={staff.documentId}
                staff={staff}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}

export default StaffDetailAdmin;