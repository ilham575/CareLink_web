import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { message } from 'antd';
import dayjs from 'dayjs';
import { API } from '../../../utils/apiConfig';
import '../../../css/pages/pharmacy/print-allergy-card.css';

// ฟังก์ชันแปลงวันที่เป็นภาษาไทย
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

// ฟังก์ชันแปลงวันที่แบบย่อ
function formatShortThaiDate(dateStr) {
  if (!dateStr) return '';
  const months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const d = dayjs(dateStr);
  if (!d.isValid()) return dateStr;
  return `${d.date()} ${months[d.month() + 1]} ${d.year() + 543}`;
}

// ฟังก์ชันแปลงยาที่แพ้เป็น array
function parseAllergies(val) {
  if (!val) return [];
  if (typeof val === 'string') {
    // ถ้าเป็น string ให้แยกด้วย comma หรือ newline
    return val
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item && item !== '-' && item.toLowerCase() !== 'ไม่มี');
  }
  if (Array.isArray(val)) {
    return val.map(item => {
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object') return item.allergy || item.drug || item.name_th || JSON.stringify(item);
      return String(item);
    }).filter(item => item && item !== '-' && item.toLowerCase() !== 'ไม่มี');
  }
  if (typeof val === 'object') {
    return [val.allergy || val.drug || val.name_th || JSON.stringify(val)].filter(item => item && item !== '-');
  }
  return [];
}

function PrintAllergyCard() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const searchParams = new URLSearchParams(location.search || '');
        const pharmacyId = searchParams.get('pharmacyId');

        // โหลดข้อมูลลูกค้า
        const customerRes = await fetch(
          API.customerProfiles.getByIdBasic(customerDocumentId),
          { headers: { Authorization: token ? `Bearer ${token}` : '' } }
        );
        if (customerRes.ok) {
          const customerData = await customerRes.json();
          setCustomer(customerData.data);
        }

        // โหลดข้อมูลร้านยา
        if (pharmacyId) {
          const pharmacyRes = await fetch(
            API.drugStores.getByDocumentId(pharmacyId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );
          if (pharmacyRes.ok) {
            const pharmacyData = await pharmacyRes.json();
            const store = pharmacyData.data?.find(item => item.documentId === pharmacyId);
            setPharmacy(store);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        message.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };

    if (customerDocumentId) {
      loadData();
    }
  }, [customerDocumentId, location.search]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return <div className="allergy-loading">กำลังโหลดข้อมูล...</div>;
  }

  if (!customer) {
    return <div className="allergy-error">ไม่พบข้อมูลลูกค้า</div>;
  }

  const user = customer.users_permissions_user;
  const today = new Date();
  const allergicDrugsArray = parseAllergies(customer.Allergic_drugs);

  // ตรวจสอบว่ามียาที่แพ้หรือไม่
  if (allergicDrugsArray.length === 0) {
    return (
      <div className="allergy-card-container">
        <div className="allergy-controls no-print">
          <button className="allergy-btn-back" onClick={handleBack}>
            ← กลับ
          </button>
        </div>
        <div className="allergy-no-data">
          <div className="allergy-no-data-icon">💊</div>
          <h2>ไม่มีข้อมูลยาที่แพ้</h2>
          <p>ผู้ป่วยรายนี้ยังไม่มีการบันทึกข้อมูลยาที่แพ้</p>
        </div>
      </div>
    );
  }

  return (
    <div className="allergy-card-container">
      {/* ปุ่มควบคุม (ซ่อนตอนพิมพ์) */}
      <div className="allergy-controls no-print">
        <button className="allergy-btn-print" onClick={handlePrint}>
          🖨️ พิมพ์บัตรแพ้ยา
        </button>
        <button className="allergy-btn-back" onClick={handleBack}>
          ← กลับ
        </button>
      </div>

      {/* บัตรแพ้ยา */}
      <div className="allergy-card">
        {/* Header */}
        <div className="allergy-card-header">
          <div className="allergy-warning-icon">⚠️</div>
          <div className="allergy-header-text">
            <h1>บัตรแพ้ยา</h1>
            <p className="allergy-header-en">DRUG ALLERGY CARD</p>
          </div>
          <div className="allergy-warning-icon">⚠️</div>
        </div>

        {/* คำเตือน */}
        <div className="allergy-warning-banner">
          <span>🚨 กรุณาแจ้งแพทย์/เภสัชกรทุกครั้งก่อนรับยา 🚨</span>
        </div>

        {/* ข้อมูลผู้ป่วย */}
        <div className="allergy-patient-section">
          <div className="allergy-section-title">
            <span className="allergy-section-icon">👤</span>
            ข้อมูลผู้ป่วย
          </div>
          <div className="allergy-patient-info">
            <div className="allergy-info-row">
              <div className="allergy-info-item">
                <label>ชื่อ-นามสกุล:</label>
                <span className="allergy-info-value">{user?.full_name || '-'}</span>
              </div>
            </div>
            <div className="allergy-info-row two-cols">
              <div className="allergy-info-item">
                <label>เบอร์โทร:</label>
                <span className="allergy-info-value">{user?.phone || '-'}</span>
              </div>
              <div className="allergy-info-item">
                <label>รหัสผู้ป่วย:</label>
                <span className="allergy-info-value allergy-patient-id">{customerDocumentId?.substring(0, 8) || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ข้อมูลยาที่แพ้ */}
        <div className="allergy-drugs-section">
          <div className="allergy-section-title danger">
            <span className="allergy-section-icon">💊</span>
            ยา/สารที่แพ้
          </div>
          <div className="allergy-drugs-box">
            <div className="allergy-drugs-content">
              {allergicDrugsArray.length === 1 ? (
                <div>{allergicDrugsArray[0]}</div>
              ) : (
                <ul className="allergy-drugs-list">
                  {allergicDrugsArray.map((drug, index) => (
                    <li key={index} className="allergy-drugs-item">{drug}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* อาการแพ้ */}
        {customer.allergy_symptoms && (
          <div className="allergy-symptoms-section">
            <div className="allergy-section-title warning">
              <span className="allergy-section-icon">🩺</span>
              อาการเมื่อแพ้
            </div>
            <div className="allergy-symptoms-box">
              {customer.allergy_symptoms}
            </div>
          </div>
        )}

        {/* โรคประจำตัว */}
        {customer.congenital_disease && customer.congenital_disease !== '-' && (
          <div className="allergy-disease-section">
            <div className="allergy-section-title info">
              <span className="allergy-section-icon">📋</span>
              โรคประจำตัว
            </div>
            <div className="allergy-disease-box">
              {customer.congenital_disease}
            </div>
          </div>
        )}

        {/* ข้อมูลร้านยา */}
        <div className="allergy-pharmacy-section">
          <div className="allergy-section-title">
            <span className="allergy-section-icon">🏪</span>
            ออกบัตรโดย
          </div>
          <div className="allergy-pharmacy-info">
            <div className="allergy-pharmacy-name">
              {pharmacy?.name_th || 'ร้านยา CareLink'}
            </div>
            <div className="allergy-pharmacy-details">
              {pharmacy?.address && <div>📍 {pharmacy.address}</div>}
              {pharmacy?.phone && <div>📞 {pharmacy.phone}</div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="allergy-card-footer">
          <div className="allergy-footer-date">
            วันที่ออกบัตร: {formatShortThaiDate(today.toISOString())}
          </div>
          <div className="allergy-footer-note">
            * กรุณาพกบัตรนี้ติดตัวเสมอ และแสดงต่อบุคลากรทางการแพทย์ทุกครั้ง
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="allergy-emergency">
          <span>🚑 ฉุกเฉิน: 1669</span>
        </div>
      </div>

      {/* Preview Info - หน้าเว็บเท่านั้น */}
      <div className="allergy-preview-info no-print">
        <h3>📋 ข้อมูลเพิ่มเติม</h3>
        <p>บัตรแพ้ยานี้จะถูกพิมพ์ในขนาด A4 แนวตั้ง</p>
        <p>แนะนำให้เคลือบบัตรหรือใส่ซองพลาสติกเพื่อความทนทาน</p>
      </div>
    </div>
  );
}

export default PrintAllergyCard;
