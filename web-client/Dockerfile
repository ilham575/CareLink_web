# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build React App with production environment
RUN NODE_ENV=production REACT_APP_API_URL=https://carelink-strapi-ke4rorabaa-as.a.run.app npm run build

# ตรวจสอบว่า Build ผ่านและมีไฟล์ static
RUN test -d /app/build || (echo "Build failed: build directory not found" && exit 1) && \
    test -f /app/build/index.html || (echo "Build failed: index.html not found" && exit 1)


# Stage 2: Runtime
FROM nginx:alpine

# ติดตั้ง wget สำหรับ Healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy nginx config ที่แก้ไขแล้ว
COPY nginx.conf /etc/nginx/nginx.conf

# Copy ไฟล์เว็บที่ Build เสร็จแล้ว
COPY --from=builder /app/build /usr/share/nginx/html

# --- Setup Permissions (สำคัญมากสำหรับ Non-root User) ---
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser && \
    # เปลี่ยนเจ้าของไฟล์ให้เป็น appuser
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    chown -R appuser:appuser /etc/nginx/conf.d && \
    # สร้างไฟล์ PID เปล่าๆ รอไว้ และให้สิทธิ์เขียน
    touch /var/run/nginx.pid && \
    chown appuser:appuser /var/run/nginx.pid && \
    # ให้สิทธิ์โฟลเดอร์เว็บ
    chown -R appuser:appuser /usr/share/nginx/html

# เปลี่ยนมาใช้ User ธรรมดา
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]