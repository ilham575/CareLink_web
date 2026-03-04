"use strict";

const reminderConfig = require("./reminder-config");
const telegramController = require("../src/api/telegram/controllers/telegram");

module.exports = {
  /**
   * Daily Telegram Reminder (ใช้เวลาจาก reminder-config.js)
   * Medication Reminder ทุก 1 นาที -> ดูใน src/index.js bootstrap (strapi.cron.add)
   */
  telegramDailyReminder: {
    task: async ({ strapi }) => {
      strapi.log.info("Cron triggered (Asia/Bangkok)");
      await telegramController.sendReminder();
    },
    options: {
      rule: `${reminderConfig.REMIND_MINUTE} ${reminderConfig.REMIND_HOUR} * * *`,
    },
  },
};
