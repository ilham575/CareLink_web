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
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb', // สำหรับ form data
      jsonLimit: '256mb', // สำหรับ JSON data  
      textLimit: '256mb', // สำหรับ text data
      formidable: {
        maxFileSize: 50 * 1024 * 1024, // 50MB สำหรับการอัพโหลดไฟล์
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
