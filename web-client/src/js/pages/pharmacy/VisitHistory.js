import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Modal, Tabs, Tag, Timeline } from 'antd';
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

function VisitHistory() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  
  const pharmacyId = new URLSearchParams(window.location.search).get('pharmacyId');

  useEffect(() => {
    loadData();
  }, [customerDocumentId, pharmacyId]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('jwt');
      
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
      
      // Load all visits (notifications) for this customer at this pharmacy
      const notifRes = await fetch(
        API.notifications.list(
          `filters[customer_profile][documentId][$eq]=${customerDocumentId}` +
          `&filters[drug_store][documentId][$eq]=${pharmacyId}` +
          `&filters[type][$in][0]=customer_assignment` +
          `&filters[type][$in][1]=customer_assignment_update` +
          `&populate=*` +
          `&sort[0]=createdAt:desc`
        ),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifications = notifData.data || [];
        
        // Group notifications by visit (customer_assignment + related updates)
        const visitsMap = new Map();
        
        notifications.forEach(notif => {
          const key = notif.customer_profile?.documentId || customerDocumentId;
          if (!visitsMap.has(key)) {
            visitsMap.set(key, []);
          }
          visitsMap.get(key).push(notif);
        });
        
        // Convert to visits array, each visit has multiple notifications
        const visits = Array.from(visitsMap.values()).map(notifs => {
          // Sort notifications within visit by createdAt desc
          notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          return {
            id: notifs[0].id, // Use first notification ID as visit ID
            notifications: notifs,
            latestNotification: notifs[0], // Most recent
            createdAt: notifs[0].createdAt,
            updatedAt: notifs[0].updatedAt
          };
        });
        
        // Sort visits by latest update desc
        visits.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        setVisits(visits);
      }
      
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (visit) => {
    setSelectedVisit(visit);
    setDetailModal(true);
  };

  const handleCreateNewVisit = () => {
    // Navigate to customer detail page to create new visit
    navigate(`/drug_store_pharmacy/${pharmacyId}/customer/${customerDocumentId}`);
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
            <button className="btn-back" onClick={() => navigate(-1)}>
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
  const modalStaff = selectedVisit?.staff_profile || latestNotifForModal?.staff_profile || null;

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
            <div className="customer-header-actions">
              <button className="customer-header-btn" onClick={handleCreateNewVisit}>
                ➕ บันทึกการมาใหม่
              </button>
            </div>
          </div>
        </div>

        {/* Visit History Timeline */}
        <div className="visits-container">
          <div className="visits-container-header">
            <h3>
              📋 ประวัติการมาใช้บริการ
              <span className="visits-badge">{visits.length} ครั้ง</span>
            </h3>
          </div>
          
          {visits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p>ยังไม่มีประวัติการมาใช้บริการ</p>
              <button className="empty-state-btn" onClick={handleCreateNewVisit}>
                บันทึกการมาครั้งแรก
              </button>
            </div>
          ) : (
            <div className="visits-timeline">
                {visits.map((visit, index) => {
                  const latestNotif = visit.latestNotification;
                  const visitData = latestNotif.data || {};
                  const symptoms = visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
                  const drugs = visitData.prescribed_drugs || latestNotif.customer_profile?.prescribed_drugs || [];
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
                          <h4>🩺 การมาใช้บริการครั้งที่ {visits.length - index}</h4>
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
        <button className="btn-back" onClick={() => navigate(-1)}>
          กลับ
        </button>
      </div>

      {/* Floating action button for quick new visit */}
      <button
        className="fab-create-visit"
        onClick={handleCreateNewVisit}
        aria-label="บันทึกการมาใหม่"
        title="บันทึกการมาใหม่"
      >
        ➕
      </button>

      <Footer />

      {/* Visit Detail Modal */}
      <Modal
        title={
          <div style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📋 รายละเอียดการมาใช้บริการ
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
              <div className="modal-info-label">วันที่มาใช้บริการ</div>
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
                    {modalDrugs.map((drug, i) => (
                      <div key={i}>
                        {typeof drug === 'string' ? drug : (drug.name || 'ยา')} {drug.quantity ? `(×${drug.quantity})` : ''}
                      </div>
                    ))}
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

            {modalStaff && (
              <div className="modal-info-section">
                <div className="modal-info-label">เจ้าหน้าที่</div>
                <div className="modal-info-value">👤 {modalStaff.full_name || '-'}</div>
              </div>
            )}

            <div className="modal-info-section">
              <div className="modal-info-label">ประวัติการอัปเดต ({selectedVisit.notifications.length} รายการ)</div>
              <div className="modal-timeline-container">
                {selectedVisit.notifications.map((notif) => (
                  <div key={notif.id} className="modal-timeline-item">
                    <div className="modal-timeline-header">
                      {notif.type === 'customer_assignment' ? '📝 การมอบหมาย' : '🔄 อัปเดต'} — <span style={{ color: '#8c8c8c', fontSize: 12 }}>{formatThaiDate(notif.createdAt)}</span>
                    </div>
                    <div className="modal-timeline-content">
                      {notif.data?.symptoms && (
                        <div style={{ marginBottom: 6 }}><strong>อาการ:</strong> {notif.data.symptoms.main || notif.data.symptoms}</div>
                      )}
                      {notif.data?.prescribed_drugs && notif.data.prescribed_drugs.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <strong>ยา:</strong> {notif.data.prescribed_drugs.map((d, i) => (typeof d === 'string' ? d : d.name || 'ยา')).join(', ')}
                        </div>
                      )}
                      {notif.message && (
                        <div style={{ fontStyle: 'italic', color: '#8c8c8c' }}>{notif.message}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default VisitHistory;
