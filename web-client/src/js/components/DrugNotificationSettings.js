import React from 'react';

/**
 * DrugNotificationSettings
 * เป็น form section สำหรับตั้งค่าเวลาทานยา (Notification Settings)
 * ใช้ในหน้า DrugList.js เมื่อเพิ่ม/แก้ไขข้อมูลยา
 * 
 * - ตั้งค่านี้เป็น OPTIONAL - ใช้เป็นค่าเริ่มต้นสำหรับลูกค้า
 * - เลือกช่วงเวลา (เช้า เที่ยง เย็น ก่อนนอน)
 * - ระบุเวลาเฉพาะ (Manual)
 * - เลือกความสัมพันธ์กับอาหาร (ก่อน หลัง พร้อม ไม่ระบุ)
 */
function DrugNotificationSettings({
  formData,
  handleInputChange
}) {
  return (
    <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-6">
      {/* Meal Relation Selector */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-black text-indigo-600 uppercase tracking-widest leading-none">
          ช่วงเวลาที่ทาน
          <span className="ml-2 text-slate-400 font-medium normal-case tracking-normal text-xs">(ไม่บังคับ — ใช้เป็นค่าเริ่มต้น)</span>
        </label>
        <select
          name="meal_relation"
          value={formData.meal_relation}
          onChange={handleInputChange}
          className="bg-white border-2 border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-700 outline-none"
        >
          <option value="before">ก่อนอาหาร</option>
          <option value="after">หลังอาหาร</option>
          <option value="with_meal">พร้อมอาหาร</option>
          <option value="none">ไม่ระบุ</option>
        </select>
      </div>

      {/* Time Slots - Checkboxes */}
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

      {/* Manual Time Input */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
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
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
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
          <p className="text-xs text-indigo-500 font-bold">💡 ทานยาทุก {formData.frequency_hours} ชั่วโมง ({Math.floor(24 / formData.frequency_hours)} ครั้ง/วัน)</p>
        )}
      </div>

      {/* Dosage per time */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
          💊 ปริมาณที่ทานต่อครั้ง (ไม่บังคับ)
        </label>
        <input
          type="text"
          name="dosage_per_time"
          value={formData.dosage_per_time || ''}
          onChange={handleInputChange}
          placeholder="เช่น 1 เม็ด, 2 ช้อนชา, 10 ml"
          className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 text-slate-800 font-bold focus:border-indigo-500 transition-all outline-none text-sm placeholder:font-medium placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}

export default DrugNotificationSettings;
