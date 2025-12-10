import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/customer/detail_customer_view.css';
import 'react-toastify/dist/ReactToastify.css';
import { Tabs } from 'antd';
import dayjs from 'dayjs';
import { API } from '../../../utils/apiConfig';

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

function CustomerDetailCustomer() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableDrugs, setAvailableDrugs] = useState([]);
  const [drugsLoaded, setDrugsLoaded] = useState(false);
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  // temporary state removed; we use antd modal textarea value instead

  useEffect(() => {
    const loadCustomerData = async () => {
      try {
        // ดึงข้อมูล customer profile
        const token = localStorage.getItem('jwt');
        const customerRes = await fetch(
          API.customerProfiles.getByIdBasic(customerDocumentId),
          { headers: { Authorization: token ? `Bearer ${token}` : "" } }
        );
        
        if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
        
        const customerData = await customerRes.json();
        setCustomer(customerData.data);

        // ดึงชื่อร้านยาและเภสัชกรที่ติดตามอาการ
        const custAttrs = customerData.data?.attributes || customerData.data;
        console.log('🔍 Customer data:', custAttrs);
        
        // drug_stores อยู่ที่ custAttrs.drug_stores โดยตรง (ไม่ใช่ .data)
        if (custAttrs?.drug_stores && custAttrs.drug_stores.length > 0) {
          const store = custAttrs.drug_stores[0].attributes || custAttrs.drug_stores[0];
          console.log('🏪 Store data:', store);
          setPharmacyName(store.name_th || '');

          // ดึงชื่อเภสัชกรจาก pharmacy_profiles ของร้าน
          if (store?.pharmacy_profiles && store.pharmacy_profiles.length > 0) {
            const profile = store.pharmacy_profiles[0].attributes || store.pharmacy_profiles[0];
            console.log('👤 Profile data:', profile);
            const user = profile?.users_permissions_user?.data?.attributes || profile?.users_permissions_user;
            const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : (profile?.full_name || '');
            setPharmacistName(name);
            console.log('✅ Pharmacy name:', store.name_th, 'Pharmacist name:', name);
          }
        } else {
          console.log('⚠️ No drug_stores found');
        }

        // ดึงรายการยาทั้งหมด
        const drugsRes = await fetch(
          API.drugs.listWithBatches(),
          { headers: { Authorization: token ? `Bearer ${token}` : "" } }
        );
        
        if (drugsRes.ok) {
          const drugsData = await drugsRes.json();
          // API returns flat data structure with all properties directly on the object
          const drugs = (drugsData.data || []).map(d => ({
            id: d.id,
            documentId: d.documentId,
            name_th: d.name_th,
            name_en: d.name_en,
            price: d.price,
            description: d.description,
            drug_batches: d.drug_batches,
            drug_store: d.drug_store
          }));
          console.log('✅ Drugs mapped successfully:', drugs.length, 'items');
          if (drugs.length > 0) {
            console.log('✅ First drug:', drugs[0]);
          }
          setAvailableDrugs(drugs);
          setDrugsLoaded(true);
        } else {
          console.warn('⚠️ Failed to fetch drugs');
          setDrugsLoaded(true);
        }

      } catch (e) {
        console.error('❌ Error fetching data:', e);
        toast.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };

    loadCustomerData();
  }, [customerDocumentId]);

  const handleBack = () => {
    navigate('/customerHome');
  };

  const handleOpenEditSymptoms = () => {
    // Navigate the user to the Edit Symptoms page for this customer
    // Pass availableDrugs via state so it can be used in the modal
    navigate(`/customer/edit_symptoms/${customerDocumentId}`, { 
      state: { availableDrugs } 
    });
  };

  // Delete feature removed per request

  if (loading) {
    return (
      <div className="app-container">
        <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="main-content">
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            กำลังโหลดข้อมูล...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="app-container">
        <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
        <main className="main-content">
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#999' }}>
            ไม่พบข้อมูลลูกค้า
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const customerData = customer.attributes || customer;
  const user = customerData.users_permissions_user;

  return (
    <div className="cust-detail-container">
      {/* Global ToastContainer in App.js */}
      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
      <main className="cust-main-content">
        {/* Header Summary - แสดงข้อมูลสำคัญ */}
        <div className="cust-header-summary">
          <div className="cust-header-avatar">
            {user?.full_name?.charAt(0)?.toUpperCase() || customerData.full_name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div className="cust-header-info">
            <h1 className="cust-header-name">{user?.full_name || customerData.full_name || 'ไม่พบชื่อ'}</h1>
            <div className="cust-header-meta">
              <span className="cust-meta-item">📞 {user?.phone || customerData.phone || 'ไม่ระบุเบอร์'}</span>
              {customerData.Follow_up_appointment_date && (
                <span className="cust-meta-item">📅 นัดถัดไป: {formatThaiDate(customerData.Follow_up_appointment_date)}</span>
              )}
            </div>
            {pharmacyName && (
              <div className="cust-header-pharmacy">
                <span>🏥 ร้านยา: {pharmacyName}</span>
                {pharmacistName && <span className="cust-pharmacist">👨‍⚕️ เภสัชกร: {pharmacistName}</span>}
              </div>
            )}
          </div>
          <div className="cust-header-stats">
            <div className="cust-stat-box">
              <span className="cust-stat-value">{customerData.prescribed_drugs?.length || 0}</span>
              <span className="cust-stat-label">รายการยา</span>
            </div>
            {customerData.Allergic_drugs && (
              <div className="cust-stat-box warning">
                <span className="cust-stat-icon">⚠️</span>
                <span className="cust-stat-label">มียาที่แพ้</span>
              </div>
            )}
          </div>
        </div>

        <Tabs
          defaultActiveKey="1"
          type="card"
          className="cust-detail-tabs"
        >
          {/* Tab 1: ข้อมูลพื้นฐาน */}
          <Tabs.TabPane tab={<span>📋 ข้อมูลพื้นฐาน</span>} key="1">
            <div className="cust-info-form">
              <div className="cust-info-grid">
                {/* Card 1: ข้อมูลติดต่อ */}
                <div className="cust-info-card">
                  <div className="cust-info-card-header">
                    <span className="cust-info-card-icon">👤</span>
                    <h3>ข้อมูลติดต่อ</h3>
                  </div>
                  <div className="cust-info-card-content">
                    <div className="cust-info-row">
                      <label>ชื่อ-นามสกุล:</label>
                      <span>{customerData.users_permissions_user?.full_name || customerData.full_name || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="cust-info-row">
                      <label>เบอร์โทรศัพท์:</label>
                      <span>{customerData.users_permissions_user?.phone || customerData.phone || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="cust-info-row">
                      <label>อีเมล:</label>
                      <span>{customerData.users_permissions_user?.email || customerData.email || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: ข้อมูลสำคัญ */}
                <div className="cust-info-card">
                  <div className="cust-info-card-header">
                    <span className="cust-info-card-icon">⚠️</span>
                    <h3>ข้อมูลสำคัญ</h3>
                  </div>
                  <div className="cust-info-card-content">
                    <div className="cust-info-row">
                      <label>ยาที่แพ้:</label>
                      <span className="cust-text-warning">{customerData.Allergic_drugs || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="cust-info-row">
                      <label>โรคประจำตัว:</label>
                      <span>{customerData.congenital_disease || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          {/* Tab 2: อาการและการติดตาม */}
          <Tabs.TabPane tab={<span>🩺 อาการและการติดตาม</span>} key="2">
            <div className="cust-symptoms-panel">
              {/* อาการปัจจุบัน */}
              <div className="cust-symptom-section">
                <div className="cust-symptom-header">
                  <h3 className="cust-section-title">🩺 อาการปัจจุบัน</h3>
                </div>
                
                <div className="cust-symptom-card">
                  {customerData.Customers_symptoms ? (
                    <div className="cust-symptom-main">
                      <div className="cust-symptom-display">
                        {customerData.Customers_symptoms}
                      </div>
                    </div>
                  ) : (
                    <div className="cust-symptom-empty">
                      <div className="cust-symptom-empty-icon">📝</div>
                      <h4>ไม่มีข้อมูลอาการ</h4>
                    </div>
                  )}
                </div>
              </div>

              {/* การนัดติดตาม */}
              <div className="cust-followup-section">
                <h3 className="cust-section-title">📅 การนัดติดตาม</h3>
                <div className="cust-followup-card">
                  <div className="cust-appointment">
                    <div className="cust-appointment-info">
                      <span className="cust-appointment-label">วันนัดติดตามอาการ:</span>
                      <span className="cust-appointment-date">
                        {customerData.Follow_up_appointment_date ? formatThaiDate(customerData.Follow_up_appointment_date) : 'ยังไม่ได้กำหนด'}
                      </span>
                    </div>
                  </div>
                  {customerData.Follow_up_appointment_date && (
                    <div className="cust-appointment-status">
                      <div className={`cust-status-badge ${new Date(customerData.Follow_up_appointment_date) > new Date() ? 'upcoming' : 'overdue'}`}>
                        {new Date(customerData.Follow_up_appointment_date) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ข้อมูลเตือนสำคัญ */}
              <div className="cust-alert-section">
                <h3 className="cust-section-title">⚠️ ข้อมูลสำคัญที่ต้องระวัง</h3>
                <div className="cust-alert-grid">
                  <div className="cust-alert-card allergy">
                    <div className="cust-alert-icon">🚫</div>
                    <div className="cust-alert-content">
                      <h4>ยาที่แพ้</h4>
                      <p>{customerData.Allergic_drugs || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                  <div className="cust-alert-card disease">
                    <div className="cust-alert-icon">🏥</div>
                    <div className="cust-alert-content">
                      <h4>โรคประจำตัว</h4>
                      <p>{customerData.congenital_disease || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          {/* Tab 3: รายการยา */}
          <Tabs.TabPane tab={<span>💊 รายการยา <span className="cust-tab-badge">{customerData?.prescribed_drugs?.length || 0}</span></span>} key="3">
            <div className="cust-drugs-panel">
              {customerData.prescribed_drugs && customerData.prescribed_drugs.length > 0 ? (
                <>
                  <div className="cust-drugs-header">
                    <div className="cust-drugs-info">
                      <span className="cust-drugs-icon">💊</span>
                      <div>
                        <h3 className="cust-drugs-title">รายการยาที่กำหนด</h3>
                        <p className="cust-drugs-patient">
                          {user?.full_name || customerData.full_name || 'ผู้ป่วย'}
                        </p>
                      </div>
                    </div>
                    <div className="cust-drugs-count">
                      {customerData.prescribed_drugs.length}
                    </div>
                  </div>
                  
                  <div className="cust-drugs-grid">
                    {customerData.prescribed_drugs.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                      const drug = availableDrugs.find(d => d.documentId === drugId || d.id === drugId);
                      
                      return (
                        <div key={drugId || index} className="cust-drug-card">
                          <div className="cust-drug-qty-badge">
                            x{quantity}
                          </div>

                          <div className="cust-drug-header">
                            <div className="cust-drug-icon">
                              Rx
                            </div>
                            <div className="cust-drug-info">
                              <h4 className="cust-drug-name">
                                {drug ? drug.name_th : 'กำลังโหลด...'}
                              </h4>
                              <p className="cust-drug-name-en">
                                {drug ? drug.name_en : '-'}
                              </p>
                              {drug && drug.price && (
                                <div className="cust-drug-price">
                                  ฿{drug.price}
                                </div>
                              )}
                            </div>
                          </div>

                          {drug && drug.description && (
                            <div className="cust-drug-desc">
                              <p>{drug.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="cust-no-drugs">
                  <div className="cust-no-drugs-icon">💊</div>
                  <h3>ยังไม่มีรายการยาที่กำหนด</h3>
                </div>
              )}
            </div>
          </Tabs.TabPane>

          {/* Tab 4: ดำเนินการ */}
          <Tabs.TabPane tab={<span>📋 ดำเนินการ</span>} key="4">
            <div className="cust-actions-panel">
              <div className="cust-actions-grid">
                    <button 
                      className="cust-action-btn" 
                      onClick={handleBack}
                    >
                      ← กลับไปหน้าหลัก
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        type="button" 
                        className="cust-action-btn" 
                        onClick={handleOpenEditSymptoms}
                        disabled={!drugsLoaded}
                        title={!drugsLoaded ? 'กำลังโหลดข้อมูลยา...' : 'คลิกเพื่ออัพเดตอาการ'}
                      >
                        {!drugsLoaded ? '⏳ กำลังโหลด...' : 'อัพเดตอาการ'}
                      </button>
                    </div>
                  </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}

export default CustomerDetailCustomer;
