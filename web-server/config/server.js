module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  proxy: {
    enabled: true,
    headers: {
      'X-Forwarded-Proto': true,
      'X-Forwarded-Host': true,
      'X-Forwarded-Port': true,
    },
  },
  url: env('URL', env('PUBLIC_URL', 'http://localhost:1337')),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
