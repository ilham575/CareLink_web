module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  // สำคัญ: ตั้งค่า URL สำหรับ admin panel
  url: env('STRAPI_ADMIN_BACKEND_URL', env('URL', 'http://localhost:1337')) + '/admin',
  serveAdminPanel: true,
});
