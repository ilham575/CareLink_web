import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Modal, Tabs, Tag } from 'antd';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { API } from '../../../utils/apiConfig';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/VisitHistory.css';

dayjs.locale('th');

// Format Thai date
function formatThaiDate(dateStr) {
  if (!dateStr) return '';
  const months = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const d = dayjs(dateStr);
  if (!d.isValid()) return dateStr;
  const day = d.date();
  const month = months[d.month() + 1];
  const year = d.year() + 543;
  const time = d.format('HH:mm');
  return `${day} ${month} ${year} เวลา ${time} น.`;
}

function StaffVisitHistory() {
  const { customerDocumentId, pharmacyId: paramPharmacyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  
  // pharmacyId can come either from the path params or from the query string.
  const pharmacyId = paramPharmacyId || new URLSearchParams(location.search).get('pharmacyId');

  useEffect(() => {
    loadData();
  }, [customerDocumentId, paramPharmacyId, location]);

  // Reload visits when returning to this page (e.g., after editing in detail page)
  useEffect(() => {
    const handleFocus = () => {
      console.log('[StaffVisitHistory] Window focused - reloading visits');
      loadData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [customerDocumentId, pharmacyId]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const userDocumentId = localStorage.getItem('user_documentId');
      
      if (!userDocumentId) {
        toast.error('ไม่พบข้อมูลผู้ใช้');
        return;
      }
      
      // Load customer profile
      const customerRes = await fetch(
        API.customerProfiles.getByIdBasic(customerDocumentId),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
      
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
      
      // Load pharmacy info
      if (pharmacyId) {
        const pharmacyRes = await fetch(
          API.drugStores.getByDocumentId(pharmacyId),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (pharmacyRes.ok) {
          const pharmacyData = await pharmacyRes.json();
          const store = pharmacyData.data?.find(item => item.documentId === pharmacyId);
          setPharmacy(store);
        }
      }
      
      // Load staff profile for filtering notifications
      const staffRes = await fetch(
        API.staffProfiles.list(`filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${pharmacyId}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      let staffDocumentId = null;
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        const staffProfile = staffData.data?.[0];
        staffDocumentId = staffProfile?.documentId;
      }
      
      // Load all visits (notifications) assigned to this staff for this customer
      // รวม type 'message' ด้วยเพื่อแสดงประวัติการบันทึกยา/อาการ
      let notifUrl = `filters[customer_profile][documentId][$eq]=${customerDocumentId}` +
                    `&filters[type][$in][0]=customer_assignment` +
                    `&filters[type][$in][1]=customer_assignment_update` +
                    `&filters[type][$in][2]=message` +
                    `&populate=*` +
                    `&sort[0]=createdAt:desc`;
      
      // Filter by staff if we have staff document ID (to show only notifications assigned to this staff)
      if (staffDocumentId) {
        notifUrl = `filters[staff_profile][documentId][$eq]=${staffDocumentId}&` + notifUrl;
      } else if (pharmacyId) {
        // Fallback: filter by pharmacy if no staff profile
        notifUrl = `filters[drug_store][documentId][$eq]=${pharmacyId}&` + notifUrl;
      }
      
      const notifRes = await fetch(
        API.notifications.list(notifUrl),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifications = notifData.data || [];
        
        // แต่ละ notification คือ 1 visit
        const visits = notifications.map(notif => ({
          id: notif.id,
          notifications: [notif],
          latestNotification: notif,
          createdAt: notif.createdAt,
          updatedAt: notif.updatedAt
        }));
        
        // Sort visits by createdAt desc
        visits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setVisits(visits);
      }
      
    } catch (error) {
      console.error('Error loading staff visit history:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (visit) => {
    const latestNotif = visit.latestNotification;
    const notifId = latestNotif?.documentId || latestNotif?.id;
    const targetNotif = notifId ? `&notifId=${encodeURIComponent(notifId)}` : '';
    navigate(`/staff/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}${targetNotif}`);
  };

  const handleCreateNewAssignment = () => {
    // Redirect back to customer list to create new assignment
    navigate(`/drug_store_staff/${pharmacyId}/customers`);
  };

  if (loading) {
    return (
      <div className="visit-history-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="visit-history-main">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="visit-history-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="visit-history-main">
          <div className="error-container">
            <h2>ไม่พบข้อมูลลูกค้า</h2>
            <button
              className="btn-back"
              onClick={() => {
                if (pharmacyId) {
                  navigate(`/drug_store_staff/${pharmacyId}/customers`);
                } else {
                  navigate(-1);
                }
              }}
            >
              กลับ
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const user = customer.users_permissions_user;

  // Derived vars for modal details
  const latestNotifForModal = selectedVisit?.latestNotification || selectedVisit?.notifications?.[0] || null;
  const modalNotifData = latestNotifForModal?.data || {};
  const modalSymptoms = modalNotifData?.symptoms?.main || modalNotifData?.symptoms || latestNotifForModal?.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
  const modalDrugs = modalNotifData?.prescribed_drugs || latestNotifForModal?.customer_profile?.prescribed_drugs || [];
  const modalStatus = latestNotifForModal?.staff_work_status || selectedVisit?.staff_work_status || {};

  return (
    <div className="visit-history-page">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      
      <main className="visit-history-main">
        {/* Customer Header */}
        <div className="customer-header">
          <div className="customer-header-content">
            <div className="customer-header-info">
              <h2>
                👤 {user?.full_name || 'ไม่พบชื่อ'}
              </h2>
              <div className="customer-header-details">
                <div className="customer-header-detail-item">
                  <span>📱</span>
                  <span>{user?.phone || '-'}</span>
                </div>
                <div className="customer-header-detail-item">
                  <span>⚠️</span>
                  <span>แพ้ยา: {customer.Allergic_drugs ? 'มี' : 'ไม่มี'}</span>
                </div>
                <div className="customer-header-detail-item">
                  <span>🏥</span>
                  <span>โรคประจำตัว: {customer.congenital_disease || 'ไม่มี'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visit History Timeline */}
        <div className="visits-container">
          <div className="visits-container-header">
            <h3>
              📋 ประวัติการจัดส่ง
              <span className="visits-badge">{visits.length} ครั้ง</span>
            </h3>
          </div>
          
          {visits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p>ยังไม่มีการมอบหมายสำหรับลูกค้านี้</p>
              <button className="empty-state-btn" onClick={handleCreateNewAssignment}>
                กลับไปเพื่อสร้างการมอบหมายใหม่
              </button>
            </div>
          ) : (
            <div className="visits-timeline">
                {visits.map((visit, index) => {
                  const latestNotif = visit.latestNotification;
                  const visitData = latestNotif.data || {};
                  // ข้อมูล snapshot อยู่ใน visitData.data (nested อีกชั้น)
                  const innerData = visitData.data || {};
                  const symptoms = innerData.symptoms || visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
                  const staffWorkStatus = latestNotif.staff_work_status || {};
                  
                  // Determine visit status
                  let statusColor = '#d9d9d9';
                  let statusText = 'รอดำเนินการ';
                  
                  if (staffWorkStatus.cancelled) {
                    statusColor = '#ff4d4f';
                    statusText = 'ยกเลิก';
                  } else if (staffWorkStatus.prepared) {
                    statusColor = '#52c41a';
                    statusText = 'จัดส่งแล้ว';
                  } else if (staffWorkStatus.received) {
                    statusColor = '#1890ff';
                    statusText = 'รับข้อมูลแล้ว';
                  }
                  
                  return (
                    <div key={visit.id} className="visit-timeline-block">
                      <div className="visit-time">
                        {formatThaiDate(visit.createdAt)}
                      </div>
                      <div className="visit-card" onClick={() => handleViewDetail(visit)}>
                        <div className="visit-card-title">
                          <h4>📦 การจัดส่งครั้งที่ {visits.length - index}</h4>
                          {symptoms && <p className="visit-card-excerpt">{symptoms}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            )}
        </div>
      </main>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <button
          className="btn-back"
          onClick={() => {
            if (pharmacyId) {
              navigate(`/drug_store_staff/${pharmacyId}/customers`);
            } else {
              navigate(-1);
            }
          }}
        >
          กลับ
        </button>
      </div>

      <Footer />

      {/* Visit Detail Modal */}
      <Modal
        title={
          <div style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📋 รายละเอียดการจัดส่ง
          </div>
        }
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <button
            key="close"
            className="modal-close-btn"
            onClick={() => setDetailModal(false)}
          >
            ปิด
          </button>
        ]}
        width={700}
      >
        {selectedVisit && (
          <div>
            <div className="modal-info-section">
              <div className="modal-info-label">วันที่มอบหมาย</div>
              <div className="modal-info-value">
                {formatThaiDate(selectedVisit.createdAt)}
              </div>
            </div>

            <div className="modal-info-section">
              <div className="modal-info-label">อาการ</div>
              <div className="modal-info-value">{modalSymptoms}</div>
            </div>

            <div className="modal-info-section">
              <div className="modal-info-label">ยา</div>
              <div className="modal-info-value">
                {Array.isArray(modalDrugs) && modalDrugs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {modalDrugs.map((drug, i) => {
                      if (typeof drug === 'string') {
                        return <div key={i}>{drug}</div>;
                      }
                      const drugName = drug.drugName || drug.name || 'ยา';
                      const quantity = drug.quantity || 1;
                      return (
                        <div key={i}>
                          {drugName} {quantity > 1 ? `(×${quantity})` : ''}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span>ไม่มี</span>
                )}
              </div>
            </div>

            <div className="modal-info-section">
              <div className="modal-info-label">สถานะ</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {modalStatus?.received && <Tag color="blue">✅ รับข้อมูลแล้ว</Tag>}
                {modalStatus?.prepared && <Tag color="green">📦 จัดส่งแล้ว</Tag>}
                {modalStatus?.cancelled && <Tag color="red">❌ ยกเลิก</Tag>}
                {!modalStatus?.received && !modalStatus?.prepared && !modalStatus?.cancelled && (
                  <Tag color="default">⏳ รอดำเนินการ</Tag>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StaffVisitHistory;
