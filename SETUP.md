# Horeca Spot — Setup & Deployment Guide

## Step 1 — Create Supabase Database

1. Go to https://supabase.com and create a free account
2. Click **New Project**, choose a name (e.g. `horeca-spot`) and a strong password
3. Wait for the project to provision (~1 min)
4. Go to **SQL Editor** (left sidebar)
5. Paste the entire contents of `server/schema.sql` and click **Run**
6. Go to **Project Settings → Database → Connection String → URI**
7. Copy the URI — it looks like:
   `postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres`

## Step 2 — Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and paste your DATABASE_URL and a random JWT_SECRET

# Seed the default users (emp/123 and admin/123)
npm run seed

# Start the dev server
npm run dev
# → Open http://localhost:3000
```

## Step 3 — Deploy to Render (Free Tier)

1. Push this project to a GitHub repository
2. Go to https://render.com and create a free account
3. Click **New → Web Service** → connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Under **Environment Variables**, add:
   - `DATABASE_URL` → your Supabase URI from Step 1
   - `JWT_SECRET`   → any long random string (or let Render generate one)
6. Click **Deploy**
7. Your app will be live at `https://horeca-spot.onrender.com` (or similar)

> **Note:** On Render's free tier the service sleeps after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds to wake up.
> Upgrade to a paid plan ($7/mo) to keep it always-on.

## Default Login Credentials

| Role     | Username | Password |
|----------|----------|----------|
| Employee | `emp`    | `123`    |
| Manager  | `admin`  | `123`    |

**Change these after your first login by updating the database directly in Supabase.**

## File Structure

```
WER/
├── public/              ← All HTML files (served as static)
│   ├── login.html
│   ├── sales-entry.html
│   ├── dashboard.html
│   ├── customer-records.html
│   └── manager-view.html
├── server/
│   ├── index.js         ← Express app entry point
│   ├── db.js            ← PostgreSQL pool
│   ├── schema.sql       ← Run once in Supabase SQL Editor
│   ├── seed.js          ← Creates default users
│   ├── middleware/
│   │   └── auth.js      ← JWT verify + role guard
│   └── routes/
│       ├── auth.js      ← POST /api/auth/login, GET /api/auth/me
│       ├── sales.js     ← POST /api/sales
│       ├── dashboard.js ← GET /api/dashboard/stats
│       └── customers.js ← GET /api/customers, GET /api/customers/:id
├── .env.example
├── .gitignore
├── package.json
└── render.yaml
```
