module.exports = [
  'strapi::errors',
  {
    name: 'strapi::cors',
    config: {
      origin: ['*'],
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      headers: [
        'Content-Type',
        'Authorization',
        'Cache-Control',          // ✅ เพิ่มบรรทัดนี้
      ],
    },
  },
  'strapi::security',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
