module.exports = [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:', 'storage.googleapis.com', 'storage.cloud.google.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:', 'storage.googleapis.com', 'storage.cloud.google.com'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'https://carelink-web-485714.web.app',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173'
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'Cache-Control'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  {
    name: 'strapi::compression',
    config: {
      gzip: true,
      br: true,
    },
  },
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb',
      jsonLimit: '256mb',
      textLimit: '256mb',
      formidable: {
        maxFileSize: 250 * 1024 * 1024, // 250MB
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];