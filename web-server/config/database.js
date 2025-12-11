const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'postgres');
  
  // ดึงค่า Host ออกมาก่อนเพื่อตรวจสอบ
  const dbHost = env('DATABASE_HOST', '127.0.0.1');
  
  // เช็คว่ากำลังเชื่อมต่อผ่าน Cloud SQL Socket หรือไม่? (ถ้า Host มีคำว่า /cloudsql)
  const isCloudSqlSocket = dbHost.includes('/cloudsql');

  const connections = {
    // MySQL configuration (ไม่เปลี่ยนแปลง)
    mysql: {
      connection: {
        host: dbHost,
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false) && {
          key: env('DATABASE_SSL_KEY', undefined),
          cert: env('DATABASE_SSL_CERT', undefined),
          ca: env('DATABASE_SSL_CA', undefined),
          capath: env('DATABASE_SSL_CAPATH', undefined),
          cipher: env('DATABASE_SSL_CIPHER', undefined),
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },

    // PostgreSQL configuration (แก้ไขแล้ว)
    postgres: {
      connection: {
        host: dbHost,
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME'),
        user: env('DATABASE_USERNAME'),
        password: env('DATABASE_PASSWORD'),

        // ********** แก้ไขจุดนี้ **********
        // ถ้าเป็น Cloud SQL Socket (บน Cloud Run) ให้บังคับ ssl: false
        // ถ้าไม่ใช่ (Local/TCP) ให้ใช้ค่าจาก env หรือ default เป็น true
        ssl: isCloudSqlSocket 
          ? false 
          : env.bool('DATABASE_SSL', true) && {
              rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
            },
        // *******************************

        schema: env('DATABASE_SCHEMA', 'public'),
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10)
      },
    },

    // SQLite configuration (ไม่เปลี่ยนแปลง)
    sqlite: {
      connection: {
        filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};