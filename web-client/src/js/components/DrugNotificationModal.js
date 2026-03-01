import React from 'react';
import { Modal } from 'antd';
import { toast } from 'react-toastify';

/**
 * DrugNotificationModal
 * Modal สำหรับตั้งค่าเวลาทานยา (Notification Settings)
 * - เลือกช่วงเวลา (เช้า เที่ยง เย็น นอน)
 * - ระบุเวลาเฉพาะ (Manual)
 * - เลือกความสัมพันธ์กับอาหาร (ก่อน หลัง พร้อม ไม่ระบุ)
 */
function DrugNotificationModal({
  drugNotificationModal,
  setDrugNotificationModal,
  addDrugModal,
  setAddDrugModal,
  setDrugQuantities
}) {
  if (!drugNotificationModal.open || !drugNotificationModal.drug) {
    return null;
  }

  const handleSave = () => {
    // Validate: ถ้าเลือกกรอกเอง ต้องมีเวลา (slot หรือ manual)
    if (!drugNotificationModal.useDefaults) {
      const hasSlot = drugNotificationModal.take_morning || drugNotificationModal.take_lunch ||
        drugNotificationModal.take_evening || drugNotificationModal.take_bedtime;
      const hasTime = drugNotificationModal.reminder_time && String(drugNotificationModal.reminder_time).trim() !== '';
      
      if (!hasSlot && !hasTime) {
        toast.error('กรุณาเลือกเวลาทานยา (ไม่ว่าจะเป็นช่วงเวลาหรือเวลาเฉพาะ)');
        return;
      }
    }

    // บันทึกเข้า selectedDrugs
    setAddDrugModal(prev => ({
      ...prev,
      selectedDrugs: [...prev.selectedDrugs, {
        drugId: drugNotificationModal.drugId,
        quantity: drugNotificationModal.quantity,
        take_morning: drugNotificationModal.take_morning,
        take_lunch: drugNotificationModal.take_lunch,
        take_evening: drugNotificationModal.take_evening,
        take_bedtime: drugNotificationModal.take_bedtime,
        meal_relation: drugNotificationModal.meal_relation,
        reminder_time: drugNotificationModal.reminder_time,
        dosage_per_time: drugNotificationModal.dosage_per_time,
        frequency_hours: drugNotificationModal.frequency_hours
      }]
    }));
    
    // ตั้งค่า quantities
    setDrugQuantities(prev => ({ ...prev, [drugNotificationModal.drugId]: drugNotificationModal.quantity }));
    
    // ปิด modal และ reset state
    setDrugNotificationModal(prev => ({ ...prev, open: false }));
    
    toast.success('เพิ่มยาสำเร็จ');
  };

  return (
    <Modal
      title={null}
      open={drugNotificationModal.open}
      onCancel={() => setDrugNotificationModal(prev => ({ ...prev, open: false }))}
      footer={null}
      centered
      width={typeof window !== 'undefined' && window.innerWidth <= 768 ? '95%' : 550}
      style={{ maxWidth: typeof window !== 'undefined' && window.innerWidth <= 768 ? '95vw' : 'auto' }}
      className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:overflow-hidden [&_.ant-modal-body]:p-0"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-2xl text-white shadow-lg shadow-indigo-200">🔔</div>
          <div>
            <h3 className="text-xl font-black text-slate-800">ตั้งค่าเวลาทานยา</h3>
            <p className="text-sm text-slate-400">{drugNotificationModal.drug?.name_th}</p>
          </div>
        </div>

        {/* Drug Info Summary */}
        <div className="mb-4 p-4 bg-slate-50 rounded-2xl flex gap-4">
          <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black">Rx</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-black text-slate-800 mb-1">{drugNotificationModal.drug?.name_th}</h4>
            <p className="text-sm text-slate-500">{drugNotificationModal.drug?.name_en}</p>
            {drugNotificationModal.drug?.manufacturer && <p className="text-xs text-indigo-600 font-bold mt-1">📦 {drugNotificationModal.drug.manufacturer}</p>}
          </div>
        </div>

        {/* Source Selector */}
        <div className="mb-5 flex rounded-2xl overflow-hidden border-2 border-indigo-200">
          <button
            type="button"
            onClick={() => setDrugNotificationModal(prev => ({
              ...prev,
              useDefaults: true,
              take_morning: prev.drugDefaults.take_morning,
              take_lunch: prev.drugDefaults.take_lunch,
              take_evening: prev.drugDefaults.take_evening,
              take_bedtime: prev.drugDefaults.take_bedtime,
              meal_relation: prev.drugDefaults.meal_relation,
              reminder_time: prev.drugDefaults.reminder_time,
              dosage_per_time: prev.drugDefaults.dosage_per_time,
              frequency_hours: prev.drugDefaults.frequency_hours,
            }))}
            className={`flex-1 py-3 text-sm font-bold transition-all ${drugNotificationModal.useDefaults ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-indigo-50'}`}
          >
            📋 ใช้ค่าจาก DrugList
          </button>
          <button
            type="button"
            onClick={() => setDrugNotificationModal(prev => ({ ...prev, useDefaults: false }))}
            className={`flex-1 py-3 text-sm font-bold transition-all ${!drugNotificationModal.useDefaults ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-indigo-50'}`}
          >
            ✏️ กรอกเองใหม่
          </button>
        </div>

        {/* Notification Settings */}
        {drugNotificationModal.useDefaults ? (
          /* --- Read-only defaults view --- */
          <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 mb-6 space-y-4">
            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">ค่าตั้งต้นจาก Drug List</p>

            {/* Meal Relation */}
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">เวลาทานเทียบกับอาหาร</p>
              <span className="inline-block px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">
                {({ before: '🍽️ ก่อนอาหาร', after: '🍽️ หลังอาหาร', with_meal: '🍽️ พร้อมอาหาร', none: '— ไม่ระบุ' })[drugNotificationModal.meal_relation] || '— ไม่ระบุ'}
              </span>
            </div>

            {/* Time Slots */}
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">ช่วงเวลาที่ต้องทาน</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'take_morning', label: '🌅 เช้า' },
                  { id: 'take_lunch', label: '☀️ เที่ยง' },
                  { id: 'take_evening', label: '🌆 เย็น' },
                  { id: 'take_bedtime', label: '🌙 ก่อนนอน' },
                ].filter(s => drugNotificationModal[s.id]).map(s => (
                  <span key={s.id} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">{s.label}</span>
                ))}
                {!drugNotificationModal.take_morning && !drugNotificationModal.take_lunch && !drugNotificationModal.take_evening && !drugNotificationModal.take_bedtime && (
                  <span className="text-slate-400 text-sm italic">ไม่ได้ระบุช่วงเวลา</span>
                )}
              </div>
            </div>

            {/* Reminder time */}
            {drugNotificationModal.reminder_time && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">เวลาแจ้งเตือนเฉพาะ</p>
                <span className="inline-block px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">⏰ {drugNotificationModal.reminder_time}</span>
              </div>
            )}

            {/* Frequency */}
            {drugNotificationModal.frequency_hours > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">ความถี่</p>
                <span className="inline-block px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-bold">🔄 ทุก {drugNotificationModal.frequency_hours} ชั่วโมง</span>
              </div>
            )}

            {/* Dosage */}
            {drugNotificationModal.dosage_per_time && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">ปริมาณต่อครั้ง</p>
                <span className="inline-block px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-lg text-sm font-bold">💊 {drugNotificationModal.dosage_per_time}</span>
              </div>
            )}

            {!drugNotificationModal.take_morning && !drugNotificationModal.take_lunch &&
             !drugNotificationModal.take_evening && !drugNotificationModal.take_bedtime &&
             !drugNotificationModal.reminder_time && !drugNotificationModal.frequency_hours &&
             !drugNotificationModal.dosage_per_time && (
              <p className="text-sm text-amber-600 font-bold">⚠️ Drug List ยังไม่มีค่าตั้งต้น — กรุณาเลือก "กรอกเองใหม่"</p>
            )}
          </div>
        ) : (
          /* --- Editable form --- */
          <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-6 mb-6">
            {/* Meal Relation Selector */}
            <div>
              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 block">เวลาทานเทียบกับอาหาร</label>
              <select
                value={drugNotificationModal.meal_relation}
                onChange={(e) => setDrugNotificationModal(prev => ({ ...prev, meal_relation: e.target.value }))}
                className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-indigo-700 outline-none"
              >
                <option value="before">ก่อนอาหาร</option>
                <option value="after">หลังอาหาร</option>
                <option value="with_meal">พร้อมอาหาร</option>
                <option value="none">ไม่ระบุ</option>
              </select>
            </div>

            {/* Time Slots */}
            <div>
              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 block">เลือกช่วงเวลาทานยา</label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: 'take_morning', label: 'เช้า', icon: '🌅' },
                  { id: 'take_lunch', label: 'เที่ยง', icon: '☀️' },
                  { id: 'take_evening', label: 'เย็น', icon: '🌆' },
                  { id: 'take_bedtime', label: 'นอน', icon: '🌙' },
                ].map(slot => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setDrugNotificationModal(prev => ({ ...prev, [slot.id]: !prev[slot.id] }))}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      drugNotificationModal[slot.id]
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                    }`}
                  >
                    <span className="text-2xl">{slot.icon}</span>
                    <span className="text-[11px] font-black uppercase leading-none">{slot.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Time */}
            <div>
              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>⏰ หรือระบุเวลาเฉพาะ</span>
                <span className="text-slate-400 font-medium text-[10px] normal-case">(ไม่บังคับ)</span>
              </label>
              <input
                type="time"
                value={drugNotificationModal.reminder_time}
                onChange={(e) => setDrugNotificationModal(prev => ({ ...prev, reminder_time: e.target.value }))}
                className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Frequency (every X hours) */}
            <div>
              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>🔄 ทานทุกกี่ชั่วโมง</span>
                <span className="text-slate-400 font-medium text-[10px] normal-case">(ไม่บังคับ)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={drugNotificationModal.frequency_hours || ''}
                  onChange={(e) => setDrugNotificationModal(prev => ({ ...prev, frequency_hours: parseInt(e.target.value) || 0 }))}
                  placeholder="เช่น 6"
                  className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                />
                <span className="text-sm font-bold text-slate-500 whitespace-nowrap">ชั่วโมง</span>
              </div>
              {drugNotificationModal.frequency_hours > 0 && (
                <p className="text-xs text-indigo-500 font-bold mt-2">💡 ทานยาทุก {drugNotificationModal.frequency_hours} ชั่วโมง ({Math.floor(24 / drugNotificationModal.frequency_hours)} ครั้ง/วัน)</p>
              )}
            </div>

            {/* Dosage per time */}
            <div>
              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 block">💊 ปริมาณที่ทานต่อครั้ง</label>
              <input
                type="text"
                value={drugNotificationModal.dosage_per_time || ''}
                onChange={(e) => setDrugNotificationModal(prev => ({ ...prev, dosage_per_time: e.target.value }))}
                placeholder="เช่น 1 เม็ด, 2 ช้อนชา, 10 ml"
                className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none placeholder:font-medium placeholder:text-slate-300"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setDrugNotificationModal(prev => ({ ...prev, open: false }))}
            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition-all active:scale-95"
          >
            บันทึก
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default DrugNotificationModal;
