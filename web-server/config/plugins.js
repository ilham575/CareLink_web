module.exports = ({ env }) => {
  // ตรวจสอบว่ากำลังรันบน Production (Cloud Run) หรือไม่
  const isProduction = env('NODE_ENV') === 'production';

  return {
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
        // เลือก Provider: ถ้า Production ใช้ GCS, ถ้า Local ใช้ local storage
        provider: isProduction 
          ? '@strapi-community/strapi-provider-upload-google-cloud-storage' 
          : 'local',
        
        providerOptions: isProduction
          ? {
              // ☁️ ตั้งค่าสำหรับ Google Cloud Storage (เฉพาะ Production)
              bucketName: env('GCS_BUCKET_NAME'),
              publicFiles: true,
              uniform: true,
              // 👇 บรรทัดนี้แก้ปัญหา path browser/browser/... ให้หายขาด
              baseUrl: `https://storage.googleapis.com/${env('GCS_BUCKET_NAME')}`,
              basePath: '',
            }
          : {
              // 💻 ตั้งค่าสำหรับ Local (ไม่ต้องตั้งอะไรเพิ่ม ใช้ค่า Default)
            },
            
        // ใช้ Breakpoints ร่วมกันทั้ง 2 โหมด
        breakpoints: {
          lg: 1000,
          md: 750,
          sm: 500,
        },
      },
    },
  };
};