"use strict";

/**
 * notification controller
 */

const { randomBytes } = require('crypto');
const { createCoreController } = require('@strapi/strapi').factories;

const HISTORY_TYPES = ['customer_assignment', 'customer_assignment_update', 'message'];
const BASE_HISTORY_TYPES = new Set(['customer_assignment', 'message']);
const DELETE_REBUILD_TYPES = new Set(['customer_assignment', 'customer_assignment_update', 'message']);
const RELATION_TABLE_BY_UID = {
  'api::staff-profile.staff-profile': 'staff_profiles',
  'api::pharmacy-profile.pharmacy-profile': 'pharmacy_profiles',
  'api::customer-profile.customer-profile': 'customer_profiles',
  'api::drug-store.drug-store': 'drug_stores',
};
const NOTIFICATION_LINK_TABLES = [
  'notifications_staff_profile_lnk',
  'notifications_pharmacy_profile_lnk',
  'notifications_customer_profile_lnk',
  'notifications_drug_store_lnk',
];

async function resolveRelationId(strapi, uid, relationValue) {
  if (!relationValue) return null;

  if (typeof relationValue === 'object') {
    if (relationValue.id) return relationValue.id;
    if (!relationValue.documentId) return null;

    const tableName = RELATION_TABLE_BY_UID[uid];
    if (tableName) {
      const row = await strapi.db.connection(tableName)
        .where('document_id', relationValue.documentId)
        .select('id')
        .first();
      if (row?.id) return row.id;
    }

    const found = await strapi.entityService.findMany(uid, {
      filters: { documentId: relationValue.documentId },
      limit: 1,
    });
    return Array.isArray(found) && found[0] ? found[0].id : null;
  }

  if (typeof relationValue === 'number') return relationValue;

  const relationStr = String(relationValue);
  if (/^\d+$/.test(relationStr)) return Number(relationStr);

  const tableName = RELATION_TABLE_BY_UID[uid];
  if (tableName) {
    const row = await strapi.db.connection(tableName)
      .where('document_id', relationStr)
      .select('id')
      .first();
    if (row?.id) return row.id;
  }

  const found = await strapi.entityService.findMany(uid, {
    filters: { documentId: relationStr },
    limit: 1,
  });
  return Array.isArray(found) && found[0] ? found[0].id : null;
}

function extractPrescribedDrugs(notification) {
  const nested = notification?.data?.data?.prescribed_drugs;
  if (Array.isArray(nested)) return nested;

  const flat = notification?.data?.prescribed_drugs;
  if (Array.isArray(flat)) return flat;

  return [];
}

function getMedicationScheduleMode(notification) {
  const nestedMode = notification?.data?.data?.medication_schedule_mode;
  if (nestedMode === 'append' || nestedMode === 'replace') return nestedMode;

  const flatMode = notification?.data?.medication_schedule_mode;
  if (flatMode === 'append' || flatMode === 'replace') return flatMode;

  return 'replace';
}

function normalizePrescribedDrugItem(item) {
  if (!item) return null;

  if (typeof item === 'string') {
    return {
      drugId: item,
      quantity: 1,
      reminder_time: '',
      take_morning: false,
      take_lunch: false,
      take_evening: false,
      take_bedtime: false,
      meal_relation: 'after',
      dosage_per_time: '',
      frequency_hours: 0,
      take_until_finished: false,
    };
  }

  if (typeof item !== 'object') return null;

  const drugId = item.drugId || item.documentId || item.id;
  if (!drugId) return null;

  return {
    ...item,
    drugId,
    quantity: item.quantity || 1,
    reminder_time: item.reminder_time || '',
    take_morning: !!item.take_morning,
    take_lunch: !!item.take_lunch,
    take_evening: !!item.take_evening,
    take_bedtime: !!item.take_bedtime,
    meal_relation: item.meal_relation || 'after',
    dosage_per_time: item.dosage_per_time || '',
    frequency_hours: Number(item.frequency_hours || 0),
    take_until_finished: !!item.take_until_finished,
  };
}

function buildPrescribedDrugKey(item) {
  const slots = [
    item.take_morning ? 'M' : '',
    item.take_lunch ? 'L' : '',
    item.take_evening ? 'E' : '',
    item.take_bedtime ? 'B' : '',
  ].join('');

  return [
    item.drugId,
    item.reminder_time || '',
    Number(item.frequency_hours || 0),
    item.meal_relation || 'after',
    item.take_until_finished ? '1' : '0',
    slots,
  ].join('|');
}

function mergeActivePrescribedDrugsFromHistories(historyRows) {
  if (!Array.isArray(historyRows) || historyRows.length === 0) return [];

  const activeWindow = [];
  for (const row of historyRows) {
    activeWindow.push(row);
    if (getMedicationScheduleMode(row) === 'replace') {
      break;
    }
  }

  const mergedMap = new Map();
  for (const row of activeWindow.slice().reverse()) {
    const drugs = extractPrescribedDrugs(row);
    for (const rawDrug of drugs) {
      const normalized = normalizePrescribedDrugItem(rawDrug);
      if (!normalized) continue;
      mergedMap.set(buildPrescribedDrugKey(normalized), normalized);
    }
  }

  return Array.from(mergedMap.values());
}

async function loadNotificationForDelete(strapi, idOrDocumentId) {
  if (!idOrDocumentId) return null;

  const knex = strapi.db.connection;
  const raw = String(idOrDocumentId);
  let notificationRow = null;

  if (/^\d+$/.test(raw)) {
    notificationRow = await knex('notifications')
      .where('id', Number(raw))
      .select('id', 'document_id', 'type', 'data')
      .first();
  }

  if (!notificationRow) {
    notificationRow = await knex('notifications')
      .where('document_id', raw)
      .select('id', 'document_id', 'type', 'data')
      .first();
  }

  if (!notificationRow?.id) return null;

  let parsedData = {};
  try {
    parsedData = notificationRow.data
      ? (typeof notificationRow.data === 'string' ? JSON.parse(notificationRow.data) : notificationRow.data)
      : {};
  } catch (_) {
    parsedData = {};
  }

  const [customerProfileRow, drugStoreRow] = await Promise.all([
    knex('notifications_customer_profile_lnk as ncp')
      .join('customer_profiles as cp', 'cp.id', 'ncp.customer_profile_id')
      .where('ncp.notification_id', notificationRow.id)
      .select('cp.id', 'cp.document_id')
      .first(),
    knex('notifications_drug_store_lnk as nds')
      .join('drug_stores as ds', 'ds.id', 'nds.drug_store_id')
      .where('nds.notification_id', notificationRow.id)
      .select('ds.id', 'ds.document_id')
      .first(),
  ]);

  return {
    id: notificationRow.id,
    documentId: notificationRow.document_id,
    type: notificationRow.type,
    data: parsedData,
    customer_profile: customerProfileRow
      ? {
          id: customerProfileRow.id,
          documentId: customerProfileRow.document_id,
        }
      : null,
    drug_store: drugStoreRow
      ? {
          id: drugStoreRow.id,
          documentId: drugStoreRow.document_id,
        }
      : null,
  };
}

async function getCustomerScopeForScheduleSync(strapi, customerRelationValue) {
  const customerId = await resolveRelationId(
    strapi,
    'api::customer-profile.customer-profile',
    customerRelationValue
  );
  if (!customerId) {
    return { customerDocumentId: null, customerIds: [], targetCustomerId: null };
  }

  const customer = await strapi.entityService.findOne(
    'api::customer-profile.customer-profile',
    customerId,
    { fields: ['id', 'documentId'] }
  );

  const customerDocumentId = customer?.documentId || null;
  if (!customerDocumentId) {
    return { customerDocumentId: null, customerIds: [customerId], targetCustomerId: customerId };
  }

  // Use raw SQL to include all sibling rows (draft/published variants) for the same document_id.
  const allCustomerRows = await strapi.db.connection('customer_profiles')
    .where('document_id', customerDocumentId)
    .select('id');

  const customerIds = Array.from(
    new Set(
      [customerId, ...(Array.isArray(allCustomerRows) ? allCustomerRows.map((row) => row.id) : [])].filter(Boolean)
    )
  );

  const targetCustomerId = customerIds.slice().sort((a, b) => b - a)[0] || customerId;

  return { customerDocumentId, customerIds, targetCustomerId };
}

async function deleteSchedulesForCustomerScope(strapi, customerIds) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return 0;

  const linkedScheduleIds = await strapi.db.connection('medication_schedules_customer_lnk')
    .whereIn('customer_profile_id', customerIds)
    .pluck('medication_schedule_id');

  const uniqueScheduleIds = Array.from(new Set((linkedScheduleIds || []).filter(Boolean)));
  for (const scheduleId of uniqueScheduleIds) {
    await strapi.entityService.delete('api::medication-schedule.medication-schedule', scheduleId);
  }

  return uniqueScheduleIds.length;
}

async function clearPrescribedDrugsForCustomerScope(strapi, customerIds) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return;

  for (const customerId of customerIds) {
    await strapi.entityService.update('api::customer-profile.customer-profile', customerId, {
      data: {
        prescribed_drugs: [],
      },
    });
  }
}

async function rebuildSchedulesAfterHistoryDelete(strapi, deletedNotification) {
  const { customerDocumentId, customerIds, targetCustomerId } = await getCustomerScopeForScheduleSync(
    strapi,
    deletedNotification?.customer_profile
  );
  if (!targetCustomerId || customerIds.length === 0) return;

  const storeId = await resolveRelationId(
    strapi,
    'api::drug-store.drug-store',
    deletedNotification?.drug_store
  );

  const knex = strapi.db.connection;
  let historyQuery = knex('notifications as n')
    .join('notifications_customer_profile_lnk as ncp', 'ncp.notification_id', 'n.id')
    .whereIn('ncp.customer_profile_id', customerIds)
    .whereIn('n.type', HISTORY_TYPES)
    .select('n.id', 'n.type', 'n.data', 'n.created_at')
    .orderBy('n.created_at', 'desc')
    .limit(200);

  if (storeId) {
    historyQuery = historyQuery
      .join('notifications_drug_store_lnk as nds', 'nds.notification_id', 'n.id')
      .where('nds.drug_store_id', storeId);
  }

  const historyRows = await historyQuery;
  const hasBaseHistory = Array.isArray(historyRows)
    ? historyRows.some((row) => BASE_HISTORY_TYPES.has(row.type))
    : false;
  const rowsForMerge = hasBaseHistory ? historyRows : [];
  const prescribedDrugs = mergeActivePrescribedDrugsFromHistories(rowsForMerge);

  // Defensive cleanup path:
  // when no remaining history (or history has no prescribed drugs), clear schedules directly.
  // This avoids stale schedules in cases where an update would be treated as a no-op.
  if (!Array.isArray(prescribedDrugs) || prescribedDrugs.length === 0) {
    const removedCount = await deleteSchedulesForCustomerScope(strapi, customerIds);
    await clearPrescribedDrugsForCustomerScope(strapi, customerIds);

    strapi.log.info(
      `[MedReminder] Cleared schedules after notification delete for customer ${targetCustomerId}` +
      ` (documentId=${customerDocumentId || 'n/a'}, linkedProfiles=${customerIds.join(',')}, removed schedules: ${removedCount})`
    );
    return;
  }

  // Triggers customer-profile lifecycle to clear old schedules, then recreate from remaining history.
  await strapi.entityService.update('api::customer-profile.customer-profile', targetCustomerId, {
    data: {
      prescribed_drugs: prescribedDrugs,
    },
  });

  strapi.log.info(
    `[MedReminder] Rebuilt schedules after notification delete for customer ${targetCustomerId}` +
    ` (documentId=${customerDocumentId || 'n/a'}, linkedProfiles=${customerIds.join(',')},` +
    ` activeHistoryCount=${Array.isArray(rowsForMerge) ? rowsForMerge.length : 0}, drugs: ${prescribedDrugs.length})`
  );
}

async function cleanupSystemAlertsIfNoSchedules(strapi, customerRelationValue) {
  const { customerDocumentId, customerIds } = await getCustomerScopeForScheduleSync(
    strapi,
    customerRelationValue
  );
  if (!customerIds.length) return;

  const knex = strapi.db.connection;
  const scheduleCountRows = await knex('medication_schedules_customer_lnk')
    .whereIn('customer_profile_id', customerIds)
    .countDistinct('medication_schedule_id as total');

  const scheduleCount = Number(scheduleCountRows?.[0]?.total || 0);
  if (scheduleCount > 0) return;

  const systemAlertRows = await knex('notifications as n')
    .join('notifications_customer_profile_lnk as ncp', 'ncp.notification_id', 'n.id')
    .whereIn('ncp.customer_profile_id', customerIds)
    .where('n.type', 'system_alert')
    .distinct('n.id');

  const systemAlertIds = (systemAlertRows || []).map((r) => r.id).filter(Boolean);
  if (!systemAlertIds.length) return;

  for (const id of systemAlertIds) {
    await strapi.entityService.delete('api::notification.notification', id);
  }

  strapi.log.info(
    `[MedReminder] Removed ${systemAlertIds.length} system_alert notification(s)` +
    ` for customer documentId=${customerDocumentId || 'n/a'} because no schedules remain`
  );
}

async function removeOldMedicationSchedulesOnNewHistory(strapi, notification) {
  if (!notification || notification.type !== 'customer_assignment') return;

  const mode = getMedicationScheduleMode(notification);
  if (mode !== 'replace') {
    strapi.log.info('[MedReminder] Skip old schedule removal on new history (mode=append)');
    return;
  }

  const { customerDocumentId, customerIds, targetCustomerId } = await getCustomerScopeForScheduleSync(
    strapi,
    notification.customer_profile
  );
  const storeId = await resolveRelationId(
    strapi,
    'api::drug-store.drug-store',
    notification.drug_store
  );

  if (!targetCustomerId || !Array.isArray(customerIds) || customerIds.length === 0 || !storeId) return;

  const knex = strapi.db.connection;
  const hasScheduleCustomerLinkTable = await knex.schema.hasTable('medication_schedules_customer_lnk');
  const hasScheduleCustomerDocumentIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_document_id');

  const previousAssignments = await knex('notifications as n')
    .join('notifications_customer_profile_lnk as ncp', 'ncp.notification_id', 'n.id')
    .join('notifications_drug_store_lnk as nds', 'nds.notification_id', 'n.id')
    .whereIn('ncp.customer_profile_id', customerIds)
    .where('nds.drug_store_id', storeId)
    .where('n.type', 'customer_assignment')
    .whereNot('n.id', notification.id)
    .select('n.id')
    .limit(1);

  if (!previousAssignments || previousAssignments.length === 0) return;

  const collectedScheduleIds = [];

  if (hasScheduleCustomerDocumentIdColumn && customerDocumentId) {
    const documentLinkedScheduleIds = await knex('medication_schedules')
      .where('customer_document_id', customerDocumentId)
      .pluck('id');
    collectedScheduleIds.push(...(documentLinkedScheduleIds || []));
  }

  if (hasScheduleCustomerLinkTable) {
    const linkedScheduleIds = await knex('medication_schedules_customer_lnk')
      .whereIn('customer_profile_id', customerIds)
      .pluck('medication_schedule_id');
    collectedScheduleIds.push(...(linkedScheduleIds || []));
  }

  const uniqueScheduleIds = Array.from(new Set(collectedScheduleIds.filter(Boolean)));
  if (uniqueScheduleIds.length === 0) return;

  if (hasScheduleCustomerLinkTable) {
    await knex('medication_schedules_customer_lnk')
      .whereIn('medication_schedule_id', uniqueScheduleIds)
      .delete();
  }

  await knex('medication_schedules')
    .whereIn('id', uniqueScheduleIds)
    .delete();

  strapi.log.info(
    `[MedReminder] Removed ${uniqueScheduleIds.length} old schedule(s) for customer ${targetCustomerId}` +
    ` (documentId=${customerDocumentId || 'n/a'}, linkedProfiles=${customerIds.join(',')}, same-store new history)`
  );
}

function broadcastNotificationCreate(notification) {
  const strapi = globalThis.strapi;
  if (!strapi?.io) return;

  const io = strapi.io;

  if (notification.documentId) {
    io.to(`notification:${notification.documentId}`).emit('notification:created', notification);
  }
  if (notification.id) {
    io.to(`notification:${notification.id}`).emit('notification:created', notification);
  }

  if (notification.customer_profile) {
    const customerId = typeof notification.customer_profile === 'object'
      ? notification.customer_profile.documentId || notification.customer_profile.id
      : notification.customer_profile;
    io.to(`customer:${customerId}`).emit('notification:created', notification);
  }

  if (notification.staff_profile) {
    const staffId = typeof notification.staff_profile === 'object'
      ? notification.staff_profile.documentId || notification.staff_profile.id
      : notification.staff_profile;
    io.to(`staff:${staffId}`).emit('notification:created', notification);
  }
}

function parseRequestedFields(ctx) {
  const fields = [];
  for (const [key, value] of Object.entries(ctx.query || {})) {
    const match = /^fields\[(\d+)\]$/.exec(key);
    if (!match || !value) continue;
    fields.push(String(value));
  }
  return fields;
}

function pickNotificationResponseFields(notification, requestedFields) {
  if (!Array.isArray(requestedFields) || requestedFields.length === 0) {
    return notification;
  }

  const picked = {};
  requestedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(notification, field)) {
      picked[field] = notification[field];
    }
  });

  if (!Object.prototype.hasOwnProperty.call(picked, 'documentId') && notification.documentId) {
    picked.documentId = notification.documentId;
  }

  return picked;
}

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  async create(ctx) {
    console.log('[Controller] Creating notification:', {
      body: ctx.request.body,
      user: ctx.state.user?.id
    });

    const payload = ctx.request.body?.data;
    if (!payload || typeof payload !== 'object') {
      return ctx.badRequest('Missing notification payload');
    }

    const requestedFields = parseRequestedFields(ctx);
    const createStart = Date.now();
    const now = new Date();
    const knex = strapi.db.connection;

    const [staffProfileId, pharmacyProfileId, customerProfileId, drugStoreId] = await Promise.all([
      resolveRelationId(strapi, 'api::staff-profile.staff-profile', payload.staff_profile),
      resolveRelationId(strapi, 'api::pharmacy-profile.pharmacy-profile', payload.pharmacy_profile),
      resolveRelationId(strapi, 'api::customer-profile.customer-profile', payload.customer_profile),
      resolveRelationId(strapi, 'api::drug-store.drug-store', payload.drug_store),
    ]);

    const insertedNotification = await knex.transaction(async (trx) => {
      const documentId = randomBytes(12).toString('hex');
      const insertedRows = await trx('notifications')
        .insert({
          document_id: documentId,
          type: payload.type,
          title: payload.title || null,
          message: payload.message || null,
          data: payload.data !== undefined ? JSON.stringify(payload.data) : JSON.stringify({}),
          staff_work_status: payload.staff_work_status !== undefined ? JSON.stringify(payload.staff_work_status) : JSON.stringify({}),
          is_read: payload.is_read ? 1 : 0,
          read_at: payload.read_at || null,
          priority: payload.priority || 'normal',
          action_url: payload.action_url || null,
          expires_at: payload.expires_at || null,
          created_at: now,
          updated_at: now,
        })
        .returning(['id', 'document_id']);

      const createdRow = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
      if (!createdRow?.id) {
        throw new Error('Notification insert did not return an id');
      }

      const linkInserts = [];
      if (staffProfileId) {
        linkInserts.push(
          trx('notifications_staff_profile_lnk').insert({
            notification_id: createdRow.id,
            staff_profile_id: staffProfileId,
          })
        );
      }
      if (pharmacyProfileId) {
        linkInserts.push(
          trx('notifications_pharmacy_profile_lnk').insert({
            notification_id: createdRow.id,
            pharmacy_profile_id: pharmacyProfileId,
          })
        );
      }
      if (customerProfileId) {
        linkInserts.push(
          trx('notifications_customer_profile_lnk').insert({
            notification_id: createdRow.id,
            customer_profile_id: customerProfileId,
          })
        );
      }
      if (drugStoreId) {
        linkInserts.push(
          trx('notifications_drug_store_lnk').insert({
            notification_id: createdRow.id,
            drug_store_id: drugStoreId,
          })
        );
      }

      if (linkInserts.length > 0) {
        await Promise.all(linkInserts);
      }

      return {
        id: createdRow.id,
        documentId: createdRow.document_id,
      };
    });

    const createdNotification = {
      id: insertedNotification.id,
      documentId: insertedNotification.documentId,
      type: payload.type,
      title: payload.title || null,
      message: payload.message || null,
      data: payload.data !== undefined ? payload.data : {},
      staff_work_status: payload.staff_work_status !== undefined ? payload.staff_work_status : {},
      is_read: !!payload.is_read,
      read_at: payload.read_at || null,
      priority: payload.priority || 'normal',
      action_url: payload.action_url || null,
      expires_at: payload.expires_at || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      staff_profile: payload.staff_profile || null,
      pharmacy_profile: payload.pharmacy_profile || null,
      customer_profile: payload.customer_profile || null,
      drug_store: payload.drug_store || null,
    };

    setImmediate(() => {
      (async () => {
        try {
          await removeOldMedicationSchedulesOnNewHistory(strapi, createdNotification);
        } catch (err) {
          strapi.log.error('[MedReminder] Failed to remove old schedules:', err.message);
        }
      })();
    });

    broadcastNotificationCreate(createdNotification);

    const responseData = pickNotificationResponseFields(createdNotification, requestedFields);
    ctx.status = 201;

    console.log('[Controller] Notification created successfully:', {
      id: createdNotification.id,
      documentId: createdNotification.documentId,
      type: createdNotification.type,
      durationMs: Date.now() - createStart,
    });

    return {
      data: responseData,
    };
  },

  async find(ctx) {
    // call the default core action
    const response = await super.find(ctx);

    if (response?.data) {
      response.data = Array.isArray(response.data)
        ? response.data.map(item => ({
            ...item,
            staff_work_status: {
              received: item.staff_work_status?.received ?? false,
              prepared: item.staff_work_status?.prepared ?? false,
              received_at: item.staff_work_status?.received_at ?? null,
              prepared_at: item.staff_work_status?.prepared_at ?? null,
              prepared_note: item.staff_work_status?.prepared_note ?? '',
              outOfStock: item.staff_work_status?.outOfStock ?? [],
              cancelled: item.staff_work_status?.cancelled ?? false,
              cancelled_at: item.staff_work_status?.cancelled_at ?? null,
              cancelled_note: item.staff_work_status?.cancelled_note ?? '',
              batches_selected: item.staff_work_status?.batches_selected || {}
            }
          }))
        : {
            ...response.data,
            staff_work_status: {
              received: response.data?.staff_work_status?.received ?? false,
              prepared: response.data?.staff_work_status?.prepared ?? false,
              received_at: response.data?.staff_work_status?.received_at ?? null,
              prepared_at: response.data?.staff_work_status?.prepared_at ?? null,
              prepared_note: response.data?.staff_work_status?.prepared_note ?? '',
              outOfStock: response.data?.staff_work_status?.outOfStock ?? [],
              cancelled: response.data?.staff_work_status?.cancelled ?? false,
              cancelled_at: response.data?.staff_work_status?.cancelled_at ?? null,
              cancelled_note: response.data?.staff_work_status?.cancelled_note ?? '',
              batches_selected: response.data?.staff_work_status?.batches_selected || {}
            }
          };
    }

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (response?.data) {
      response.data = {
        ...response.data,
        staff_work_status: {
          received: response.data?.staff_work_status?.received ?? false,
          prepared: response.data?.staff_work_status?.prepared ?? false,
          received_at: response.data?.staff_work_status?.received_at ?? null,
          prepared_at: response.data?.staff_work_status?.prepared_at ?? null,
          prepared_note: response.data?.staff_work_status?.prepared_note ?? '',
          outOfStock: response.data?.staff_work_status?.outOfStock ?? [],
          cancelled: response.data?.staff_work_status?.cancelled ?? false,
          cancelled_at: response.data?.staff_work_status?.cancelled_at ?? null,
          cancelled_note: response.data?.staff_work_status?.cancelled_note ?? '',
          batches_selected: response.data?.staff_work_status?.batches_selected || {}
        }
      };
    }

    return response;
  },

  async update(ctx) {
    const { id: documentId } = ctx.params;
    const { data: body } = ctx.request.body || {};

    if (!documentId || !body) {
      return ctx.badRequest('Missing documentId or request body');
    }

    const knex = strapi.db.connection;

    // Resolve numeric id + fetch existing data column in one query
    const existing = await knex('notifications')
      .where('document_id', documentId)
      .select('id', 'document_id', 'data')
      .first();

    if (!existing) {
      return ctx.notFound('Notification not found');
    }

    // Parse existing data column so we can merge (preserving prescribed_drugs etc.)
    let existingData = {};
    try {
      if (existing.data) {
        existingData = typeof existing.data === 'string'
          ? JSON.parse(existing.data)
          : existing.data;
      }
    } catch (_) { existingData = {}; }

    // Merge incoming body.data WITH existing data — never wipe fields not in the update
    const mergedData = body.data !== undefined
      ? { ...existingData, ...body.data }
      : existingData;

    const updateFields = { updated_at: new Date() };
    if (body.type !== undefined) updateFields.type = body.type;
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.message !== undefined) updateFields.message = body.message;
    if (body.data !== undefined) updateFields.data = JSON.stringify(mergedData);
    if (body.staff_work_status !== undefined) updateFields.staff_work_status = JSON.stringify(body.staff_work_status);
    if (body.is_read !== undefined) updateFields.is_read = body.is_read ? 1 : 0;
    if (body.priority !== undefined) updateFields.priority = body.priority;

    // Single SQL UPDATE — no document service overhead
    await knex('notifications')
      .where('id', existing.id)
      .update(updateFields);

    // Update staff_profile relation link table only when staff changed
    if (body.staff_profile) {
      const staffDocId = typeof body.staff_profile === 'object'
        ? (body.staff_profile.documentId || String(body.staff_profile))
        : String(body.staff_profile);
      const staffRow = await knex('staff_profiles')
        .where('document_id', staffDocId)
        .select('id')
        .first();
      if (staffRow?.id) {
        await knex('notifications_staff_profile_lnk')
          .where('notification_id', existing.id)
          .delete();
        await knex('notifications_staff_profile_lnk').insert({
          notification_id: existing.id,
          staff_profile_id: staffRow.id,
        });
      }
    }

    // Socket broadcast — include full merged data so staff UI updates without re-fetching
    const now = new Date().toISOString();
    const io = strapi?.io;
    if (io) {
      const broadcastPayload = {
        id: existing.id,
        documentId,
        type: body.type,
        title: body.title,
        message: body.message,
        data: mergedData,
        staff_work_status: body.staff_work_status || {},
        is_read: body.is_read ?? false,
        priority: body.priority,
        updatedAt: now,
      };
      io.to(`notification:${documentId}`).emit('notification:update', broadcastPayload);
      io.to(`notification:${existing.id}`).emit('notification:update', broadcastPayload);
      if (body.customer_profile) {
        io.to(`customer:${body.customer_profile}`).emit('notification:update', broadcastPayload);
      }
      if (body.staff_profile) {
        const staffTarget = typeof body.staff_profile === 'object'
          ? (body.staff_profile.documentId || body.staff_profile.id)
          : body.staff_profile;
        io.to(`staff:${staffTarget}`).emit('notification:update', broadcastPayload);
      }
    }

    return {
      data: {
        id: existing.id,
        documentId,
        type: body.type,
        title: body.title,
        message: body.message,
        data: mergedData,
        staff_work_status: body.staff_work_status || {},
        updatedAt: now,
      },
    };
  },

  async delete(ctx) {
    const { id: idOrDocumentId } = ctx.params;
    if (!idOrDocumentId) {
      return ctx.badRequest('Missing notification id');
    }

    const deleteStart = Date.now();
    const knex = strapi.db.connection;
    const notification = await loadNotificationForDelete(strapi, idOrDocumentId);

    if (!notification?.id) {
      return ctx.notFound('Notification not found');
    }

    await knex.transaction(async (trx) => {
      await Promise.all(
        NOTIFICATION_LINK_TABLES.map((tableName) => (
          trx(tableName)
            .where('notification_id', notification.id)
            .delete()
        ))
      );

      await trx('notifications')
        .where('id', notification.id)
        .delete();
    });

    if (DELETE_REBUILD_TYPES.has(notification.type)) {
      setImmediate(() => {
        (async () => {
          try {
            await rebuildSchedulesAfterHistoryDelete(strapi, notification);
            await cleanupSystemAlertsIfNoSchedules(strapi, notification.customer_profile);
          } catch (err) {
            strapi.log.error('[MedReminder] Failed async cleanup after notification delete:', err.message);
          }
        })();
      });
    }

    ctx.status = 204;
    console.log('[Controller] Notification deleted successfully:', {
      id: notification.id,
      documentId: notification.documentId,
      type: notification.type,
      durationMs: Date.now() - deleteStart,
    });
    return null;
  }
}));