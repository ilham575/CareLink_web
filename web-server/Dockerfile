# ใช้ Node.js base image
FROM node:20

# ตั้ง working directory
WORKDIR /app

# คัดลอกไฟล์ package.json และ package-lock.json
COPY package.json package-lock.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอก source code ที่เหลือ (หลังจาก install dependenciesเพื่อใช้ cache)
COPY . .

# เปิดพอร์ตที่ Strapi ใช้
EXPOSE 1337

# คำสั่งเริ่มต้น
CMD ["npm", "run", "develop"]