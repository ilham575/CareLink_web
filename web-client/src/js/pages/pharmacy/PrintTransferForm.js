import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Modal, message } from 'antd';
import dayjs from 'dayjs';
import { API } from '../../../utils/apiConfig';
import '../../../css/pages/pharmacy/print-transfer-form.css';

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

// ฟังก์ชันแปลงยาที่แพ้เป็น array
function parseAllergies(val) {
  if (!val) return [];
  if (typeof val === 'string') {
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

function PrintTransferForm() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drugs, setDrugs] = useState([]);

  const location = useLocation();

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

          // โหลดข้อมูลยา
          const drugsRes = await fetch(
            API.drugs.listByStore(pharmacyId),
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          );
          if (drugsRes.ok) {
            const drugsData = await drugsRes.json();
            setDrugs(drugsData.data || []);
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
    return <div className="print-loading">กำลังโหลดข้อมูล...</div>;
  }

  if (!customer) {
    return <div className="print-error">ไม่พบข้อมูลลูกค้า</div>;
  }

  const user = customer.users_permissions_user;
  const prescribedDrugs = customer.prescribed_drugs || [];
  const allergicDrugsArray = parseAllergies(customer.Allergic_drugs);
  const today = new Date();

  // Helper: normalize values to safe display strings
  const normalizeDisplay = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      // common shapes: { allergy }, { drug }, { date, drug, symptoms }
      return val.allergy || val.drug || val.symptoms || JSON.stringify(val);
    }
    return String(val);
  };

  return (
    <div className="print-transfer-form-container">
      {/* ปุ่มควบคุม (ซ่อนตอนพิมพ์) */}
      <div className="print-controls no-print">
        <button className="print-btn-print" onClick={handlePrint}>
          🖨️ พิมพ์ใบส่งต่อ
        </button>
        <button className="print-btn-back" onClick={handleBack}>
          ← กลับ
        </button>
      </div>

      {/* เนื้อหาที่จะพิมพ์ */}
      <div className="print-transfer-form">
        {/* ส่วน Header */}
        <div className="print-form-header">
          <div className="print-header-title">
            <h1>ใบส่งต่อผู้ป่วย</h1>
            <p className="print-header-subtitle">Patient Referral Form</p>
          </div>
          <div className="print-header-info">
            <div className="print-form-number">
              เลขที่: {customerDocumentId?.substring(0, 8) || '-'}
            </div>
            <div className="print-form-date">
              วันที่: {formatThaiDate(today.toISOString())}
            </div>
          </div>
        </div>

        {/* ส่วน 1: ข้อมูลผู้ป่วย */}
        <section className="print-form-section">
          <h2 className="print-section-title">📋 ข้อมูลผู้ป่วย</h2>
          <div className="print-section-content print-two-columns">
            <div className="print-form-field">
              <label>ชื่อ - นามสกุล:</label>
              <div className="print-field-value">{user?.full_name || '-'}</div>
            </div>
            <div className="print-form-field">
              <label>เบอร์โทรศัพท์:</label>
              <div className="print-field-value">{user?.phone || '-'}</div>
            </div>
            <div className="print-form-field print-full-width">
              <label>ที่อยู่:</label>
              <div className="print-field-value">{customer.address || '-'}</div>
            </div>
            <div className="print-form-field">
              <label>อีเมล:</label>
              <div className="print-field-value">{user?.email || '-'}</div>
            </div>
          </div>
        </section>

        {/* ส่วน 2: ข้อมูลคลินิก/แพทย์ */}
        <section className="print-form-section">
          <h2 className="print-section-title">👨‍⚕️ ข้อมูลคลินิก/แพทย์ผู้สั่ง</h2>
          <div className="print-section-content print-two-columns">
            <div className="print-form-field print-full-width">
              <label>ชื่อคลินิก/หน่วยแพทย์:</label>
              <div className="print-field-value">
                {customer.clinic_name || customer.hospital_name || '(ไม่ระบุ)'}
              </div>
            </div>
            <div className="print-form-field">
              <label>ชื่อแพทย์ผู้สั่ง:</label>
              <div className="print-field-value">
                {customer.doctor_name || '(ไม่ระบุ)'}
              </div>
            </div>
            <div className="print-form-field">
              <label>เบอร์ติดต่อ:</label>
              <div className="print-field-value">
                {customer.doctor_phone || '(ไม่ระบุ)'}
              </div>
            </div>
          </div>
        </section>

        {/* ส่วน 3: ข้อมูลทางการแพทย์ */}
        <section className="print-form-section">
          <h2 className="print-section-title">⚠️ ข้อมูลทางการแพทย์ที่ต้องระวัง</h2>
          <div className="print-section-content">
            <div className="print-form-field print-full-width">
              <label>ยาที่แพ้:</label>
              <div className="print-field-value">
                {allergicDrugsArray.length === 0 ? '(ไม่มี)' : allergicDrugsArray.length === 1 ? allergicDrugsArray[0] : (
                  <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                    {allergicDrugsArray.map((drug, index) => (
                      <li key={index}>{drug}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="print-form-field print-full-width">
              <label>โรคประจำตัว:</label>
              <div className="print-field-value">
                  {normalizeDisplay(customer.congenital_disease) || '(ไม่มี)'}
                </div>
            </div>
            <div className="print-form-field print-full-width">
              <label>อาการปัจจุบัน:</label>
              <div className="print-field-value">
                  {normalizeDisplay(customer.Customers_symptoms) || '(ไม่ระบุ)'}
                </div>
            </div>
          </div>
        </section>

        {/* ส่วน 4: รายการยา */}
        <section className="print-form-section">
          <h2 className="print-section-title">💊 รายการยาที่ส่งต่อ</h2>
          <div className="print-section-content">
            {prescribedDrugs.length > 0 ? (
              <table className="print-drugs-table">
                <thead>
                  <tr>
                    <th className="print-col-no">ลำดับ</th>
                    <th className="print-col-name">ชื่อยา (ไทย)</th>
                    <th className="print-col-name-en">ชื่อยา (อังกฤษ)</th>
                    <th className="print-col-strength">ขนาด</th>
                    <th className="print-col-qty">จำนวน</th>
                    <th className="print-col-unit">หน่วย</th>
                    <th className="print-col-duration">ระยะเวลา</th>
                    <th className="print-col-usage">วิธีใช้</th>
                  </tr>
                </thead>
                <tbody>
                  {prescribedDrugs.map((drugItem, index) => {
                    const drugId = typeof drugItem === 'string'
                      ? drugItem
                      : (drugItem.drugId || drugItem.drug || (drugItem?.drug?.documentId));
                    const quantity = typeof drugItem === 'string' ? 1 : drugItem.quantity || 1;
                    const drug = drugs.find(d => d.documentId === drugId) || drugs.find(d => d.documentId === (drugItem?.drug?.documentId));

                    return (
                      <tr key={drugId || index}>
                        <td className="print-col-no">{index + 1}</td>
                        <td className="print-col-name">{drug?.name_th || 'กำลังโหลด...'}</td>
                        <td className="print-col-name-en">{drug?.name_en || '-'}</td>
                        <td className="print-col-strength">{drug?.strength || '-'}</td>
                        <td className="print-col-qty">{quantity}</td>
                        <td className="print-col-unit">{drug?.unit || 'เม็ด'}</td>
                        <td className="print-col-duration">{drug?.duration || '-'}</td>
                        <td className="print-col-usage">{drug?.usage_instruction || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="print-no-drugs-message">
                ไม่มีรายการยาที่ส่งต่อ
              </div>
            )}
          </div>
        </section>

        {/* ส่วน 5: ข้อมูลร้านยาต้นทาง (ผู้ส่งต่อ) */}
        <section className="print-form-section">
          <h2 className="print-section-title">🏪 ร้านยาต้นทาง (ผู้ส่งต่อ)</h2>
          <div className="print-section-content print-two-columns">
            <div className="print-form-field print-full-width">
              <label>ชื่อร้านยา:</label>
              <div className="print-field-value">{pharmacy?.name_th || '-'}</div>
            </div>
            <div className="print-form-field">
              <label>ที่อยู่:</label>
              <div className="print-field-value">{pharmacy?.address || '-'}</div>
            </div>
            <div className="print-form-field">
              <label>เบอร์โทรศัพท์:</label>
              <div className="print-field-value">{pharmacy?.phone || '-'}</div>
            </div>
          </div>
        </section>

        {/* ส่วน 5.1: ข้อมูลสถานพยาบาลปลายทาง (ผู้รับต่อ) */}
        <section className="print-form-section">
          <h2 className="print-section-title">🏥 สถานพยาบาลปลายทาง (ผู้รับต่อ)</h2>
          <div className="print-section-content print-two-columns">
            <div className="print-form-field">
              <label>ประเภท:</label>
              <div className="print-field-value print-checkbox-group">
                <span className="print-checkbox">☐ ร้านยา</span>
                <span className="print-checkbox">☐ โรงพยาบาล</span>
                <span className="print-checkbox">☐ คลินิก</span>
              </div>
            </div>
            <div className="print-form-field print-full-width">
              <label>ชื่อสถานพยาบาล:</label>
              <div className="print-field-value print-field-blank">____________________________________________________</div>
            </div>
            <div className="print-form-field print-full-width">
              <label>ที่อยู่:</label>
              <div className="print-field-value print-field-blank">____________________________________________________</div>
            </div>
            <div className="print-form-field">
              <label>เบอร์โทรศัพท์:</label>
              <div className="print-field-value print-field-blank">________________________</div>
            </div>
            <div className="print-form-field">
              <label>ผู้รับ:</label>
              <div className="print-field-value print-field-blank">________________________</div>
            </div>
          </div>
        </section>

        {/* ส่วน 6: วันนัดติดตาม */}
        <section className="print-form-section">
          <h2 className="print-section-title">📅 วันนัดติดตามอาการ</h2>
          <div className="print-section-content">
            <div className="print-form-field print-full-width">
              <label>วันที่นัดติดตามอาการ:</label>
              <div className="print-field-value">
                {customer.Follow_up_appointment_date
                  ? formatThaiDate(customer.Follow_up_appointment_date)
                  : 'ยังไม่มีการกำหนด'}
              </div>
            </div>
          </div>
        </section>

        {/* ส่วน 7: ช่องลงนาม */}
        <section className="print-form-section">
          <h2 className="print-section-title">✍️ ลงนาม</h2>
          <div className="print-section-content print-signature-grid">
            <div className="print-signature-box">
              <div className="print-signature-label">เภสัชกรผู้ส่งต่อ (ร้านยาต้นทาง)</div>
              <div className="print-signature-line"></div>
              <div className="print-signature-name">ชื่อ: _______________</div>
              <div className="print-signature-date">วันที่: _______________</div>
            </div>
            <div className="print-signature-box">
              <div className="print-signature-label">ผู้รับต่อ (ร้านยา/รพ./คลินิก)</div>
              <div className="print-signature-line"></div>
              <div className="print-signature-name">ชื่อ: _______________</div>
              <div className="print-signature-date">วันที่: _______________</div>
            </div>
          </div>
        </section>

        {/* ส่วน 8: หมายเหตุ */}
        <section className="print-form-section">
          <h2 className="print-section-title">📝 หมายเหตุ</h2>
          <div className="print-section-content">
            <div className="print-notes-area">
              <div className="print-notes-line"></div>
              <div className="print-notes-line"></div>
              <div className="print-notes-line"></div>
            </div>
          </div>
        </section>

        {/* Footer - ซ่อนตอนพิมพ์ */}
        <div className="print-form-footer no-print">
          <p className="print-footer-text">
            เอกสารนี้ออกเมื่อ {formatThaiDate(today.toISOString())}
          </p>
          <p className="print-footer-text print-footer-subtext">
            * เอกสารนี้ใช้สำหรับส่งต่อผู้ป่วยจากร้านยาไปยังร้านยา โรงพยาบาล หรือคลินิกอื่น
          </p>
        </div>
      </div>
    </div>
  );
}

export default PrintTransferForm;
