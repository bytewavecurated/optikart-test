# Environment Variables Quick Guide

## What You Need to Do

### Step 1: Create Your .env File

Navigate to the `server` folder and create a `.env` file:

```bash
cd server
cp .env.example .env
```

### Step 2: Fill in Your Values

Open `.env` and replace placeholder values with your actual credentials.

---

## Required Environment Variables

### ✅ MUST HAVE (Core Functionality)

```env
# Server Port
PORT=5000

# MongoDB Database
MONGODB_URI=mongodb://localhost:27017/eyewear-platform

# JWT Secret (Generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Admin Email
ADMIN_EMAIL=admin@example.com
```

### ✅ MUST HAVE (Email/OTP)

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```

**How to get Gmail App Password:**
1. Enable 2FA on your Gmail: https://myaccount.google.com/security
2. Go to: https://myaccount.google.com/apppasswords
3. Generate App Password (16 characters)
4. Use that password in `SMTP_PASS`

### ⚠️ OPTIONAL (Payment Integration)

```env
# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

**Get from:** https://dashboard.razorpay.com/ → Settings → API Keys

### ⚠️ OPTIONAL (Shipping Integration)

```env
# Shiprocket Shipping
SHIPROCKET_EMAIL=your_shiprocket_email
SHIPROCKET_PASSWORD=your_shiprocket_password
SHIPROCKET_API_KEY=your_shiprocket_api_key
```

**Get from:** https://app.shiprocket.in/ → Settings → API

### ⚠️ OPTIONAL (Image Storage)

```env
# Cloudinary (for product images)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Get from:** https://cloudinary.com/ → Dashboard → Account Details

---

## About .env Files

### What's the difference?

| File | Purpose | Committed to Git? |
|------|---------|-------------------|
| `.env` | Your actual credentials | ❌ NO (in .gitignore) |
| `.env.example` | Template with placeholders | ✅ YES |
| `.env.local` | Local overrides (optional) | ❌ NO (in .gitignore) |
| `.env.production` | Production config (optional) | ❌ NO (in .gitignore) |

### Why .env is NOT in Git

Your `.env` file contains sensitive credentials (passwords, API keys, etc.). It's in `.gitignore` to prevent accidental exposure.

**Never commit `.env` to GitHub!**

### What about .env.local and .env.production?

These are **optional** files mentioned in `.gitignore`. The codebase currently uses a single `.env` file.

**When would you use them?**
- `.env.local` - Override specific values for local development
- `.env.production` - Different config for production deployment

**Current setup:** Single `.env` file is sufficient. You can manually change values when switching between development and production.

---

## Quick Setup Commands

### For Development

```bash
# 1. Clone repository
git clone https://github.com/bytewavecurated/optikart-test.git
cd optikart-test

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Create .env file
cd ../server
cp .env.example .env
# Edit .env with your values

# 4. Seed database (optional)
node seed.js

# 5. Start servers
# Terminal 1: Backend
node server.js

# Terminal 2: Frontend
cd ../client
npm start
```

### For Production

```bash
# 1. Update .env for production
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
MONGODB_URI=mongodb+srv://...  # Use MongoDB Atlas

# 2. Build frontend
cd client
npm run build

# 3. Start backend
cd ../server
NODE_ENV=production node server.js
```

---

## Testing Your Setup

After creating `.env`, test it:

```bash
cd server
node server.js
```

**Expected output:**
```
Connected to MongoDB
Server running on port 5000
```

**If you see errors:**
- Check MongoDB is running (or use Atlas)
- Verify all required variables are set
- Check for typos in variable names

---

## Common Issues

### ❌ MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Fix:** 
- Start MongoDB: `mongod`
- OR use MongoDB Atlas connection string

### ❌ Email Not Sending
```
Error: Invalid login
```
**Fix:**
- Use Gmail App Password (not regular password)
- Enable 2FA on Gmail
- Check SMTP credentials

### ❌ Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Fix:**
- Change `PORT=5001` in `.env`
- OR kill process: `lsof -ti:5000 | xargs kill -9`

---

## Security Checklist

Before deploying to production:

- [ ] Changed JWT_SECRET to strong random string
- [ ] Using MongoDB Atlas (not local MongoDB)
- [ ] Updated FRONTEND_URL to production domain
- [ ] Using production Razorpay keys (if using payments)
- [ ] Set NODE_ENV=production
- [ ] Using production email service
- [ ] Enabled HTTPS
- [ ] Set up proper firewall rules

---

## Need Help?

📖 **Detailed guide:** See [ENV_SETUP.md](./ENV_SETUP.md) for complete instructions

📖 **Full documentation:** See [README.md](./README.md) for project overview

---

## Summary

✅ **You need:** One `.env` file in the `server` folder

✅ **Required variables:** MongoDB URI, JWT Secret, SMTP credentials

✅ **Optional variables:** Razorpay, Shiprocket, Cloudinary (for specific features)

✅ **Never commit:** `.env` file (it's in .gitignore)

✅ **Template available:** `.env.example` shows all variables

---

**That's it! Fill in your `.env` file and you're ready to go!** 🚀
