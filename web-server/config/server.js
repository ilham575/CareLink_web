module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // เพิ่ม middleware สำหรับ serve uploads
  middleware: {
    settings: {
      public: {
        enabled: true,
        path: './public',
        index: true,
        maxAge: 60000,
      },
    },
  },
});
