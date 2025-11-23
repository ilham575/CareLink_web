# ใช้ Node 18 Alpine (รุ่นนี้ปัญหาน้อยสุดกับ Strapi)
FROM node:18-alpine

# 1. ติดตั้งเครื่องมือระบบ (สำคัญมาก! ต้องมี vips-dev และ git)
RUN apk update && apk add --no-cache \
    build-base gcc autoconf automake \
    zlib-dev libpng-dev nasm bash \
    vips-dev git

# 2. ตั้งค่า Environment
ENV NODE_ENV=production
WORKDIR /opt/app

# 3. ติดตั้ง Dependencies (ใช้วิธี install ธรรมดาเพื่อความชัวร์)
COPY package*.json ./
RUN npm config set fetch-retry-maxtimeout 600000 -g && npm install

# 4. ย้ายโค้ดเข้า Container
COPY . .

# 5. สร้าง uploads directory
RUN mkdir -p public/uploads && \
    chmod -R 777 public/uploads

# 6. Build หน้า Admin Panel
RUN npm run build

# 7. เปิด Port
EXPOSE 1337

# 8. Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:1337/admin || exit 1

# 9. สั่งรัน
CMD ["npm", "run", "start"]