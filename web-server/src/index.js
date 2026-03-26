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

    console.log('[BOOTSTRAP] TELEGRAM_WEBHOOK_URL from .env:', manualWebhookUrl);
    console.log('[BOOTSTRAP] publicUrl from strapi.config:', publicUrl);

    if (manualWebhookUrl) {
      console.log('✅ [TELEGRAM] Using manual webhook URL from TELEGRAM_WEBHOOK_URL env var');
      await setupTelegramWebhook(manualWebhookUrl);
    } else if (publicUrl && !publicUrl.includes('localhost')) {
      console.log('✅ [TELEGRAM] Using publicUrl from strapi.config.server.url (no TELEGRAM_WEBHOOK_URL set)');
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
            const currentTime = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Bangkok',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(now);
            const currentDay = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Bangkok',
              weekday: 'short',
            }).format(now);
            const currentDayLong = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'long' }).format(now);
            const hasScheduleCustomerLinkTable = await strapi.db.connection.schema.hasTable('medication_schedules_customer_lnk');
            const hasScheduleCustomerDocumentIdColumn = await strapi.db.connection.schema.hasColumn('medication_schedules', 'customer_document_id');
            const customerByDocumentIdCache = new Map();

            strapi.log.info(`⏰ [MedReminder] Checking schedule for ${currentTime} (${currentDay}) Thailand Time`);

            // ใช้ strapi.db.query เพื่อ query raw DB (bypass Strapi v5 document deduplication)
            const schedules = await strapi.db.query('api::medication-schedule.medication-schedule').findMany({
              where: { is_active: true },
              populate: { customer: { populate: ['users_permissions_user'] } },
            });

            if (!schedules || schedules.length === 0) {
              strapi.log.info('[MedReminder] No active schedules found.');
              return;
            }

            const matchingSchedules = schedules.filter(s => (s.schedule_time || '').slice(0, 5) === currentTime);
            strapi.log.info(`[MedReminder] ${schedules.length} active schedules, ${matchingSchedules.length} match time ${currentTime}`);

            const normalizeDayValue = (value) => {
              const raw = String(value || '').trim().toLowerCase();
              if (!raw) return '';
              const aliases = {
                sunday: 'sun',
                monday: 'mon',
                tuesday: 'tue',
                wednesday: 'wed',
                thursday: 'thu',
                friday: 'fri',
                saturday: 'sat',
              };
              if (aliases[raw]) return aliases[raw];
              return raw.slice(0, 3);
            };

            const resolveCustomerFromLinkTable = async (scheduleId) => {
              if (!hasScheduleCustomerLinkTable) return null;
              if (!scheduleId) return null;

              const row = await strapi.db.connection('medication_schedules_customer_lnk as mscl')
                .join('customer_profiles as cp', 'cp.id', 'mscl.customer_profile_id')
                .where('mscl.medication_schedule_id', scheduleId)
                .orderBy('cp.id', 'desc')
                .first('cp.id', 'cp.document_id as documentId', 'cp.telegram_chat_id as telegramChatId');

              if (!row) return null;

              return {
                id: row.id,
                documentId: row.documentId,
                telegramChatId: row.telegramChatId,
              };
            };

            const resolveCustomerFromDocumentId = async (documentId) => {
              const normalized = String(documentId || '').trim();
              if (!normalized) return null;

              if (customerByDocumentIdCache.has(normalized)) {
                return customerByDocumentIdCache.get(normalized);
              }

              const rows = await strapi.db.connection('customer_profiles as cp')
                .where('cp.document_id', normalized)
                .orderBy('cp.id', 'desc')
                .select('cp.id', 'cp.document_id as documentId', 'cp.telegram_chat_id as telegramChatId')
                .limit(20);

              const preferredRow = (rows || []).find((r) => String(r?.telegramChatId || '').trim() !== '') || rows?.[0] || null;

              const value = preferredRow
                ? {
                    id: preferredRow.id,
                    documentId: preferredRow.documentId,
                    telegramChatId: preferredRow.telegramChatId,
                  }
                : null;

              customerByDocumentIdCache.set(normalized, value);
              return value;
            };

            for (const schedule of matchingSchedules) {
              let scheduledDays = schedule.days_of_week;
              if (typeof scheduledDays === 'string') {
                try { scheduledDays = JSON.parse(scheduledDays); } catch(e) {}
              }
              if (Array.isArray(scheduledDays) && scheduledDays.length > 0) {
                const normalizedToday = normalizeDayValue(currentDay);
                const normalizedTodayLong = normalizeDayValue(currentDayLong);
                const normalizedScheduleDays = scheduledDays.map(normalizeDayValue);
                const dayMatched = normalizedScheduleDays.some(
                  (d) => d === normalizedToday || d === normalizedTodayLong
                );

                if (!dayMatched) {
                  strapi.log.info(
                    `[MedReminder] Skip scheduleId=${schedule.id} (${schedule.drug_name}) due day mismatch.` +
                    ` scheduleDays=${JSON.stringify(scheduledDays)} today=${currentDay}`
                  );
                  continue;
                }
              }

              const scheduleCustomerDocId = hasScheduleCustomerDocumentIdColumn
                ? String(schedule.customer_document_id || '').trim()
                : '';

              const hasChatId = (v) => String(v || '').trim() !== '';
              let customerProfile = null;
              if (scheduleCustomerDocId) {
                customerProfile = await resolveCustomerFromDocumentId(scheduleCustomerDocId);
              }

              const scheduleCustomer = schedule.customer || null;
              const linkTableCustomer = (!scheduleCustomerDocId && (!customerProfile || !hasChatId(customerProfile?.telegramChatId)))
                ? await resolveCustomerFromLinkTable(schedule.id)
                : null;

              const customerCandidates = [customerProfile, scheduleCustomer, linkTableCustomer].filter(Boolean);
              customerProfile = customerCandidates.find((c) => hasChatId(c?.telegramChatId || c?.telegram_chat_id))
                || customerCandidates[0]
                || null;

              const customerDocId =
                scheduleCustomerDocId || customerProfile?.documentId || customerProfile?.document_id || null;
              const telegramChatId = customerProfile?.telegramChatId || customerProfile?.telegram_chat_id || null;

              strapi.log.info(
                `[MedReminder] Resolved scheduleId=${schedule.id} customer=${customerDocId || 'unknown'}` +
                ` telegramChatId=${telegramChatId ? 'present' : 'empty'}`
              );

              if (!telegramChatId) {
                strapi.log.info(
                  `[MedReminder] Skip Telegram scheduleId=${schedule.id} (${schedule.drug_name})` +
                  ` because telegramChatId is empty for customer=${customerDocId || 'unknown'}`
                );
              }

              const dosagePart = schedule.dosage_per_time ? ` — ครั้งละ ${schedule.dosage_per_time}` : '';
              const mealMap = { before: '💊➡️🍽️ กินยาก่อน แล้วค่อยกินอาหาร', after: '🍽️➡️💊 กินอาหารก่อน แล้วค่อยกินยา', with_meal: '🍽️💊 กินยาพร้อมกับอาหาร' };
              const mealInstruction = mealMap[schedule.meal_relation] || '';
              const needsUntilFinishedFlow = !!schedule.take_until_finished;
              const flowHint = needsUntilFinishedFlow
                ? '\n\nยานี้เป็นแบบ "กินจนหมด"\nโปรดเลือกว่ายาหมดแล้วหรือยัง'
                : '\n\nโปรดอัปเดตอาการ: หายแล้ว / ยังไม่หาย / ยาหมด';
              const message = `🔔 ถึงเวลากินยา!\n💊 ${schedule.drug_name}${dosagePart}\n⏰ เวลา ${schedule.schedule_time.slice(0, 5)} น.${mealInstruction ? '\n' + mealInstruction : ''}${flowHint}`;

              if (customerDocId) {
                strapi.log.info(`[MedReminder] Sending reminder to customer documentId=${customerDocId}`);
                const shortMessage = `${schedule.drug_name}${dosagePart} — ${schedule.schedule_time.slice(0, 5)} น.`;

                // สำคัญ: ไม่ await งานสร้าง notification เพื่อไม่ให้บล็อกการส่ง Telegram
                void (async () => {
                  try {
                    strapi.log.info(`[MedReminder] Creating system_alert notification for customer=${customerDocId}`);

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

                    strapi.log.info(`[MedReminder] Created system_alert notification for customer=${customerDocId}`);

                    // Broadcast ผ่าน Socket.IO ไปยัง room customer:documentId (ตามมาตรฐาน lifecycle)
                    if (strapi.io) {
                      strapi.io.to(`customer:${customerDocId}`).emit('notification', {
                        title: 'ถึงเวลากินยา',
                        message: shortMessage,
                        type: 'medication',
                      });
                    }
                  } catch (notifyErr) {
                    strapi.log.error(
                      `[MedReminder] Failed notification create for customer=${customerDocId}:`,
                      notifyErr.message
                    );
                  }
                })();
              }

              if (telegramChatId) {
                try {
                  strapi.log.info(`[MedReminder] Sending Telegram to Chat ID ${telegramChatId}`);
                  if (needsUntilFinishedFlow && schedule.id) {
                    await sendTelegramMessage(telegramChatId, message, {
                      reply_markup: {
                        inline_keyboard: [[
                          { text: '⏳ ยังไม่หมด', callback_data: `meddone:${schedule.id}:notyet` },
                          { text: '✅ หมดแล้ว', callback_data: `meddone:${schedule.id}:done` },
                        ]],
                      },
                    });
                  } else if (schedule.id) {
                    await sendTelegramMessage(telegramChatId, message, {
                      reply_markup: {
                        inline_keyboard: [
                          [
                            { text: '😊 หายแล้ว', callback_data: `medstat:${schedule.id}:good` },
                            { text: '😷 ยังไม่หาย', callback_data: `medstat:${schedule.id}:notyet` },
                          ],
                          [
                            { text: '💊 ยาหมด', callback_data: `medstat:${schedule.id}:finished` },
                          ],
                        ],
                      },
                    });
                  } else {
                    await sendTelegramMessage(telegramChatId, message);
                  }
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

    // --- drug_unit fields on drugs table ---
    const hasDrugUnit = await knex.schema.hasColumn('drugs', 'drug_unit');
    if (!hasDrugUnit) {
      await knex.schema.table('drugs', (table) => {
        table.string('drug_unit').defaultTo('tablet').nullable();
      });
      console.log('✅ [MIGRATION] drug_unit column added to drugs');
    } else {
      console.log('ℹ️  [MIGRATION] drug_unit already exists - skipping');
    }

    const hasDrugUnitCustom = await knex.schema.hasColumn('drugs', 'drug_unit_custom');
    if (!hasDrugUnitCustom) {
      await knex.schema.table('drugs', (table) => {
        table.string('drug_unit_custom').nullable();
      });
      console.log('✅ [MIGRATION] drug_unit_custom column added to drugs');
    } else {
      console.log('ℹ️  [MIGRATION] drug_unit_custom already exists - skipping');
    }

    // --- dosage_unit on medication_schedules table ---
    const hasDosageUnit = await knex.schema.hasColumn('medication_schedules', 'dosage_unit');
    if (!hasDosageUnit) {
      await knex.schema.table('medication_schedules', (table) => {
        table.string('dosage_unit').nullable();
      });
      console.log('✅ [MIGRATION] dosage_unit column added to medication_schedules');
    } else {
      console.log('ℹ️  [MIGRATION] dosage_unit already exists - skipping');
    }

    const hasTakeUntilFinished = await knex.schema.hasColumn('medication_schedules', 'take_until_finished');
    if (!hasTakeUntilFinished) {
      await knex.schema.table('medication_schedules', (table) => {
        table.boolean('take_until_finished').defaultTo(false);
      });
      console.log('✅ [MIGRATION] take_until_finished column added to medication_schedules');
    } else {
      console.log('ℹ️  [MIGRATION] take_until_finished already exists - skipping');
    }

    // --- customer_document_id on medication_schedules ---
    const hasScheduleCustomerDocumentId = await knex.schema.hasColumn('medication_schedules', 'customer_document_id');
    if (!hasScheduleCustomerDocumentId) {
      await knex.schema.table('medication_schedules', (table) => {
        table.string('customer_document_id').nullable();
      });
      console.log('✅ [MIGRATION] customer_document_id column added to medication_schedules');
    } else {
      console.log('ℹ️  [MIGRATION] customer_document_id already exists - skipping');
    }

    // --- relation health: backfill customer_document_id from legacy relation paths ---
    const hasScheduleCustomerLinkTable = await knex.schema.hasTable('medication_schedules_customer_lnk');
    const hasScheduleCustomerId = await knex.schema.hasColumn('medication_schedules', 'customer_id');

    const byScheduleId = new Map();
    let fromLinkRows = 0;
    let fromCustomerIdRows = 0;

    if (hasScheduleCustomerLinkTable) {
      const linkRows = await knex('medication_schedules as ms')
        .join('medication_schedules_customer_lnk as l', 'l.medication_schedule_id', 'ms.id')
        .join('customer_profiles as cp', 'cp.id', 'l.customer_profile_id')
        .whereNull('ms.customer_document_id')
        .whereNotNull('cp.document_id')
        .select('ms.id as schedule_id', 'cp.document_id', 'cp.id as customer_id')
        .orderBy('cp.id', 'desc');

      for (const row of linkRows) {
        if (!byScheduleId.has(row.schedule_id)) {
          byScheduleId.set(row.schedule_id, row.document_id);
          fromLinkRows += 1;
        }
      }
    }

    if (hasScheduleCustomerId) {
      const customerIdRows = await knex('medication_schedules as ms')
        .join('customer_profiles as cp', 'cp.id', 'ms.customer_id')
        .whereNull('ms.customer_document_id')
        .whereNotNull('cp.document_id')
        .select('ms.id as schedule_id', 'cp.document_id', 'cp.id as customer_id')
        .orderBy('cp.id', 'desc');

      for (const row of customerIdRows) {
        if (!byScheduleId.has(row.schedule_id)) {
          byScheduleId.set(row.schedule_id, row.document_id);
          fromCustomerIdRows += 1;
        }
      }
    }

    const updates = Array.from(byScheduleId.entries());
    if (updates.length > 0) {
      for (const [scheduleId, customerDocumentId] of updates) {
        await knex('medication_schedules')
          .where({ id: scheduleId })
          .update({ customer_document_id: customerDocumentId, updated_at: new Date() });
      }

      console.log(
        `✅ [MIGRATION] customer_document_id backfill complete` +
        ` (updated=${updates.length}, fromLink=${fromLinkRows}, fromCustomerId=${fromCustomerIdRows})`
      );
    } else {
      console.log('ℹ️  [MIGRATION] customer_document_id backfill skipped (no rows required update)');
    }

    console.log('✅ [MIGRATION] Database migrations completed');
  } catch (error) {
    console.error('❌ [MIGRATION] Migration failed:', error.message);
    // Don't throw - allow Strapi to continue even if migration fails
  }
}
