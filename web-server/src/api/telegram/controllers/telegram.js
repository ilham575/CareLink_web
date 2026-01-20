"use strict";

const { sendTelegramMessage } = require("../../../utils/telegram");
const reminderConfig = require("../../../../config/reminder-config");

module.exports = {
  async webhook(ctx) {
    // � Log แบบชัดเจนสุดๆ
    console.log('====================================');
    console.log('RECEIVED REQUEST FROM TELEGRAM');
    console.log('Method:', ctx.request.method);
    console.log('Body:', JSON.stringify(ctx.request.body));
    console.log('====================================');
    
    const body = ctx.request.body;
    if (!body || !body.message) {
      ctx.body = { ok: true };
      return;
    }

    const chatId = body.message.chat.id;
    const text = (body.message.text || "");

    // 🔗 จัดการ /start พร้อม parameter
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        const customerId = parts[1];
        console.log(`[Telegram] Linking Customer Profile ID: ${customerId} with ChatID: ${chatId}`);
        
        try {
          // 🔍 ค้นหาโปรไฟล์ลูกค้า (ใช้ Document Service ของ Strapi 5)
          const profile = await strapi.documents('api::customer-profile.customer-profile').findFirst({
            filters: {
              $or: [
                { documentId: customerId },
                { id: isNaN(customerId) ? -1 : parseInt(customerId) }
              ]
            }
          });

          if (profile) {
            const actualDocId = profile.documentId;
            
            // 🛑 ตรวจสอบก่อนว่าเคยผูกไปแล้วหรือยัง
            if (profile.telegramChatId === chatId.toString()) {
              console.log(`[Telegram] Already linked with ChatID: ${chatId}`);
              ctx.body = { ok: true };
              return;
            }

            // 📝 อัปเดตข้อมูลและสั่ง Publish ทันที (วิธีของ Strapi 5)
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
          await sendTelegramMessage(chatId, "❌ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้งภายหลัง");
        }
      } else {
        await sendTelegramMessage(chatId, "สวัสดีค่ะ! 😊 กรุณากดปุ่ม 'เชื่อมต่อ' จากหน้าโปรไฟล์บนเว็บไซต์ เพื่อเปิดใช้งานการแจ้งเตือนนะคะ");
      }
    } else {
      await sendTelegramMessage(chatId, "ได้รับข้อความแล้วค่ะ!");
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