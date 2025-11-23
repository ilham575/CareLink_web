module.exports = () => ({
  'config-sync': {
    enabled: true,
    config: {
      syncDir: 'config/sync/',
      minify: false,
      importOnBootstrap: false,
      exclude: [],
    },
  },
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        localServer: {
          maxage: 60000,
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
      },
      breakpoints: {
        lg: 1000,
        md: 750,
        sm: 500,
      },
      // ตั้ง Public URL สำหรับ GCP
      publicUrl: process.env.CDN_URL || 'https://carelink-strapi-ke4rorabaa-as.a.run.app',
    },
  },
});

