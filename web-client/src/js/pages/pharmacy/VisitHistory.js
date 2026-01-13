import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  const { customerDocumentId, pharmacyId: paramPharmacyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    open: false,
    visit: null,
    loading: false
  });
  
  // pharmacyId can come either from the path params or from the query string.
  // Use path param first (when route is /drug_store_pharmacy/:pharmacyId/customer/:customerDocumentId/history),
  // otherwise fall back to ?pharmacyId= in the query string.
  const pharmacyId = paramPharmacyId || new URLSearchParams(location.search).get('pharmacyId');

  useEffect(() => {
    loadData();
  }, [customerDocumentId, paramPharmacyId, location]);

  // Reload visits when returning to this page (e.g., after editing in detail page)
  // This ensures new notifications appear in the list immediately
  useEffect(() => {
    const handleFocus = () => {
      console.log('[VisitHistory] Window focused - reloading visits');
      loadData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [customerDocumentId, pharmacyId]);

  // Also reload data on component mount to catch new visits created in detail page
  useEffect(() => {
    console.log('[VisitHistory] Component mounted/remounted - reloading visits');
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // ⚠️ เฉพาะ customer_assignment (การมอบหมายใหม่) และ message (บันทึกข้อมูล)
      // ❌ ไม่รวม customer_assignment_update เพราะมันคือการอัพเดตของ visit เดียวกัน
      // (ถ้าใส่ customer_assignment_update มันจะแสดงสองครั้งในรายการ visit)
      const notifRes = await fetch(
        API.notifications.list(
          `filters[customer_profile][documentId][$eq]=${customerDocumentId}` +
          `&filters[drug_store][documentId][$eq]=${pharmacyId}` +
          `&filters[type][$in][0]=customer_assignment` +
          `&filters[type][$in][1]=message` +
          `&populate=*` +
          `&sort[0]=createdAt:desc`
        ),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifications = notifData.data || [];
        
        // แต่ละ notification คือ 1 visit (ไม่ group)
        // เพราะแต่ละครั้งที่ส่งข้อมูลให้พนักงาน ถือเป็นการมาใหม่
        const visits = notifications.map(notif => ({
          id: notif.id,
          notifications: [notif], // wrap ใน array เพื่อให้ compatible กับ UI
          latestNotification: notif,
          createdAt: notif.createdAt,
          updatedAt: notif.updatedAt
        }));
        
        // Sort visits by createdAt desc (ล่าสุดก่อน)
        visits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setVisits(visits);
      }
      
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (visit) => {
    // Navigate to CustomerDetail page and pass notifId so detail page can load specific visit
    const latestNotif = visit.latestNotification;
    const notifId = latestNotif?.documentId || latestNotif?.id;
    const targetNotif = notifId ? `&notifId=${encodeURIComponent(notifId)}` : '';
    // Use the app's CustomerDetail route: /customer_detail/:customerDocumentId
    navigate(`/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}${targetNotif}`);
  };

  const handleCreateNewVisit = () => {
    // Navigate to customer detail page to create new visit
    navigate(`/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}&newVisit=1`);
  };

  const handleDeleteVisit = (visit) => {
    setDeleteConfirmModal({
      open: true,
      visit: visit,
      loading: false
    });
  };

  const handleConfirmDeleteVisit = async () => {
    if (!deleteConfirmModal.visit) return;

    setDeleteConfirmModal(prev => ({ ...prev, loading: true }));

    try {
      const token = localStorage.getItem('jwt');
      const notifId = deleteConfirmModal.visit.latestNotification.documentId;

      const res = await fetch(API.notifications.delete(notifId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('ลบข้อมูลไม่สำเร็จ');

      toast.success('ลบประวัติการมาใช้บริการสำเร็จ');
      setDeleteConfirmModal({ open: false, visit: null, loading: false });

      // Reload data to update the list
      loadData();

    } catch (error) {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบข้อมูล');
      setDeleteConfirmModal(prev => ({ ...prev, loading: false }));
    }
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
                if (pharmacy?.documentId || pharmacyId) {
                  navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
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
  
  // Read from nested snapshot (innerData) first, then fallback to top-level
  const modalInnerData = modalNotifData?.data || {};
  const modalSymptoms = modalInnerData?.symptoms?.main || modalInnerData?.symptoms || modalNotifData?.symptoms?.main || modalNotifData?.symptoms || latestNotifForModal?.customer_profile?.Customers_symptoms || 'ไม่ระบุอาการ';
  const modalDrugs = modalInnerData?.prescribed_drugs || modalNotifData?.prescribed_drugs || latestNotifForModal?.customer_profile?.prescribed_drugs || [];
  const modalAppointmentDate = modalInnerData?.appointment_date || modalNotifData?.appointment_date || latestNotifForModal?.customer_profile?.Follow_up_appointment_date || null;
  
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
                  // ข้อมูล snapshot อยู่ใน visitData.data (nested อีกชั้น)
                  const innerData = visitData.data || {};
                  // Normalize symptoms to a display string (handle object/string)
                  const rawSymptoms = innerData.symptoms || visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || null;
                  let symptoms = 'ไม่ระบุอาการ';
                  if (rawSymptoms) {
                    if (typeof rawSymptoms === 'string') {
                      symptoms = rawSymptoms;
                    } else if (typeof rawSymptoms === 'object') {
                      symptoms = rawSymptoms.main || rawSymptoms.history || rawSymptoms.note || JSON.stringify(rawSymptoms);
                    }
                  }
                  const drugs = innerData.prescribed_drugs || visitData.prescribed_drugs || latestNotif.customer_profile?.prescribed_drugs || [];
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
                          <div style={{ flex: 1 }}>
                            <h4>🩺 การมาใช้บริการครั้งที่ {visits.length - index}</h4>
                            {symptoms && <p className="visit-card-excerpt">{symptoms}</p>}
                          </div>
                          <button
                            className="visit-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVisit(visit);
                            }}
                            title="ลบประวัติการมาใช้บริการ"
                          >
                            🗑️
                          </button>
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
            if (pharmacy?.documentId || pharmacyId) {
              navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
            } else {
              navigate(-1);
            }
          }}
        >
          กลับ
        </button>
      </div>

      {/* Floating action button for quick new visit */}

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
              <div className="modal-info-label">วันนัดติดตาม</div>
              <div className="modal-info-value">
                {modalAppointmentDate ? formatThaiDate(modalAppointmentDate) : 'ยังไม่มีกำหนด'}
              </div>
            </div>

            <div className="modal-info-section">
              <div className="modal-info-label">ยา</div>
              <div className="modal-info-value">
                {Array.isArray(modalDrugs) && modalDrugs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {modalDrugs.map((drug, i) => {
                      // รองรับทั้ง format เก่าและใหม่
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
                      {notif.type === 'customer_assignment' ? '📝 การมอบหมาย' : 
                       notif.type === 'customer_assignment_update' ? '🔄 อัปเดต' : 
                       notif.type === 'message' ? '💊 บันทึกข้อมูล' : '📋 บันทึก'} — <span style={{ color: '#8c8c8c', fontSize: 12 }}>{formatThaiDate(notif.createdAt)}</span>
                    </div>
                    <div className="modal-timeline-content">
                      {notif.data?.symptoms && (
                        <div style={{ marginBottom: 6 }}><strong>อาการ:</strong> {notif.data.symptoms.main || notif.data.symptoms}</div>
                      )}
                      {notif.data?.prescribed_drugs && notif.data.prescribed_drugs.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <strong>ยา:</strong> {notif.data.prescribed_drugs.map((d, i) => {
                            // รองรับทั้ง format เก่า (string/object ธรรมดา) และ format ใหม่ (มี drugName, quantity)
                            if (typeof d === 'string') return d;
                            if (d.drugName) return `${d.drugName} ${d.quantity ? `×${d.quantity}` : ''}`;
                            return d.name || 'ยา';
                          }).join(', ')}
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

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ ยืนยันการลบประวัติ
          </div>
        }
        open={deleteConfirmModal.open}
        onCancel={() => setDeleteConfirmModal({ open: false, visit: null, loading: false })}
        footer={[
          <button
            key="cancel"
            onClick={() => setDeleteConfirmModal({ open: false, visit: null, loading: false })}
            disabled={deleteConfirmModal.loading}
            style={{
              padding: '8px 16px',
              background: '#f5f5f5',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            ยกเลิก
          </button>,
          <button
            key="confirm"
            onClick={handleConfirmDeleteVisit}
            loading={deleteConfirmModal.loading}
            disabled={deleteConfirmModal.loading}
            style={{
              padding: '8px 16px',
              background: '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {deleteConfirmModal.loading ? 'กำลังลบ...' : 'ลบประวัติ'}
          </button>
        ]}
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          <p style={{ margin: 0, fontSize: '16px', color: '#262626' }}>
            คุณต้องการลบประวัติการมาใช้บริการนี้หรือไม่?
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#8c8c8c' }}>
            การดำเนินการนี้ไม่สามารถยกเลิกได้
          </p>
          {deleteConfirmModal.visit && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '6px'
            }}>
              <strong>วันที่:</strong> {formatThaiDate(deleteConfirmModal.visit.createdAt)}
              <br />
              <strong>อาการ:</strong> {(() => {
                const latestNotif = deleteConfirmModal.visit.latestNotification;
                const visitData = latestNotif.data || {};
                const innerData = visitData.data || {};
                const rawSymptoms = innerData.symptoms || visitData.symptoms || latestNotif.customer_profile?.Customers_symptoms || null;
                let symptoms = 'ไม่ระบุอาการ';
                if (rawSymptoms) {
                  if (typeof rawSymptoms === 'string') {
                    symptoms = rawSymptoms;
                  } else if (typeof rawSymptoms === 'object') {
                    symptoms = rawSymptoms.main || rawSymptoms.history || rawSymptoms.note || JSON.stringify(rawSymptoms);
                  }
                }
                return symptoms;
              })()}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default VisitHistory;
