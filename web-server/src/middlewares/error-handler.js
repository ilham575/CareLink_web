/**
 * Custom error handling middleware
 * Provides better error responses for all API endpoints
 */
module.exports = (options, { strapi }) => {
  return async (ctx, next) => {
    try {
      await next();

      // INTERCEPT AUTH ERRORS AFTER RESPONSE IS SET
      if (ctx.path === '/api/auth/local' && ctx.body?.error?.message) {
        const originalMessage = ctx.body.error.message;
        let translatedMessage = originalMessage;

        // Translate auth error messages to Thai
        if (originalMessage.includes('Invalid identifier or password')) {
          translatedMessage = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        } else if (originalMessage.includes('Invalid credentials')) {
          translatedMessage = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        } else if (originalMessage.includes('User not found')) {
          translatedMessage = 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
        } else if (originalMessage.includes('Your account email is not confirmed')) {
          translatedMessage = 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ';
        } else if (originalMessage.includes('Your account has been blocked')) {
          translatedMessage = 'บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ';
        }

        if (translatedMessage !== originalMessage) {
          ctx.body.error.message = translatedMessage;
        }
      }

    } catch (error) {

      const statusCode = error.status || 500;
      let message = error.message || 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์';

      // TRANSLATE AUTH ERRORS TO THAI (IN CATCH BLOCK)
      if (ctx.path === '/api/auth/local') {
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

      }

      // Enhance error messages for common scenarios (non-auth routes)
      else if (statusCode === 401) {
        message = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      } else if (statusCode === 404) {
        message = 'ไม่พบทรัพยากรที่ร้องขอ';
      } else if (statusCode === 403) {
        message = 'ไม่มีสิทธิ์ในการเข้าถึง';
      } else if (statusCode === 400) {
        message = error.message || 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
      } else if (statusCode === 500) {
        message = error.message || 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์';
      }

      ctx.status = statusCode;
      ctx.body = {
        data: null,
        error: {
          status: statusCode,
          message: message,
          ...(process.env.NODE_ENV === 'development' && {
            detail: error.message,
            stack: error.stack,
          }),
        },
      };
    }
  };
};
