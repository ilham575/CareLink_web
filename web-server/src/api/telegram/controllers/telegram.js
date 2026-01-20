"use strict";

const { sendTelegramMessage } = require("../../../utils/telegram");
const reminderConfig = require("../../../../config/reminder-config");

module.exports = {
  async webhook(ctx) {
    // 1. ตอบกลับ Telegram ทันทีเพื่อหยุดสถานะ Retry
    ctx.body = { ok: true }; 
    
    // � Log แบบชัดเจนสุดๆ
    console.log('====================================');
    console.log('RECEIVED REQUEST FROM TELEGRAM');
    console.log('Method:', ctx.request.method);
    console.log('Body:', JSON.stringify(ctx.request.body));
    console.log('====================================');
    
    const body = ctx.request.body;
    if (!body || !body.message) return; // ไม่ต้องทำอะไรต่อถ้าไม่มี message

    const chatId = body.message.chat.id;
    const text = (body.message.text || "");

    // 🔗 จัดการ /start พร้อม parameter
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        const customerId = parts[1];
        
        try {
          // 🔍 ค้นหาโปรไฟล์ลูกค้า (ระบุ status: 'draft' เพื่อให้หาเจอทั้งฉบับร่างและที่เผยแพร่แล้วใน Strapi 5)
          const profile = await strapi.documents('api::customer-profile.customer-profile').findFirst({
            status: 'draft',
            filters: {
              $or: [
                { documentId: customerId },
                { id: isNaN(customerId) ? -1 : parseInt(customerId) }
              ]
            }
          });

          if (profile) {
            const actualDocId = profile.documentId;
            const existingChatId = profile.telegramChatId;

            // 1. ตรวจสอบว่ามี telegramChatId อยู่แล้วหรือไม่
            if (existingChatId) {
              if (existingChatId === chatId.toString()) {
                // กรณี ChatID เหมือนเดิม
                await sendTelegramMessage(chatId, "ℹ️ บัญชีนี้ถูกเชื่อมต่อกับระบบ CareLink ไว้เรียบร้อยแล้วค่ะ");
                return; // จบการทำงาน (ctx.body ถูกตั้งไว้ตั้งแต่ต้นแล้ว)
              } else {
                // กรณีมี ChatID อยู่แล้วแต่ไม่เหมือนเดิม (ต้องการเปลี่ยนเครื่อง/บัญชี)
                await strapi.documents('api::customer-profile.customer-profile').update({
                  documentId: actualDocId,
                  data: { telegramChatId: chatId.toString() },
                  status: 'published'
                });
                await sendTelegramMessage(
                  chatId, 
                  "🔄 พบการเชื่อมต่อเดิมกับบัญชีอื่นอยู่ ระบบได้ทำการเปลี่ยนมาเชื่อมต่อกับบัญชีนี้ให้แทนเรียบร้อยแล้วค่ะ"
                );
                return;
              }
            }

            // 2. ถ้าไม่มีข้อมูล ChatID เลย (กรณีผูกครั้งแรก)
            const updatedRecord = await strapi.documents('api::customer-profile.customer-profile').update({
              documentId: actualDocId,
              data: { 
                telegramChatId: chatId.toString(),
              },
              status: 'published'
            });

            if (updatedRecord) {
              await sendTelegramMessage(
                chatId,
                "✅ เชื่อมต่อระบบ CareLink เรียบร้อยแล้วค่ะ! ท่านจะได้รับการแจ้งเตือนการทานยาผ่านช่องทางนี้"
              );
              return;
            }
          }
          
          // ถ้าไม่เจอโปรไฟล์
          await sendTelegramMessage(chatId, "❌ ไม่พบข้อมูลโปรไฟล์ของคุณในระบบ กรุณาลองใหม่อีกครั้งจากหน้าเว็บไซต์นะคะ");

        } catch (err) {
          console.error('[TELEGRAM ERROR]', err);
        }
      }
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