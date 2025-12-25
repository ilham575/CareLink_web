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
        setVisits(notifData.data || []);
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

  return (
    <div className="visit-history-page">
      <HomeHeader pharmacyName={pharmacy?.name_th || ''} />
      
      <main className="visit-history-main">
        {/* Customer Header */}
        <div className="customer-header" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>
                👤 {user?.full_name || 'ไม่พบชื่อ'}
              </h2>
              <p style={{ margin: '0', opacity: 0.9 }}>
                📱 {user?.phone || '-'} | 
                ⚠️ แพ้ยา: {customer.Allergic_drugs ? 'มี' : 'ไม่มี'} | 
                🏥 โรคประจำตัว: {customer.congenital_disease || 'ไม่มี'}
              </p>
            </div>
            <button
              onClick={handleCreateNewVisit}
              style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid white',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'white' && (e.target.style.color = '#667eea')}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)' && (e.target.style.color = 'white')}
            >
              ➕ บันทึกการมาใหม่
            </button>
          </div>
        </div>

        {/* Visit History Timeline */}
        <div className="visits-container" style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>
            📋 ประวัติการมาใช้บริการ ({visits.length} ครั้ง)
          </h3>
          
          {visits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <p>ยังไม่มีประวัติการมาใช้บริการ</p>
              <button
                onClick={handleCreateNewVisit}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                บันทึกการมาครั้งแรก
              </button>
            </div>
          ) : (
            <Timeline mode="left">
              {visits.map((visit, index) => {
                const visitData = visit.data || {};
                const symptoms = visitData.symptoms || visitData.Customers_symptoms || 'ไม่ระบุอาการ';
                const drugs = visitData.prescribed_drugs || [];
                const staffWorkStatus = visit.staff_work_status || {};
                
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
                  <Timeline.Item
                    key={visit.id}
                    color={statusColor}
                    label={
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {formatThaiDate(visit.createdAt)}
                      </div>
                    }
                  >
                    <div style={{
                      padding: '16px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      border: '1px solid #e8e8e8'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                            🩺 ครั้งที่ {visits.length - index}
                          </h4>
                          <Tag color={statusColor}>{statusText}</Tag>
                        </div>
                        <button
                          onClick={() => handleViewDetail(visit)}
                          style={{
                            padding: '6px 12px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ดูรายละเอียด
                        </button>
                      </div>
                      
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>อาการ:</strong> {symptoms}
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>จำนวนยา:</strong> {Array.isArray(drugs) ? drugs.length : 0} รายการ
                        </div>
                        {visit.staff_profile && (
                          <div>
                            <strong>เจ้าหน้าที่:</strong> {visit.staff_profile.full_name || '-'}
                          </div>
                        )}
                      </div>
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          )}
        </div>
      </main>

      <Footer />

      {/* Visit Detail Modal */}
      <Modal
        title={
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            📋 รายละเอียดการมาใช้บริการ
          </div>
        }
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <button
            key="close"
            onClick={() => setDetailModal(false)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            ปิด
          </button>
        ]}
        width={700}
      >
        {selectedVisit && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>วันที่มาใช้บริการ</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {formatThaiDate(selectedVisit.createdAt)}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>อาการ</div>
              <div style={{ fontSize: '14px', padding: '12px', background: '#f0f5ff', borderRadius: '6px' }}>
                {selectedVisit.data?.symptoms || selectedVisit.data?.Customers_symptoms || 'ไม่ระบุอาการ'}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>รายการยา</div>
              {selectedVisit.data?.prescribed_drugs && selectedVisit.data.prescribed_drugs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedVisit.data.prescribed_drugs.map((drug, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        background: '#fafafa',
                        borderRadius: '6px',
                        border: '1px solid #e8e8e8'
                      }}
                    >
                      💊 {typeof drug === 'string' ? drug : `${drug.name || 'ยา'} (จำนวน ${drug.quantity || 1})`}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px', color: '#999', textAlign: 'center' }}>
                  ไม่มีรายการยา
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>สถานะการทำงาน</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedVisit.staff_work_status?.received && (
                  <Tag color="blue">✅ รับข้อมูลแล้ว</Tag>
                )}
                {selectedVisit.staff_work_status?.prepared && (
                  <Tag color="green">📦 จัดส่งแล้ว</Tag>
                )}
                {selectedVisit.staff_work_status?.cancelled && (
                  <Tag color="red">❌ ยกเลิก</Tag>
                )}
                {!selectedVisit.staff_work_status?.received && (
                  <Tag color="default">⏳ รอดำเนินการ</Tag>
                )}
              </div>
            </div>

            {selectedVisit.staff_profile && (
              <div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>เจ้าหน้าที่</div>
                <div style={{ fontSize: '14px' }}>
                  👤 {selectedVisit.staff_profile.full_name || '-'}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default VisitHistory;
