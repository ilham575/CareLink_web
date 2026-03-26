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
      // ORDER BY id DESC: prefer published row (highest id) for draft/publish entities
      const row = await strapi.db.connection(tableName)
        .where('document_id', relationValue.documentId)
        .select('id')
        .orderBy('id', 'desc')
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
    // ORDER BY id DESC: prefer published row (highest id) for draft/publish entities
    const row = await strapi.db.connection(tableName)
      .where('document_id', relationStr)
      .select('id')
      .orderBy('id', 'desc')
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

async function deleteSchedulesForCustomerScope(strapi, customerIds, customerDocumentId = null) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return 0;

  const knex = strapi.db.connection;
  const hasScheduleCustomerLinkTable = await knex.schema.hasTable('medication_schedules_customer_lnk');
  const hasScheduleCustomerDocumentIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_document_id');
  const hasScheduleCustomerIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_id');

  const collectedScheduleIds = [];

  if (hasScheduleCustomerDocumentIdColumn && customerDocumentId) {
    const documentLinkedScheduleIds = await knex('medication_schedules')
      .where('customer_document_id', customerDocumentId)
      .pluck('id');
    collectedScheduleIds.push(...(documentLinkedScheduleIds || []));
  } else {
    if (hasScheduleCustomerLinkTable) {
      const linkedScheduleIds = await knex('medication_schedules_customer_lnk')
        .whereIn('customer_profile_id', customerIds)
        .pluck('medication_schedule_id');
      collectedScheduleIds.push(...(linkedScheduleIds || []));
    }

    if (hasScheduleCustomerIdColumn) {
      const directScheduleIds = await knex('medication_schedules')
        .whereIn('customer_id', customerIds)
        .pluck('id');
      collectedScheduleIds.push(...(directScheduleIds || []));
    }
  }

  const uniqueScheduleIds = Array.from(new Set(collectedScheduleIds.filter(Boolean)));
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
    const removedCount = await deleteSchedulesForCustomerScope(strapi, customerIds, customerDocumentId);
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
  const hasScheduleCustomerLinkTable = await knex.schema.hasTable('medication_schedules_customer_lnk');
  const hasScheduleCustomerDocumentIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_document_id');
  const hasScheduleCustomerIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_id');

  let scheduleCount = 0;

  if (hasScheduleCustomerDocumentIdColumn && customerDocumentId) {
    const scheduleCountRows = await knex('medication_schedules')
      .where('customer_document_id', customerDocumentId)
      .countDistinct('id as total');
    scheduleCount = Number(scheduleCountRows?.[0]?.total || 0);
  } else {
    const collectedScheduleIds = [];

    if (hasScheduleCustomerLinkTable) {
      const linkedScheduleIds = await knex('medication_schedules_customer_lnk')
        .whereIn('customer_profile_id', customerIds)
        .pluck('medication_schedule_id');
      collectedScheduleIds.push(...(linkedScheduleIds || []));
    }

    if (hasScheduleCustomerIdColumn) {
      const directScheduleIds = await knex('medication_schedules')
        .whereIn('customer_id', customerIds)
        .pluck('id');
      collectedScheduleIds.push(...(directScheduleIds || []));
    }

    scheduleCount = Array.from(new Set(collectedScheduleIds.filter(Boolean))).length;
  }
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
  const hasScheduleCustomerDocumentIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_document_id');
  const hasScheduleCustomerLinkTable = await knex.schema.hasTable('medication_schedules_customer_lnk');
  const hasScheduleCustomerIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_id');

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

  if (!hasScheduleCustomerDocumentIdColumn) {
    if (hasScheduleCustomerLinkTable) {
      const linkedScheduleIds = await knex('medication_schedules_customer_lnk')
        .whereIn('customer_profile_id', customerIds)
        .pluck('medication_schedule_id');
      collectedScheduleIds.push(...(linkedScheduleIds || []));
    }

    if (hasScheduleCustomerIdColumn) {
      const directScheduleIds = await knex('medication_schedules')
        .whereIn('customer_id', customerIds)
        .pluck('id');
      collectedScheduleIds.push(...(directScheduleIds || []));
    }
  }

  const uniqueScheduleIds = Array.from(new Set(collectedScheduleIds.filter(Boolean)));
  if (uniqueScheduleIds.length === 0) return;

  if (!hasScheduleCustomerDocumentIdColumn && hasScheduleCustomerLinkTable) {
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

function broadcastNotificationUpdate(notification) {
  const strapi = globalThis.strapi;
  if (!strapi?.io) return;

  const io = strapi.io;

  if (notification.documentId) {
    io.to(`notification:${notification.documentId}`).emit('notification:update', notification);
  }
  if (notification.id) {
    io.to(`notification:${notification.id}`).emit('notification:update', notification);
  }

  if (notification.customer_profile) {
    const customerId = typeof notification.customer_profile === 'object'
      ? notification.customer_profile.documentId || notification.customer_profile.id
      : notification.customer_profile;
    io.to(`customer:${customerId}`).emit('notification:update', notification);
    io.to(`customer:${customerId}`).emit('customer:update', notification);
  }

  if (notification.staff_profile) {
    const staffId = typeof notification.staff_profile === 'object'
      ? notification.staff_profile.documentId || notification.staff_profile.id
      : notification.staff_profile;
    io.to(`staff:${staffId}`).emit('notification:update', notification);
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

async function resolveRelationDocumentId(strapi, uid, relationValue) {
  if (!relationValue) return null;

  if (typeof relationValue === 'object') {
    if (relationValue.documentId) return String(relationValue.documentId);
    if (relationValue.id) {
      const tableName = RELATION_TABLE_BY_UID[uid];
      if (!tableName) return null;

      const row = await strapi.db.connection(tableName)
        .where('id', relationValue.id)
        .select('document_id')
        .first();

      return row?.document_id ? String(row.document_id) : null;
    }

    return null;
  }

  const rawValue = String(relationValue).trim();
  if (!rawValue) return null;
  if (!/^\d+$/.test(rawValue)) return rawValue;

  const tableName = RELATION_TABLE_BY_UID[uid];
  if (!tableName) return null;

  const row = await strapi.db.connection(tableName)
    .where('id', Number(rawValue))
    .select('document_id')
    .first();

  return row?.document_id ? String(row.document_id) : null;
}

async function buildNotificationDocumentData(strapi, payload, mergedDataOverride) {
  const [staffProfileDocumentId, pharmacyProfileDocumentId, customerProfileDocumentId, drugStoreDocumentId] = await Promise.all([
    resolveRelationDocumentId(strapi, 'api::staff-profile.staff-profile', payload.staff_profile),
    resolveRelationDocumentId(strapi, 'api::pharmacy-profile.pharmacy-profile', payload.pharmacy_profile),
    resolveRelationDocumentId(strapi, 'api::customer-profile.customer-profile', payload.customer_profile),
    resolveRelationDocumentId(strapi, 'api::drug-store.drug-store', payload.drug_store),
  ]);

  const data = {
    type: payload.type,
    title: payload.title || null,
    message: payload.message || null,
    data: mergedDataOverride !== undefined
      ? (mergedDataOverride || {})
      : (payload.data !== undefined ? payload.data : {}),
    staff_work_status: payload.staff_work_status !== undefined ? payload.staff_work_status : {},
    is_read: !!payload.is_read,
    read_at: payload.read_at || null,
    priority: payload.priority || 'normal',
    action_url: payload.action_url || null,
    expires_at: payload.expires_at || null,
  };

  if (staffProfileDocumentId) {
    data.staff_profile = { connect: [staffProfileDocumentId] };
  }
  if (pharmacyProfileDocumentId) {
    data.pharmacy_profile = { connect: [pharmacyProfileDocumentId] };
  }
  if (customerProfileDocumentId) {
    data.customer_profile = { connect: [customerProfileDocumentId] };
  }
  if (drugStoreDocumentId) {
    data.drug_store = { connect: [drugStoreDocumentId] };
  }

  return {
    data,
    relationDocumentIds: {
      staff_profile: staffProfileDocumentId,
      pharmacy_profile: pharmacyProfileDocumentId,
      customer_profile: customerProfileDocumentId,
      drug_store: drugStoreDocumentId,
    },
  };
}

async function createNotificationRecord(strapi, payload) {
  const now = new Date().toISOString();
  const { data: documentData, relationDocumentIds } = await buildNotificationDocumentData(strapi, payload);

  const createdNotification = await strapi.documents('api::notification.notification').create({
    data: documentData,
    status: 'published',
  });

  return {
    id: createdNotification?.id,
    documentId: createdNotification?.documentId,
    type: createdNotification?.type ?? payload.type,
    title: createdNotification?.title ?? payload.title ?? null,
    message: createdNotification?.message ?? payload.message ?? null,
    data: createdNotification?.data ?? (payload.data !== undefined ? payload.data : {}),
    staff_work_status: createdNotification?.staff_work_status ?? (payload.staff_work_status !== undefined ? payload.staff_work_status : {}),
    is_read: createdNotification?.is_read ?? !!payload.is_read,
    read_at: createdNotification?.read_at ?? payload.read_at ?? null,
    priority: createdNotification?.priority ?? payload.priority ?? 'normal',
    action_url: createdNotification?.action_url ?? payload.action_url ?? null,
    expires_at: createdNotification?.expires_at ?? payload.expires_at ?? null,
    createdAt: createdNotification?.createdAt ?? now,
    updatedAt: createdNotification?.updatedAt ?? now,
    staff_profile: createdNotification?.staff_profile || relationDocumentIds.staff_profile || payload.staff_profile || null,
    pharmacy_profile: createdNotification?.pharmacy_profile || relationDocumentIds.pharmacy_profile || payload.pharmacy_profile || null,
    customer_profile: createdNotification?.customer_profile || relationDocumentIds.customer_profile || payload.customer_profile || null,
    drug_store: createdNotification?.drug_store || relationDocumentIds.drug_store || payload.drug_store || null,
  };
}

async function updateNotificationRecord(strapi, documentId, body) {
  const knex = strapi.db.connection;
  const existing = await knex('notifications')
    .where('document_id', documentId)
    .select('id', 'document_id', 'data', 'is_read', 'priority', 'title', 'message', 'type')
    .first();

  if (!existing) {
    throw new Error('Notification not found');
  }

  let existingData = {};
  try {
    if (existing.data) {
      existingData = typeof existing.data === 'string'
        ? JSON.parse(existing.data)
        : existing.data;
    }
  } catch (_) {
    existingData = {};
  }

  const mergedData = body.data !== undefined
    ? { ...existingData, ...body.data }
    : existingData;

  const updatedAt = new Date().toISOString();
  const { data: documentData, relationDocumentIds } = await buildNotificationDocumentData(strapi, body, mergedData);

  const updatedNotification = await strapi.documents('api::notification.notification').update({
    documentId,
    data: documentData,
    status: 'published',
  });

  return {
    id: updatedNotification?.id ?? existing.id,
    documentId,
    type: updatedNotification?.type ?? body.type ?? existing.type,
    title: updatedNotification?.title ?? body.title ?? existing.title,
    message: updatedNotification?.message ?? body.message ?? existing.message,
    data: updatedNotification?.data ?? mergedData,
    staff_work_status: updatedNotification?.staff_work_status ?? body.staff_work_status ?? {},
    is_read: updatedNotification?.is_read ?? body.is_read ?? !!existing.is_read,
    priority: updatedNotification?.priority ?? body.priority ?? existing.priority,
    updatedAt: updatedNotification?.updatedAt ?? updatedAt,
    staff_profile: updatedNotification?.staff_profile || relationDocumentIds.staff_profile || body.staff_profile || null,
    pharmacy_profile: updatedNotification?.pharmacy_profile || relationDocumentIds.pharmacy_profile || body.pharmacy_profile || null,
    customer_profile: updatedNotification?.customer_profile || relationDocumentIds.customer_profile || body.customer_profile || null,
    drug_store: updatedNotification?.drug_store || relationDocumentIds.drug_store || body.drug_store || null,
  };
}

async function deleteNotificationRecordById(strapi, notificationId) {
  const knex = strapi.db.connection;
  await knex.transaction(async (trx) => {
    await Promise.all(
      NOTIFICATION_LINK_TABLES.map((tableName) => (
        trx(tableName)
          .where('notification_id', notificationId)
          .delete()
      ))
    );

    await trx('notifications')
      .where('id', notificationId)
      .delete();
  });
}

async function getCustomerScopeRowsByDocumentId(strapi, customerDocumentId) {
  if (!customerDocumentId) return [];

  const rows = await strapi.db.connection('customer_profiles')
    .where('document_id', String(customerDocumentId))
    .select('id', 'document_id')
    .orderBy('id', 'asc');

  return Array.isArray(rows) ? rows : [];
}

async function syncCustomerProfilesForAssignment(strapi, customerDocumentId, customerProfileUpdates) {
  const rows = await getCustomerScopeRowsByDocumentId(strapi, customerDocumentId);
  if (rows.length === 0) {
    throw new Error('Customer profile not found');
  }

  const updateData = {};
  if (Object.prototype.hasOwnProperty.call(customerProfileUpdates, 'prescribed_drugs')) {
    updateData.prescribed_drugs = Array.isArray(customerProfileUpdates.prescribed_drugs)
      ? customerProfileUpdates.prescribed_drugs
      : [];
  }

  if (Object.prototype.hasOwnProperty.call(customerProfileUpdates, 'assigned_by_staff_document_id')) {
    const assignedStaffId = customerProfileUpdates.assigned_by_staff_document_id
      ? await resolveRelationId(
          strapi,
          'api::staff-profile.staff-profile',
          customerProfileUpdates.assigned_by_staff_document_id
        )
      : null;
    updateData.assigned_by_staff = assignedStaffId || null;
  }

  if (Object.keys(updateData).length === 0) {
    return rows[rows.length - 1];
  }

  const targetRow = rows[rows.length - 1];
  const nonTargetRows = rows.slice(0, -1);

  for (const row of nonTargetRows) {
    await strapi.entityService.update('api::customer-profile.customer-profile', row.id, {
      data: updateData,
    });
  }

  await strapi.entityService.update('api::customer-profile.customer-profile', targetRow.id, {
    data: updateData,
  });

  return targetRow;
}

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  async assignToStaff(ctx) {
    const assignStart = Date.now();
    const payload = ctx.request.body?.data;
    const notificationPayload = payload?.notification;
    const customerDocumentId = payload?.customer_profile_document_id || notificationPayload?.customer_profile;
    const existingNotificationDocumentId = payload?.existing_notification_document_id || null;
    const customerProfileUpdates = payload?.customer_profile_updates || {};

    if (!notificationPayload || typeof notificationPayload !== 'object') {
      return ctx.badRequest('Missing notification payload');
    }

    if (!customerDocumentId) {
      return ctx.badRequest('Missing customer profile documentId');
    }

    let createdNotification = null;

    try {
      if (!existingNotificationDocumentId) {
        createdNotification = await createNotificationRecord(strapi, notificationPayload);
      }

      await syncCustomerProfilesForAssignment(strapi, customerDocumentId, customerProfileUpdates);

      const notificationRecord = existingNotificationDocumentId
        ? await updateNotificationRecord(strapi, existingNotificationDocumentId, notificationPayload)
        : createdNotification;

      ctx.status = existingNotificationDocumentId ? 200 : 201;
      strapi.log.info(
        `[AssignToStaff] Completed ${existingNotificationDocumentId ? 'update' : 'create'} for customer=${customerDocumentId}` +
        ` notification=${notificationRecord.documentId} in ${Date.now() - assignStart}ms`
      );

      return {
        data: notificationRecord,
      };
    } catch (error) {
      if (!existingNotificationDocumentId && createdNotification?.id) {
        try {
          await deleteNotificationRecordById(strapi, createdNotification.id);
        } catch (cleanupError) {
          strapi.log.error('[AssignToStaff] Failed to cleanup notification after error:', cleanupError.message);
        }
      }

      strapi.log.error('[AssignToStaff] Failed orchestrated assign:', error);
      return ctx.internalServerError(error.message || 'Failed to assign customer to staff');
    }
  },

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
    const createdNotification = await createNotificationRecord(strapi, payload);

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

    const updatedNotification = await updateNotificationRecord(strapi, documentId, body);
    return { data: updatedNotification };
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