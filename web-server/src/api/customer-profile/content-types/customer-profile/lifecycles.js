'use strict';

const { randomBytes } = require('crypto');
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
 * Parse reminder_time ที่อาจมาในหลาย format:
 *   - "06:45 AM" / "6:45 AM"  (12-hour AM/PM จาก frontend)
 *   - "18:30"                  (24-hour HH:MM)
 *   - "18:30:00"               (24-hour HH:MM:SS)
 * คืนค่า "HH:MM:SS" 24-hour เสมอ หรือ null ถ้า parse ไม่ได้
 */
function parseReminderTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const t = timeStr.trim();
  if (!t) return null;

  // 12-hour format: "6:45 AM", "06:45 AM", "12:30 PM"
  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'AM') {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }

  // 24-hour HH:MM:SS
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}:00`;
  }

  // 24-hour HH:MM
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}:00`;
  }

  return null;
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

function chunkArray(list, size = 100) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

let scheduleSchemaFlagsPromise = null;

async function getScheduleSchemaFlags(knex) {
  if (!scheduleSchemaFlagsPromise) {
    scheduleSchemaFlagsPromise = Promise.all([
      knex.schema.hasTable('medication_schedules_customer_lnk'),
      knex.schema.hasColumn('medication_schedules', 'customer_document_id'),
      knex.schema.hasColumn('medication_schedules', 'customer_id'),
    ]).then(([hasScheduleCustomerLinkTable, hasScheduleCustomerDocumentIdColumn, hasScheduleCustomerIdColumn]) => ({
      hasScheduleCustomerLinkTable,
      hasScheduleCustomerDocumentIdColumn,
      hasScheduleCustomerIdColumn,
    })).catch((error) => {
      scheduleSchemaFlagsPromise = null;
      throw error;
    });
  }

  return scheduleSchemaFlagsPromise;
}

async function loadDrugsForSchedules(knex, prescribedDrugs) {
  const numericDrugIds = new Set();
  const documentDrugIds = new Set();

  for (const drugItem of Array.isArray(prescribedDrugs) ? prescribedDrugs : []) {
    const rawDrugId = typeof drugItem === 'string'
      ? drugItem
      : (drugItem?.drugId || drugItem?.documentId || drugItem?.id);

    if (!rawDrugId) continue;

    if (typeof rawDrugId === 'number' || /^\d+$/.test(String(rawDrugId))) {
      numericDrugIds.add(Number(rawDrugId));
    } else {
      documentDrugIds.add(String(rawDrugId));
    }
  }

  const selectFields = [
    'id',
    'document_id',
    'name_th',
    'name_en',
    'dosage_per_time',
    'meal_relation',
    'take_morning',
    'take_lunch',
    'take_evening',
    'take_bedtime',
    'suggested_time'
  ];

  const drugRows = [];

  if (numericDrugIds.size > 0) {
    const rowsById = await knex('drugs')
      .whereIn('id', Array.from(numericDrugIds))
      .select(selectFields);
    drugRows.push(...(rowsById || []));
  }

  if (documentDrugIds.size > 0) {
    const rowsByDocumentId = await knex('drugs')
      .whereIn('document_id', Array.from(documentDrugIds))
      .select(selectFields);
    drugRows.push(...(rowsByDocumentId || []));
  }

  const drugByKey = new Map();
  for (const row of drugRows) {
    if (!row) continue;

    const normalizedDrug = {
      id: row.id,
      documentId: row.document_id,
      name_th: row.name_th,
      name_en: row.name_en,
      dosage_per_time: row.dosage_per_time,
      meal_relation: row.meal_relation,
      take_morning: !!row.take_morning,
      take_lunch: !!row.take_lunch,
      take_evening: !!row.take_evening,
      take_bedtime: !!row.take_bedtime,
      suggested_time: row.suggested_time,
    };

    drugByKey.set(String(row.id), normalizedDrug);
    if (row.document_id) {
      drugByKey.set(String(row.document_id), normalizedDrug);
    }
  }

  return drugByKey;
}

const SCHEDULE_TRIGGER_FIELDS = new Set([
  'prescribed_drugs',
  'morning_meal_time',
  'lunch_meal_time',
  'evening_meal_time',
  'bedtime_time',
]);

function shouldSyncSchedules(event) {
  const action = event?.action || '';
  const data = event?.params?.data || {};

  if (action === 'afterCreate') {
    return true;
  }

  const changedKeys = Object.keys(data);
  if (changedKeys.length === 0) {
    return false;
  }

  return changedKeys.some((key) => SCHEDULE_TRIGGER_FIELDS.has(key));
}

async function syncSchedules(event) {
  const { result, params } = event;
  const data = params.data || {};

  if (!shouldSyncSchedules(event)) {
    strapi.log.info(
      `[MedSchedule] Skip sync for customer ${result?.id || 'n/a'} because update does not affect schedules`
    );
    return;
  }

  // Strapi v5 with draft/publish can fire lifecycle for draft + published rows.
  // Only sync schedules from published rows to avoid duplicate schedules.
  // NOTE: draftAndPublish:true means normal PUTs update the draft row (published_at=null).
  // We must NOT skip draft rows — pharmacy always updates the draft when assigning prescribed_drugs.
  // The historyCount guard below prevents runaway creation with no matching notification history.

  // รับ prescribed_drugs จาก result (ค่าหลัง save) หรือ data (ค่าที่ส่งมา)
  const prescribedDrugs = result.prescribed_drugs || data.prescribed_drugs;

  strapi.log.info(`[MedSchedule] syncSchedules fired — customerId=${result.id}, prescribed_drugs count=${Array.isArray(prescribedDrugs) ? prescribedDrugs.length : 'N/A (not array)'}`);

  try {
    const knex = strapi.db.connection;
    const {
      hasScheduleCustomerLinkTable,
      hasScheduleCustomerDocumentIdColumn,
      hasScheduleCustomerIdColumn,
    } = await getScheduleSchemaFlags(knex);

    const customerProfileId = result.id;
    const customerDocumentId = result.documentId;

    let cleanupCustomerIds = [customerProfileId];
    if (customerDocumentId) {
      // Use raw SQL so we get ALL rows for this documentId (both draft + published).
      // entityService.findMany with draftAndPublish content-types only returns one status variant
      // at a time, so it would miss the published row when the lifecycle fires on the draft row.
      const allCustomerRows = await knex('customer_profiles')
        .where('document_id', customerDocumentId)
        .select('id');

      const siblingIds = (Array.isArray(allCustomerRows) ? allCustomerRows : [])
        .map((row) => row.id)
        .filter(Boolean);

      cleanupCustomerIds = Array.from(new Set([customerProfileId, ...siblingIds]));
    }

    // Use the published row (highest numeric ID among siblings) for schedule linking,
    // consistent with the notification lifecycle approach.
    const targetCustomerId = cleanupCustomerIds.slice().sort((a, b) => b - a)[0] || customerProfileId;

    // Strapi can fire this lifecycle more than once for the same documentId (draft + sibling rows).
    // Only let the highest sibling row perform the heavy delete/rebuild work to avoid self-contention.
    if (cleanupCustomerIds.length > 1 && customerProfileId !== targetCustomerId) {
      strapi.log.info(
        `[MedSchedule] Skip duplicate sync for customer ${customerProfileId}` +
        ` (documentId=${customerDocumentId || 'n/a'}, targetId=${targetCustomerId})`
      );
      return;
    }

    // ลบ schedules เก่าของลูกค้าคนนี้ออกก่อนเสมอ
    // เพื่อกันเคสประวัติใหม่ที่ไม่มียาแล้ว schedule เก่าค้างอยู่
    const collectedScheduleIds = [];

    if (hasScheduleCustomerDocumentIdColumn && customerDocumentId) {
      const documentLinkedScheduleIds = await knex('medication_schedules')
        .where('customer_document_id', customerDocumentId)
        .pluck('id');
      collectedScheduleIds.push(...(documentLinkedScheduleIds || []));
    }

    if (!hasScheduleCustomerDocumentIdColumn && hasScheduleCustomerLinkTable) {
      const linkedScheduleIds = await knex('medication_schedules_customer_lnk')
        .whereIn('customer_profile_id', cleanupCustomerIds)
        .pluck('medication_schedule_id');
      collectedScheduleIds.push(...(linkedScheduleIds || []));
    }

    if (!hasScheduleCustomerDocumentIdColumn && hasScheduleCustomerIdColumn) {
      const directScheduleIds = await knex('medication_schedules')
        .whereIn('customer_id', cleanupCustomerIds)
        .pluck('id');
      collectedScheduleIds.push(...(directScheduleIds || []));
    }

    const uniqueScheduleIds = Array.from(new Set(collectedScheduleIds.filter(Boolean)));

    strapi.log.info(
      `[MedSchedule] Deleting ${uniqueScheduleIds.length} existing schedule(s) for customer ${customerProfileId}` +
      ` (documentId=${customerDocumentId || 'n/a'}, targetId=${targetCustomerId}, linkedProfiles=${cleanupCustomerIds.join(',')})`
    );
    if (uniqueScheduleIds.length > 0) {
      // Use raw Knex to avoid nested-transaction deadlock inside the lifecycle.
      if (!hasScheduleCustomerDocumentIdColumn && hasScheduleCustomerLinkTable) {
        await knex('medication_schedules_customer_lnk')
          .whereIn('medication_schedule_id', uniqueScheduleIds)
          .delete();
      }
      await knex('medication_schedules')
        .whereIn('id', uniqueScheduleIds)
        .delete();
    }

    if (!prescribedDrugs || !Array.isArray(prescribedDrugs) || prescribedDrugs.length === 0) {
      strapi.log.info('[MedSchedule] No prescribed_drugs found — old schedules cleared and skipping create');
      return;
    }

    // If no remaining visit-history notifications exist, do not recreate schedules from stale profile data.
    const historyCountRows = await knex('notifications as n')
      .join('notifications_customer_profile_lnk as ncp', 'ncp.notification_id', 'n.id')
      .whereIn('ncp.customer_profile_id', cleanupCustomerIds)
      .whereIn('n.type', ['customer_assignment', 'message'])
      .countDistinct('n.id as total');

    const historyCount = Number(historyCountRows?.[0]?.total || 0);
    if (historyCount === 0) {
      strapi.log.info(
        `[MedSchedule] No history notifications remain for documentId=${customerDocumentId || 'n/a'}` +
        ' — skipping schedule recreate'
      );
      return;
    }

    // โหลด customer profile เพื่อดึงเวลาอาหารที่ลูกค้าตั้งไว้
    // ใช้ targetCustomerId (published row) เพื่อดึงข้อมูลที่ถูกต้อง
    const customerProfile = await knex('customer_profiles')
      .where('id', targetCustomerId)
      .first('morning_meal_time', 'lunch_meal_time', 'evening_meal_time', 'bedtime_time');

    // เวลาอาหารของลูกค้า (ถ้าไม่มีก็ใช้ default)
    const customerMealTimes = {
      morning: customerProfile?.morning_meal_time || '08:00',
      lunch:   customerProfile?.lunch_meal_time   || '12:00',
      evening: customerProfile?.evening_meal_time || '18:00',
      bedtime: customerProfile?.bedtime_time      || '21:00',
    };

    const drugLookupStart = Date.now();
    const drugByKey = await loadDrugsForSchedules(knex, prescribedDrugs);
    strapi.log.info(`[MedSchedule] Loaded ${drugByKey.size} drug lookup keys in ${Date.now() - drugLookupStart}ms`);

    const pendingScheduleRows = [];
    const pendingScheduleDocIds = [];

    // สร้าง schedule ใหม่จาก prescribed_drugs แต่ละรายการ
    for (const drugItem of prescribedDrugs) {
      const drugId = typeof drugItem === 'string'
        ? drugItem
        : (drugItem.drugId || drugItem.documentId || drugItem.id);
      if (!drugId) continue;

      const drug = drugByKey.get(String(drugId)) || null;

      if (!drug) {
        strapi.log.warn(`[MedSchedule] ไม่พบยา drugId=${drugId} — ข้ามรายการนี้`);
        continue;
      }

      const drugName = drug.name_th || drug.name_en || 'Unknown Drug';
      const dosagePerTime = (typeof drugItem === 'object' && drugItem.dosage_per_time)
        ? drugItem.dosage_per_time
        : (drug.dosage_per_time || '');
      const mealRelation = (typeof drugItem === 'object' ? drugItem.meal_relation : null)
        || drug.meal_relation || 'after';
      const takeUntilFinished = (typeof drugItem === 'object') ? !!drugItem.take_until_finished : false;

        // กำหนดเวลาแจ้งเตือน
        const times = [];

      // Case A: เจาะจงเวลา (Manual override) — รองรับทั้ง 12-hour AM/PM และ 24-hour
      if (typeof drugItem === 'object' && drugItem.reminder_time && String(drugItem.reminder_time).trim() !== '') {
        const t = parseReminderTime(String(drugItem.reminder_time));
        if (t) {
          times.push(t);
        } else {
          strapi.log.warn(`[MedSchedule] Drug "${drugName}" → Case A: ไม่สามารถ parse reminder_time="${drugItem.reminder_time}" — ข้าม`);
        }
      }
      // Case B: ทุกกี่ชั่วโมง
      else if (typeof drugItem === 'object' && drugItem.frequency_hours && Number(drugItem.frequency_hours) > 0) {
        const freq = Number(drugItem.frequency_hours);
        for (let hour = 0; hour < 24; hour += freq) {
          times.push(`${String(hour).padStart(2, '0')}:00:00`);
        }
      }
      // Case C: ช่วงมื้ออาหาร
      else {
        if (drugItem.take_morning || drug.take_morning) {
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
          let t = customerMealTimes.bedtime;
          if (t.split(':').length === 2) t += ':00';
          times.push(t);
        }
        // Fallback: suggested_time จากยา
        if (times.length === 0 && (drugItem.suggested_time || drug.suggested_time)) {
          let t = drugItem.suggested_time || drug.suggested_time;
          if (t.split(':').length === 2) t += ':00';
          times.push(t);
        }
      }

      if (times.length === 0) {
        strapi.log.warn(`[MedSchedule] Drug "${drugName}" — ไม่มีเวลาแจ้งเตือน ข้ามรายการนี้`);
        continue;
      }

      const uniqueTimes = Array.from(new Set(times.filter(Boolean)));
      for (const time of uniqueTimes) {
        const docId = randomBytes(12).toString('hex'); // 24-char unique documentId
        const scheduleInsertData = {
          document_id: docId,
          drug_name: drugName,
          schedule_time: time,
          is_active: true,
          customer_document_id: hasScheduleCustomerDocumentIdColumn ? customerDocumentId || null : undefined,
          customer_id: hasScheduleCustomerIdColumn ? targetCustomerId : undefined,
          meal_relation: mealRelation,
          dosage_per_time: dosagePerTime || null,
          take_until_finished: takeUntilFinished,
          days_of_week: JSON.stringify(drugItem.days_of_week || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
          created_at: new Date(),
          updated_at: new Date(),
        };

        if (!hasScheduleCustomerDocumentIdColumn) {
          delete scheduleInsertData.customer_document_id;
        }
        if (!hasScheduleCustomerIdColumn) {
          delete scheduleInsertData.customer_id;
        }

        pendingScheduleRows.push(scheduleInsertData);
        pendingScheduleDocIds.push(docId);
      }
    }

    if (pendingScheduleRows.length === 0) {
      strapi.log.info(`[MedSchedule] No schedule rows to create for customer ${targetCustomerId}`);
      return;
    }

    const insertStart = Date.now();
    await knex.transaction(async (trx) => {
      for (const batch of chunkArray(pendingScheduleRows, 200)) {
        await trx('medication_schedules').insert(batch);
      }

      if (targetCustomerId && hasScheduleCustomerLinkTable && !hasScheduleCustomerIdColumn && !hasScheduleCustomerDocumentIdColumn) {
        const existingCustomerRow = await trx('customer_profiles')
          .where('id', targetCustomerId)
          .first('id');

        if (!existingCustomerRow?.id) {
          throw new Error(`Customer profile ${targetCustomerId} not found for legacy schedule link insert`);
        }

        const insertedScheduleRows = [];
        for (const batch of chunkArray(pendingScheduleDocIds, 300)) {
          const rows = await trx('medication_schedules')
            .whereIn('document_id', batch)
            .select('id');
          insertedScheduleRows.push(...(rows || []));
        }

        const linkRows = insertedScheduleRows
          .map((row) => row?.id)
          .filter(Boolean)
          .map((scheduleId) => ({
            medication_schedule_id: scheduleId,
            customer_profile_id: existingCustomerRow.id,
          }));

        for (const batch of chunkArray(linkRows, 500)) {
          await trx('medication_schedules_customer_lnk')
            .insert(batch)
            .onConflict(['medication_schedule_id', 'customer_profile_id'])
            .ignore();
        }
      }
    });

    strapi.log.info(
      `[MedSchedule] Created ${pendingScheduleRows.length} schedule row(s) for customer ${targetCustomerId}` +
      ` in ${Date.now() - insertStart}ms`
    );

    strapi.log.info(`[MedSchedule] ✅ Schedule sync complete for customer ${targetCustomerId} (updated row: ${customerProfileId})`);
  } catch (err) {
    strapi.log.error('[MedSchedule] ❌ Error syncing medication-schedule:', err);
  }
}

module.exports = {
  async afterUpdate(event) {
    event.action = 'afterUpdate';
    await syncSchedules(event);
  },

  async afterCreate(event) {
    event.action = 'afterCreate';
    await syncSchedules(event);
  },
};
