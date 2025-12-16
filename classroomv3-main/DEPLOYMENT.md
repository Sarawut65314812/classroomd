# 🚀 คู่มือการ Deploy ขึ้น Server

## ✅ สิ่งที่ต้องเตรียม

### 1. Environment Variables
สร้างไฟล์ `.env` ใน backend:
```env
PORT=5000
NODE_ENV=production
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
CORS_ORIGIN=https://your-domain.com
```

สร้างไฟล์ `.env` ใน root (frontend):
```env
VITE_API_URL=https://your-api-domain.com/api
```

### 2. Build Files
```bash
# Build Frontend
npm run build

# Build Backend
cd backend
npm run build  # ถ้ามี build script
```

---

## 🌐 วิธี Deploy แบบต่างๆ

### Option 1: Vercel (แนะนำสำหรับ Frontend)

**ขั้นตอน:**
1. Push code ขึ้น GitHub
2. ไปที่ [vercel.com](https://vercel.com)
3. Import repository
4. ตั้งค่า:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. เพิ่ม Environment Variables:
   - `VITE_API_URL` = URL ของ backend
6. Deploy!

**Backend บน Vercel:**
- สร้าง `vercel.json` ใน backend:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ]
}
```

---

### Option 2: Render (แนะนำสำหรับ Full Stack)

**Frontend:**
1. ไปที่ [render.com](https://render.com)
2. New > Static Site
3. Connect repository
4. ตั้งค่า:
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
5. เพิ่ม Environment Variables
6. Deploy

**Backend:**
1. New > Web Service
2. Connect repository
3. ตั้งค่า:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Root Directory: `backend` (หรือเว้นว่างแล้วใช้ cd)
4. เพิ่ม Environment Variables
5. Deploy

---

### Option 3: Railway (ง่ายที่สุด)

1. ไปที่ [railway.app](https://railway.app)
2. New Project > Deploy from GitHub
3. Select repository
4. Railway จะ auto-detect และ deploy ทั้ง frontend + backend
5. เพิ่ม Environment Variables
6. เสร็จ!

---

### Option 4: VPS (Ubuntu Server)

**ติดตั้ง Prerequisites:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

**Deploy Backend:**
```bash
# Clone repository
git clone https://github.com/Sarawut65314812/classroomv3.git
cd classroomv3/backend

# Install dependencies
npm install

# สร้าง .env file
nano .env
# (ใส่ค่าตามด้านบน)

# Start with PM2
pm2 start src/server.ts --name classroom-api
pm2 save
pm2 startup
```

**Deploy Frontend:**
```bash
cd ..
npm install
npm run build

# Copy dist to nginx
sudo cp -r dist /var/www/classroom
```

**Nginx Configuration:**
```bash
sudo nano /etc/nginx/sites-available/classroom
```

เพิ่ม:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/classroom;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads {
        proxy_pass http://localhost:5000/uploads;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/classroom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**SSL (Let's Encrypt):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### Option 5: Docker (Production Ready)

**สร้าง `Dockerfile` ใน backend:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
```

**สร้าง `Dockerfile` ใน root (frontend):**
```dockerfile
FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**สร้าง `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
    volumes:
      - ./backend/uploads:/app/uploads
    restart: unless-stopped

  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  # Optional: Database
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

**Deploy:**
```bash
docker-compose up -d
```

---

## 📝 Checklist ก่อน Deploy

- [ ] ตั้ง Environment Variables ครบ
- [ ] Build frontend สำเร็จ (`npm run build`)
- [ ] Test backend locally (`npm start`)
- [ ] ปรับ CORS origin ให้ถูกต้อง
- [ ] ตั้งค่า file upload path
- [ ] เพิ่ม `.gitignore`:
  ```
  node_modules/
  dist/
  .env
  uploads/
  *.log
  ```
- [ ] Push code ขึ้น GitHub
- [ ] เตรียม domain name (ถ้ามี)
- [ ] Backup database (ถ้ามี)

---

## 🔧 Configuration Files ที่ต้องปรับ

### 1. `vite.config.ts` (ปรับ API proxy):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
```

### 2. `src/services/api.ts` (ใช้ environment variable):
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
```

### 3. `backend/src/server.ts` (ปรับ CORS):
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}))
```

---

## 🚨 Production Checklist

### Security:
- [ ] เปลี่ยน default ports
- [ ] ตั้ง rate limiting
- [ ] เพิ่ม helmet.js
- [ ] Sanitize user input
- [ ] Enable HTTPS
- [ ] ตั้ง secure cookies

### Performance:
- [ ] Enable gzip compression
- [ ] Minify static assets
- [ ] Enable caching
- [ ] Optimize images
- [ ] Use CDN (ถ้าเป็นไปได้)

### Monitoring:
- [ ] ตั้ง logging (Winston/Pino)
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring (UptimeRobot)
- [ ] Analytics (Google Analytics)

---

## 📊 แนะนำการเลือก Platform

| Platform | ราคา | ความเหมาะสม | ความยาก |
|----------|------|-------------|---------|
| **Vercel** | Free tier ดี | Frontend, Serverless | ⭐ ง่าย |
| **Render** | Free tier พอใช้ | Full Stack | ⭐⭐ ปานกลาง |
| **Railway** | $5/month | Full Stack + DB | ⭐ ง่ายมาก |
| **VPS** | $5-20/month | ควบคุมเต็มที่ | ⭐⭐⭐ ยาก |
| **Docker** | ขึ้นกับ host | Production | ⭐⭐⭐⭐ ยากมาก |

---

## 🎯 แนะนำสำหรับโปรเจกต์นี้

**สำหรับเริ่มต้น (Free):**
```
Frontend → Vercel
Backend → Render Free Tier
Database → MongoDB Atlas Free
```

**สำหรับโปรเจกต์จริง:**
```
ทั้งหมด → Railway ($5/month)
หรือ VPS (DigitalOcean $6/month)
```

---

## 🆘 Troubleshooting

### ปัญหา: API calls ไม่ทำงาน
**แก้:** ตรวจสอบ CORS, VITE_API_URL, network tab

### ปัญหา: Upload ไม่ทำงาน
**แก้:** ตรวจสอบ file permissions, UPLOAD_DIR, multer config

### ปัญหา: Build failed
**แก้:** ลบ node_modules แล้ว `npm install` ใหม่

### ปัญหา: 502 Bad Gateway
**แก้:** Backend ไม่ทำงาน, ตรวจสอบ logs

---

## 📞 Commands สำหรับ Deploy

```bash
# ตรวจสอบ build locally
npm run build
npm run preview

# Git commands
git add .
git commit -m "Ready for deployment"
git push origin main

# PM2 commands
pm2 list
pm2 logs classroom-api
pm2 restart classroom-api
pm2 stop classroom-api

# Nginx commands
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx

# Docker commands
docker-compose ps
docker-compose logs -f
docker-compose restart
```

---

**พร้อม Deploy แล้ว! 🚀**

เลือก platform ที่เหมาะสมแล้วตาม checklist ด้านบนได้เลยครับ
