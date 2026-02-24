# 🚀 DukeFarm Deployment Guide

> **เอกสารการ Deploy ระบบ DukeFarm บน Ubuntu 22.04 LTS Server ของมหาวิทยาลัย**
>
> ใช้ **Nginx** เป็น Reverse Proxy, **PostgreSQL** เป็นฐานข้อมูล, **PM2** เป็น Process Manager

---

## 📋 สารบัญ

| ลำดับ | หัวข้อ |
|:---:|---|
| 1 | [ภาพรวมสถาปัตยกรรม](#1-ภาพรวมสถาปัตยกรรม) |
| 2 | [ข้อกำหนดเบื้องต้น](#2-ข้อกำหนดเบื้องต้น) |
| 3 | [เตรียมความพร้อม Server](#3-เตรียมความพร้อม-server) |
| 4 | [ติดตั้ง Node.js](#4-ติดตั้ง-nodejs) |
| 5 | [ติดตั้ง PostgreSQL](#5-ติดตั้ง-postgresql) |
| 6 | [ติดตั้ง Nginx](#6-ติดตั้ง-nginx) |
| 7 | [Deploy Backend](#7-deploy-backend) |
| 8 | [Deploy Frontend (เกษตรกร)](#8-deploy-frontend) |
| 8.5 | [Deploy Admin Panel](#85-deploy-admin-panel) |
| 9 | [ตั้งค่า Nginx Reverse Proxy](#9-ตั้งค่า-nginx-reverse-proxy) |
| 10 | [ตั้งค่า SSL (HTTPS)](#10-ตั้งค่า-ssl-https) |
| 11 | [ตั้งค่า Firewall](#11-ตั้งค่า-firewall) |
| 12 | [คำสั่งที่ใช้บ่อย & การจัดการ](#12-คำสั่งที่ใช้บ่อย--การจัดการ) |
| 13 | [Troubleshooting](#13-troubleshooting) |
| 14 | [Production Checklist](#14-production-checklist) |

---

## 1. ภาพรวมสถาปัตยกรรม

```
                    ┌──────────────────────────────────────────────────────┐
                    │                 Ubuntu 22.04 Server                  │
                    │                                                      │
   Users ──────►   │   Nginx (Port 80/443)                                │
                    │     │                                                │
                    │     ├── / ───────────────► Next.js (Port 3000)       │  ← Frontend เกษตรกร
                    │     │                                                │
                    │     ├── /admin ──────────► Next.js (Port 3001)       │  ← Admin Panel
                    │     │                                                │
                    │     ├── /api ────────────► Express (Port 4000)       │  ← Backend API
                    │     │                                                │
                    │     └── /uploads ────────► Express (Port 4000)       │
                    │                                                      │
                    │   PostgreSQL (Port 5432)                             │
                    │                                                      │
                    │   PM2 (Process Manager)                              │
                    └──────────────────────────────────────────────────────┘
```

| Component | Tech Stack | Port | Path |
|---|---|---|---|
| **Frontend (เกษตรกร)** | Next.js 15, React 19, TailwindCSS 4 | 3000 | `/` |
| **Admin Panel** | Next.js 16, React 19, TailwindCSS 4, Recharts | 3001 | `/admin` |
| **Backend** | Express 5, TypeScript, Prisma ORM | 4000 | `/api` |
| **Database** | PostgreSQL 14+ | 5432 | — |
| **Reverse Proxy** | Nginx | 80 / 443 | — |
| **Process Manager** | PM2 | — | — |

---

## 2. ข้อกำหนดเบื้องต้น

| รายการ | ขั้นต่ำ | แนะนำ |
|---|---|---|
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| RAM | 2 GB | 4 GB+ |
| CPU | 1 core | 2 core+ |
| Disk | 10 GB | 20 GB+ |
| Node.js | 18.x | 20.x LTS |
| PostgreSQL | 14 | 16 |

**สิ่งที่ต้องเตรียม:**
- สิทธิ์ `sudo` บน Server
- Domain name (ถ้ามี) หรือ IP ของ Server
- Credentials ของ LINE Login (Channel ID, Channel Secret)
- Google Maps API Key

---

## 3. เตรียมความพร้อม Server

### 3.1 อัปเดตระบบ

```bash
sudo apt update && sudo apt upgrade -y
```

### 3.2 ติดตั้ง Packages พื้นฐาน

```bash
sudo apt install -y curl git build-essential ca-certificates gnupg lsb-release
```

### 3.3 สร้าง User สำหรับ Deploy (แนะนำ)

> [!TIP]
> การรัน Application ด้วย user แยกจะปลอดภัยกว่าใช้ root

```bash
# สร้าง user ชื่อ dukefarm
sudo adduser dukefarm

# เพิ่มสิทธิ์ sudo (เลือกได้)
sudo usermod -aG sudo dukefarm

# สลับไปใช้ user ใหม่
su - dukefarm
```

---

## 4. ติดตั้ง Node.js

### 4.1 ติดตั้ง Node.js 20 LTS ผ่าน NodeSource

```bash
# ดาวน์โหลดและรัน setup script
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# ติดตั้ง Node.js (จะได้ npm มาด้วย)
sudo apt install -y nodejs

# ตรวจสอบเวอร์ชัน
node -v   # ควรได้ v20.x.x
npm -v    # ควรได้ 10.x.x
```

### 4.2 ติดตั้ง PM2

```bash
sudo npm install -g pm2
```

---

## 5. ติดตั้ง PostgreSQL

### 5.1 ติดตั้ง

```bash
# ติดตั้ง PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# ตรวจสอบสถานะ
sudo systemctl status postgresql

# ตั้งค่าให้เริ่มต้นอัตโนมัติ
sudo systemctl enable postgresql
```

### 5.2 สร้าง Database และ User

```bash
# เข้า PostgreSQL shell
sudo -u postgres psql
```

```sql
-- สร้าง user สำหรับ DukeFarm
CREATE USER dukefarm_user WITH PASSWORD 'your-strong-password-here';

-- สร้าง database
CREATE DATABASE dukefarm OWNER dukefarm_user;

-- ให้สิทธิ์ทั้งหมดบน database
GRANT ALL PRIVILEGES ON DATABASE dukefarm TO dukefarm_user;

-- ออกจาก psql
\q
```

> [!CAUTION]
> **อย่าใช้ password ที่เดาง่าย!** ใช้คำสั่งนี้สร้าง password แบบสุ่ม:
> ```bash
> openssl rand -base64 32
> ```

### 5.3 ทดสอบเชื่อมต่อ

```bash
psql -U dukefarm_user -d dukefarm -h localhost
# ถ้าเชื่อมต่อได้ แสดงว่าสำเร็จ → พิมพ์ \q เพื่อออก
```

> [!NOTE]
> ถ้าเชื่อมต่อไม่ได้ อาจต้องแก้ไขไฟล์ `pg_hba.conf`
> ```bash
> sudo nano /etc/postgresql/14/main/pg_hba.conf
> ```
> เปลี่ยน method ของ `local all all` จาก `peer` เป็น `md5`
> แล้วรีสตาร์ท:
> ```bash
> sudo systemctl restart postgresql
> ```

---

## 6. ติดตั้ง Nginx

```bash
sudo apt install -y nginx

# ตรวจสอบสถานะ
sudo systemctl status nginx

# ตั้งค่าให้เริ่มต้นอัตโนมัติ
sudo systemctl enable nginx
```

เข้าไปที่ `http://<server-ip>` ผ่าน Browser ถ้าเห็นหน้า **"Welcome to nginx!"** แสดงว่าสำเร็จ

---

## 7. Deploy Backend

### 7.1 Clone Repository

```bash
# สร้างโฟลเดอร์สำหรับเก็บ Application
sudo mkdir -p /var/www/dukefarm
sudo chown -R $USER:$USER /var/www/dukefarm
cd /var/www/dukefarm

# Clone backend repository
git clone <your-backend-repo-url> backend
cd backend
```

### 7.2 ติดตั้ง Dependencies

```bash
npm install
```

### 7.3 ตั้งค่า Environment Variables

```bash
cp .env.example .env
nano .env
```

แก้ไขค่าต่อไปนี้:

```env
# ===== Database =====
DATABASE_URL="postgresql://dukefarm_user:your-strong-password-here@localhost:5432/dukefarm?schema=public"

# ===== JWT =====
# สร้างด้วย: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="<generated-secret>"

# ===== LINE Login =====
LINE_CHANNEL_ID="<your-line-channel-id>"
LINE_CHANNEL_SECRET="<your-line-channel-secret>"
LINE_REDIRECT_URI="https://your-domain.com/api/auth/line/callback"

# ===== Frontend =====
FRONTEND_CALLBACK_URL="https://your-domain.com/auth/callback"

# ===== Server =====
PORT=4000
NODE_ENV="production"

# ===== External APIs =====
GOOGLE_MAPS_API_KEY="<your-google-maps-api-key>"
```

> [!IMPORTANT]
> - เปลี่ยน `your-domain.com` เป็นโดเมนจริงของคุณ
> - ถ้ายังไม่มีโดเมน ใช้ IP ของ Server แทนได้ (เช่น `http://158.108.x.x`)
> - อย่าลืมอัปเดต Callback URL ใน **LINE Developers Console** ให้ตรงกับ `LINE_REDIRECT_URI`

### 7.4 สร้าง Prisma Client และ Migrate Database

```bash
# สร้าง Prisma Client
npx prisma generate

# รัน Migration (สร้างตารางในฐานข้อมูล)
npx prisma migrate deploy

# Seed ข้อมูลเริ่มต้น (สูตรอาหาร, ข้อมูลโรค ฯลฯ)
npx prisma db seed
```

### 7.5 Build TypeScript

```bash
npm run build
```

### 7.6 สร้างโฟลเดอร์สำหรับ File Upload

```bash
mkdir -p uploads
```

### 7.7 ทดสอบรัน

```bash
# ทดสอบรันด้วย Node โดยตรง
npm start

# เปิด terminal ใหม่ แล้วทดสอบ
curl http://localhost:4000/healthz
# ควรได้ {"status":"ok"}

# หยุดด้วย Ctrl+C
```

### 7.8 ตั้งค่า PM2

```bash
# รันด้วย PM2
pm2 start dist/server.js --name "dukefarm-backend"

# ตรวจสอบสถานะ
pm2 status

# ดู logs
pm2 logs dukefarm-backend

# บันทึกรายการ PM2 เพื่อให้เริ่มอัตโนมัติหลัง Server reboot
pm2 save
pm2 startup
# PM2 จะแสดงคำสั่ง sudo ... ให้ copy ไปรันตามนั้น
```

---

## 8. Deploy Frontend

### 8.1 Clone Repository

```bash
cd /var/www/dukefarm

# Clone frontend repository
git clone <your-frontend-repo-url> frontend
cd frontend
```

### 8.2 ติดตั้ง Dependencies

```bash
npm install
```

### 8.3 ตั้งค่า Environment Variables

```bash
nano .env.local
```

```env
# Backend API URL (ผ่าน Nginx reverse proxy)
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api
```

> [!NOTE]
> Frontend ใช้ env var **ตัวเดียว** คือ `NEXT_PUBLIC_API_BASE_URL`
> ซึ่งถูก centralize ไว้ที่ `src/config/api.ts` — ทุกไฟล์ import จากที่เดียว

### 8.4 Build Frontend

```bash
npm run build
```

> Build อาจใช้เวลาสักครู่ (1-3 นาที ขึ้นอยู่กับสเป็ค Server)

### 8.5 ทดสอบรัน

```bash
npm start
# เปิด terminal ใหม่ แล้วทดสอบ
curl http://localhost:3000
# ควรได้ HTML กลับมา → หยุดด้วย Ctrl+C
```

### 8.6 ตั้งค่า PM2

```bash
pm2 start npm --name "dukefarm-frontend" -- start

# ตรวจสอบสถานะ
pm2 status

# บันทึก
pm2 save
```

---

## 8.5 Deploy Admin Panel

> [!NOTE]
> Admin Panel เป็น Next.js App แยกจาก Frontend เกษตรกร ใช้สำหรับผู้ดูแลระบบดูข้อมูลเกษตรกร, Dashboard, จัดการข้อมูล

### 8.5.1 Clone Repository

```bash
cd /var/www/dukefarm

# Clone admin panel repository
git clone <your-admin-repo-url> admin
cd admin
```

### 8.5.2 ติดตั้ง Dependencies

```bash
npm install
```

### 8.5.3 ตั้งค่า Environment Variables

```bash
nano .env.local
```

```env
# Backend API URL (ผ่าน Nginx reverse proxy)
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api
```

### 8.5.4 ตั้งค่า Base Path

เนื่องจาก Admin Panel จะ serve อยู่ที่ `/admin` ต้องเพิ่ม `basePath` ใน `next.config.ts`:

```bash
nano next.config.ts
```

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/admin',
};

export default nextConfig;
```

### 8.5.5 Build Admin Panel

```bash
npm run build
```

### 8.5.6 ทดสอบรัน

```bash
# รันบน port 3001
npx next start -p 3001

# เปิด terminal ใหม่ แล้วทดสอบ
curl http://localhost:3001/admin
# ควรได้ HTML กลับมา → หยุดด้วย Ctrl+C
```

### 8.5.7 ตั้งค่า PM2

```bash
pm2 start npx --name "dukefarm-admin" -- next start -p 3001

# ตรวจสอบสถานะ
pm2 status

# บันทึก
pm2 save
```

---

## 9. ตั้งค่า Nginx Reverse Proxy

### 9.1 สร้างไฟล์ Configuration

```bash
sudo nano /etc/nginx/sites-available/dukefarm
```

วาง Configuration ด้านล่าง:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # เปลี่ยนเป็นโดเมนจริง หรือ IP ของ Server

    # ===== Logging =====
    access_log /var/log/nginx/dukefarm_access.log;
    error_log  /var/log/nginx/dukefarm_error.log;

    # ===== ขนาดไฟล์ Upload สูงสุด =====
    client_max_body_size 20M;

    # ===== Backend API =====
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # ===== Health Check =====
    location /healthz {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ===== File Uploads (Static) =====
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ===== Admin Panel (Next.js on port 3001) =====
    location /admin {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ===== Frontend (Next.js) =====
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ===== Static Assets Caching =====
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 9.2 เปิดใช้งาน Configuration

```bash
# สร้าง symbolic link
sudo ln -s /etc/nginx/sites-available/dukefarm /etc/nginx/sites-enabled/

# ลบ default config (ถ้ามี)
sudo rm -f /etc/nginx/sites-enabled/default

# ทดสอบ config
sudo nginx -t
# ควรได้: syntax is ok / test is successful

# Reload Nginx
sudo systemctl reload nginx
```

---

## 10. ตั้งค่า SSL (HTTPS)

> [!IMPORTANT]
> **จำเป็นต้องมี HTTPS** เพราะ LINE Login กำหนดให้ Callback URL เป็น HTTPS
>
> **กรณีมหาวิทยาลัยมี SSL Certificate ให้:** ข้ามไปใช้วิธี [10.2 ใช้ Certificate ของมหาวิทยาลัย](#102-ใช้-certificate-ของมหาวิทยาลัย)
>
> **กรณีใช้โดเมนตัวเอง:** ใช้ Let's Encrypt ตามขั้นตอน [10.1](#101-ใช้-lets-encrypt-ฟรี)

### 10.1 ใช้ Let's Encrypt (ฟรี)

```bash
# ติดตั้ง Certbot
sudo apt install -y certbot python3-certbot-nginx

# ขอ SSL Certificate
sudo certbot --nginx -d your-domain.com

# Certbot จะแก้ไข Nginx config ให้อัตโนมัติ
# ทดสอบเข้า https://your-domain.com

# ตั้ง auto-renew (Certbot ทำให้อัตโนมัติ แต่ทดสอบได้)
sudo certbot renew --dry-run
```

### 10.2 ใช้ Certificate ของมหาวิทยาลัย

ถ้ามหาวิทยาลัยมี SSL Certificate ให้ ให้แก้ไขไฟล์ Nginx:

```bash
sudo nano /etc/nginx/sites-available/dukefarm
```

เพิ่ม server block สำหรับ HTTPS:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Certificate จากมหาวิทยาลัย
    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-cert-key.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... (ส่วน location blocks เหมือนเดิมที่ Section 9)
    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /admin {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 11. ตั้งค่า Firewall

```bash
# เปิด UFW
sudo ufw enable

# อนุญาต SSH (สำคัญมาก! ไม่งั้นจะเข้า Server ไม่ได้)
sudo ufw allow OpenSSH

# อนุญาต HTTP และ HTTPS
sudo ufw allow 'Nginx Full'

# ตรวจสอบ rules
sudo ufw status

# ผลลัพธ์ควรเป็น:
# OpenSSH          ALLOW       Anywhere
# Nginx Full       ALLOW       Anywhere
```

> [!WARNING]
> **อย่าลืม allow OpenSSH ก่อน enable UFW!** ไม่งั้นจะเข้า Server ทาง SSH ไม่ได้
>
> **Port ที่ต้องเปิด:**
> - `22` — SSH
> - `80` — HTTP
> - `443` — HTTPS
>
> **Port ที่ไม่ต้องเปิด** (เพราะเข้าถึงผ่าน Nginx):
> - `3000` — Frontend เกษตรกร (เข้าถึงผ่าน Nginx)
> - `3001` — Admin Panel (เข้าถึงผ่าน Nginx)
> - `4000` — Backend (เข้าถึงผ่าน Nginx)
> - `5432` — PostgreSQL (เข้าถึงเฉพาะ localhost)

---

## 12. คำสั่งที่ใช้บ่อย & การจัดการ

### 🔄 อัปเดต Code (Re-deploy)

สร้างสคริปต์สำหรับ Deploy ใหม่:

```bash
nano /var/www/dukefarm/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Starting DukeFarm deployment..."

# ===== Backend =====
echo "📦 Deploying Backend..."
cd /var/www/dukefarm/backend
git pull origin main
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart dukefarm-backend

# ===== Frontend =====
echo "🎨 Deploying Frontend..."
cd /var/www/dukefarm/frontend
git pull origin main
npm install
npm run build
pm2 restart dukefarm-frontend

# ===== Admin Panel =====
echo "🛡️ Deploying Admin Panel..."
cd /var/www/dukefarm/admin
git pull origin main
npm install
npm run build
pm2 restart dukefarm-admin

echo "✅ Deployment complete!"
pm2 status
```

```bash
chmod +x /var/www/dukefarm/deploy.sh
```

ใช้งาน:

```bash
/var/www/dukefarm/deploy.sh
```

### 📊 PM2 Commands

| คำสั่ง | คำอธิบาย |
|---|---|
| `pm2 status` | ดูสถานะทุก process |
| `pm2 logs` | ดู logs ทั้งหมด |
| `pm2 logs dukefarm-backend` | ดู logs เฉพาะ backend |
| `pm2 logs dukefarm-frontend` | ดู logs เฉพาะ frontend |
| `pm2 logs dukefarm-admin` | ดู logs เฉพาะ admin panel |
| `pm2 restart all` | รีสตาร์ททั้งหมด |
| `pm2 restart dukefarm-backend` | รีสตาร์ทเฉพาะ backend |
| `pm2 restart dukefarm-admin` | รีสตาร์ทเฉพาะ admin |
| `pm2 stop all` | หยุดทั้งหมด |
| `pm2 monit` | เปิด monitoring dashboard |

### 🗃️ Database Commands

| คำสั่ง | คำอธิบาย |
|---|---|
| `sudo -u postgres psql -d dukefarm` | เข้า database shell |
| `npx prisma studio` | เปิด Prisma GUI (เฉพาะตอน dev) |
| `npx prisma migrate deploy` | รัน migration ใหม่ |
| `npx prisma db seed` | Seed ข้อมูลเริ่มต้น |

### 🔍 Nginx Commands

| คำสั่ง | คำอธิบาย |
|---|---|
| `sudo nginx -t` | ทดสอบ config |
| `sudo systemctl reload nginx` | Reload config |
| `sudo systemctl restart nginx` | รีสตาร์ท Nginx |
| `sudo tail -f /var/log/nginx/dukefarm_error.log` | ดู error logs |
| `sudo tail -f /var/log/nginx/dukefarm_access.log` | ดู access logs |

---

## 13. Troubleshooting

### ❌ Backend ไม่ทำงาน

```bash
# ดู logs
pm2 logs dukefarm-backend --lines 50

# ทดสอบ healthcheck
curl http://localhost:4000/healthz

# ถ้าเชื่อมต่อ DB ไม่ได้ → ตรวจสอบ DATABASE_URL ใน .env
# ถ้ามี error "Missing required environment variable" → ตรวจสอบ .env ว่าครบทุกค่า
```

### ❌ Frontend ไม่แสดงผล

```bash
# ดู logs
pm2 logs dukefarm-frontend --lines 50

# ทดสอบเข้าถึง
curl http://localhost:3000

# ถ้า API เรียกไม่ได้ → ตรวจสอบ .env.local ว่า NEXT_PUBLIC_API_BASE_URL ถูกต้อง
# (ต้อง rebuild หลังแก้ .env.local)
```

### ❌ Nginx 502 Bad Gateway

```bash
# ตรวจสอบว่า backend/frontend รันอยู่
pm2 status

# ถ้าไม่รัน → restart
pm2 restart all

# ตรวจสอบ Nginx error log
sudo tail -20 /var/log/nginx/dukefarm_error.log
```

### ❌ Database เชื่อมต่อไม่ได้

```bash
# ตรวจสอบ PostgreSQL ทำงานอยู่
sudo systemctl status postgresql

# ทดสอบเชื่อมต่อ
psql -U dukefarm_user -d dukefarm -h localhost

# ถ้าเป็น authentication failed → ตรวจสอบ pg_hba.conf
sudo cat /etc/postgresql/14/main/pg_hba.conf
```

### ❌ LINE Login ไม่ทำงาน

- ตรวจสอบว่า `LINE_REDIRECT_URI` ใน `.env` ตรงกับ Callback URL ใน LINE Developers Console
- ตรวจสอบว่าใช้ HTTPS (LINE กำหนดให้ใช้ HTTPS)
- ตรวจสอบว่า `FRONTEND_CALLBACK_URL` ชี้ไปที่ Frontend ถูกต้อง

### ❌ Admin Panel ไม่แสดงผล

```bash
# ดู logs
pm2 logs dukefarm-admin --lines 50

# ทดสอบเข้าถึงโดยตรง
curl http://localhost:3001/admin

# ถ้าได้ 404 → ตรวจสอบว่า next.config.ts มี basePath: '/admin'
# ถ้า API เรียกไม่ได้ → ตรวจสอบ .env.local ว่า NEXT_PUBLIC_API_BASE_URL ถูกต้อง
# (ต้อง rebuild หลังแก้ .env.local หรือ next.config.ts)
```

---

## 14. Production Checklist

### ก่อน Deploy

- [ ] สร้าง strong password สำหรับ PostgreSQL
- [ ] สร้าง JWT_SECRET ด้วย `openssl rand -hex 32`
- [ ] ตั้งค่า `NODE_ENV=production`
- [ ] อัปเดต LINE Developers Console Callback URL
- [ ] ตั้งค่า Google Maps API Key

### หลัง Deploy

- [ ] เข้าเว็บผ่าน `https://your-domain.com` ได้
- [ ] เข้า Admin Panel ผ่าน `https://your-domain.com/admin` ได้
- [ ] Health check: `curl https://your-domain.com/healthz` ได้ `{"status":"ok"}`
- [ ] ทดสอบ LINE Login ได้
- [ ] ดูข้อมูล Dashboard ได้ (ทั้ง Farmer และ Admin)
- [ ] Upload รูปได้
- [ ] PM2 startup ตั้งค่าแล้ว (`pm2 save` + `pm2 startup`)
- [ ] PM2 มี 3 processes: `dukefarm-backend`, `dukefarm-frontend`, `dukefarm-admin`
- [ ] Firewall เปิดเฉพาะ port 22, 80, 443
- [ ] SSL Certificate ติดตั้งแล้ว

### Backup Database (แนะนำ)

ตั้ง cron job สำหรับ backup อัตโนมัติ:

```bash
# สร้าง script
nano /var/www/dukefarm/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/www/dukefarm/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U dukefarm_user -h localhost dukefarm > "$BACKUP_DIR/dukefarm_$TIMESTAMP.sql"

# ลบ backup เก่ากว่า 30 วัน
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete

echo "✅ Backup completed: dukefarm_$TIMESTAMP.sql"
```

```bash
chmod +x /var/www/dukefarm/backup-db.sh

# ตั้ง cron job — backup ทุกวันตอนตี 3
crontab -e
# เพิ่มบรรทัดนี้:
0 3 * * * /var/www/dukefarm/backup-db.sh >> /var/log/dukefarm-backup.log 2>&1
```

---

## 📌 สรุปโครงสร้างไฟล์บน Server

```
/var/www/dukefarm/
├── backend/                    # Backend source code
│   ├── .env                    # Backend environment variables
│   ├── dist/                   # Compiled JavaScript
│   ├── prisma/                 # Database schema & migrations
│   ├── uploads/                # User uploaded files
│   └── node_modules/
├── frontend/                   # Frontend เกษตรกร (Port 3000)
│   ├── .env.local              # Frontend environment variables
│   ├── .next/                  # Next.js build output
│   └── node_modules/
├── admin/                      # Admin Panel (Port 3001)
│   ├── .env.local              # Admin environment variables
│   ├── .next/                  # Next.js build output
│   ├── next.config.ts          # มี basePath: '/admin'
│   └── node_modules/
├── backups/                    # Database backups
├── deploy.sh                   # Re-deployment script
└── backup-db.sh                # Database backup script
```

---

> **ผู้เขียน:** DukeFarm Team  
> **ปรับปรุงล่าสุด:** กุมภาพันธ์ 2026  
> **เวอร์ชัน:** 1.0
