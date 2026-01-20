"use strict";

const { sendTelegramMessage } = require("../../../utils/telegram");
const reminderConfig = require("../../../../config/reminder-config");

module.exports = {
  async webhook(ctx) {
    // Debug log
    console.log('Telegram webhook called:', ctx.request.method, ctx.request.url);

    // รับเฉพาะ POST เท่านั้น
    if (ctx.request.method !== 'POST') {
      ctx.status = 405;
      ctx.body = { error: 'Method Not Allowed' };
      return;
    }

    const body = ctx.request.body;
    if (!body || !body.message) {
      ctx.body = { ok: true };
      return;
    }

    const chatId = body.message.chat.id;
    const text = (body.message.text || "").toLowerCase();

    // 👋 คำทักทาย
    if (["hello", "hi", "สวัสดี"].includes(text)) {
      await sendTelegramMessage(
        chatId,
        "สวัสดีครับ 😊 ระบบแจ้งเตือนการทานยา CareLink พร้อมใช้งานแล้ว"
      );
    }


    ctx.body = { ok: true };
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