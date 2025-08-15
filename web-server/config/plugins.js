module.exports = () => ({
  'config-sync': {
    enabled: true,
    config: {
      syncDir: 'config/sync/', // หรือเปลี่ยนชื่อ path ได้
      minify: false,
      importOnBootstrap: false,
      exclude: [], // เช่น ['core-store.plugin_users-permissions_grant']
    },
  },
});

