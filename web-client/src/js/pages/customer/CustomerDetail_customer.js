import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
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
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');

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
          const drugs = (drugsData.data || []).map(d => d.attributes || d);
          setAvailableDrugs(drugs);
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

  return (
    <div className="customer-detail-container">
      <ToastContainer />
      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} />
      <main className="main-content">
        <Tabs
          defaultActiveKey="1"
          type="card"
          className="customer-detail-tabs responsive"
        >
          {/* Tab 1: ข้อมูลพื้นฐาน */}
          <Tabs.TabPane tab={<span>📋 ข้อมูลพื้นฐาน</span>} key="1">
            <div className="customer-info-form responsive">
              <div className="essential-info-grid">
                {/* Card 1: ข้อมูลติดต่อ */}
                <div className="info-card">
                  <div className="info-card-header">
                    <span className="info-card-icon">👤</span>
                    <h3>ข้อมูลติดต่อ</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="info-row">
                      <label>ชื่อ-นามสกุล:</label>
                      <span>{customerData.users_permissions_user?.full_name || customerData.full_name || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
                      <label>เบอร์โทรศัพท์:</label>
                      <span>{customerData.users_permissions_user?.phone || customerData.phone || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
                      <label>อีเมล:</label>
                      <span>{customerData.users_permissions_user?.email || customerData.email || 'ไม่มีข้อมูล'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: ข้อมูลสำคัญ */}
                <div className="info-card">
                  <div className="info-card-header">
                    <span className="info-card-icon">⚠️</span>
                    <h3>ข้อมูลสำคัญ</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="info-row">
                      <label>ยาที่แพ้:</label>
                      <span className="text-warning">{customerData.Allergic_drugs || 'ไม่มีข้อมูล'}</span>
                    </div>
                    <div className="info-row">
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
            <div className="symptoms-followup-panel responsive">
              {/* อาการปัจจุบัน */}
              <div className="symptom-section">
                <div className="symptom-section-header">
                  <h3 className="section-title">🩺 อาการปัจจุบัน</h3>
                </div>
                
                <div className="symptom-card">
                  {customerData.Customers_symptoms ? (
                    <div className="symptom-main">
                      <div className="symptom-display">
                        {customerData.Customers_symptoms}
                      </div>
                    </div>
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
                        {customerData.Follow_up_appointment_date ? formatThaiDate(customerData.Follow_up_appointment_date) : 'ยังไม่ได้กำหนด'}
                      </span>
                    </div>
                  </div>
                  {customerData.Follow_up_appointment_date && (
                    <div className="appointment-status">
                      <div className={`status-badge ${new Date(customerData.Follow_up_appointment_date) > new Date() ? 'upcoming' : 'overdue'}`}>
                        {new Date(customerData.Follow_up_appointment_date) > new Date() ? '📋 กำหนดการ' : '⚠️ ครบกำหนด'}
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
                      <p>{customerData.Allergic_drugs || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                  <div className="alert-card disease">
                    <div className="alert-icon">🏥</div>
                    <div className="alert-content">
                      <h4>โรคประจำตัว</h4>
                      <p>{customerData.congenital_disease || 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.TabPane>

          {/* Tab 3: รายการยา */}
          <Tabs.TabPane tab={<span>💊 รายการยา <span className="tab-badge">{customerData?.prescribed_drugs?.length || 0}</span></span>} key="3">
            <div className="customer-actions-panel responsive">
              <div className="actions-header responsive">
                <h2>รายการยาที่ต้องใช้</h2>
              </div>

              {customerData.prescribed_drugs && customerData.prescribed_drugs.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <div className="prescribed-drugs-header">
                    <div className="prescribed-drugs-info">
                      <span className="prescribed-drugs-icon">💊</span>
                      <div>
                        <h3 className="prescribed-drugs-title">ยาที่กำหนดแล้ว:</h3>
                        <p className="prescribed-drugs-patient">
                          {customerData.users_permissions_user?.full_name || customerData.full_name || 'ผู้ป่วย'}
                        </p>
                      </div>
                    </div>
                    <div className="prescribed-drugs-count">
                      {customerData.prescribed_drugs.length} รายการ
                    </div>
                  </div>
                  
                  <div className="prescribed-drugs-grid">
                    {customerData.prescribed_drugs.map((drugItem, index) => {
                      const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
                      const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                      const drug = availableDrugs.find(d => d.documentId === drugId || d.id === drugId);
                      
                      return (
                        <div key={drugId || index} className="prescribed-drug-card-individual">
                          <div className="prescribed-drug-quantity-badge">
                            จำนวน {quantity}
                          </div>

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

                          {drug && drug.description && (
                            <div className="prescribed-drug-description">
                              <p>{drug.description}</p>
                            </div>
                          )}

                          {/* Lot details Removed - customers should not see batch/lot info */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="no-drugs-placeholder">
                  <div className="no-drugs-placeholder-icon">💊</div>
                  <h3>ยังไม่มีรายการยาที่กำหนด</h3>
                </div>
              )}
            </div>
          </Tabs.TabPane>

          {/* Tab 4: ดำเนินการ */}
          <Tabs.TabPane tab={<span>📋 ดำเนินการ</span>} key="4">
            <div className="customer-actions-panel">
              <div className="actions-grid">
                <button 
                  className="action-btn green responsive" 
                  onClick={handleBack}
                >
                  ← กลับไปหน้าหลัก
                </button>
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
