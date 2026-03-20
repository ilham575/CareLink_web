"use strict";

const { sendTelegramMessage, answerTelegramCallbackQuery } = require("../../../utils/telegram");
const reminderConfig = require("../../../../config/reminder-config");

const HISTORY_NOTIFICATION_TYPES = ['customer_assignment', 'customer_assignment_update', 'message'];

function formatThaiDateTimeForHistory(date = new Date()) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function parseCallbackData(rawData) {
  if (!rawData || typeof rawData !== 'string') return null;

  const parts = rawData.split(':');
  if (parts.length !== 3) return null;

  const [group, scheduleIdRaw, action] = parts;
  const scheduleId = Number(scheduleIdRaw);
  if (!Number.isFinite(scheduleId) || scheduleId <= 0) return null;

  if (group === 'meddone' && (action === 'notyet' || action === 'done')) {
    return { group, scheduleId, action };
  }

  if (group === 'medstat' && (action === 'good' || action === 'notyet' || action === 'finished')) {
    return { group, scheduleId, action };
  }

  if (group === 'medrec' && (action === 'good' || action === 'bad')) {
    return { group, scheduleId, action };
  }

  return null;
}

async function findCustomerProfileByChatId(strapi, chatId) {
  if (!chatId) return null;

  const row = await strapi.db.connection('customer_profiles')
    .where('telegram_chat_id', String(chatId))
    .orderBy('id', 'desc')
    .first('id', 'document_id as documentId', 'telegram_chat_id as telegramChatId', 'symptom_history');

  return row || null;
}

async function loadScheduleWithCustomer(strapi, scheduleId) {
  if (!scheduleId) return null;

  const schedule = await strapi.db.query('api::medication-schedule.medication-schedule').findOne({
    where: { id: scheduleId },
    populate: {
      customer: {
        select: ['id', 'documentId', 'telegramChatId', 'symptom_history'],
      },
    },
  });

  if (!schedule) return null;

  if (!schedule.customer && schedule.customer_document_id) {
    const customerRow = await strapi.db.connection('customer_profiles')
      .where('document_id', String(schedule.customer_document_id))
      .orderBy('id', 'desc')
      .first('id', 'document_id as documentId', 'telegram_chat_id as telegramChatId', 'symptom_history');

    if (customerRow) {
      schedule.customer = customerRow;
    }
  }

  return schedule;
}

async function findLatestCustomerByDocumentId(strapi, documentId) {
  if (!documentId) return null;

  return strapi.db.connection('customer_profiles')
    .where('document_id', String(documentId))
    .orderBy('id', 'desc')
    .first('id', 'document_id as documentId', 'telegram_chat_id as telegramChatId');
}

async function syncTelegramChatIdByDocumentId(strapi, documentId, chatId) {
  if (!documentId || !chatId) return 0;

  const updatedCount = await strapi.db.connection('customer_profiles')
    .where('document_id', String(documentId))
    .update({ telegram_chat_id: String(chatId), updated_at: new Date() });

  return Number(updatedCount || 0);
}

async function deactivateSchedulesForDrug(strapi, profile, drugName) {
  if (!profile || !drugName) return 0;

  const knex = strapi.db.connection;
  const hasScheduleCustomerDocumentIdColumn = await knex.schema.hasColumn('medication_schedules', 'customer_document_id');
  const hasScheduleCustomerLinkTable = await knex.schema.hasTable('medication_schedules_customer_lnk');

  const scheduleRows = [];

  if (hasScheduleCustomerDocumentIdColumn && profile.documentId) {
    const byDocRows = await knex('medication_schedules as ms')
      .where('ms.customer_document_id', String(profile.documentId))
      .where('ms.drug_name', drugName)
      .where('ms.is_active', true)
      .select('ms.id');
    scheduleRows.push(...(byDocRows || []));
  }

  if (hasScheduleCustomerLinkTable && profile.id) {
    const byLinkRows = await knex('medication_schedules as ms')
      .join('medication_schedules_customer_lnk as msc', 'msc.medication_schedule_id', 'ms.id')
      .where('msc.customer_profile_id', profile.id)
      .where('ms.drug_name', drugName)
      .where('ms.is_active', true)
      .select('ms.id');
    scheduleRows.push(...(byLinkRows || []));
  }

  const scheduleIds = Array.from(new Set((scheduleRows || []).map((r) => r.id).filter(Boolean)));
  if (!scheduleIds.length) return 0;

  await knex('medication_schedules')
    .whereIn('id', scheduleIds)
    .update({ is_active: false, updated_at: new Date() });

  return scheduleIds.length;
}

async function findLatestDrugStoreDocumentId(strapi, customerId) {
  if (!customerId) return null;

  const rows = await strapi.db.query('api::notification.notification').findMany({
    where: {
      customer_profile: customerId,
      type: { $in: HISTORY_NOTIFICATION_TYPES },
    },
    populate: {
      drug_store: { select: ['documentId'] },
    },
    orderBy: { createdAt: 'desc' },
    limit: 1,
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  return row?.drug_store?.documentId || null;
}

async function appendTelegramFollowupToHistory(
  strapi,
  profile,
  drugName,
  followupSummary,
  followupStatus,
  contextLabel = 'ติดตามยา'
) {
  if (!profile?.documentId) return;

  const stamp = formatThaiDateTimeForHistory();
  const line = `${stamp} - ${contextLabel} (${drugName}): ${followupStatus}`;
  const currentHistory = (profile.symptom_history || '').trim();
  const nextHistory = currentHistory ? `${currentHistory}\n${line}` : line;

  await strapi.db.connection('customer_profiles')
    .where('document_id', String(profile.documentId))
    .update({
      symptom_history: nextHistory,
      updated_at: new Date(),
    });

  const latestDrugStoreDocumentId = await findLatestDrugStoreDocumentId(strapi, profile.id);
  const notificationData = {
    title: 'ติดตามอาการหลังยาหมด',
    type: 'message',
    message: followupSummary,
    customer_profile: { connect: [profile.documentId] },
    data: {
      followup_symptoms: followupSummary,
      symptoms: {
        followup_symptoms: followupSummary,
      },
      data: {
        followup_symptoms: followupSummary,
      },
      telegram_followup: {
        drug_name: drugName,
        status: followupStatus,
        tracked_at: stamp,
      },
    },
  };

  if (latestDrugStoreDocumentId) {
    notificationData.drug_store = { connect: [latestDrugStoreDocumentId] };
  }

  await strapi.documents('api::notification.notification').create({
    data: notificationData,
    status: 'published',
  });
}

async function handleMedicationCallback(strapi, callbackQuery) {
  const callbackId = callbackQuery?.id;
  const chatId = callbackQuery?.message?.chat?.id;
  const parsed = parseCallbackData(callbackQuery?.data);

  if (!callbackId || !chatId || !parsed) {
    return;
  }

  const profile = await findCustomerProfileByChatId(strapi, chatId);
  if (!profile) {
    await answerTelegramCallbackQuery(callbackId, 'ไม่พบบัญชีผู้ใช้ในระบบ CareLink', true);
    return;
  }

  const schedule = await loadScheduleWithCustomer(strapi, parsed.scheduleId);
  if (!schedule || !schedule.customer) {
    await answerTelegramCallbackQuery(callbackId, 'ไม่พบข้อมูลตารางยา', true);
    return;
  }

  const scheduleCustomerDocId = schedule.customer?.documentId || schedule.customer?.document_id || schedule.customer_document_id || null;
  const profileDocId = profile.documentId || profile.document_id || null;

  if (scheduleCustomerDocId && profileDocId) {
    if (String(scheduleCustomerDocId) !== String(profileDocId)) {
      await answerTelegramCallbackQuery(callbackId, 'รายการนี้ไม่ใช่ของบัญชีนี้', true);
      return;
    }
  } else if (Number(schedule.customer.id) !== Number(profile.id)) {
    await answerTelegramCallbackQuery(callbackId, 'รายการนี้ไม่ใช่ของบัญชีนี้', true);
    return;
  }

  if (parsed.group === 'meddone' && !schedule.take_until_finished) {
    await answerTelegramCallbackQuery(callbackId, 'รายการนี้ไม่ได้เปิดโหมดติดตามยาจนหมด', true);
    return;
  }

  if (parsed.group === 'medstat' && schedule.take_until_finished) {
    await answerTelegramCallbackQuery(callbackId, 'รายการนี้ใช้โหมดกินยาจนหมด กรุณาใช้ปุ่มในข้อความล่าสุด', true);
    return;
  }

  if (!schedule.is_active) {
    await answerTelegramCallbackQuery(callbackId, 'รายการนี้ถูกบันทึกแล้ว', false);
    await sendTelegramMessage(
      chatId,
      `รายการติดตามยา ${schedule.drug_name} ถูกปิดไปแล้ว หากยังมีอาการผิดปกติ โปรดติดต่อเภสัชกรหรือโรงพยาบาลนะคะ`
    );
    return;
  }

  if (parsed.group === 'meddone') {
    if (parsed.action === 'notyet') {
      await answerTelegramCallbackQuery(callbackId, 'รับทราบค่ะ จะเตือนรอบถัดไป', false);
      await sendTelegramMessage(
        chatId,
        `รับทราบค่ะ ยา ${schedule.drug_name} ยังไม่หมด\nระบบจะเตือนคุณอีกครั้งในรอบถัดไปนะคะ`
      );
      return;
    }

    await answerTelegramCallbackQuery(callbackId, 'รับทราบว่ายาหมดแล้ว', false);
    await sendTelegramMessage(chatId, `ยา ${schedule.drug_name} หมดแล้วใช่ไหมคะ\nตอนนี้อาการของคุณเป็นอย่างไร`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '😊 หายดีแล้ว', callback_data: `medrec:${schedule.id}:good` },
          { text: '😷 ยังไม่หาย', callback_data: `medrec:${schedule.id}:bad` },
        ]],
      },
    });
    return;
  }

  if (parsed.group === 'medstat') {
    if (parsed.action === 'notyet') {
      await answerTelegramCallbackQuery(callbackId, 'รับทราบค่ะ จะเตือนรอบถัดไป', false);
      await sendTelegramMessage(
        chatId,
        `รับทราบค่ะ ตอนนี้อาการยังไม่หาย\nระบบจะเตือนยารอบถัดไปให้อัตโนมัตินะคะ`
      );
      return;
    }

    if (parsed.action === 'good') {
      const deactivatedCount = await deactivateSchedulesForDrug(strapi, profile, schedule.drug_name);
      strapi.log.info(
        `[TELEGRAM] Deactivated ${deactivatedCount} schedule(s) after symptom-recovered callback` +
        ` customerId=${profile.id}, drug=${schedule.drug_name}`
      );

      const summary = `ติดตามผ่าน Telegram: ผู้ป่วยแจ้งว่าอาการหายแล้วระหว่างใช้ยา ${schedule.drug_name}`;
      await appendTelegramFollowupToHistory(
        strapi,
        profile,
        schedule.drug_name,
        summary,
        'อาการหายแล้ว',
        'ติดตามอาการระหว่างใช้ยา'
      );

      await answerTelegramCallbackQuery(callbackId, 'ขอบคุณสำหรับการอัปเดตค่ะ', false);
      await sendTelegramMessage(
        chatId,
        '🎉 ยินดีด้วยค่ะ อาการของคุณหายแล้ว\nระบบจะหยุดแจ้งเตือนยารายการนี้ให้อัตโนมัตินะคะ'
      );
      return;
    }

    await answerTelegramCallbackQuery(callbackId, 'รับทราบว่ายาหมดแล้ว', false);
    await sendTelegramMessage(chatId, `ยา ${schedule.drug_name} หมดแล้วใช่ไหมคะ\nตอนนี้อาการของคุณเป็นอย่างไร`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '😊 หายดีแล้ว', callback_data: `medrec:${schedule.id}:good` },
          { text: '😷 ยังไม่หาย', callback_data: `medrec:${schedule.id}:bad` },
        ]],
      },
    });
    return;
  }

  if (parsed.group === 'medrec') {
    const deactivatedCount = await deactivateSchedulesForDrug(strapi, profile, schedule.drug_name);
    strapi.log.info(
      `[TELEGRAM] Deactivated ${deactivatedCount} schedule(s) after medication-finished callback` +
      ` customerId=${profile.id}, drug=${schedule.drug_name}`
    );

    if (parsed.action === 'good') {
      const summary = `ติดตามผ่าน Telegram: ยา ${schedule.drug_name} หมดแล้ว และผู้ป่วยแจ้งว่าอาการหายดี`;
      await appendTelegramFollowupToHistory(
        strapi,
        profile,
        schedule.drug_name,
        summary,
        'อาการหายดี'
      );

      await answerTelegramCallbackQuery(callbackId, 'ขอบคุณสำหรับการอัปเดตค่ะ', false);
      await sendTelegramMessage(
        chatId,
        '🎉 ยินดีด้วยค่ะ อาการของคุณดีขึ้นแล้ว\nขอให้สุขภาพแข็งแรงนะคะ หากมีอาการผิดปกติสามารถติดต่อร้านยาได้เสมอ'
      );
      return;
    }

    const summary = `ติดตามผ่าน Telegram: ยา ${schedule.drug_name} หมดแล้ว แต่ผู้ป่วยแจ้งว่ายังไม่หาย`;
    await appendTelegramFollowupToHistory(
      strapi,
      profile,
      schedule.drug_name,
      summary,
      'ยังไม่หาย'
    );

    await answerTelegramCallbackQuery(callbackId, 'รับทราบข้อมูลแล้ว', false);
    await sendTelegramMessage(
      chatId,
      '⚠️ หากยังไม่หาย โปรดไปพบเภสัชกรที่ร้านยานี้\nหรือไปโรงพยาบาลเพื่อประเมินอาการเพิ่มเติมโดยเร็ว'
    );
  }
}

async function handleStartLinking(strapi, chatId, text) {
  const startMatch = String(text || '').trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  const customerId = startMatch?.[1]?.trim();

  try {
    if (!customerId) {
      await sendTelegramMessage(
        chatId,
        'สวัสดีค่ะ 👋 กรุณาเริ่มเชื่อมต่อจากหน้าเว็บไซต์ CareLink แล้วกดปุ่มเปิด Telegram ผ่านลิงก์ที่ระบบสร้างให้นะคะ'
      );
      return;
    }

    let profile = await findLatestCustomerByDocumentId(strapi, customerId);

    if (!profile && /^\d+$/.test(customerId)) {
      const idRow = await strapi.db.connection('customer_profiles')
        .where('id', Number(customerId))
        .first('id', 'document_id as documentId', 'telegram_chat_id as telegramChatId');

      if (idRow?.documentId) {
        profile = await findLatestCustomerByDocumentId(strapi, idRow.documentId);
      }
    }

    if (profile) {
      const actualDocId = profile.documentId;
      const existingChatId = profile.telegramChatId;

      if (existingChatId) {
        if (existingChatId === chatId.toString()) {
          await sendTelegramMessage(chatId, 'ℹ️ บัญชีนี้ถูกเชื่อมต่อกับระบบ CareLink ไว้เรียบร้อยแล้วค่ะ');
          return;
        }

        await syncTelegramChatIdByDocumentId(strapi, actualDocId, chatId.toString());
        await sendTelegramMessage(
          chatId,
          '🔄 พบการเชื่อมต่อเดิมกับบัญชีอื่นอยู่ ระบบได้ทำการเปลี่ยนมาเชื่อมต่อกับบัญชีนี้ให้แทนเรียบร้อยแล้วค่ะ'
        );
        return;
      }

      const updatedCount = await syncTelegramChatIdByDocumentId(strapi, actualDocId, chatId.toString());

      if (updatedCount > 0) {
        await sendTelegramMessage(
          chatId,
          '✅ เชื่อมต่อระบบ CareLink เรียบร้อยแล้วค่ะ! ท่านจะได้รับการแจ้งเตือนการทานยาผ่านช่องทางนี้'
        );
        return;
      }
    }

    await sendTelegramMessage(chatId, '❌ ไม่พบข้อมูลโปรไฟล์ของคุณในระบบ กรุณาลองใหม่อีกครั้งจากหน้าเว็บไซต์นะคะ');
  } catch (err) {
    console.error('[TELEGRAM ERROR]', err);
    try {
      await sendTelegramMessage(chatId, '❌ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่นะคะ');
    } catch (_) {}
  }
}

module.exports = {
  async webhook(ctx) {
    ctx.body = { ok: true };

    console.log('====================================');
    console.log('RECEIVED REQUEST FROM TELEGRAM');
    console.log('Method:', ctx.request.method);
    console.log('Body:', JSON.stringify(ctx.request.body));
    console.log('====================================');

    const strapi = globalThis.strapi;
    if (!strapi) return;

    const body = ctx.request.body;
    if (!body) return;

    if (body.callback_query) {
      try {
        await handleMedicationCallback(strapi, body.callback_query);
      } catch (err) {
        console.error('[TELEGRAM CALLBACK ERROR]', err);
      }
      return;
    }

    if (!body.message) return;

    const chatId = body.message.chat.id;
    const text = (body.message.text || "");

    if (text.startsWith('/start')) {
      await handleStartLinking(strapi, chatId, text);
    }
  },

  // ฟังก์ชันสำหรับ cron job
  async sendReminder() {
    // ...existing code...
    const hour = reminderConfig.REMIND_HOUR.toString().padStart(2, "0");
    const minute = reminderConfig.REMIND_MINUTE.toString().padStart(2, "0");
    const message = `กรุณาทานยา ${reminderConfig.DRUG_NAME} เวลา ${hour}:${minute} น. 😊`;
    for (const chatId of reminderConfig.CHAT_IDS) {
      try {
        await sendTelegramMessage(chatId, message);
        console.log(`ส่งแจ้งเตือนสำเร็จ: ${chatId}`);
      } catch (err) {
        console.error(`ส่งแจ้งเตือนไม่สำเร็จ: ${chatId}`, err);
      }
    }
  },
};

if (require.main === module) {
  module.exports.sendReminder();
}