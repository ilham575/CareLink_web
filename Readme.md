# My_Project
Web Application CareLink

## Created by
* supachai thongsong 6510110469
* ilham hajidoloh 6510110575

**Project Overview**
- **Purpose**: CareLink เป็นเว็บแอปสำหรับจัดการข้อมูลลูกค้า ร้านยา และบุคลากรทางการแพทย์ โดยแยกเป็นส่วน frontend (client) และ backend (server) เพื่อให้ง่ายต่อการพัฒนาและปรับใช้

**Repository Layout**
- **web-client**: [web-client](web-client) — React-based single-page application (production build อยู่ใน `web-client/build`).
- **web-server**: [web-server](web-server) — Strapi/Node.js backend พร้อม API, migrations และการตั้งค่าที่เกี่ยวข้อง.

**web-client (frontend)**
- **Description**: ส่วน UI/UX ของแอป เขียนด้วย React, ใช้ `react-scripts` (Create React App) และ Tailwind/CSS สำหรับสไตลิ่ง
- **Key files**: [web-client/package.json](web-client/package.json) , `src/` (source), `public/` และ `build/` (static production output)
- **Common commands**:
	- Install: `cd web-client && npm install`
	- Dev server: `npm start` (runs `react-scripts start`)
	- Run tests: `npm test`
	- Build for production: `npm run build` (ผลลัพธ์จะอยู่ที่ `web-client/build`)
- **Env / Deployment**: มีไฟล์ `.env.example` และ `.env.production` ในโฟลเดอร์ `web-client` ใช้เมื่อต้องการตั้งค่าตัวแปรสภาพแวดล้อมสำหรับการ build/production. มี `Dockerfile` และ `nginx.conf` สำหรับการ deploy เป็น container/เว็บเซิร์ฟเวอร์

**web-server (backend)**
- **Description**: บริการ backend พัฒนาด้วย Strapi (headless CMS) พร้อม controller, service, routes แบบกำหนดเอง และใช้ Knex สำหรับการจัดการ migrations
- **Key files**: [web-server/package.json](web-server/package.json) , `src/` (API implementations), `database/migrations/` (Knex migrations), `config/` และไฟล์ `.env`
- **Tech/Requirements**:
	- Node.js ตาม `engines` ใน `package.json` ของ `web-server` (แนะนำ Node >=18 และ <=22)
	- ฐานข้อมูล: โปรเจครองรับหลาย DB (มี `pg`, `better-sqlite3` ใน dependencies); production มักใช้ PostgreSQL
- **Common commands**:
	- Install: `cd web-server && npm install`
	- Start development: `npm run develop` หรือ `npm run dev` (รัน Strapi ในโหมดพัฒนา)
	- Build & start production: `npm run build` แล้ว `npm start` (`strapi build` + `strapi start`)
	- Database migrations: `npm run db:migrate` (เรียก `knex migrate:latest --env production` ตามที่ตั้งไว้)
- **Env / Deployment**: แก้ไข `.env` หรือใช้ `.env.example` เป็น template มี `Dockerfile`, `docker-compose.yml` และสคริปต์ deployment ภายในโฟลเดอร์เพื่อช่วยการ deploy ขึ้น container/คลาวด์

**Quick Troubleshooting / Notes**
- **Node version**: ตรวจสอบเวอร์ชัน Node ให้เป็นไปตามที่กำหนดใน `web-server/package.json` (`engines`) เพื่อหลีกเลี่ยงปัญหา compatibility
- **Migrations**: ก่อนรัน production ให้สำรองฐานข้อมูลและตรวจสอบ migration files ใน `web-server/database/migrations`
- **Environment**: ตั้งค่า environment variables ให้ครบ (DB URL, credentials, JWT secret ฯลฯ) โดยใช้ไฟล์ตัวอย่าง `.env.example`

