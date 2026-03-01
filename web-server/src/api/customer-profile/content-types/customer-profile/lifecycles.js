'use strict';

const reminderConfig = require("../../../../../config/reminder-config");

async function syncSchedules(event) {
  const { result, params } = event;
  const data = params.data || {};

  // Check both event result and input data as Strapi behavior can vary
  const prescribedDrugs = result.prescribed_drugs || data.prescribed_drugs;

  if (prescribedDrugs) {
    try {
      const customerProfileId = result.id;

      if (!Array.isArray(prescribedDrugs)) return;

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

        const drug = await strapi.entityService.findOne('api::drug.drug', drugId);
        if (!drug) continue;

        const drugName = drug.name_th || drug.name_en || 'Unknown Drug';
        
        // Build dosage label for notification message
        const dosageLabel = (typeof drugItem === 'object' && drugItem.dosage_per_time) 
          ? ` (ครั้งละ ${drugItem.dosage_per_time})` 
          : (drug.dosage_per_time ? ` (ครั้งละ ${drug.dosage_per_time})` : '');
        
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
        // Case C: Meal-based timing (เช้า เที่ยง เย็น ก่อนนอน)
        else {
          const mealType = drugItem.meal_relation || drug.meal_relation || 'after';
          const timeConfig = mealType === 'before' ? reminderConfig.TIMES.BEFORE_MEAL : reminderConfig.TIMES.AFTER_MEAL;
          
          if (drugItem.take_morning || drug.take_morning) times.push(timeConfig.MORNING);
          if (drugItem.take_lunch || drug.take_lunch) times.push(timeConfig.LUNCH);
          if (drugItem.take_evening || drug.take_evening) times.push(timeConfig.EVENING);
          if (drugItem.take_bedtime || drug.take_bedtime) times.push(reminderConfig.TIMES.BEFORE_BED);
          
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
              drug_name: drugName + dosageLabel,
              schedule_time: time,
              customer: customerProfileId,
              is_active: true,
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
