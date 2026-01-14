import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Tabs } from 'antd';
import { fetchWithAuth } from '../../../utils/apiConfig';
import { API } from '../../../utils/apiConfig';
import HomeHeader from '../../components/HomeHeader';
import Footer from '../../components/footer';

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
  
  // Visit history tracking
  const [notifId, setNotifId] = useState(null);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  
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
    // Check for visit history mode from URL params or location state
    const params = new URLSearchParams(location.search);
    const notificationId = params.get('notifId') || location.state?.notifId;
    const passedNotificationData = location.state?.notificationData;
    
    if (notificationId) {
      setNotifId(notificationId);
      setIsHistoryMode(true);
      
      // If notification data is passed from CustomerDetail, use it directly
      if (passedNotificationData) {
        const notifAttrs = passedNotificationData.attributes || passedNotificationData;
        
        // Load symptoms from notification data instead of customer profile
        if (notifAttrs.Customers_symptoms) {
          setSymptomsText(notifAttrs.Customers_symptoms);
        }
        
        // Load allergies from notification data
        if (notifAttrs.Allergic_drugs) {
          let allergyStr = '';
          if (typeof notifAttrs.Allergic_drugs === 'object' && !Array.isArray(notifAttrs.Allergic_drugs)) {
            allergyStr = notifAttrs.Allergic_drugs.allergy || notifAttrs.Allergic_drugs.drug || '';
          } else if (typeof notifAttrs.Allergic_drugs === 'string') {
            allergyStr = notifAttrs.Allergic_drugs;
          } else if (Array.isArray(notifAttrs.Allergic_drugs)) {
            allergyStr = notifAttrs.Allergic_drugs.join(', ');
          }
          
          const arr = allergyStr ? allergyStr.split(',').map(s => s.trim()).filter(Boolean) : [];
          if (arr.length > 0) {
            setAllergies(arr.map((name, i) => ({ id: `notif-${i}`, name, symptom: '-', time: '-' })));
          }
        }
      } else {
        // Fallback: fetch notification data from API if not passed
        const loadNotification = async () => {
          try {
            const token = localStorage.getItem('jwt');
            const res = await fetch(API.notifications.getByDocumentId(notificationId), {
              headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            if (!res.ok) return;
            const js = await res.json();
            const notif = js.data || js;
            const notifAttrs = notif?.attributes || notif;
            
            if (notifAttrs.Customers_symptoms) {
              setSymptomsText(notifAttrs.Customers_symptoms);
            }
            
            if (notifAttrs.Allergic_drugs) {
              let allergyStr = '';
              if (typeof notifAttrs.Allergic_drugs === 'object' && !Array.isArray(notifAttrs.Allergic_drugs)) {
                allergyStr = notifAttrs.Allergic_drugs.allergy || notifAttrs.Allergic_drugs.drug || '';
              } else if (typeof notifAttrs.Allergic_drugs === 'string') {
                allergyStr = notifAttrs.Allergic_drugs;
              } else if (Array.isArray(notifAttrs.Allergic_drugs)) {
                allergyStr = notifAttrs.Allergic_drugs.join(', ');
              }
              
              const arr = allergyStr ? allergyStr.split(',').map(s => s.trim()).filter(Boolean) : [];
              if (arr.length > 0) {
                setAllergies(arr.map((name, i) => ({ id: `notif-${i}`, name, symptom: '-', time: '-' })));
              }
            }
          } catch (e) {
            console.warn('Failed to load notification data', e);
          }
        };
        loadNotification();
      }
    }
    
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
    // Only load from customer profile if NOT in history mode
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
        
        // Only set symptoms and allergies if NOT in history mode (otherwise use notification data)
        if (!notificationId) {
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
        }
        
        // Always set pharmacy name and pharmacist name (regardless of mode)
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

    // Prevent editing historical records
    if (isHistoryMode && notifId) {
      toast.error('ไม่สามารถแก้ไขข้อมูลประวัติการรักษาได้ กรุณากลับไปแก้ไขข้อมูลปัจจุบัน');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-prompt">
      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} forceShowPharmacy={true} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* History Mode Warning Banner */}
        {isHistoryMode && notifId && (
          <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center text-white font-bold shadow-lg">⚠️</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-3 py-1 bg-amber-400 text-white rounded-lg text-sm font-bold">โหมดดูข้อมูลอดีต</span>
                  </div>
                  <span className="text-sm text-amber-800 font-medium">
                    📜 คุณกำลังดูข้อมูลประวัติการรักษา - ไม่สามารถแก้ไขได้
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header with Title and Date */}
        <div className="mb-8 p-6 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-3xl shadow-lg shadow-indigo-200">
                📝
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 mb-1">อัพเดตอาการผู้ป่วย</h1>
                <p className="text-sm text-slate-500 font-medium">บันทึกและจัดการข้อมูลอาการ</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100">
              <span className="text-sm text-blue-600 font-bold">วันที่:</span>
              <span className="text-lg text-blue-700 font-black">{formatThaiDate()}</span>
            </div>
          </div>
        </div>

        {/* Tabs Content */}
        <Tabs
          defaultActiveKey="1"
          type="card"
          className="[&_.ant-tabs-nav]:bg-white [&_.ant-tabs-nav]:rounded-2xl [&_.ant-tabs-nav]:p-2 [&_.ant-tabs-nav]:shadow-lg [&_.ant-tabs-nav]:border [&_.ant-tabs-nav]:border-slate-100 [&_.ant-tabs-tab]:rounded-xl [&_.ant-tabs-tab]:font-bold [&_.ant-tabs-tab]:text-slate-600 [&_.ant-tabs-tab-active]:bg-gradient-to-r [&_.ant-tabs-tab-active]:from-indigo-500 [&_.ant-tabs-tab-active]:to-violet-500 [&_.ant-tabs-tab-active]:text-white [&_.ant-tabs-tab-active]:shadow-lg [&_.ant-tabs-content-holder]:mt-6"
        >
          {/* Tab 1: Symptoms */}
          <Tabs.TabPane tab={<span className="flex items-center gap-2">📝 บันทึกอาการ</span>} key="1">
            <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">📝</div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">บันทึกอาการของผู้ป่วย</h3>
                  {isHistoryMode && <p className="text-xs text-amber-600 font-bold mt-1">⚠️ โหมดดูข้อมูลอดีต - ไม่สามารถแก้ไขได้</p>}
                </div>
              </div>
              <textarea
                className={`w-full min-h-[300px] p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 border-2 rounded-xl focus:outline-none transition-all duration-300 text-slate-700 font-medium resize-y placeholder:text-slate-400 ${
                  isHistoryMode 
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                    : 'border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'
                }`}
                value={symptomsText}
                onChange={(e) => setSymptomsText(e.target.value)}
                placeholder="พิมพ์บันทึกอาการที่นี่ เช่น&#10;• อาการดีขึ้น/แย่ลง&#10;• อาการเฉพาะที่สังเกตได้&#10;• ความรู้สึกอื่น ๆ"
                disabled={isHistoryMode}
                readOnly={isHistoryMode}
              />
            </div>
          </Tabs.TabPane>

          {/* Tab 2: Allergies */}
          <Tabs.TabPane tab={<span className="flex items-center gap-2">⚠️ ยาที่แพ้ {allergies.length > 0 && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold">{allergies.length}</span>}</span>} key="2">
            <div className="p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">⚠️</div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">รายการยาที่แพ้</h3>
                    {isHistoryMode && <p className="text-xs text-amber-600 font-bold mt-1">⚠️ โหมดดูข้อมูลอดีต - ไม่สามารถแก้ไขได้</p>}
                  </div>
                </div>
                {!isHistoryMode && (
                  <button 
                    className="group px-6 py-3 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white rounded-xl font-bold shadow-lg shadow-rose-200 hover:shadow-xl transition-all duration-300 hover:scale-105"
                    type="button" 
                    onClick={() => setIsModalVisible(true)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl">+</span>
                      เพิ่มยาที่แพ้
                    </span>
                  </button>
                )}
              </div>

              {/* Allergy Cards Grid */}
              {allergies.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-dashed border-slate-300">
                  <div className="text-6xl mb-4">💊</div>
                  <h4 className="text-xl font-black text-slate-600 mb-2">ยังไม่มีข้อมูลยาที่แพ้</h4>
                  <p className="text-slate-400">{isHistoryMode ? 'ไม่มีข้อมูลยาที่แพ้ในรอบนี้' : 'คลิกปุ่ม "เพิ่มยาที่แพ้" เพื่อเริ่มบันทึกข้อมูล'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allergies.map(row => (
                    <div key={row.id} className="group relative p-5 bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 rounded-2xl shadow-md hover:shadow-xl hover:shadow-rose-100 transition-all duration-300">
                      {!isHistoryMode && (
                        <button 
                          className="absolute -top-3 -right-3 w-8 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                          type="button" 
                          onClick={() => handleRemoveAllergy(row.id)}
                          title="ลบรายการนี้"
                        >
                          ×
                        </button>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">💊</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-black text-rose-700 mb-2">{row.name}</h4>
                          <div className="space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-rose-600 font-bold min-w-[60px]">อาการ:</span>
                              <span className="text-sm text-slate-600 font-medium">{row.symptom}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-rose-600 font-bold min-w-[60px]">เวลา:</span>
                              <span className="text-sm text-slate-600 font-medium">{row.time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Tabs.TabPane>
        </Tabs>

        {/* Modal for Adding Allergy */}
        <Modal
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-2xl">⚠️</div>
              <span className="text-lg font-black text-slate-800">เพิ่มยาที่แพ้</span>
            </div>
          }
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
          okButtonProps={{
            className: "bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 border-none font-bold h-10 px-6 rounded-xl shadow-lg"
          }}
          cancelButtonProps={{
            className: "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 font-bold h-10 px-6 rounded-xl"
          }}
        >
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <span>💊</span>
                <span>เลือกยา <span className="text-rose-500">*</span></span>
              </label>
              <select
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-300 text-slate-700 font-medium"
                value={selectedDrug}
                onChange={(e) => setSelectedDrug(e.target.value)}
              >
                <option value="">-- เลือกยา --</option>
                {availableDrugs.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <span>🩺</span>
                <span>อาการ</span>
              </label>
              <input
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-300 text-slate-700 font-medium"
                type="text"
                value={allergySymptom}
                placeholder="เช่น คัน, ชาติ, หายใจหนวด"
                onChange={(e) => setAllergySymptom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <span>⏰</span>
                <span>เวลาเกิดอาการ</span>
              </label>
              <input
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-300 text-slate-700 font-medium"
                type="text"
                value={allergyTime}
                placeholder="เช่น หลังกินยา 30 นาที"
                onChange={(e) => setAllergyTime(e.target.value)}
              />
            </div>
          </div>
        </Modal>

        {/* Action Buttons */}
        <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button 
              className={`group flex-1 min-w-[200px] px-8 py-4 rounded-2xl font-black text-lg shadow-lg transition-all duration-300 hover:scale-105 ${
                isSaving || isHistoryMode
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300'
              }`}
              type="button" 
              onClick={handleSave} 
              disabled={isSaving || isHistoryMode}
              title={isHistoryMode ? 'ไม่สามารถแก้ไขข้อมูลประวัติได้' : ''}
            >
              <span className="flex items-center justify-center gap-3">
                <span className="text-2xl">{isSaving ? '⏳' : isHistoryMode ? '🔒' : '💾'}</span>
                {isSaving ? 'กำลังบันทึก...' : isHistoryMode ? 'โหมดดูข้อมูล' : 'บันทึก'}
              </span>
            </button>
            <button 
              className="group px-8 py-4 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              type="button" 
              onClick={handleCancel}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">❌</span>
                {isHistoryMode ? 'กลับ' : 'ยกเลิก'}
              </span>
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default EditSymptomsCustomer;
