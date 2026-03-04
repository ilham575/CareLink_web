'use strict';
const importRoles = require('../scripts/importRoles');
const { initializeSocketIO } = require('./socket-server');
const { setupTelegramWebhook } = require('./utils/telegram');
const { sendTelegramMessage } = require('./utils/telegram');

module.exports = {
  register() {},
  async bootstrap({ strapi }) {
    // Import roles first
    await importRoles({ strapi });
    
    // Run database migrations
    await runDatabaseMigrations({ strapi });
    
    // Initialize Socket.IO on Strapi's HTTP server
    initializeSocketIO(strapi, strapi.server.httpServer || strapi.server);

    // Setup Telegram Webhook automatically
    const publicUrl = strapi.config.get('server.url');
    const manualWebhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

    if (manualWebhookUrl) {
      await setupTelegramWebhook(manualWebhookUrl);
    } else if (publicUrl && !publicUrl.includes('localhost')) {
      await setupTelegramWebhook(publicUrl);
    } else {
      console.log('ℹ️ [TELEGRAM] Localhost detected - skipping automatic setup.');
    }

    // ✅ Register medication reminder cron via strapi.cron.add() (Strapi v5 compatible)
    console.log('⏰ [CRON] Registering medicationReminder cron task...');
    strapi.cron.add({
      medicationReminder: {
        task: async ({ strapi }) => {
          try {
            const now = new Date();
            const options = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };
            const currentTime = new Intl.DateTimeFormat('en-GB', options).format(now);
            const dayOptions = { timeZone: 'Asia/Bangkok', weekday: 'short' };
            const currentDay = new Intl.DateTimeFormat('en-GB', dayOptions).format(now);

            strapi.log.info(`⏰ [MedReminder] Checking schedule for ${currentTime} (${currentDay}) Thailand Time`);

            // ใช้ strapi.db.query เพื่อ query raw DB (bypass Strapi v5 document deduplication)
            const schedules = await strapi.db.query('api::medication-schedule.medication-schedule').findMany({
              where: { is_active: true, published_at: { $notNull: true } },
              populate: { customer: { populate: ['users_permissions_user'] } },
            });

            if (!schedules || schedules.length === 0) {
              strapi.log.info('[MedReminder] No active schedules found.');
              return;
            }

            const matchingSchedules = schedules.filter(s => (s.schedule_time || '').slice(0, 5) === currentTime);
            strapi.log.info(`[MedReminder] ${schedules.length} active schedules, ${matchingSchedules.length} match time ${currentTime}`);

            for (const schedule of matchingSchedules) {
              let scheduledDays = schedule.days_of_week;
              if (typeof scheduledDays === 'string') {
                try { scheduledDays = JSON.parse(scheduledDays); } catch(e) {}
              }
              if (Array.isArray(scheduledDays) && !scheduledDays.includes(currentDay)) continue;

              const customerProfile = schedule.customer;
              const telegramChatId = customerProfile?.telegramChatId;
              const customerDocId = customerProfile?.documentId;

              const dosagePart = schedule.dosage_per_time ? ` — ครั้งละ ${schedule.dosage_per_time}` : '';
              const mealMap = { before: '💊➡️🍽️ กินยาก่อน แล้วค่อยกินอาหาร', after: '🍽️➡️💊 กินอาหารก่อน แล้วค่อยกินยา', with_meal: '🍽️💊 กินยาพร้อมกับอาหาร' };
              const mealInstruction = mealMap[schedule.meal_relation] || '';
              const message = `🔔 ถึงเวลากินยา!\n💊 ${schedule.drug_name}${dosagePart}\n⏰ เวลา ${schedule.schedule_time.slice(0, 5)} น.${mealInstruction ? '\n' + mealInstruction : ''}`;

              if (customerDocId) {
                strapi.log.info(`[MedReminder] Sending reminder to customer documentId=${customerDocId}`);
                const shortMessage = `${schedule.drug_name}${dosagePart} — ${schedule.schedule_time.slice(0, 5)} น.`;

                // สร้าง Notification ด้วย documents API (Strapi v5) โดยใช้ documentId สำหรับ relation
                await strapi.documents('api::notification.notification').create({
                  data: {
                    title: 'ถึงเวลากินยา',
                    type: 'system_alert',
                    message: shortMessage,
                    customer_profile: { connect: [customerDocId] },
                  },
                  status: 'published',
                });

                // Broadcast ผ่าน Socket.IO ไปยัง room customer:documentId (ตามมาตรฐาน lifecycle)
                if (strapi.io) {
                  strapi.io.to(`customer:${customerDocId}`).emit('notification', {
                    title: 'ถึงเวลากินยา',
                    message: shortMessage,
                    type: 'medication',
                  });
                }
              }

              if (telegramChatId) {
                try {
                  strapi.log.info(`[MedReminder] Sending Telegram to Chat ID ${telegramChatId}`);
                  await sendTelegramMessage(telegramChatId, message);
                } catch (err) {
                  strapi.log.error(`[MedReminder] Failed Telegram to ${telegramChatId}:`, err.message);
                }
              }
            }
          } catch (err) {
            strapi.log.error('[MedReminder] Cron error:', err.message);
          }
        },
        options: { rule: '*/1 * * * *' },
      },
    });
    console.log('✅ [CRON] medicationReminder registered successfully');
  },
};

/**
 * Run database migrations on Strapi bootstrap
 * This adds any missing columns to the database
 */
async function runDatabaseMigrations({ strapi }) {
  console.log('🔧 [MIGRATION] Starting database migrations...');
  
  try {
    const knex = strapi.db.connection;
    
    // Check if admin_profile_id column exists in drug_stores
    const hasColumn = await knex.schema.hasColumn('drug_stores', 'admin_profile_id');
    
    if (!hasColumn) {
      console.log('📝 [MIGRATION] Adding admin_profile_id column to drug_stores table...');
      
      await knex.schema.table('drug_stores', (table) => {
        table.integer('admin_profile_id').nullable();
      });
      
      console.log('✅ [MIGRATION] Column admin_profile_id added successfully');
      
      // Try to add foreign key if possible
      try {
        const hasForeignKey = await knex.raw(`
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'drug_stores' 
          AND constraint_name = 'fk_drug_stores_admin_profile'
        `);
        
        if (!hasForeignKey.rows || hasForeignKey.rows.length === 0) {
          await knex.schema.table('drug_stores', (table) => {
            table.foreign('admin_profile_id')
              .references('id')
              .inTable('admin_profiles')
              .onDelete('SET NULL')
              .onUpdate('CASCADE');
          });
          console.log('✅ [MIGRATION] Foreign key constraint added successfully');
        }
      } catch (fkError) {
        console.warn('⚠️  [MIGRATION] Could not add foreign key:', fkError.message);
      }
    } else {
      console.log('ℹ️  [MIGRATION] Column admin_profile_id already exists - skipping');
    }
    
    console.log('✅ [MIGRATION] Database migrations completed');
  } catch (error) {
    console.error('❌ [MIGRATION] Migration failed:', error.message);
    // Don't throw - allow Strapi to continue even if migration fails
  }
}
