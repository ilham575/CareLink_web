const path = require('path');

module.exports = ({ env }) => {
  // ตั้งค่าเริ่มต้นของ client เป็น 'postgres' เพื่อให้แน่ใจว่าใช้ PostgreSQL
  // ถ้า env('DATABASE_CLIENT') ไม่ถูกกำหนดใน .env
  const client = env('DATABASE_CLIENT', 'postgres');

  const connections = {
    // MySQL configuration (ไม่เปลี่ยนแปลง)
    mysql: {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
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

    // PostgreSQL configuration (ส่วนที่เราจะแก้ไข)
    postgres: {
      connection: {
        // ไม่ต้องใช้ connectionString ถ้าคุณระบุ host, port, database, user, password แยกกัน
        // connectionString: env('DATABASE_URL'), // <-- คอมเมนต์หรือลบบรรทัดนี้ถ้าไม่ใช้ DATABASE_URL

        // ใช้ค่าจาก Environment Variables ใน .env
        host: env('DATABASE_HOST'), // จะถูกดึงมาจาก DATABASE_HOST ใน .env (ซึ่งควรเป็น IP ของ Cloud SQL)
        port: env.int('DATABASE_PORT', 5432), // จะถูกดึงมาจาก DATABASE_PORT ใน .env
        database: env('DATABASE_NAME'), // จะถูกดึงมาจาก DATABASE_NAME ใน .env
        user: env('DATABASE_USERNAME'), // จะถูกดึงมาจาก DATABASE_USERNAME ใน .env
        password: env('DATABASE_PASSWORD'), // จะถูกดึงมาจาก DATABASE_PASSWORD ใน .env

        // การตั้งค่า SSL
        // env.bool('DATABASE_SSL', true) จะทำให้ SSL เปิดใช้งานโดย default ถ้าไม่มี DATABASE_SSL ใน .env
        ssl: env.bool('DATABASE_SSL', true) && {
          // ไม่ต้องระบุ key, cert, ca, capath, cipher หากไม่ได้ใช้ Client Certificates หรือ CA Specific
          // key: env('DATABASE_SSL_KEY', undefined),
          // cert: env('DATABASE_SSL_CERT', undefined),
          // ca: env('DATABASE_SSL_CA', undefined),
          // capath: env('DATABASE_SSL_CAPATH', undefined),
          // cipher: env('DATABASE_SSL_CIPHER', undefined),

          // **สำคัญ**: ตั้งค่า rejectUnauthorized เป็น false สำหรับการทดสอบบนเครื่อง Local
          // เพื่อข้ามการตรวจสอบ Certificate ที่อาจมีปัญหา
          // ควรเปลี่ยนกลับเป็น true เมื่อ Deploy ไปยัง Production บน GCP และใช้ Cloud SQL Proxy
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
        },
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
      // เพิ่ม acquireConnectionTimeout ให้ยาวขึ้นอีกนิด เพื่อรองรับความหน่วงในการเชื่อมต่อครั้งแรก
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000), // Default 60 วินาที
    },
  };
};