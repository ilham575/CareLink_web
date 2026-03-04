module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  cron: { enabled: true },

  // การตั้งค่า Proxy (จำเป็นมากสำหรับ Cloud Run)
  proxy: {
    enabled: true,
    headers: {
      'X-Forwarded-Proto': true,
      'X-Forwarded-Host': true,
      'X-Forwarded-Port': true,
    },
  },
  // ✅ ใช้ PUBLIC_URL ที่ส่งมาจาก Cloud Build เป็นหลัก
  // ถ้าไม่มี (เช่นตอนรัน Local) จะไปใช้ localhost แทน
  url: env('PUBLIC_URL', env('URL', 'http://localhost:1337')),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});