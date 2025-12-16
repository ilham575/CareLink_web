import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Tabs } from 'antd';
import { fetchWithAuth } from '../../../utils/apiConfig';
import { API } from '../../../utils/apiConfig';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';
import '../../../css/pages/customer/edit_symptoms_view.css';

// Unique CSS prefix: symrec-

function EditSymptomsCustomer() {
  const { customerDocumentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [symptomsText, setSymptomsText] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  const [availableDrugs, setAvailableDrugs] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [allergySymptom, setAllergySymptom] = useState('');
  const [allergyTime, setAllergyTime] = useState('');

  // Format current date in Thai
  const formatThaiDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    // Get drugs from location state (passed from CustomerDetail) or fetch them
    const passedDrugs = location.state?.availableDrugs;
    
    if (passedDrugs && passedDrugs.length > 0) {
      // Use drugs from CustomerDetail page
      const drugList = passedDrugs.map(d => ({
        id: d.id || d.documentId,
        name: d.name_th || d.name_en || 'ยาที่ไม่ระบุ'
      }));
      setAvailableDrugs(drugList);
    } else {
      // Fallback: fetch drugs if not passed
      const loadDrugs = async () => {
        try {
          const res = await fetch(API.drugs.listWithBatches());
          if (!res.ok) return;
          const js = await res.json();
          const list = (js.data || []).map(d => ({
            id: d.id || d.documentId,
            name: d.name_th || d.name_en || 'ยาที่ไม่ระบุ'
          }));
          setAvailableDrugs(list);
        } catch (e) {
          console.warn('Failed to load drugs for allergy select', e);
        }
      };
      loadDrugs();
    }

    // Load customer basic info (name, pharmacy) and initial symptoms/allergies
    const loadCustomer = async () => {
      try {
        const token = localStorage.getItem('jwt');
        const res = await fetch(API.customerProfiles.getByIdBasic(customerDocumentId), {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (!res.ok) return;
        const js = await res.json();
        const cust = js.data || js;
        const attrs = cust?.attributes || cust;
        // set initial symptoms text
        setSymptomsText(attrs?.Customers_symptoms || '');
        // set allergies
        if (attrs?.Allergic_drugs) {
          // Allergic_drugs might be:
          // - JSON object: { allergy: 'ยา A, ยา B' } or { drug: 'ยา A' }
          // - String: 'ยา A, ยา B'
          // - Array: ['ยา A', 'ยา B']
          let allergyStr = '';
          if (typeof attrs.Allergic_drugs === 'object' && !Array.isArray(attrs.Allergic_drugs)) {
            allergyStr = attrs.Allergic_drugs.allergy || attrs.Allergic_drugs.drug || '';
          } else if (typeof attrs.Allergic_drugs === 'string') {
            allergyStr = attrs.Allergic_drugs;
          } else if (Array.isArray(attrs.Allergic_drugs)) {
            allergyStr = attrs.Allergic_drugs.join(', ');
          }
          
          const arr = allergyStr ? allergyStr.split(',').map(s => s.trim()).filter(Boolean) : [];
          if (arr.length > 0) {
            setAllergies(arr.map((name, i) => ({ id: `init-${i}`, name, symptom: '-', time: '-' })));
          }
        }
        // set pharmacy name and pharmacist name if available
        if (attrs?.drug_stores && attrs.drug_stores.length > 0) {
          const store = attrs.drug_stores[0].attributes || attrs.drug_stores[0];
          setPharmacyName(store.name_th || '');
          if (store?.pharmacy_profiles && store.pharmacy_profiles.length > 0) {
            const profile = store.pharmacy_profiles[0].attributes || store.pharmacy_profiles[0];
            const user = profile?.users_permissions_user?.data?.attributes || profile?.users_permissions_user;
            const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user?.username : (profile?.full_name || '');
            setPharmacistName(name);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    if (customerDocumentId) loadCustomer();
  }, [customerDocumentId, location.state]);

  const handleAddAllergy = () => {
    if (!selectedDrug) {
      toast.warn('กรุณาเลือกชื่อยาที่แพ้ก่อน');
      return;
    }
    const drugName = availableDrugs.find(d => String(d.id) === String(selectedDrug))?.name || selectedDrug;
    setAllergies(prev => [...prev, { id: Date.now(), name: drugName, symptom: allergySymptom || '-', time: allergyTime || '-' }]);
    
    // Reset modal fields and close
    setSelectedDrug('');
    setAllergySymptom('');
    setAllergyTime('');
    setIsModalVisible(false);
    toast.success('เพิ่มข้อมูลยาที่แพ้เรียบร้อย');
  };

  const handleRemoveAllergy = (id) => setAllergies(prev => prev.filter(a => a.id !== id));

  const handleSave = async () => {
    // Validation: require either a symptoms text or at least one allergy
    if (!symptomsText.trim() && allergies.length === 0) {
      toast.warn('กรุณากรอกอาการ หรือเพิ่มยาที่แพ้ ก่อนบันทึก');
      return;
    }

    setIsSaving(true);
    try {
      // Build payload (backend expects JSON object for Allergic_drugs)
      const payload = {
        data: {
          Customers_symptoms: symptomsText,
          Allergic_drugs: allergies.length > 0 ? { allergy: allergies.map(a => a.name).join(', ') } : null,
        }
      };

      console.log('Saving symptoms (payload):', payload);

      // Use fetchWithAuth helper so token and headers are handled consistently
      await fetchWithAuth(API.customerProfiles.update(customerDocumentId), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      toast.success('บันทึกอัพเดตอาการเรียบร้อย');
      // Navigate back after a short delay
      setTimeout(() => navigate(-1), 700);
    } catch (error) {
      console.error('Save symptoms error:', error);
      // If an error has a message, show it; otherwise show generic message
      toast.error(error?.message || 'ไม่สามารถบันทึกข้อมูลได้ ลองอีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    toast.info('ยกเลิกการแก้ไข');
    navigate(-1);
  };

  return (
    <div>
      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} forceShowPharmacy={true} />
      <div className="symrec-wrapper">
        {/* Header with Title and Date */}
        <div className="symrec-header">
          <div>
            <h1 className="symrec-title">อัพเดตอาการผู้ป่วย</h1>
          </div>
          <div className="symrec-date">
            <span className="symrec-date-label">วันที่:</span>
            <span className="symrec-date-value">{formatThaiDate()}</span>
          </div>
        </div>

        {/* Tabs Content */}
        <Tabs
          defaultActiveKey="1"
          type="card"
          className="symrec-tabs"
        >
          {/* Tab 1: Symptoms */}
          <Tabs.TabPane tab={<span>📝 บันทึกอาการ</span>} key="1">
            <div className="symrec-box symrec-symptoms">
              <textarea
                className="symrec-textarea"
                value={symptomsText}
                onChange={(e) => setSymptomsText(e.target.value)}
                placeholder="พิมพ์บันทึกอาการที่นี่ เช่น&#10;• อาการดีขึ้น/แย่ลง&#10;• อาการเฉพาะที่สังเกตได้&#10;• ความรู้สึกอื่น ๆ"
              />
            </div>
          </Tabs.TabPane>

          {/* Tab 2: Allergies */}
          <Tabs.TabPane tab={<span>⚠️ ยาที่แพ้</span>} key="2">
            <div className="symrec-box symrec-allergies">
              <button className="symrec-add-allergy-btn" type="button" onClick={() => setIsModalVisible(true)}>
                + เพิ่มยาที่แพ้
              </button>

              <table className="symrec-allergy-table">
                <thead>
                  <tr>
                    <th>ชื่อยา</th>
                    <th>อาการ</th>
                    <th>เวลา</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {allergies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="symrec-empty">ยังไม่มีข้อมูล</td>
                    </tr>
                  )}
                  {allergies.map(row => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.symptom}</td>
                      <td>{row.time}</td>
                      <td><button className="symrec-remove-btn" type="button" onClick={() => handleRemoveAllergy(row.id)}>ลบ</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tabs.TabPane>
        </Tabs>

        {/* Modal for Adding Allergy */}
        <Modal
          title="⚠️ ยาที่แพ้"
          open={isModalVisible}
          onOk={handleAddAllergy}
          onCancel={() => {
            setIsModalVisible(false);
            setSelectedDrug('');
            setAllergySymptom('');
            setAllergyTime('');
          }}
          okText="เพิ่ม"
          cancelText="ยกเลิก"
          centered
        >
          <div className="symrec-modal-content">
            <div className="symrec-modal-field">
              <label className="symrec-modal-label">เลือกยา *</label>
              <select
                className="symrec-select"
                value={selectedDrug}
                onChange={(e) => setSelectedDrug(e.target.value)}
              >
                <option value="">-- เลือกยา --</option>
                {availableDrugs.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="symrec-modal-field">
              <label className="symrec-modal-label">อาการ</label>
              <input
                className="symrec-allergy-input"
                type="text"
                value={allergySymptom}
                placeholder="เช่น คัน, ชาติ, หายใจหนวด"
                onChange={(e) => setAllergySymptom(e.target.value)}
              />
            </div>

            <div className="symrec-modal-field">
              <label className="symrec-modal-label">เวลาเกิดอาการ</label>
              <input
                className="symrec-allergy-time"
                type="text"
                value={allergyTime}
                placeholder="เช่น หลังกินยา 30 นาที"
                onChange={(e) => setAllergyTime(e.target.value)}
              />
            </div>
          </div>
        </Modal>

        {/* Action Buttons */}
        <div className="symrec-actions">
          <button className="symrec-save" type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
          <button className="symrec-cancel" type="button" onClick={handleCancel}>ยกเลิก</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default EditSymptomsCustomer;
