'use strict';

/**
 * Enhanced auth error handling for login
 * Provides better error messages for different failure scenarios
 */

module.exports = (plugin) => {
  // Override the local login controller to intercept and translate errors
  const originalLocal = plugin.controllers.auth.local;

  plugin.controllers.auth.local = async (ctx) => {
    // Execute the original local login first
    await originalLocal(ctx);

    // If response has error, translate it to Thai
    if (ctx.body?.error) {
      const originalError = ctx.body.error;
      let message = originalError.message || 'เกิดข้อผิดพลาดในการลงชื่อเข้าใช้';

      // Translate common error messages to Thai
      if (message.includes('Invalid identifier or password')) {
        message = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      } else if (message.includes('Invalid credentials')) {
        message = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      } else if (message.includes('User not found')) {
        message = 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
      } else if (message.includes('Your account email is not confirmed')) {
        message = 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ';
      } else if (message.includes('Your account has been blocked')) {
        message = 'บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ';
      }

      // Update the error message in the response
      ctx.body.error.message = message;
    }
  };

  return plugin;
};
