'use strict';

/**
 * Notification lifecycle hooks (Strapi v5)
 *
 * IMPORTANT: This file MUST live at content-types/notification/lifecycles.js
 * for Strapi v5 to auto-load it. Files under src/api/notification/lifecycles/
 * are NOT loaded automatically.
 */

// ──────────────────────────────────────────────
// Shared helpers (used by afterCreate & afterDelete)
// ──────────────────────────────────────────────

const RELATION_TABLE_BY_UID = {
  'api::staff-profile.staff-profile': 'staff_profiles',
  'api::pharmacy-profile.pharmacy-profile': 'pharmacy_profiles',
  'api::customer-profile.customer-profile': 'customer_profiles',
  'api::drug-store.drug-store': 'drug_stores',
};

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
  // entityService.findMany can miss variants in Strapi v5 draft/publish scenarios.
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

// ──────────────────────────────────────────────
// afterCreate helpers
// ──────────────────────────────────────────────

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
  const {
    hasScheduleCustomerLinkTable,
    hasScheduleCustomerDocumentIdColumn,
    hasScheduleCustomerIdColumn,
  } = await getScheduleSchemaFlags(knex);

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

// ──────────────────────────────────────────────
// afterDelete helpers
// ──────────────────────────────────────────────

const HISTORY_TYPES = ['customer_assignment', 'customer_assignment_update', 'message'];
const BASE_HISTORY_TYPES = new Set(['customer_assignment', 'message']);
const DELETE_ELIGIBLE_TYPES = new Set(['customer_assignment', 'customer_assignment_update', 'message']);

async function deleteSchedulesForCustomerScope(strapi, customerIds, customerDocumentId = null) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return 0;

  const knex = strapi.db.connection;
  const {
    hasScheduleCustomerLinkTable,
    hasScheduleCustomerDocumentIdColumn,
    hasScheduleCustomerIdColumn,
  } = await getScheduleSchemaFlags(knex);

  const collectedScheduleIds = [];

  if (hasScheduleCustomerDocumentIdColumn && customerDocumentId) {
    const documentScheduleIds = await knex('medication_schedules')
      .where('customer_document_id', customerDocumentId)
      .pluck('id');
    collectedScheduleIds.push(...(documentScheduleIds || []));
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
  if (uniqueScheduleIds.length > 0) {
    if (!hasScheduleCustomerDocumentIdColumn && hasScheduleCustomerLinkTable) {
      await knex('medication_schedules_customer_lnk')
        .whereIn('medication_schedule_id', uniqueScheduleIds)
        .delete();
    }
    await knex('medication_schedules')
      .whereIn('id', uniqueScheduleIds)
      .delete();
  }

  return uniqueScheduleIds.length;
}

async function clearPrescribedDrugsForCustomerScope(strapi, customerIds) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return;

  for (const customerId of customerIds) {
    await strapi.entityService.update('api::customer-profile.customer-profile', customerId, {
      data: { prescribed_drugs: [] },
    });
  }
}

async function rebuildSchedulesFromRemainingHistory(strapi, deletedNotification) {
  const { customerDocumentId, customerIds, targetCustomerId } = await getCustomerScopeForScheduleSync(
    strapi,
    deletedNotification?.customer_profile
  );
  if (!targetCustomerId || !customerIds.length) return;

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

  if (!Array.isArray(prescribedDrugs) || prescribedDrugs.length === 0) {
    const removedCount = await deleteSchedulesForCustomerScope(strapi, customerIds, customerDocumentId);
    await clearPrescribedDrugsForCustomerScope(strapi, customerIds);

    strapi.log.info(
      `[MedReminder] Cleared schedules after notification delete for customer ${targetCustomerId}` +
      ` (documentId=${customerDocumentId || 'n/a'}, linkedProfiles=${customerIds.join(',')}, removed schedules: ${removedCount})`
    );
    return;
  }

  await strapi.entityService.update('api::customer-profile.customer-profile', targetCustomerId, {
    data: { prescribed_drugs: prescribedDrugs },
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
  const {
    hasScheduleCustomerLinkTable,
    hasScheduleCustomerDocumentIdColumn,
    hasScheduleCustomerIdColumn,
  } = await getScheduleSchemaFlags(knex);

  const collectedScheduleIds = [];

  if (hasScheduleCustomerDocumentIdColumn && customerDocumentId) {
    const documentScheduleIds = await knex('medication_schedules')
      .where('customer_document_id', customerDocumentId)
      .pluck('id');
    collectedScheduleIds.push(...(documentScheduleIds || []));
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

  const scheduleCount = Array.from(new Set(collectedScheduleIds.filter(Boolean))).length;
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

// ──────────────────────────────────────────────
// Socket.IO broadcast helpers
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Exported lifecycle hooks
// ──────────────────────────────────────────────

module.exports = {
  async beforeDelete(event) {
    const strapi = globalThis.strapi;
    if (!strapi) return;

    const where = event?.params?.where;
    if (!where || Array.isArray(where)) return;

    try {
      const snapshot = await strapi.db.query('api::notification.notification').findOne({
        where,
        select: ['id', 'documentId', 'type', 'data'],
        populate: {
          customer_profile: { select: ['id', 'documentId'] },
          drug_store: { select: ['id', 'documentId'] },
        },
      });

      event.state = event.state || {};
      event.state.deletedNotificationSnapshot = snapshot || null;
    } catch (err) {
      strapi.log.error('[MedReminder] Failed to capture notification snapshot before delete:', err.message);
    }
  },

  async afterCreate(event) {
    const { result: notification } = event;
    if (!notification) return;

    console.log('[Lifecycle] Notification after-create:', {
      id: notification.id,
      documentId: notification.documentId,
      type: notification.type,
    });

    const strapi = globalThis.strapi;
    if (!strapi) return;

    try {
      await removeOldMedicationSchedulesOnNewHistory(strapi, notification);
    } catch (err) {
      strapi.log.error('[MedReminder] Failed to remove old schedules:', err.message);
    }

    broadcastNotificationCreate(notification);
  },

  async afterUpdate(event) {
    const notification = event?.result;
    if (!notification) return;

    console.log('[Lifecycle] Notification after-update:', {
      id: notification.id,
      documentId: notification.documentId,
      type: notification.type,
    });

    broadcastNotificationUpdate(notification);
  },

  async afterDelete(event) {
    const notification = event?.state?.deletedNotificationSnapshot || event?.result;
    if (!notification) return;

    if (notification.type && !DELETE_ELIGIBLE_TYPES.has(notification.type)) return;

    const strapi = globalThis.strapi;
    if (!strapi) return;

    // Run heavy rebuild asynchronously so DELETE API can return quickly.
    setImmediate(() => {
      (async () => {
        try {
          await rebuildSchedulesFromRemainingHistory(strapi, notification);
          await cleanupSystemAlertsIfNoSchedules(strapi, notification.customer_profile);
        } catch (err) {
          strapi.log.error('[MedReminder] Failed to rebuild schedules after delete:', err.message);
        }
      })();
    });
  },
};
