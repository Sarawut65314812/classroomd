# คู่มือการ Deploy โปรเจคไปยัง Railway

## ขั้นตอนการ Deploy

### 1. เตรียมโปรเจค
โปรเจคนี้ถูกเตรียมพร้อมแล้วสำหรับการ deploy ไปยัง Railway

### 2. สร้าง Account บน Railway
- ไปที่ https://railway.app/
- สร้างบัญชีด้วย GitHub account

### 3. สร้าง Project ใหม่
1. คลิก "New Project"
2. เลือก "Deploy from GitHub repo"
3. เชื่อมต่อ GitHub repository ของโปรเจคนี้
4. Railway จะตรวจจับ `package.json` และติดตั้ง dependencies อัตโนมัติ

### 4. ตั้งค่า Environment Variables
ไปที่ `Variables` tab และเพิ่มตัวแปรต่อไปนี้:

```
MONGODB_URI=mongodb+srv://nippit62:ohm0966477158@testing.hgxbz.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=Huroa2
NODE_ENV=production
```

**หมายเหตุ:** PORT จะถูกกำหนดอัตโนมัติโดย Railway ไม่ต้องตั้งค่า

### 5. Build และ Deploy
Railway จะรันคำสั่งต่อไปนี้อัตโนมัติ:

1. **Install:** `npm install`
2. **Build:** `npm run build` (จะ build โปรเจค React ใน classroomv3-main)
3. **Start:** `npm start` (รัน Express server)

### 6. ตรวจสอบการ Deploy
- ดูสถานะการ deploy ใน "Deployments" tab
- เมื่อ deploy สำเร็จจะได้ URL เช่น `https://your-project.railway.app`
- ตรวจสอบ logs เพื่อดูว่าทุกอย่างทำงานถูกต้อง

## โครงสร้างโปรเจค

```
Huaroa/
├── server.js              # Main Express server
├── package.json           # Root dependencies
├── classroomv3-main/      # React Vite app
│   ├── dist/             # Built files (สร้างเมื่อรัน npm run build)
│   └── package.json      # React app dependencies
├── css/                   # CSS files
├── js/                    # JavaScript files
├── picture/              # Images
├── Sound/                # Audio files
├── uploads/              # User uploads
└── data/                 # Usage tracking data
```

## คำสั่งที่สำคัญ

- `npm start` - รัน production server
- `npm run build` - build React app
- `npm run dev` - รัน development server (ทั้ง Express + Vite)

## การทำงานของแอพ

### Production Mode (บน Railway):
- Express server serve static files และ API endpoints
- React app ที่ถูก build แล้วจะถูก serve ที่ `/studio`
- ไฟล์ HTML อื่นๆ (เกมต่างๆ) ถูก serve โดยตรง

### Development Mode (ในเครื่อง):
- Express server ทำงานที่ port 3000
- Vite dev server ทำงานที่ port 5173
- Express proxy requests ไปยัง Vite

## การตรวจสอบปัญหา

### ถ้า Build ล้มเหลว:
1. ตรวจสอบ logs ใน Railway dashboard
2. ตรวจสอบว่า dependencies ติดตั้งครบถ้วน
3. ตรวจสอบว่า NODE_ENV ตั้งค่าเป็น production

### ถ้า Server ไม่ทำงาน:
1. ตรวจสอบว่า MONGODB_URI ถูกต้อง
2. ตรวจสอบ logs สำหรับ error messages
3. ตรวจสอบว่า uploads/ folder มีสิทธิ์เขียนได้

### ถ้า React App ไม่แสดง:
1. ตรวจสอบว่า `npm run build` ทำงานสำเร็จ
2. ตรวจสอบว่ามีไฟล์ใน `classroomv3-main/dist/`
3. ตรวจสอบ console browser สำหรับ errors

## ข้อควรระวัง

1. **MongoDB Connection:** ตรวจสอบว่า MongoDB Atlas อนุญาต IP address ของ Railway
   - ใน MongoDB Atlas Network Access ให้เพิ่ม `0.0.0.0/0` เพื่ออนุญาตทุก IP
   
2. **File Uploads:** Railway มี ephemeral filesystem หากต้องการเก็บไฟล์ถาวรควรใช้ cloud storage เช่น AWS S3 หรือ Cloudinary

3. **Environment Variables:** อย่าเผยแพร่ค่า sensitive ใน GitHub repository ใช้ Railway Variables แทน

## เพิ่มเติม

- Railway Docs: https://docs.railway.app/
- Vite Deployment: https://vitejs.dev/guide/static-deploy.html
- Express Best Practices: https://expressjs.com/en/advanced/best-practice-performance.html
