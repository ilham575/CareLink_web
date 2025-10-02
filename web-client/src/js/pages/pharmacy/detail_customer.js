import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/pharmacy/detail_customer.css';
import 'react-toastify/dist/ReactToastify.css';
import { Modal, DatePicker } from 'antd';
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

function CustomerDetail() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [medicalModal, setMedicalModal] = useState({ open: false, title: '', icon: '', value: '' });
  const [editMedicalModal, setEditMedicalModal] = useState({ open: false, type: '', label: '', value: '' });
  const [editSymptomModal, setEditSymptomModal] = useState({
    open: false,
    main: '',
    history: '',
    note: ''
  });
  const userRole = localStorage.getItem('role');
  
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

  const handleOpenAppointmentModal = () => {
    setAppointmentDate(customer?.Follow_up_appointment_date || null);
    setIsAppointmentModalOpen(true);
  };

  const handleSaveAppointment = async () => {
    if (!appointmentDate) {
      toast.error('กรุณาเลือกวันนัดติดตามอาการ');
      return;
    }
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`http://localhost:1337/api/customer-profiles/${customerDocumentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Follow_up_appointment_date: appointmentDate
          }
        })
      });
      if (!res.ok) throw new Error('บันทึกวันนัดไม่สำเร็จ');
      toast.success('บันทึกวันนัดติดตามอาการสำเร็จ');
      setIsAppointmentModalOpen(false);
      // refresh customer data
      const customerRes = await fetch(
        `http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteAppointment = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`http://localhost:1337/api/customer-profiles/${customerDocumentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Follow_up_appointment_date: null
          }
        })
      });
      if (!res.ok) throw new Error('ลบวันนัดไม่สำเร็จ');
      toast.success('ลบวันนัดติดตามอาการสำเร็จ');
      setIsAppointmentModalOpen(false);
      // refresh customer data
      const customerRes = await fetch(
        `http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const openMedicalModal = (type) => {
    let title = '';
    let icon = '';
    let value = '';
    let extra = null;
    if (type === 'disease') {
      title = 'โรคประจำตัว';
      icon = '🏥';
      value = customer.congenital_disease || '-';
    } else if (type === 'allergy') {
      title = 'ยาที่แพ้';
      icon = '⚠️';
      value = customer.Allergic_drugs || '-';
    } else if (type === 'symptom') {
      title = 'อาการ';
      icon = '🩺';
      // สมมุติ field ใน customer: symptom_main, symptom_history, symptom_note
      const main = customer.symptom_main || customer.Customers_symptoms || '-';
      const history = customer.symptom_history || '-';
      const note = customer.symptom_note || '-';
      extra = { main, history, note };
      value = '';
    }
    setMedicalModal({ open: true, title, icon, value, extra });
  };

  const openEditMedicalModal = (type) => {
    let label = '';
    let value = '';
    if (type === 'disease') {
      label = 'โรคประจำตัว';
      value = customer.congenital_disease || '';
    } else if (type === 'allergy') {
      label = 'ยาที่แพ้';
      value = customer.Allergic_drugs || '';
    }
    setEditMedicalModal({ open: true, type, label, value });
  };

  // เปิด modal แก้ไขอาการ
  const openEditSymptomModal = () => {
    setEditSymptomModal({
      open: true,
      main: customer.Customers_symptoms || '',
      history: customer.symptom_history || '',
      note: customer.symptom_note || ''
    });
  };

  const handleSaveEditMedical = async () => {
    try {
      const token = localStorage.getItem('jwt');
      let updateData = {};
      if (editMedicalModal.type === 'disease') {
        updateData = { congenital_disease: editMedicalModal.value };
      } else if (editMedicalModal.type === 'allergy') {
        updateData = { Allergic_drugs: editMedicalModal.value };
      }
      const res = await fetch(`http://localhost:1337/api/customer-profiles/${customerDocumentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data: updateData })
      });
      if (!res.ok) throw new Error('บันทึกข้อมูลไม่สำเร็จ');
      toast.success('บันทึกข้อมูลสำเร็จ');
      setEditMedicalModal({ ...editMedicalModal, open: false });
      // refresh customer data
      const customerRes = await fetch(
        `http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // ฟังก์ชันบันทึกอาการ
  const handleSaveEditSymptom = async () => {
    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`http://localhost:1337/api/customer-profiles/${customerDocumentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            Customers_symptoms: editSymptomModal.main,
            symptom_history: editSymptomModal.history,
            symptom_note: editSymptomModal.note
          }
        })
      });
      if (!res.ok) throw new Error('บันทึกข้อมูลไม่สำเร็จ');
      toast.success('บันทึกข้อมูลสำเร็จ');
      setEditSymptomModal({ ...editSymptomModal, open: false });
      // refresh customer data
      const customerRes = await fetch(
        `http://localhost:1337/api/customer-profiles/${customerDocumentId}?populate[0]=users_permissions_user&populate[1]=drug_stores`,
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
      const customerData = await customerRes.json();
      setCustomer(customerData.data);
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
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
                    <span
                      className="long-text-ellipsis"
                      title={customer.congenital_disease || 'ไม่มีข้อมูล'}
                    >
                      {customer.congenital_disease || 'ไม่มีข้อมูล'}
                    </span>
                    <span className="form-display-actions">
                      {customer.congenital_disease && (
                        <button className="edit-btn-inline" onClick={() => openMedicalModal('disease')}>รายละเอียด</button>
                      )}
                      {userRole === 'pharmacy' && (
                        <button className="edit-btn-inline" style={{marginLeft:8,background:'linear-gradient(90deg,#10b981,#06b6d4)'}} onClick={() => openEditMedicalModal('disease')}>แก้ไข</button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>ยาที่แพ้</label>
                  <div className="form-display">
                    <span
                      className="long-text-ellipsis"
                      title={customer.Allergic_drugs || 'ไม่มีข้อมูล'}
                    >
                      {customer.Allergic_drugs || 'ไม่มีข้อมูล'}
                    </span>
                    <span className="form-display-actions">
                      {customer.Allergic_drugs && (
                        <button className="edit-btn-inline" onClick={() => openMedicalModal('allergy')}>รายละเอียด</button>
                      )}
                      {userRole === 'pharmacy' && (
                        <button className="edit-btn-inline" style={{marginLeft:8,background:'linear-gradient(90deg,#10b981,#06b6d4)'}} onClick={() => openEditMedicalModal('allergy')}>แก้ไข</button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>อาการ</label>
                  <div className="form-display">
                    <span>{customer.Customers_symptoms || 'ไม่มีข้อมูล'}</span>
                    <span className="form-display-actions">
                      {customer.Customers_symptoms && (
                        <button className="edit-btn-inline" onClick={() => openMedicalModal('symptom')}>รายละเอียด</button>
                      )}
                      {userRole === 'pharmacy' && (
                        <button
                          className="edit-btn-inline"
                          style={{ marginLeft: 8, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }}
                          onClick={openEditSymptomModal}
                        >
                          แก้ไข
                        </button>
                      )}
                    </span>
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
                    {customer.Follow_up_appointment_date
                      ? formatThaiDate(customer.Follow_up_appointment_date)
                      : 'ไม่มีข้อมูล'}
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

              <button className="action-btn green" onClick={handleOpenAppointmentModal}>
                <span>{customer.Follow_up_appointment_date ? 'แก้ไขวันนัดติดตามอาการ' : 'เพิ่มวันนัดติดตามอาการ'}</span>
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

      {/* Modal สำหรับเพิ่ม/แก้ไขวันนัดติดตามอาการ */}
      <Modal
        title={customer?.Follow_up_appointment_date ? 'แก้ไขวันนัดติดตามอาการ' : 'เพิ่มวันนัดติดตามอาการ'}
        open={isAppointmentModalOpen}
        onOk={handleSaveAppointment}
        onCancel={() => setIsAppointmentModalOpen(false)}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="modal-appointment"
        footer={[
          <button
            key="delete"
            className="btn-appointment-delete"
            style={{
              display: customer?.Follow_up_appointment_date ? 'inline-block' : 'none'
            }}
            onClick={handleDeleteAppointment}
          >
            ลบวันนัด
          </button>,
          <button
            key="cancel"
            className="btn-appointment-cancel"
            onClick={() => setIsAppointmentModalOpen(false)}
          >
            ยกเลิก
          </button>,
          <button
            key="ok"
            className="btn-appointment-ok"
            onClick={handleSaveAppointment}
          >
            บันทึก
          </button>
        ]}
      >
        <div className="modal-appointment-header">
          <div className="modal-appointment-title">
            <span role="img" aria-label="calendar">📅</span>
            {customer?.Follow_up_appointment_date ? 'เลือกวันใหม่' : 'เลือกวันนัด'}
          </div>
          <div className="modal-appointment-desc">
            กรุณาเลือกวันที่ต้องการนัดติดตามอาการของลูกค้า
          </div>
        </div>
        <DatePicker
          value={appointmentDate ? dayjs(appointmentDate) : null}
          onChange={date => setAppointmentDate(date ? date.format('YYYY-MM-DD') : null)}
          className="modal-appointment-datepicker"
          placeholder="เลือกวันนัดติดตามอาการ"
          format="YYYY-MM-DD"
          size="large"
        />
        {appointmentDate && (
          <div className="modal-appointment-selected">
            วันที่เลือก: {formatThaiDate(appointmentDate)}
          </div>
        )}
      </Modal>

      {/* Modal สำหรับดูรายละเอียดข้อมูลทางการแพทย์ */}
      <Modal
        title={
          <div className="modal-medical-title">
            <span role="img" aria-label="icon">{medicalModal.icon}</span>{medicalModal.title}
          </div>
        }
        open={medicalModal.open}
        onCancel={() => setMedicalModal({ ...medicalModal, open: false })}
        footer={null}
        centered
        className="modal-medical"
      >
        {medicalModal.title === 'อาการ' && medicalModal.extra ? (
          <div className="modal-medical-symptom">
            <div className="modal-medical-symptom-section">
              <div className="modal-medical-symptom-label main">
                <span role="img" aria-label="main">🩺</span> อาการนำ
              </div>
              <div className="modal-medical-symptom-value main">{medicalModal.extra.main}</div>
            </div>
            <div className="modal-medical-symptom-section">
              <div className="modal-medical-symptom-label history">
                <span role="img" aria-label="history">📖</span> ประวัติการเจ็บป่วย
              </div>
              <div className="modal-medical-symptom-value history">{medicalModal.extra.history}</div>
            </div>
            <div className="modal-medical-symptom-section">
              <div className="modal-medical-symptom-label note">
                <span role="img" aria-label="note">📝</span> รายละเอียดเพิ่มเติม
              </div>
              <div className="modal-medical-symptom-value note">{medicalModal.extra.note}</div>
            </div>
          </div>
        ) : (
          <div className="modal-medical-content">
            <div className="modal-medical-desc">
              ข้อมูล{medicalModal.title}ของลูกค้า
            </div>
            <div className="modal-medical-value">
              {medicalModal.value}
            </div>
          </div>
        )}
        <button
          className="btn-medical-close"
          onClick={() => setMedicalModal({ ...medicalModal, open: false })}
        >
          ปิด
        </button>
      </Modal>

      {/* Modal สำหรับแก้ไขข้อมูลทางการแพทย์ (pharmacy) */}
      <Modal
        title={
          <div className="modal-editmedical-title">
            <span role="img" aria-label="edit">✏️</span>แก้ไข{editMedicalModal.label}
          </div>
        }
        open={editMedicalModal.open}
        onCancel={() => setEditMedicalModal({ ...editMedicalModal, open: false })}
        onOk={handleSaveEditMedical}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="modal-editmedical"
      >
        <div className="modal-editmedical-content">
          <div className="modal-editmedical-desc">
            กรุณากรอกข้อมูล{editMedicalModal.label}ใหม่
          </div>
          <textarea
            value={editMedicalModal.value}
            onChange={e => setEditMedicalModal({ ...editMedicalModal, value: e.target.value })}
            rows={4}
            className="modal-editmedical-textarea"
            placeholder={`ระบุ${editMedicalModal.label}`}
          />
        </div>
      </Modal>

      {/* Modal สำหรับแก้ไขอาการ */}
      <Modal
        title={
          <div className="modal-editmedical-title">
            <span role="img" aria-label="edit">✏️</span>แก้ไขอาการ
          </div>
        }
        open={editSymptomModal.open}
        onCancel={() => setEditSymptomModal({ ...editSymptomModal, open: false })}
        onOk={handleSaveEditSymptom}
        okText="บันทึก"
        cancelText="ยกเลิก"
        centered
        className="modal-editmedical"
      >
        <div className="modal-editmedical-content">
          <div className="modal-editmedical-desc">กรุณากรอกข้อมูลอาการ</div>
          <div className="form-group">
            <label>อาการนำ</label>
            <textarea
              value={editSymptomModal.main}
              onChange={e => setEditSymptomModal({ ...editSymptomModal, main: e.target.value })}
              rows={2}
              className="modal-editmedical-textarea"
              placeholder="ระบุอาการนำ"
            />
          </div>
          <div className="form-group">
            <label>ประวัติการเจ็บป่วย</label>
            <textarea
              value={editSymptomModal.history}
              onChange={e => setEditSymptomModal({ ...editSymptomModal, history: e.target.value })}
              rows={3}
              className="modal-editmedical-textarea"
              placeholder="ระบุประวัติการเจ็บป่วย"
            />
          </div>
          <div className="form-group">
            <label>รายละเอียดเพิ่มเติม</label>
            <textarea
              value={editSymptomModal.note}
              onChange={e => setEditSymptomModal({ ...editSymptomModal, note: e.target.value })}
              rows={3}
              className="modal-editmedical-textarea"
              placeholder="ระบุรายละเอียดเพิ่มเติม"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CustomerDetail;