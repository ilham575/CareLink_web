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
      breakpoints: {
        lg: 1000,
        md: 750,
        sm: 500,
      },
    },
  },
});

