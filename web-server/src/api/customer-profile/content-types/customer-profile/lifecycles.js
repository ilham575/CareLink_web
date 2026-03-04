'use strict';

const reminderConfig = require("../../../../../config/reminder-config");

/**
 * แปลง "HH:MM" หรือ "HH:MM:SS" เป็น total minutes จากเที่ยงคืน
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * แปลง total minutes กลับเป็น "HH:MM:SS"
 * รองรับค่าลบ (วนรอบข้ามวัน) และมากกว่า 1440 นาที
 */
function minutesToTime(totalMinutes) {
  let m = ((totalMinutes % 1440) + 1440) % 1440; // normalise 0-1439
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

/**
 * คำนวณเวลาแจ้งเตือนจากเวลาอาหาร + ประเภทความสัมพันธ์กับอาหาร
 * before → แจ้งเตือน 30 นาที ก่อนมื้ออาหาร (กินยาก่อนกินข้าว)
 * after  → แจ้งเตือน 30 นาที หลังมื้ออาหาร (กินข้าวก่อนแล้วค่อยกินยา)
 * with_meal → แจ้งเตือนพร้อมมื้ออาหาร
 * none / other → ใช้เวลาอาหารตรงๆ
 */
function calcNotificationTime(mealTimeStr, mealRelation) {
  const base = timeToMinutes(mealTimeStr);
  if (base === null) return null;
  switch (mealRelation) {
    case 'before':    return minutesToTime(base - 30);
    case 'after':     return minutesToTime(base + 30);
    case 'with_meal': return minutesToTime(base);
    default:          return minutesToTime(base);
  }
}

async function syncSchedules(event) {
  const { result, params } = event;
  const data = params.data || {};

  // Check both event result and input data as Strapi behavior can vary
  const prescribedDrugs = result.prescribed_drugs || data.prescribed_drugs;

  if (prescribedDrugs && Array.isArray(prescribedDrugs) && prescribedDrugs.length > 0) {
    try {
      const customerProfileId = result.id;

      if (!Array.isArray(prescribedDrugs)) return;

      // โหลด customer profile เพื่อดึงเวลาอาหารที่ลูกค้าตั้งไว้
      const customerProfile = await strapi.entityService.findOne(
        'api::customer-profile.customer-profile',
        customerProfileId
      );

      // เวลาอาหารของลูกค้า (ถ้าไม่มีก็ใช้ default)
      const customerMealTimes = {
        morning: customerProfile?.morning_meal_time || '08:00',
        lunch:   customerProfile?.lunch_meal_time   || '12:00',
        evening: customerProfile?.evening_meal_time || '18:00',
        bedtime: customerProfile?.bedtime_time      || '21:00',
      };

      // 1. Get existing schedules for this customer to cleanup
      const existingSchedules = await strapi.entityService.findMany('api::medication-schedule.medication-schedule', {
        filters: { customer: customerProfileId },
      });

      // Delete all old schedules and recreate them to ensure accuracy
      for (const s of existingSchedules) {
        await strapi.entityService.delete('api::medication-schedule.medication-schedule', s.id);
      }

      // 2. Iterate through prescribed drugs and create schedules
      for (const drugItem of prescribedDrugs) {
        const drugId = typeof drugItem === 'string' ? drugItem : drugItem.drugId;
        if (!drugId) continue;

        // drugId อาจเป็น numeric id หรือ document_id (string)
        let drug = null;
        if (typeof drugId === 'number' || /^\d+$/.test(String(drugId))) {
          // numeric id → findOne โดยตรง
          drug = await strapi.entityService.findOne('api::drug.drug', Number(drugId));
        } else {
          // document_id (string) → ค้นหาจาก documentId
          const allDrugs = await strapi.entityService.findMany('api::drug.drug', {
            filters: { documentId: drugId },
            limit: 1,
          });
          drug = allDrugs[0] || null;
        }
        if (!drug) {
          strapi.log.warn(`[MedSchedule] ไม่พบยา drugId=${drugId} — ข้ามรายการนี้`);
          continue;
        }

        const drugName = drug.name_th || drug.name_en || 'Unknown Drug';
        
        // ปริมาณต่อครั้ง (เพื่อเก็บไว้ใน schedule สำหรับข้อความแจ้งเตือน)
        const dosagePerTime = (typeof drugItem === 'object' && drugItem.dosage_per_time)
          ? drugItem.dosage_per_time
          : (drug.dosage_per_time || '');
        
        // ความสัมพันธ์กับอาหาร
        const mealRelation = (typeof drugItem === 'object' ? drugItem.meal_relation : null)
          || drug.meal_relation || 'after';
        
        // Determine times to schedule
        const times = [];

        // Case A: Specific reminder_time provided in prescription (manual override)
        if (typeof drugItem === 'object' && drugItem.reminder_time) {
          let t = drugItem.reminder_time;
          if (t.split(':').length === 2) t += ':00';
          times.push(t);
        }
        // Case B: Frequency-based (every X hours)
        else if (typeof drugItem === 'object' && drugItem.frequency_hours && drugItem.frequency_hours > 0) {
          const freq = drugItem.frequency_hours;
          for (let hour = 0; hour < 24; hour += freq) {
            const hh = String(hour).padStart(2, '0');
            times.push(`${hh}:00:00`);
          }
        }
        // Case C: Meal-based timing โดยใช้เวลาอาหารของลูกค้า (เช้า เที่ยง เย็น ก่อนนอน)
        else {
          if (drugItem.take_morning || drug.take_morning) {
            // ก่อนนอนไม่มี offset (ใช้เวลาตรง), มื้ออาหารอื่นๆ offset ตาม meal_relation
            const t = calcNotificationTime(customerMealTimes.morning, mealRelation);
            if (t) times.push(t);
          }
          if (drugItem.take_lunch || drug.take_lunch) {
            const t = calcNotificationTime(customerMealTimes.lunch, mealRelation);
            if (t) times.push(t);
          }
          if (drugItem.take_evening || drug.take_evening) {
            const t = calcNotificationTime(customerMealTimes.evening, mealRelation);
            if (t) times.push(t);
          }
          if (drugItem.take_bedtime || drug.take_bedtime) {
            // ก่อนนอนใช้เวลาตรงๆ ของลูกค้า ไม่มี offset
            let t = customerMealTimes.bedtime;
            if (t.split(':').length === 2) t += ':00';
            times.push(t);
          }
          
          // Fallback to suggested_time if no meal slots selected but suggested_time exists
          if (times.length === 0 && (drugItem.suggested_time || drug.suggested_time)) {
            let t = drugItem.suggested_time || drug.suggested_time;
            if (t.split(':').length === 2) t += ':00';
            times.push(t);
          }
        }

        // 3. Create schedule entries for each time
        for (const time of times) {
          if (!time) continue;
          
          await strapi.entityService.create('api::medication-schedule.medication-schedule', {
            data: {
              drug_name: drugName,
              schedule_time: time,
              customer: customerProfileId,
              is_active: true,
              meal_relation: mealRelation,
              dosage_per_time: dosagePerTime,
              days_of_week: drugItem.days_of_week || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
              publishedAt: new Date(),
            },
          });
        }
      }
    } catch (err) {
      strapi.log.error('Error in customer-profile lifecycle syncing medication-schedule:', err);
    }
  }
}

module.exports = {
  async afterUpdate(event) {
    await syncSchedules(event);
  },

  async afterCreate(event) {
    await syncSchedules(event);
  },
};
