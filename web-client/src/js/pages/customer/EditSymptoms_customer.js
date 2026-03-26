import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Tabs } from 'antd';
import { fetchWithAuth } from '../../../utils/apiConfig';
import { API } from '../../../utils/apiConfig';
import HomeHeader from '../../components/HomeHeader';
// Footer is rendered globally in App.js

// Helper: Safely render text that might be an object
function renderSafeText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    // If it's the {main, note, history} structure
    const components = [];
    if (val.main) components.push(`อาการหลัก: ${val.main}`);
    if (val.history) components.push(`ประวัติ: ${val.history}`);
    if (val.note) components.push(`หมายเหตุ: ${val.note}`);
    if (val.followup_symptoms) components.push(`ติดตามอาการ: ${val.followup_symptoms}`);
    
    if (components.length > 0) return components.join('\n');
    
    // Fallback for other objects
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
}

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
  
  // Notification / Round state
  const [notifId, setNotifId] = useState(null);
  const [notifData, setNotifData] = useState(null);
  const [originalSymptoms, setOriginalSymptoms] = useState('');
  const [isOriginalModalVisible, setIsOriginalModalVisible] = useState(false);
  
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
    const token = localStorage.getItem('jwt');
    
    // Get drugs from location state (passed from CustomerDetail) or fetch them
    const passedDrugs = location.state?.availableDrugs;
    const passedNotifId = location.state?.notifId;
    const passedNotifData = location.state?.notificationData;

    if (passedNotifId) setNotifId(passedNotifId);
    
    // หากมีการส่งรายการยามา (ระบุยาที่ได้รับ) ให้ใช้รายการนั้น
    if (passedDrugs) {
      const drugList = passedDrugs.map(d => ({
        id: d.id || d.documentId,
        name: d.name_th || d.name_en || 'ยาที่ไม่ระบุ'
      }));
      setAvailableDrugs(drugList);
    } 
    // หากไม่มีการส่งข้อมูลมาเลย (เช่น เข้าผ่าน URL โดยตรง) ให้โหลดรายการยาทั้งหมดเป็น fallback
    else {
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

    // Process notification data if passed
    if (passedNotifData) {
      const dataObj = passedNotifData.data || passedNotifData;
      const attributes = passedNotifData.attributes || passedNotifData;
      
      const symptoms = attributes.symptoms || dataObj.symptoms || '';
      const followup = attributes.followup_symptoms || dataObj.followup_symptoms || '';
      
      setNotifData(passedNotifData);
      setOriginalSymptoms(renderSafeText(symptoms));
      setSymptomsText(renderSafeText(followup));

      // Extract pharmacy info if available in notification
      const store = attributes.drug_store || dataObj.drug_store;
      if (store) {
        setPharmacyName(store.name_th || '');
        const profiles = store.pharmacy_profiles?.data || store.pharmacy_profiles;
        const profile = Array.isArray(profiles) ? profiles[0] : profiles;
        if (profile) {
          const profileAttrs = profile.attributes || profile;
          const user = profileAttrs.users_permissions_user?.data?.attributes || profileAttrs.users_permissions_user;
          const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : (profileAttrs.full_name || '');
          setPharmacistName(name);
        }
      }
    }

    // Load customer basic info (name, pharmacy) and initial symptoms/allergies
    const loadCustomer = async () => {
      try {
        const res = await fetch(API.customerProfiles.getByIdBasic(customerDocumentId), {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (!res.ok) return;
        const js = await res.json();
        const cust = js.data || js;
        const attrs = cust?.attributes || cust;
        
        // If not in a specific round, load initial symptoms from customer profile
        if (!passedNotifData && !passedNotifId) {
          setSymptomsText(renderSafeText(attrs?.Customers_symptoms) || '');
        }
        
        // Load allergies (always load from profile as they are permanent)
        if (attrs?.Allergic_drugs) {
          let parsedAllergies = [];
          const val = attrs.Allergic_drugs;
          
          if (Array.isArray(val)) {
            parsedAllergies = val.map((item, i) => {
              if (typeof item === 'object' && item !== null) {
                return {
                  id: item.id || `init-${i}`,
                  name: item.drug || item.allergy || item.name || 'ไม่ระบุชื่อยา',
                  symptom: item.symptoms || item.symptom || '-',
                  time: item.date || item.time || '-'
                };
              }
              return { id: `init-${i}`, name: String(item), symptom: '-', time: '-' };
            });
          } else if (typeof val === 'object' && val !== null) {
             // Single object
             parsedAllergies = [{
               id: 'init-0',
               name: val.drug || val.allergy || val.name || 'ไม่ระบุชื่อยา',
               symptom: val.symptoms || val.symptom || '-',
               time: val.date || val.time || '-'
             }];
          } else if (typeof val === 'string' && val.trim()) {
            const sVal = val.trim();
            if (sVal.startsWith('[') || sVal.startsWith('{')) {
              try {
                const parsed = JSON.parse(sVal);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                parsedAllergies = arr.map((item, i) => ({
                   id: item.id || `init-${i}`,
                   name: item.drug || item.allergy || item.name || 'ไม่ระบุชื่อยา',
                   symptom: item.symptoms || item.symptom || '-',
                   time: item.date || item.time || '-'
                }));
              } catch(e) { 
                parsedAllergies = sVal.split(',').map((s, i) => ({ id: `init-${i}`, name: s.trim(), symptom: '-', time: '-' }));
              }
            } else {
              parsedAllergies = sVal.split(',').map((s, i) => ({ id: `init-${i}`, name: s.trim(), symptom: '-', time: '-' }));
            }
          }
          setAllergies(parsedAllergies.filter(a => a.name && a.name !== 'undefined'));
        }
        
        // Set pharmacy name and pharmacist name (only if not already set from notification)
        if (!passedNotifData && attrs?.drug_stores && attrs.drug_stores.length > 0) {
          const store = attrs.drug_stores[0].attributes || attrs.drug_stores[0];
          setPharmacyName(store.name_th || '');
          const profiles = store.pharmacy_profiles?.data || store.pharmacy_profiles;
          const profile = Array.isArray(profiles) ? profiles[0] : profiles;
          if (profile) {
            const profileAttrs = profile.attributes || profile;
            const user = profileAttrs.users_permissions_user?.data?.attributes || profileAttrs.users_permissions_user;
            const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user?.username : (profileAttrs.full_name || '');
            setPharmacistName(name);
          }
        }
      } catch (e) {
        console.warn('Load customer info error:', e);
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
    setIsSaving(true);
    try {
      // 1. Update Customer Profile (Global)
      const profilePayload = {
        data: {
          Customers_symptoms: symptomsText,
          Allergic_drugs: allergies.length > 0 ? allergies.map(a => ({
            drug: a.name,
            symptoms: a.symptom,
            date: a.time
          })) : [],
        }
      };

      await fetchWithAuth(API.customerProfiles.update(customerDocumentId), {
        method: 'PUT',
        body: JSON.stringify(profilePayload),
      });

      // 2. Update Notification (Round Specific) if in a round
      if (notifId) {
        // Extract current data object to merge
        let currentData = notifData?.data || {};
        if (notifData?.attributes?.data) currentData = notifData.attributes.data;

        const notificationPayload = {
          data: {
            data: {
              ...currentData,
              followup_symptoms: symptomsText,
              Allergic_drugs: allergies.map(a => ({
                drug: a.name,
                symptoms: a.symptom,
                date: a.time
              }))
            }
          }
        };

        console.log('Updating notification followup (payload):', notificationPayload);
        
        await fetchWithAuth(API.notifications.update(notifId), {
          method: 'PUT',
          body: JSON.stringify(notificationPayload),
        });
      }

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
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Background decoration elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-200/20 blur-[100px] rounded-full"></div>
      </div>

      <HomeHeader isLoggedIn={true} pharmacyName={pharmacyName} pharmacistName={pharmacistName} forceShowPharmacy={true} />

      <main className="relative z-10 flex-1 w-full px-6 py-6 animate-in fade-in duration-700">
        {/* Breadcrumb / Status */}
        <div className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span className="hover:text-indigo-600 cursor-pointer transition-colors" onClick={handleCancel}>หน้าหลัก</span>
          <span>/</span>
          <span className="text-slate-900">อัปเดตอาการ</span>
        </div>

        {/* Dynamic Premium Header */}
        <div className="bg-white/60 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 mb-8 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] -mr-16 -mt-16 transition-all group-hover:bg-indigo-500/10"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-3xl shadow-xl shadow-slate-200">
                ✍️
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
                  บันทึกอาการสุขภาพ
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-xs text-slate-500 font-bold">แจ้งความคืบหน้าการรักษาให้เภสัชกร</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 py-3 bg-white/50 backdrop-blur rounded-2xl border border-white/50 shadow-sm self-start md:self-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm">📅</div>
              <div>
                <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5">วันที่รายงาน</div>
                <div className="text-sm font-black text-slate-700 leading-none">{formatThaiDate()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Premium Tabs with improved styling and item IDs */}
        <div className="custom-luxury-tabs-wrapper">
          <Tabs
            defaultActiveKey="1"
            className="custom-luxury-tabs"
            items={[
              {
                key: '1',
                label: (
                   <div className="flex flex-col items-center py-2 px-1">
                    <span className="text-xl mb-1">📝</span>
                    <span className="text-[10px] uppercase tracking-widest font-black">บันทึกอาการ</span>
                  </div>
                ),
                children: (
                  <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <div className="p-6 bg-white/60 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl text-blue-600 shadow-sm">📝</div>
                          <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">รายละเอียดอาการ</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ข้อมูลอาการทางการแพทย์</p>
                          </div>
                        </div>
                        
                        {originalSymptoms && (
                          <button
                            onClick={() => setIsOriginalModalVisible(true)}
                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm border border-indigo-100"
                          >
                            <span>🔍</span> อาการเริ่มต้น
                          </button>
                        )}
                      </div>
                      
                      <div className="relative group/textarea">
                        <textarea
                          className="w-full min-h-[320px] p-6 text-base font-bold leading-relaxed rounded-2xl transition-all duration-500 shadow-inner group-hover/textarea:shadow-md bg-white/80 border-2 border-slate-50 text-slate-700 border-b-indigo-200/30 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5"
                          value={symptomsText}
                          onChange={(e) => setSymptomsText(e.target.value)}
                          placeholder="กรุณาพิมพ์รายละเอียดอาการที่คุณพบ เช่น&#10;• อาการไข้/ไอ/ปวดหัว&#10;• ผลลัพธ์หลังการใช้ยา&#10;• ข้อซักถามเพิ่มเติมถึงเภสัชกร"
                        />
                        <div className="absolute bottom-4 right-4 text-[10px] font-black text-indigo-300 opacity-0 group-hover/textarea:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none">
                          ระบบบันทึกอัตโนมัติทำงาน
                        </div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: '2',
                label: (
                   <div className="flex flex-col items-center py-2 px-1 relative">
                    <span className="text-xl mb-1">⚠️</span>
                    <span className="text-[10px] uppercase tracking-widest font-black">ประวัติแพ้ยา</span>
                    {allergies.length > 0 && (
                      <span className="absolute -top-1 -right-2 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {allergies.length}
                      </span>
                    )}
                  </div>
                ),
                children: (
                  <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <div className="p-6 bg-white/60 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-xl text-rose-600 shadow-sm">⚠️</div>
                          <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">รายการยาที่แพ้</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ข้อมูลความไวต่อยา</p>
                          </div>
                        </div>
                        
                        <button 
                          className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                          type="button" 
                          onClick={() => setIsModalVisible(true)}
                        >
                            <span className="flex items-center justify-center gap-2">
                              <span className="text-lg leading-none">+</span>
                              เพิ่มข้อมูลแพ้ยา
                            </span>
                          </button>

                      </div>

                      {allergies.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl group transition-colors hover:border-indigo-200">
                          <div className="text-5xl mb-4 opacity-10 filter grayscale group-hover:grayscale-0 group-hover:opacity-30 transition-all duration-500">💊</div>
                          <h4 className="text-lg font-black text-slate-300 mb-1">ไม่พบข้อมูลประวัติแพ้ยา</h4>
                          <p className="text-slate-400 text-xs font-medium px-10">เพื่อความปลอดภัย โปรดแจ้งให้เภสัชกรทราบหากท่านมีอาการแพ้ยา</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {allergies.map(row => (
                            <div key={row.id} className="group relative p-5 bg-white border border-slate-50 rounded-2xl shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 border-b-4 border-b-slate-100 hover:border-b-indigo-200">
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 flex flex-col items-center justify-center text-rose-500">
                                  <span className="text-xl">💊</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-black text-slate-800 mb-2 truncate group-hover:text-rose-600 transition-colors">{row.name}</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">อาการที่พบ</div>
                                      <p className="text-xs text-slate-600 font-bold leading-relaxed">{row.symptom || 'ไม่ระบุอาการ'}</p>
                                    </div>
                                    <div className="flex items-center gap-4 pt-1">
                                      <div className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                        เวลา: {row.time || '-'}
                                      </div>
                                    </div>
                                    
                                    <div className="pt-4 flex justify-end">
                                      <button 
                                        type="button"
                                        onClick={() => handleRemoveAllergy(row.id)}
                                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-rose-100 flex items-center gap-2 shadow-sm"
                                      >
                                        <span>🗑️</span> ลบรายการยาที่แพ้
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
            ]}
          />
        </div>

        {/* Unified Premium Action Bar */}
        <div className="mt-8 p-6 bg-slate-900 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] -mr-24 -mt-24"></div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
            <div className="text-center sm:text-left">
              <h4 className="text-xl font-black text-white tracking-tight mb-1">ยืนยันการบันทึกข้อมูล</h4>
              <p className="text-indigo-200/50 text-[10px] font-black uppercase tracking-widest">กรุณาตรวจสอบข้อมูลก่อนกดยืนยัน</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                className="flex-1 sm:flex-none px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-sm transition-all border border-white/10"
                type="button" 
                onClick={handleCancel}
              >
                ยกเลิก
              </button>
              
              <button 
                className={`flex-1 sm:flex-none px-10 py-3 rounded-2xl font-black text-sm shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 ${
                  isSaving
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-indigo-500/20'
                }`}
                type="button" 
                onClick={handleSave} 
                disabled={isSaving}
              >
                <div className="flex items-center justify-center gap-2">
                   {isSaving ? (
                     <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                   ) : (
                     <span>บันทึกข้อมูล</span>
                   )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Redesigned Allergy Modal */}
        <Modal
          title={null}
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setSelectedDrug('');
            setAllergySymptom('');
            setAllergyTime('');
          }}
          footer={null}
          centered
          width={450}
          styles={{ 
            content: { padding: 0, borderRadius: '2rem', overflow: 'hidden', border: 'none' },
            mask: { backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.4)' }
          }}
        >
          <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 text-white">
             <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">⚠️</div>
              <button onClick={() => setIsModalVisible(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <h2 className="text-2xl font-black tracking-tightest">แจ้งรายละเอียดการแพ้ยา</h2>
            <p className="text-rose-100/70 text-xs font-medium">โปรดระบุยาและอาการแพ้ให้ชัดเจนที่สุด</p>
          </div>

          <div className="p-6 bg-slate-50 space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                รายชื่อยาที่แพ้ <span className="text-rose-500">*</span>
              </label>
              <select
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-400/5 focus:outline-none transition-all duration-300 text-slate-700 font-black text-sm appearance-none shadow-sm"
                value={selectedDrug}
                onChange={(e) => setSelectedDrug(e.target.value)}
              >
                <option value="">-- กรุณาเลือกยา --</option>
                {availableDrugs.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">อาการที่เกิดขึ้น</label>
                <input
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-400/5 focus:outline-none transition-all duration-300 text-slate-700 font-bold text-sm shadow-sm placeholder:text-slate-300"
                  type="text"
                  value={allergySymptom}
                  placeholder="เช่น ผื่นคัน, บวม, หายใจไม่ออก"
                  onChange={(e) => setAllergySymptom(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">ระยะเวลาที่เกิด (หลังใช้ยา)</label>
                <input
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-400/5 focus:outline-none transition-all duration-300 text-slate-700 font-bold text-sm shadow-sm placeholder:text-slate-300"
                  type="text"
                  value={allergyTime}
                  placeholder="เช่น 15-30 นาทีหลังรับประทาน"
                  onChange={(e) => setAllergyTime(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setIsModalVisible(false)}
                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-50 transition-all shadow-sm"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleAddAllergy}
                className="flex-[2] py-3.5 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200"
              >
                เพิ่มรายการ
              </button>
            </div>
          </div>
        </Modal>

        {/* View-Only Original Symptoms Modal */}
        <Modal
          title={null}
          open={isOriginalModalVisible}
          onCancel={() => setIsOriginalModalVisible(false)}
          footer={null}
          centered
          width={500}
          styles={{ 
            content: { padding: 0, borderRadius: '2rem', overflow: 'hidden', border: 'none' },
            mask: { backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.4)' }
          }}
        >
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 text-white">
             <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">🔍</div>
              <button onClick={() => setIsOriginalModalVisible(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <h2 className="text-2xl font-black tracking-tightest">อาการเริ่มต้นในรอบนี้</h2>
            <p className="text-indigo-100/70 text-xs font-medium">ข้อมูลอาการที่คุณแจ้งไว้เมื่อเริ่มรับการรักษา</p>
          </div>

          <div className="p-8 bg-white">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
              <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap font-bold">
                {originalSymptoms || 'ไม่มีข้อมูลอาการเริ่มต้น'}
              </div>
            </div>
            
            <button 
              onClick={() => setIsOriginalModalVisible(false)}
              className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              รับทราบ
            </button>
          </div>
        </Modal>
      </main>

      <style jsx="true">{`
        .custom-luxury-tabs .ant-tabs-nav {
          background: rgba(255, 255, 255, 0.6) !important;
          backdrop-filter: blur(20px) !important;
          border-radius: 2rem !important;
          padding: 0.5rem !important;
          border: 1px solid white !important;
          display: flex !important;
          justify-content: center !important;
          margin-bottom: 24px !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.02) !important;
        }
        .custom-luxury-tabs .ant-tabs-tab {
          border-radius: 1.5rem !important;
          padding: 8px 16px !important;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border: none !important;
          margin: 0 4px !important;
          background: transparent !important;
        }
        .custom-luxury-tabs .ant-tabs-tab-active {
          background: #1e293b !important;
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }
        .custom-luxury-tabs .ant-tabs-tab-active .text-xs,
        .custom-luxury-tabs .ant-tabs-tab-active .text-[10px] {
          color: white !important;
        }
        .custom-luxury-tabs .ant-tabs-tab-active .text-xl {
          transform: scale(1.1) rotate(-5deg);
        }
        .custom-luxury-tabs .ant-tabs-ink-bar {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

export default EditSymptomsCustomer;
