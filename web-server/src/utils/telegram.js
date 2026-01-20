"use strict";

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) {
    console.error("[TELEGRAM] ERROR: TELEGRAM_TOKEN is not set in environment variables!");
    throw new Error("TELEGRAM_TOKEN is not set");
  }
  console.log("[TELEGRAM] Using TELEGRAM_TOKEN:", token);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    console.log(`[TELEGRAM] Sent to chatId ${chatId}. Response:`, data);
    if (!data.ok) throw new Error(`Telegram error: ${JSON.stringify(data)}`);
    return data;
  } catch (err) {
    console.error(`[TELEGRAM] Telegram fetch error for chatId ${chatId}:`, err);
    throw new Error("Telegram fetch failed: " + err.message);
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

module.exports = { sendTelegramMessage, setupTelegramWebhook };
