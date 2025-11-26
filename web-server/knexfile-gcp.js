const path = require('path');

// For GCP Cloud Run, connect via Cloud SQL Proxy Unix socket or TCP
module.exports = {
  production: {
    client: 'pg',
    connection: {
      // Try both methods: Unix socket for Cloud SQL Proxy OR TCP connection
      // In Cloud Run with Cloud SQL connector, use Unix socket path
      socketPath: '/cloudsql/carelink-web:asia-southeast1:carelink-db',
      database: process.env.DATABASE_NAME || 'carelink_db',
      user: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD,
      schema: process.env.DATABASE_SCHEMA || 'public',
    },
    pool: {
      min: 1,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    },
    migrations: {
      directory: path.join(__dirname, 'database', 'migrations'),
      extension: 'js',
    },
    acquireConnectionTimeout: 60000,
    // Enable debug logging for connection issues
    log: {
      warn(message) { console.warn('[knex warn]', message); },
      error(message) { console.error('[knex error]', message); },
      deprecate(message) { console.log('[knex deprecate]', message); },
      debug(message) { console.log('[knex debug]', message); },
    },
  },
};

