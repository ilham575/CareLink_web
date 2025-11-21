import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/detail_customer.css';
import 'react-toastify/dist/ReactToastify.css';
import { Modal, Tabs } from 'antd';
import dayjs from 'dayjs';

// เพิ่มฟังก์ชันแปลงวันที่เป็นภาษาไทย
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
  return `${day} ${month} ${year}`;
}

function CustomerDetailStaff() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState(null);
  const [notification, setNotification] = useState(null);
  const [staffStatus, setStaffStatus] = useState({
    received: false,
    prepared: false,
    received_at: null,
    prepared_at: null,
    prepared_note: '',
    outOfStock: []
  });
  const [statusModal, setStatusModal] = useState({
    open: false,
    type: '', // 'received' | 'prepared' | 'outOfStock'
    note: ''
  });
  const [addDrugModal, setAddDrugModal] = useState({ 
    open: false, 
    availableDrugs: []
  });
  const [activeTab, setActiveTab] = useState('1');
  
  // Get pharmacyId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');

  useEffect(() => {
    const loadCustomerData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId');
        
        const isNotificationOnly = customerDocumentId.startsWith('notif_');

        if (isNotificationOnly) {
          // โหลด notification และสร้าง customer data สำหรับกรณี notification only
          const notificationId = customerDocumentId.replace('notif_', '');
          
          // โหลด staff profile
          const staffRes = await fetch(
            `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${pharmacyId}`,
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (!staffRes.ok) throw new Error('ไม่สามารถโหลดข้อมูล Staff ได้');

          const staffData = await staffRes.json();
          const staffProfile = staffData.data?.[0];

          if (!staffProfile) throw new Error('ไม่พบข้อมูล Staff Profile');

          // โหลด notification
          const notifRes = await fetch(
            `http://localhost:1337/api/notifications/${notificationId}?populate=*`,
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (!notifRes.ok) throw new Error('ไม่สามารถโหลดข้อมูล Notification ได้');

          const notifData = await notifRes.json();
          const notif = notifData.data;

          // สร้าง customer data จาก notification
          const d = notif.data || {};
          let full_name = d.full_name || d.name || d.patient_name || d.patient_full_name || 'ไม่ระบุ';
          if (full_name === 'ไม่ระบุ' && notif.message) {
            const match = notif.message.match(/ได้รับมอบหมายดูแลผู้ป่วย:\s*([^\n]+)/);
            if (match) {
              full_name = match[1].trim();
            }
          }

          const userObj = {
            full_name: full_name,
            phone: d.phone || d.tel || d.mobile || '',
            email: d.email || ''
          };

          const tempCustomer = {
            documentId: customerDocumentId,
            users_permissions_user: userObj,
            Customers_symptoms: d.symptoms || '',
            Allergic_drugs: d.allergy || '',
            congenital_disease: d.disease || '',
            Follow_up_appointment_date: d.follow_up_date || d.appointment_date || null,
            prescribed_drugs: d.prescribed_drugs || [],
            _fromNotificationOnly: true
          };

          setCustomer(tempCustomer);
          setNotification(notif);

          // อ่านสถานะจาก notification data
          if (notif?.staff_work_status) {
            setStaffStatus(notif.staff_work_status);
          }

        } else {
          // โหลด customer profile ตามปกติ
          const customerRes = await fetch(
            `http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
          
          if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
          
          const customerData = await customerRes.json();
          setCustomer(customerData.data);
          
          // โหลดข้อมูล staff profile
          const staffRes = await fetch(
            `http://localhost:1337/api/staff-profiles?filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${pharmacyId}`,
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );

          if (staffRes.ok) {
            const staffData = await staffRes.json();
            const staffProfile = staffData.data?.[0];

            if (staffProfile) {
              // โหลด notification ของลูกค้าคนนี้ที่ส่งมาให้ staff คนนี้
              const notifRes = await fetch(
                `http://localhost:1337/api/notifications?filters[staff_profile][documentId][$eq]=${staffProfile.documentId}&filters[customer_profile][documentId][$eq]=${customerDocumentId}&filters[type][$eq]=customer_assignment&populate[]=staff_profile&populate[]=pharmacy_profile&populate[]=drug_store&populate[]=customer_profile`,
                { headers: { Authorization: token ? `Bearer ${token}` : '' } }
              );

              if (notifRes.ok) {
                const notifData = await notifRes.json();
                const notif = notifData.data?.[0];
                setNotification(notif);

                // อ่านสถานะจาก notification staff_work_status
                if (notif?.staff_work_status) {
                  setStaffStatus(notif.staff_work_status);
                }
              }
            }
          }
        }
        
        // Load pharmacy data if pharmacyId exists
        if (pharmacyId) {
          const pharmacyRes = await fetch(
            `http://localhost:1337/api/drug-stores?filters[documentId][$eq]=${pharmacyId}`,
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
          
          if (pharmacyRes.ok) {
            const pharmacyData = await pharmacyRes.json();
            const store = pharmacyData.data?.find(item => item.documentId === pharmacyId);
            setPharmacy(store);
          }
          
          // Load drugs for this pharmacy
          const drugsRes = await fetch(
            `http://localhost:1337/api/drugs?filters[drug_store][documentId][$eq]=${pharmacyId}&populate=*`,
            {
              headers: { Authorization: token ? `Bearer ${token}` : "" }
            }
          );
          if (drugsRes.ok) {
            const drugsData = await drugsRes.json();
            setAddDrugModal(prev => ({ ...prev, availableDrugs: drugsData.data }));
          }
        }
        
      } catch (error) {
        console.error('Error loading customer data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
      } finally {
        setLoading(false);
      }
    };

    if (customerDocumentId) {
      loadCustomerData();
    }
  }, [customerDocumentId, pharmacyId]);

  const handleBack = () => {
    if (pharmacyId) {
      navigate(`/drug_store_staff/${pharmacyId}/customers`);
    } else {
      navigate(-1);
    }
  };

  const handleUpdateStatus = async (type, note = '') => {
    try {
      const token = localStorage.getItem('jwt');
      
      if (!notification) {
        toast.error('ไม่พบข้อมูล notification');
        return;
      }

      const updatedStatus = { ...staffStatus };
      const now = new Date().toISOString();
      
      if (type === 'received') {
        updatedStatus.received = true;
        updatedStatus.received_at = now;
      } else if (type === 'prepared') {
        updatedStatus.prepared = true;
        updatedStatus.prepared_at = now;
        updatedStatus.prepared_note = note;
      }

      const res = await fetch(`http://localhost:1337/api/notifications/${notification.documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            staff_work_status: updatedStatus,
            is_read: true
          }
        })
      });

      if (res.ok) {
        setStaffStatus(updatedStatus);
        setNotification(prev => ({ ...prev, staff_work_status: updatedStatus, is_read: true }));
        toast.success('อัปเดตสถานะสำเร็จ');
        setStatusModal({ open: false, type: '', note: '' });
      } else {
        throw new Error('ไม่สามารถอัปเดตสถานะได้');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  const handleReportOutOfStock = async (drugIds, note) => {
    try {
      const token = localStorage.getItem('jwt');
      
      if (!notification) {
        toast.error('ไม่พบข้อมูล notification');
        return;
      }

      const updatedStatus = {
        ...staffStatus,
        outOfStock: [...new Set([...staffStatus.outOfStock, ...drugIds])]
      };

      const res = await fetch(`http://localhost:1337/api/notifications/${notification.documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            staff_work_status: updatedStatus
          }
        })
      });

      if (res.ok) {
        setStaffStatus(updatedStatus);
        setNotification(prev => ({ ...prev, staff_work_status: updatedStatus }));
        toast.success('แจ้งยาหมดสต็อกสำเร็จ');
        setStatusModal({ open: false, type: '', note: '' });
      } else {
        throw new Error('ไม่สามารถแจ้งยาหมดสต็อกได้');
      }
    } catch (error) {
      console.error('Error reporting out of stock:', error);
      toast.error('เกิดข้อผิดพลาดในการแจ้งยาหมดสต็อก');
    }
  };

  if (loading) {
    return (
      <div className="customer-detail-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="customer-detail-main">
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
      <div className="customer-detail-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="customer-detail-main">
          <div className="error-container">
            <h2>ไม่พบข้อมูลลูกค้า</h2>
            <button className="btn-back" onClick={handleBack}>
              กลับ
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const user = customer.users_permissions_user;
  const notifData = notification?.data || {};

  return (
    <div className="customer-detail-page">
      <ToastContainer />
      <HomeHeader 
        pharmacyName={pharmacy?.name_th || pharmacy?.attributes?.name_th || ''}
      />
      
      <main className="customer-detail-main">
        {/* Header summary: patient info only */}
        <div className="detail-header-summary">
          <div className="detail-header-left">
            <div className="detail-header-name">{user?.full_name || 'ไม่พบชื่อ'}</div>
            <div className="detail-header-meta">
              <span>{user?.phone || '-'}</span>
              <span className="dot">•</span>
              <span>{customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ไม่มีวันนัด'}</span>
            </div>
          </div>
          <div className="detail-header-right">
            <div className="detail-header-badges">
              <div className="pill-badge">💊 {customer.prescribed_drugs ? customer.prescribed_drugs.length : 0}</div>
            </div>
          </div>
        </div>

        {/* สถานะการทำงานของ Staff */}
        <div className="staff-status-panel" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>📊 สถานะการดำเนินการ</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusModal({ open: true, type: 'received', note: '' })}
              disabled={staffStatus.received}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: staffStatus.received ? '#52c41a' : 'rgba(255,255,255,0.2)',
                color: 'white',
                cursor: staffStatus.received ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {staffStatus.received ? '✅ ได้รับข้อมูลแล้ว' : '📥 ยืนยันรับข้อมูล'}
            </button>
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'prepared', note: '' })}
              disabled={staffStatus.prepared || !staffStatus.received}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: staffStatus.prepared ? '#52c41a' : staffStatus.received ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: staffStatus.prepared || !staffStatus.received ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                opacity: !staffStatus.received ? 0.5 : 1
              }}
            >
              {staffStatus.prepared ? '✅ จัดยาส่งแล้ว' : '📦 จัดยาส่งไปแล้ว'}
            </button>
            
            <button
              onClick={() => setStatusModal({ open: true, type: 'outOfStock', note: '', selectedDrugs: [] })}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              🚨 แจ้งยาหมดสต็อก
            </button>
          </div>
          
          {notifData.staff_note && (
            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <strong>📝 หมายเหตุ:</strong> {notifData.staff_note}
            </div>
          )}

          {notifData.note && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px' }}>
              <strong>💬 หมายเหตุจากเภสัชกร:</strong> {notifData.note}
            </div>
          )}
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={key => setActiveTab(key)} 
          defaultActiveKey="1" 
          type="card" 
          size="large"
          className="customer-detail-tabs responsive"
        >
          <Tabs.TabPane tab={<span>📋 ข้อมูลพื้นฐาน</span>} key="1">
            <div className="customer-info-form responsive">
              {/* Essential Customer Info */}
              <div className="essential-info-grid">
                <div className="info-card">
                  <div className="info-card-header">
                    <span className="info-card-icon">👤</span>
                    <h3>ข้อมูลติดต่อ</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="info-row">
                      <label>ชื่อ-นามสกุล:</label>
                      <span>{user?.full_name || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
                      <label>เบอร์โทรศัพท์:</label>
                      <span>{user?.phone || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-header">
                    <span className="info-card-icon">⚠️</span>
                    <h3>ข้อมูลสำคัญ</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="info-row">
                      <label>ยาที่แพ้:</label>
                      <span className="text-warning">{customer.Allergic_drugs || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
                      <label>โรคประจำตัว:</label>
                      <span>{customer.congenital_disease || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab={<span>🩺 อาการและการติดตาม</span>} key="2">
            <div className="symptoms-followup-panel responsive">
              {/* อาการปัจจุบัน */}
              <div className="symptom-section">
                <div className="symptom-section-header">
                  <h3 className="section-title">🩺 อาการปัจจุบัน</h3>
                </div>
                
                <div className="symptom-card">
                  {(customer.Customers_symptoms || customer.symptom_history || customer.symptom_note) ? (
                    <>
                      <div className="symptom-main">
                        <label>อาการหลัก:</label>
                        <div className="symptom-display">
                          {customer.Customers_symptoms || '-'}
                        </div>
                      </div>
                      {customer.symptom_history && (
                        <div className="symptom-history">
                          <label>ประวัติการเจ็บป่วย:</label>
                          <div className="symptom-display">{customer.symptom_history}</div>
                        </div>
                      )}
                      {customer.symptom_note && (
                        <div className="symptom-note">
                          <label>หมายเหตุ:</label>
                          <div className="symptom-display">{customer.symptom_note}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="symptom-empty">
                      <div className="symptom-empty-icon">📝</div>
                      <h4>ไม่มีข้อมูลอาการ</h4>
                    </div>
                  )}
                </div>
              </div>

              {/* การนัดติดตาม */}
              <div className="followup-section">
                <h3 className="section-title">📅 การนัดติดตาม</h3>
                <div className="followup-card">
                  <div className="current-appointment">
                    <div className="appointment-info">
                      <span className="appointment-label">วันนัดติดตามอาการ:</span>
                      <span className="appointment-date">
                        {customer.Follow_up_appointment_date ? formatThaiDate(customer.Follow_up_appointment_date) : 'ยังไม่ได้กำหนด'}
                      </span>
                    </div>
                  </div>
                  {customer.Follow_up_appointment_date && (
                    <div className="appointment-status">
                      <div className={`status-badge ${new Date(customer.Follow_up_appointment_date) > new Date() ? 'upcoming' : 'overdue'}`}>
                        {new Date(customer.Follow_up_appointment_date) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ข้อมูลเตือนสำคัญ */}
              <div className="alert-section">
                <h3 className="section-title">⚠️ ข้อมูลสำคัญที่ต้องระวัง</h3>
                <div className="alert-grid">
                  <div className="alert-card allergy">
                    <div className="alert-icon">🚫</div>
                    <div className="alert-content">
                      <h4>ยาที่แพ้</h4>
                      <p>{customer.Allergic_drugs || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                  <div className="alert-card disease">
                    <div className="alert-icon">🏥</div>
                    <div className="alert-content">
                      <h4>โรคประจำตัว</h4>
                      <p>{customer.congenital_disease || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab={<span>💊 รายการยา <span className="tab-badge">{customer?.prescribed_drugs?.length || 0}</span></span>} key="3">
            <div className="customer-actions-panel responsive">
              <div className="actions-header responsive">
                <h2>รายการยาที่ต้องใช้</h2>
              </div>

              {/* แสดงรายการยาที่กำหนดแล้ว */}
              {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <div className="prescribed-drugs-header">
                    <div className="prescribed-drugs-info">
                      <span className="prescribed-drugs-icon">💊</span>
                      <div>
                        <h3 className="prescribed-drugs-title">
                          ยาที่กำหนดแล้ว:
                        </h3>
                        <p className="prescribed-drugs-patient">
                          {user?.full_name || 'ผู้ป่วย'}
                        </p>
                      </div>
                    </div>
                    <div className="prescribed-drugs-count">
                      {customer.prescribed_drugs.length} รายการ
                    </div>
                  </div>
                  
                  {/* Grid Layout สำหรับยา */}
                  <div className="prescribed-drugs-grid">
                    {customer.prescribed_drugs.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                      const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                      const isOutOfStock = staffStatus.outOfStock.includes(drugId);
                      
                      return (
                        <div key={drugId} className="prescribed-drug-card-individual" style={{
                          opacity: isOutOfStock ? 0.6 : 1,
                          border: isOutOfStock ? '2px solid #ff4d4f' : undefined
                        }}>
                          {/* Quantity Badge */}
                          <div className="prescribed-drug-quantity-badge">
                            จำนวน {quantity}
                          </div>

                          {isOutOfStock && (
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              background: '#ff4d4f',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              หมดสต็อก
                            </div>
                          )}

                          {/* Drug Icon และ Badge */}
                          <div className="prescribed-drug-header">
                            <div className="prescribed-drug-icon">
                              Rx
                            </div>
                            <div className="prescribed-drug-info">
                              <h4 className="prescribed-drug-name">
                                {drug ? drug.name_th : 'กำลังโหลด...'}
                              </h4>
                              <p className="prescribed-drug-name-en">
                                {drug ? drug.name_en : '-'}
                              </p>
                              {drug && drug.price && (
                                <div className="prescribed-drug-price">
                                  ราคา: {drug.price} บาท
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Drug Description */}
                          {drug && drug.description && (
                            <div className="prescribed-drug-description">
                              <p>
                                {drug.description}
                              </p>
                            </div>
                          )}

                          {/* Additional Info */}
                          {drug && (drug.lot_number || drug.expiry_date) && (
                            <div className="prescribed-drug-meta">
                              {drug.lot_number && (
                                <span>
                                  Lot: {drug.lot_number}
                                </span>
                              )}
                              {drug.expiry_date && (
                                <span>
                                  หมดอายุ: {drug.expiry_date}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="no-drugs-placeholder">
                  <div className="no-drugs-placeholder-icon">💊</div>
                  <h3>
                    ยังไม่มีรายการยาที่กำหนด
                  </h3>
                </div>
              )}
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab={<span>📋 ดำเนินการ</span>} key="4">
            <div className="customer-actions-panel responsive">
              <div className="actions-grid responsive">
                <button className="action-btn green responsive" onClick={handleBack}>
                  <span>← กลับ</span>
                </button>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </main>

      <Footer />

      {/* Status Update Modal */}
      <Modal
        title={
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {statusModal.type === 'received' && '📥 ยืนยันรับข้อมูล'}
            {statusModal.type === 'prepared' && '📦 ยืนยันจัดยาส่งแล้ว'}
            {statusModal.type === 'outOfStock' && '🚨 แจ้งยาหมดสต็อก'}
          </div>
        }
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, type: '', note: '', selectedDrugs: [] })}
        centered
        width={statusModal.type === 'outOfStock' ? 600 : 400}
        footer={[
          <button
            key="cancel"
            onClick={() => setStatusModal({ open: false, type: '', note: '', selectedDrugs: [] })}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            ยกเลิก
          </button>,
          <button
            key="confirm"
            onClick={() => {
              if (statusModal.type === 'outOfStock') {
                if (statusModal.selectedDrugs.length === 0) {
                  toast.error('กรุณาเลือกยาที่หมดสต็อก');
                  return;
                }
                handleReportOutOfStock(statusModal.selectedDrugs, statusModal.note);
              } else {
                handleUpdateStatus(statusModal.type, statusModal.note);
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #52c41a, #73d13d)',
              color: 'white',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            ยืนยัน
          </button>
        ]}
      >
        <div style={{ padding: '20px 0' }}>
          {statusModal.type === 'received' && (
            <p>คุณต้องการยืนยันว่าได้รับข้อมูลลูกค้าแล้วใช่หรือไม่?</p>
          )}
          {statusModal.type === 'prepared' && (
            <p>คุณได้จัดยาส่งไปให้ลูกค้าเรียบร้อยแล้วใช่หรือไม่?</p>
          )}
          {statusModal.type === 'outOfStock' && (
            <div>
              <p style={{ marginBottom: '15px' }}>เลือกยาที่หมดสต็อก:</p>
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid #e8e8e8', 
                borderRadius: '6px',
                padding: '10px'
              }}>
                {customer.prescribed_drugs && customer.prescribed_drugs.length > 0 ? (
                  customer.prescribed_drugs.map((drugItem, index) => {
                    const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                    const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                    const drug = addDrugModal.availableDrugs.find(d => d.documentId === drugId);
                    const isSelected = statusModal.selectedDrugs.includes(drugId);
                    
                    return (
                      <div 
                        key={drugId} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px 0',
                          borderBottom: index < customer.prescribed_drugs.length - 1 ? '1px solid #f0f0f0' : 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStatusModal(prev => ({
                                ...prev,
                                selectedDrugs: [...prev.selectedDrugs, drugId]
                              }));
                            } else {
                              setStatusModal(prev => ({
                                ...prev,
                                selectedDrugs: prev.selectedDrugs.filter(id => id !== drugId)
                              }));
                            }
                          }}
                          style={{ marginRight: '10px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                            {drug ? drug.name_th : 'กำลังโหลด...'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {drug ? drug.name_en : '-'} • จำนวน {quantity}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ textAlign: 'center', color: '#999' }}>ไม่มีรายการยา</p>
                )}
              </div>
              {statusModal.selectedDrugs.length > 0 && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '8px', 
                  background: '#f6ffed', 
                  border: '1px solid #b7eb8f',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#52c41a'
                }}>
                  เลือกแล้ว {statusModal.selectedDrugs.length} รายการ
                </div>
              )}
            </div>
          )}
          
          <textarea
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            value={statusModal.note}
            onChange={(e) => setStatusModal({ ...statusModal, note: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              marginTop: '15px',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              fontSize: '14px'
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

export default CustomerDetailStaff;
