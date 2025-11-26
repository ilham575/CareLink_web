const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, '.tmp', 'data.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'database', 'migrations'),
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT || 5432,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true' ? {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
      } : false,
      schema: process.env.DATABASE_SCHEMA || 'public',
    },
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DATABASE_POOL_MAX, 10) || 10,
    },
    migrations: {
      directory: path.join(__dirname, 'database', 'migrations'),
    },
    acquireConnectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT, 10) || 60000,
  },
};
