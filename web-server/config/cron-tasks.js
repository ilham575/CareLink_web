"use strict";

const reminderConfig = require("./reminder-config");
const telegramController = require("../src/api/telegram/controllers/telegram");

module.exports = {
  [`${reminderConfig.REMIND_MINUTE} ${reminderConfig.REMIND_HOUR} * * *`]: async ({ strapi }) => {
    strapi.log.info("⏰ Cron triggered (Asia/Bangkok)");
    await telegramController.sendReminder();
  },
};
