"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/telegram/webhook",
      handler: "telegram.webhook",
      config: {
        auth: false, // Telegram ไม่มี token
      },
    },
  ],
};
