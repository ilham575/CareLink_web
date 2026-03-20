# ใช้ Node 18 Alpine (รุ่นนี้เสถียรสุดกับ Strapi v4)
FROM node:18-alpine

# 1. ติดตั้ง System Dependencies
# เพิ่ม git และ vips-dev (จำเป็นมากสำหรับ Strapi)
RUN apk update && apk add --no-cache \
    build-base gcc autoconf automake \
    zlib-dev libpng-dev nasm bash \
    vips-dev git

# 2. ตั้งค่า Environment Variables
# Default เป็น production เพื่อความปลอดภัยและประสิทธิภาพ
ENV NODE_ENV=production
WORKDIR /opt/app

# 3. จัดการ Dependencies (เทคนิค Caching)
COPY package.json package-lock.json* ./

# เพิ่ม --platform=linux/amd64 เพื่อความชัวร์ และ install dependencies ทั้งหมด
RUN npm config set fetch-retry-maxtimeout 600000 -g && \
    npm install --platform=linux/amd64 --arch=x64 sharp && \
    npm install

# 4. ย้ายโค้ดเข้า Container
COPY . .

# 5. Build Strapi Admin Panel 🛠️
# รับค่า PUBLIC_URL มาจาก Cloud Build เพื่อฝังลงใน JS ของหน้า Admin
ARG PUBLIC_URL
ENV PUBLIC_URL=${PUBLIC_URL}
ENV STRAPI_ADMIN_BACKEND_URL=${PUBLIC_URL}

RUN npm run build

# 6. ลบ devDependencies ออกเพื่อลดขนาด Image 🧹
# ช่วยประหยัดพื้นที่ Cloud Run ได้เยอะ
RUN npm prune --production

# 7. สร้างโฟลเดอร์ Uploads (เผื่อไว้กรณี fallback แต่หลักๆ จะไปใช้ GCS)
RUN mkdir -p public/uploads && \
    chmod -R 777 public/uploads

# 8. เปิด Port
EXPOSE 1337

# 9. Health Check (แก้เป็น /_health เพื่อลดภาระ Server)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:1337/_health || exit 1

# 10. Start Server
CMD ["npm", "run", "start"]