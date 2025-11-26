module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/upload/files/:documentId/serve',
      handler: 'upload.serveFile',
      config: {
        auth: false, // ไม่ต้อง authenticate
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/upload/files/:documentId/download',
      handler: 'upload.serveFile',
      config: {
        auth: false, // ไม่ต้อง authenticate
        policies: [],
      },
    },
  ],
};