import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/detail_customer.css';
import 'react-toastify/dist/ReactToastify.css';

function CustomerDetail() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState(null);
  
  // Get pharmacyId from URL params
  const searchParams = new URLSearchParams(location.search);
  const pharmacyId = searchParams.get('pharmacyId');

  useEffect(() => {
    const loadCustomerData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        
        // Load customer data
        const customerRes = await fetch(
          `http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
          {
            headers: { Authorization: token ? `Bearer ${token}` : "" }
          }
        );
        
        if (!customerRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
        
        const customerData = await customerRes.json();
        setCustomer(customerData.data);
        
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

  const handleEdit = () => {
    navigate(`/form_customer?documentId=${customerDocumentId}&pharmacyId=${pharmacy?.documentId || pharmacyId}`);
  };

  const handleBack = () => {
    if (pharmacy?.documentId || pharmacyId) {
      navigate(`/drug_store_pharmacy/${pharmacy?.documentId || pharmacyId}/followup-customers`);
    } else {
      navigate(-1);
    }
  };

  // Helper: get pharmacist name from pharmacy object
  const getPharmacistName = (pharmacyObj) => {
    if (!pharmacyObj) return '';
    // ปรับ field ตาม schema จริง ถ้าไม่ใช่ pharmacist_name ให้เปลี่ยน
    return pharmacyObj.pharmacist_name || pharmacyObj.attributes?.pharmacist_name || '';
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

  return (
    <div className="customer-detail-page">
      <ToastContainer />
      <HomeHeader 
        pharmacyName={pharmacy?.name_th || pharmacy?.attributes?.name_th || ''}
        pharmacistName={getPharmacistName(pharmacy)}
      />
      
      <main className="customer-detail-main">
        <div className="customer-detail-layout">
          
          {/* Left Panel - Customer Information Form */}
          <div className="customer-info-form">
            {/* Header Section */}
            <div className="form-header-section">
              <h2 className="form-title">ข้อมูลลูกค้า</h2>
              <div className="customer-avatar-section">
                <div className="customer-avatar-large">
                  {(user?.full_name?.charAt(0) || 'C').toUpperCase()}
                </div>
                <div className="customer-meta">
                  <h3>{user?.full_name || 'ไม่พบชื่อ'}</h3>
                  <p>@{user?.username || 'user'}</p>
                </div>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="form-section">
              <h4 className="section-title">ข้อมูลส่วนตัว</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>ชื่อ</label>
                  <div className="form-display">
                    {user?.full_name?.split(' ')[0] || 'ไม่มีข้อมูล'}
                  </div>
                </div>
                <div className="form-group">
                  <label>นามสกุล</label>
                  <div className="form-display">
                    {user?.full_name?.split(' ').slice(1).join(' ') || 'ไม่มีข้อมูล'}
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label>เบอร์โทรศัพท์</label>
                  <div className="form-display">
                    {user?.phone || 'ไม่มีข้อมูล'}
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Information Section */}
            <div className="form-section">
              <h4 className="section-title">ข้อมูลทางการแพทย์</h4>
              
              <div className="form-row">
                <div className="form-group full-width">
                  <label>โรคประจำตัว</label>
                  <div className="form-display">
                    {customer.congenital_disease || 'ไม่มีข้อมูล'}
                    {customer.congenital_disease && (
                      <button className="edit-btn-inline">รายละเอียด</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>ยาที่แพ้</label>
                  <div className="form-display">
                    {customer.Allergic_drugs || 'ไม่มีข้อมูล'}
                    {customer.Allergic_drugs && (
                      <button className="edit-btn-inline">รายละเอียด</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>อาการ</label>
                  <div className="form-display">
                    {customer.Customers_symptoms || 'ไม่มีข้อมูล'}
                    {customer.Customers_symptoms && (
                      <button className="edit-btn-inline">รายละเอียด</button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Appointment Section */}
            <div className="form-section">
              <h4 className="section-title">การนัดหมาย</h4>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>วันนัดติดตามอาการ</label>
                  <div className="form-display">
                    {customer.Follow_up_appointment_date || 'ไม่มีข้อมูล'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Actions Grid */}
          <div className="customer-actions-panel">
            <div className="actions-header">
              <h2>รายการยาที่ต้องใช้</h2>
              <button className="btn-add">เพิ่มยา</button>
            </div>

            <div className="actions-grid">
              <button className="action-btn green">
                <span>พิมพ์บัตรแพ้ยา</span>
              </button>

              <button className="action-btn green">
                <span>เพิ่มวันนัดติดตามอาการ</span>
              </button>

              <button className="action-btn green">
                <span>ส่งข้อมูลให้พนักงาน</span>
              </button>

              <button className="action-btn green">
                <span>ใส่ส่งต่อร้านยา</span>
              </button>

              <button className="action-btn green" onClick={handleEdit}>
                <span>แก้ไข</span>
              </button>

              <button className="action-btn green" onClick={handleBack}>
                <span>กลับ</span>
              </button>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default CustomerDetail;