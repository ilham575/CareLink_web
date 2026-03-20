import React from 'react';

/**
 * DrugNotificationSettingsModal
 * Modal wrapper สำหรับ Notification Settings ในหน้า DrugList
 * เปิดแยกออกมาจาก Modal เพิ่ม/แก้ไขยา เพื่อลด clutter ในฟอร์มหลัก
 *
 * Props:
 *   open              {boolean}   - แสดง/ซ่อน Modal
 *   onClose           {function}  - callback เมื่อปิด Modal (X button / backdrop)
 *   onSave            {function}  - callback เมื่อกดบันทึก (optional; ถ้าไม่ส่งจะใช้ onClose)
 *   formData          {object}    - ข้อมูลฟอร์ม (take_morning, take_lunch, ...)
 *   handleInputChange {function}  - handler เมื่อ input เปลี่ยนแปลง
 *   drugName          {string}    - ชื่อยา (แสดงใน header)
 *   saving            {boolean}   - แสดง loading state บนปุ่มบันทึก
 */
function DrugNotificationSettingsModal({ open, onClose, onSave, formData, handleInputChange, drugName, saving, drugUnit }) {
  if (!open) return null;

  const unitLabel = drugUnit || 'เม็ด';

  const hasAnySlot = formData.take_morning || formData.take_lunch || formData.take_evening || formData.take_bedtime;
  const hasTime = !!formData.suggested_time;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-lg">
              🔔
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">ตั้งค่าการแจ้งเตือน</h3>
              {drugName
                ? <p className="text-xs text-indigo-600 font-bold mt-0.5 truncate max-w-[200px]">{drugName}</p>
                : <p className="text-xs text-slate-400 font-medium mt-0.5">ค่าเริ่มต้นสำหรับยานี้ — ไม่บังคับ</p>
              }
            </div>
          </div>
          <button
            type="button"
            className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200"
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">

          {/* Meal Relation */}
          <div>
            <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none block mb-3">
              ความสัมพันธ์กับอาหาร
            </label>
            <select
              name="meal_relation"
              value={formData.meal_relation}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
            >
              <option value="before">ก่อนอาหาร</option>
              <option value="after">หลังอาหาร</option>
              <option value="with_meal">พร้อมอาหาร</option>
              <option value="none">ไม่ระบุ</option>
            </select>
          </div>

          {/* Time Slots */}
          <div>
            <label className="text-sm font-black text-slate-600 uppercase tracking-widest leading-none block mb-3">
              ช่วงเวลาที่ทาน
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'take_morning', label: 'เช้า', icon: '🌅' },
                { id: 'take_lunch', label: 'เที่ยง', icon: '☀️' },
                { id: 'take_evening', label: 'เย็น', icon: '🌆' },
                { id: 'take_bedtime', label: 'ก่อนนอน', icon: '🌙' },
              ].map(item => (
                <label
                  key={item.id}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData[item.id]
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                      : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    name={item.id}
                    checked={formData[item.id]}
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Manual Time */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-2">
              หรือระบุเวลาแจ้งเตือนที่ต้องการ (Manual)
            </label>
            <div className="relative">
              <input
                type="time"
                name="suggested_time"
                value={formData.suggested_time}
                onChange={handleInputChange}
                className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 pl-10 text-slate-800 font-bold focus:border-indigo-500 transition-all outline-none text-sm"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⏰</span>
            </div>
          </div>

          {/* Frequency (every X hours) */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-2">
              🔄 ทานทุกกี่ชั่วโมง (ไม่บังคับ)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                name="frequency_hours"
                min="0"
                max="24"
                value={formData.frequency_hours || ''}
                onChange={handleInputChange}
                placeholder="เช่น 6"
                className="flex-1 bg-white border-2 border-slate-100 rounded-xl p-3 text-slate-800 font-bold focus:border-indigo-500 transition-all outline-none text-sm"
              />
              <span className="text-sm font-bold text-slate-400 whitespace-nowrap">ชั่วโมง</span>
            </div>
            {formData.frequency_hours > 0 && (
              <p className="text-xs text-indigo-500 font-bold mt-2">💡 ทานยาทุก {formData.frequency_hours} ชั่วโมง ({Math.floor(24 / formData.frequency_hours)} ครั้ง/วัน)</p>
            )}
          </div>

          {/* Dosage per time */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-2">
              💊 ปริมาณที่ทานต่อครั้ง (ไม่บังคับ)
            </label>
            <input
              type="text"
              name="dosage_per_time"
              value={formData.dosage_per_time || ''}
              onChange={handleInputChange}
              placeholder={`เช่น 1 ${unitLabel}, 2 ${unitLabel}`}
              className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 text-slate-800 font-bold focus:border-indigo-500 transition-all outline-none text-sm placeholder:font-medium placeholder:text-slate-300"
            />
          </div>

          {/* Summary badge */}
          {(hasAnySlot || hasTime) && (
            <div className="flex flex-wrap gap-2">
              {formData.take_morning && <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-200">🌅 เช้า</span>}
              {formData.take_lunch && <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-xl text-xs font-bold border border-yellow-200">☀️ เที่ยง</span>}
              {formData.take_evening && <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold border border-orange-200">🌆 เย็น</span>}
              {formData.take_bedtime && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200">🌙 ก่อนนอน</span>}
              {hasTime && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">⏰ {formData.suggested_time}</span>}
              {formData.frequency_hours > 0 && <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold border border-violet-200">🔄 ทุก {formData.frequency_hours} ชม.</span>}
              {formData.dosage_per_time && <span className="px-3 py-1 bg-cyan-50 text-cyan-700 rounded-xl text-xs font-bold border border-cyan-200">💊 {formData.dosage_per_time}</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSave ?? onClose}
            disabled={saving}
            className="flex-[2] px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all duration-200 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && (
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DrugNotificationSettingsModal;
