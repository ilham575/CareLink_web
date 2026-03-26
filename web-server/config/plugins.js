module.exports = ({ env }) => {
  // ตรวจสอบว่ากำลังรันบน Production (Cloud Run) หรือไม่
  const isProduction = env('NODE_ENV') === 'production';

  return {
    // ==================
    // Email (Forgot Password)
    // ==================
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: env('SMTP_HOST', 'smtp.gmail.com'),
          port: env.int('SMTP_PORT', 587),
          secure: false, // true for port 465
          auth: {
            user: env('SMTP_USER', ''),
            pass: env('SMTP_PASS', ''),
          },
        },
        settings: {
          defaultFrom: env('EMAIL_FROM', 'noreply@carelink-pharmacy.com'),
          defaultReplyTo: env('EMAIL_FROM', 'noreply@carelink-pharmacy.com'),
        },
      },
    },

    // Config เดิมของคุณ (เก็บไว้เหมือนเดิม)
    'config-sync': {
      enabled: true,
      config: {
        syncDir: 'config/sync/',
        minify: false,
        importOnBootstrap: false,
        exclude: [],
      },
    },
    
    // ✅ ส่วนจัดการ Upload (แก้ไขสมบูรณ์แล้ว)
    upload: {
      config: {
        // 1. Provider Config
        provider: isProduction 
          ? '@strapi-community/strapi-provider-upload-google-cloud-storage' 
          : 'local',
        
        providerOptions: isProduction
          ? {
              bucketName: env('GCS_BUCKET_NAME'),
              publicFiles: true,
              uniform: true,
              baseUrl: `https://storage.googleapis.com/${env('GCS_BUCKET_NAME')}`,
              basePath: '',
            }
          : {},

        // 2. Action Options (ถ้ามี)
        actionOptions: {
          upload: {},
          delete: {},
        },

        // ✅ 3. Breakpoints อยู่ตรงนี้ครับ (ระดับเดียวกับ provider)
        breakpoints: {
          xl: 1000, // (เผื่ออยากเพิ่ม)
          lg: 750,
          md: 500,
          sm: 300,  // (ปรับค่าตามต้องการ)
        },
      },
    },
  };
};