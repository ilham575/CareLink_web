module.exports = [
  'strapi::errors',
  {
    name: 'strapi::cors',
    config: {
      origin: ['*'], // หรือใส่โดเมน Frontend ของคุณเพื่อความปลอดภัย
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      headers: [
        'Content-Type', 
        'Authorization', 
        'Origin', 
        'Accept', 
        'Cache-Control', // ✅ เพิ่มตัวนี้ครับ ตัวการของปัญหา
        'Keep-Alive', 
        'User-Agent', 
        'X-Requested-With', 
        'If-Modified-Since'
      ],
      keepHeaderOnError: true,
    },
  },
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          // 👇 อนุญาตให้โหลดรูปจาก Google Storage
          'img-src': [
            "'self'", 
            'data:', 
            'blob:', 
            'https:', 
            'storage.googleapis.com',
            'storage.cloud.google.com'
          ],
          'media-src': [
            "'self'", 
            'data:', 
            'blob:', 
            'https:', 
            'storage.googleapis.com',
            'storage.cloud.google.com'
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb',
      jsonLimit: '256mb',
      textLimit: '256mb',
      formidable: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];