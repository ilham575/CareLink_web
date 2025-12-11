import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/component/CustomerCard.css';
import '../../../css/component/ModernCustomerCard.css';
import '../../../css/pages/staff/staffCustomerPage.css';
import dayjs from 'dayjs';
import { API } from '../../../utils/apiConfig';

function CustomerPageStaff() {
  const { id: pharmacyId } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const userDocumentId = localStorage.getItem('user_documentId');

        if (!userDocumentId) {
          toast.error('ไม่พบข้อมูลผู้ใช้');
          return;
        }

        // โหลดข้อมูล staff profile เพื่อเอา documentId
        const staffRes = await fetch(
          API.staffProfiles.list(`filters[users_permissions_user][documentId][$eq]=${userDocumentId}&filters[drug_store][documentId][$eq]=${pharmacyId}`),
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );

        if (!staffRes.ok) throw new Error('ไม่สามารถโหลดข้อมูล Staff ได้');

        const staffData = await staffRes.json();
        const staffProfile = staffData.data?.[0];

        if (!staffProfile) {
          toast.error('ไม่พบข้อมูล Staff Profile');
          return;
        }

        // โหลด notifications ที่ส่งมาให้พนักงานคนนี้
        // ใช้ populate=* ชั่วคราวเพื่อหลีกเลี่ยงปัญหา ValidationError ของคีย์
        const notifRes = await fetch(
          API.notifications.list(`filters[staff_profile][documentId][$eq]=${staffProfile.documentId}&filters[type][$eq]=customer_assignment&populate=*`),
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifications(notifData.data || []);

          // Extract unique customers from notifications
          const customerMap = new Map();
          (notifData.data || []).forEach(notif => {
            const customerProfile = notif.customer_profile;

            if (customerProfile && customerProfile.documentId) {
              customerMap.set(customerProfile.documentId, {
                ...customerProfile,
                notification: notif // เก็บ notification ไว้ใช้ดูสถานะ
              });
              return;
            }

            // ถ้า notification ไม่มีความสัมพันธ์กับ customer_profile ให้สร้างรายการชั่วคราวจาก notif.data
            const d = notif.data || {};
            const generatedId = `notif_${notif.documentId || notif.id}`;
            
            // พยายาม parse ชื่อจาก message ถ้าไม่มีใน data
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

            customerMap.set(generatedId, {
              documentId: generatedId,
              users_permissions_user: userObj,
              Customers_symptoms: d.symptoms || '',
              Allergic_drugs: d.allergy || '',
              congenital_disease: d.disease || '',
              Follow_up_appointment_date: d.follow_up_date || d.appointment_date || null,
              notification: notif,
              _fromNotificationOnly: true
            });
          });

          setCustomers(Array.from(customerMap.values()));
        }

        // โหลดข้อมูลร้านยา
        const pharmacyRes = await fetch(
          `${API.drugStores.delete(pharmacyId)}`,
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );

        if (pharmacyRes.ok) {
          const pharmacyData = await pharmacyRes.json();
          setPharmacy(pharmacyData.data);
        }

      } catch (error) {
        console.error('Error loading data:', error);
        toast.error(error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [pharmacyId]);

  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true;
    const user = customer.users_permissions_user;
    const fullName = user?.full_name || '';
    const phone = user?.phone || '';
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           phone.includes(searchTerm);
  });

  const handleViewDetail = (customer) => {
    navigate(`/staff/customer_detail/${customer.documentId}?pharmacyId=${pharmacyId}`);
  };

  const formatThaiDate = (dateStr) => {
    if (!dateStr) return 'ไม่มีวันนัด';
    const d = dayjs(dateStr);
    if (!d.isValid()) return 'ไม่มีวันนัด';
    const months = [
      '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return `${d.date()} ${months[d.month() + 1]} ${d.year() + 543}`;
  };

  if (loading) {
    return (
      <div className="customer-page">
        <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
        <main className="customer-main">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div className="loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="customer-page">
      <ToastContainer />
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      
      <main className="customer-main">
        <div className="customer-header">
          <h2>📋 ข้อมูลลูกค้าที่ได้รับมอบหมาย</h2>
          <div className="customer-actions">
            <button 
              className="btn-back"
              onClick={() => navigate(`/staffHome`)}
            >
              ← กลับ
            </button>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อหรือเบอร์โทร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>ยังไม่มีลูกค้าที่ได้รับมอบหมาย</h3>
            <p>เมื่อเภสัชกรส่งข้อมูลลูกค้ามาให้ จะแสดงที่นี่</p>
          </div>
        ) : (
          <div className="customer-grid">
            {filteredCustomers.map(customer => {
              const notification = customer.notification;
              const notifData = notification?.data || {};

              // Normalize user object from various shapes
              const user = (
                customer.users_permissions_user?.data?.attributes ||
                customer.attributes?.users_permissions_user?.data?.attributes ||
                customer.users_permissions_user?.attributes ||
                customer.users_permissions_user ||
                {}
              );

              const customerDocumentId = customer.documentId || customer.attributes?.documentId || null;
              const userId = (
                customer.users_permissions_user?.data?.id ||
                customer.attributes?.users_permissions_user?.data?.id ||
                customer.users_permissions_user?.id ||
                customer.attributes?.users_permissions_user?.id ||
                null
              );

              const customerName = user?.full_name || 'ลูกค้า';
              const followUpDate = customer.Follow_up_appointment_date || customer.attributes?.Follow_up_appointment_date || null;

              return (
                <div className="modern-customer-card" key={customerDocumentId || customer.id || Math.random()}>
                  <div className="card-header">
                    <div className="customer-avatar-modern">
                      <div className="avatar-circle">
                        {(user?.full_name?.charAt(0) || 'C').toUpperCase()}
                      </div>
                      <div className="customer-status-badge active">●</div>
                    </div>
                    <div className="customer-basic-info">
                      <h3 className="customer-name-modern">
                        {(() => {
                          let displayName = user?.full_name || 'ไม่พบชื่อ';
                          if (displayName === 'ไม่พบชื่อ' && notification?.message) {
                            const match = notification.message.match(/ได้รับมอบหมายดูแลผู้ป่วย:\s*([^\n]+)/);
                            if (match) {
                              displayName = match[1].trim();
                            }
                          }
                          return displayName;
                        })()}
                      </h3>
                      <p className="customer-username">@{user?.username || 'staff'}</p>
                    </div>
                  </div>

                  <div className="card-content">
                    <div className="info-grid">
                      {(customer.congenital_disease || customer.attributes?.congenital_disease) && (
                        <div className="info-item medical">
                          <div className="info-icon medical">🏥</div>
                          <div className="info-text">
                            <span className="info-label">โรคประจำตัว</span>
                            <span className="info-value">{customer.congenital_disease || customer.attributes?.congenital_disease}</span>
                          </div>
                        </div>
                      )}

                      {(customer.Allergic_drugs || customer.attributes?.Allergic_drugs || notifData.allergy) && (
                        <div className="info-item allergy">
                          <div className="info-icon allergy">⚠️</div>
                          <div className="info-text">
                            <span className="info-label">ยาที่แพ้</span>
                            <span className="info-value">{notifData.allergy || customer.Allergic_drugs || customer.attributes?.Allergic_drugs}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {followUpDate && (
                      <div className="appointment-section">
                        <div className="appointment-badge">
                          <span className="appointment-icon">📅</span>
                          <span className="appointment-text">นัดครั้งถัดไป: <strong>{formatThaiDate(followUpDate)}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <button
                      className="btn-modern btn-primary"
                      onClick={() => {
                        if (!customerDocumentId) {
                          toast.error('ไม่พบข้อมูลลูกค้า ไม่สามารถดูรายละเอียดได้');
                          return;
                        }
                        navigate(`/staff/customer_detail/${customerDocumentId}?pharmacyId=${pharmacyId}`);
                      }}
                    >
                      <span className="btn-icon">👁️</span>
                      <span className="btn-text">ดูรายละเอียด</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}

export default CustomerPageStaff;
