"use strict";

function getTelegramToken() {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) {
    console.error("[TELEGRAM] ERROR: TELEGRAM_TOKEN is not set in environment variables!");
    throw new Error("TELEGRAM_TOKEN is not set");
  }
  return token;
}

async function callTelegram(method, payload) {
  const token = getTelegramToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram error (${method}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const token = getTelegramToken();
  console.log("[TELEGRAM] Using TELEGRAM_TOKEN:", token);
  try {
    const data = await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      ...options,
    });

    console.log(`[TELEGRAM] Sent to chatId ${chatId}. Response:`, data);
    return data;
  } catch (err) {
    console.error(`[TELEGRAM] Telegram fetch error for chatId ${chatId}:`, err);
    throw new Error("Telegram fetch failed: " + err.message);
  }
}

async function answerTelegramCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  if (!callbackQueryId) return null;

  try {
    return await callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: !!showAlert,
    });
  } catch (err) {
    console.error(`[TELEGRAM] Failed answerCallbackQuery ${callbackQueryId}:`, err.message);
    return null;
  }
}

async function setupTelegramWebhook(baseUrl) {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) return;

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;

  console.log(`[TELEGRAM] Setting webhook to: ${webhookUrl}`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) {
      console.log("✅ [TELEGRAM] Webhook set successfully");
    } else {
      console.error("❌ [TELEGRAM] Failed to set webhook:", data.description);
    }
  } catch (err) {
    console.error("❌ [TELEGRAM] Webhook setup error:", err.message);
  }
}

module.exports = {
  sendTelegramMessage,
  answerTelegramCallbackQuery,
  setupTelegramWebhook,
};
