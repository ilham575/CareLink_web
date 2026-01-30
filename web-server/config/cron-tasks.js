"use strict";

const reminderConfig = require("./reminder-config");
const telegramController = require("../src/api/telegram/controllers/telegram");
const { sendTelegramMessage } = require("../src/utils/telegram");

module.exports = {
  // Existing Telegram Reminder
  [`${reminderConfig.REMIND_MINUTE} ${reminderConfig.REMIND_HOUR} * * *`]: async ({ strapi }) => {
    strapi.log.info("⏰ Cron triggered (Asia/Bangkok)");
    await telegramController.sendReminder();
  },

  // New Medication Reminder (Every 1 minute)
  "*/1 * * * *" : async ({ strapi }) => {
    try {
      // Get current time in Asia/Bangkok
      const now = new Date();
      const options = { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false };
      const currentTime = new Intl.DateTimeFormat("en-GB", options).format(now); // "HH:mm"
      
      const dayOptions = { timeZone: "Asia/Bangkok", weekday: "short" };
      const currentDay = new Intl.DateTimeFormat("en-GB", dayOptions).format(now); // "Sun", "Mon", etc.

      strapi.log.debug(`Checking medication schedule for ${currentTime} ${currentDay} (Thailand Time)`);

      const schedules = await strapi.entityService.findMany("api::medication-schedule.medication-schedule", {
        filters: {
          schedule_time: { $startsWith: currentTime },
          is_active: true,
        },
        populate: ["customer", "customer.users_permissions_user"],
      });

      if (!schedules || schedules.length === 0) return;

      for (const schedule of schedules) {
        // Check days
        let scheduledDays = schedule.days_of_week;
        if (typeof scheduledDays === 'string') {
           try { scheduledDays = JSON.parse(scheduledDays); } catch(e) {}
        }
        
        if (Array.isArray(scheduledDays) && !scheduledDays.includes(currentDay)) {
          continue;
        }

        const customerProfile = schedule.customer;
        const user = customerProfile?.users_permissions_user;
        const telegramChatId = customerProfile?.telegramChatId;
        
        const message = `🔔 แจ้งเตือนกินยา: ${schedule.drug_name}\nเวลา: ${schedule.schedule_time.slice(0, 5)} น.`;

        if (user && user.id) {
          strapi.log.info(`Sending medication reminder to User ID ${user.id}: ${message}`);

          // 1. Create Notification Record
          await strapi.entityService.create("api::notification.notification", {
            data: {
              title: "แจ้งเตือนกินยา",
              type: "system_alert",
              message: message.replace("🔔 ", ""),
              customer_profile: customerProfile.id,
              publishedAt: new Date(),
            },
          });

          // 2. Send Socket Event
          if (strapi.io) {
            strapi.io.to(`user_${user.id}`).emit("notification", {
              title: "แจ้งเตือนกินยา",
              message: message.replace("🔔 ", ""),
              type: "medication",
            });
          }
        }

        // 3. Send Telegram Message if exists
        if (telegramChatId) {
          try {
            strapi.log.info(`Sending Telegram medication reminder to Chat ID ${telegramChatId}`);
            await sendTelegramMessage(telegramChatId, message);
          } catch (err) {
            strapi.log.error(`Failed to send Telegram reminder to ${telegramChatId}:`, err);
          }
        }
      }
    } catch (err) {
      strapi.log.error('Cron Medication Error:', err);
    }
  },
};
