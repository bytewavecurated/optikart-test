# Environment Variables Setup Guide

This guide explains how to configure all environment variables for the OptiKart platform.

## Quick Start

1. Copy the example file:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit `.env` and fill in your actual values

3. **Never commit `.env` to Git** (it's already in `.gitignore`)

---

## Environment Variables Explained

### 1. Server Configuration

```env
PORT=5000
```
- **Purpose**: Port number for the backend server
- **Default**: 5000
- **Required**: Yes
- **Notes**: Change if port 5000 is already in use

---

### 2. Database Configuration

```env
MONGODB_URI=mongodb://localhost:27017/eyewear-platform
```
- **Purpose**: MongoDB connection string
- **Required**: Yes
- **Options**:
  - **Local MongoDB**: `mongodb://localhost:27017/eyewear-platform`
  - **MongoDB Atlas**: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/eyewear-platform?retryWrites=true&w=majority`

**Setup MongoDB Atlas (Recommended for Production)**:
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a cluster
4. Create a database user
5. Whitelist your IP address (or use 0.0.0.0/0 for development)
6. Get connection string and replace `<username>` and `<password>`

---

### 3. JWT Authentication

```env
JWT_SECRET=change_this_to_a_strong_random_string
```
- **Purpose**: Secret key for signing JWT tokens
- **Required**: Yes
- **Security**: Use a strong random string (at least 32 characters)

**Generate a secure JWT secret**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 4. Frontend URL (CORS)

```env
FRONTEND_URL=http://localhost:3000
```
- **Purpose**: Frontend URL for CORS configuration
- **Required**: Yes
- **Development**: `http://localhost:3000`
- **Production**: `https://yourdomain.com`

---

### 5. Admin Email

```env
ADMIN_EMAIL=admin@example.com
```
- **Purpose**: Admin email for system notifications
- **Required**: Yes
- **Notes**: Used for help tickets and system alerts

---

### 6. Email Configuration (SMTP)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```
- **Purpose**: Email sending for OTP, order confirmations, etc.
- **Required**: Yes (for OTP functionality)

#### Gmail Setup:
1. Enable 2-Factor Authentication on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an App Password (16 characters)
4. Use that password in `SMTP_PASS`

#### Other Providers:

**SendGrid**:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx (your SendGrid API key)
```

**Mailgun**:
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your_mailgun_username
SMTP_PASS=your_mailgun_password
```

---

### 7. Razorpay Payment Gateway

```env
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
```
- **Purpose**: Payment processing integration
- **Required**: Yes (for payment functionality)

**Setup**:
1. Go to https://dashboard.razorpay.com/
2. Sign up/Login
3. Go to Settings > API Keys
4. Click "Generate Test Key" (for testing) or "Generate Live Key" (for production)
5. Copy Key ID and Key Secret

**Note**: Test keys work in test mode, Live keys process real payments

---

### 8. Shiprocket Shipping API

```env
SHIPROCKET_EMAIL=your_shiprocket_email@example.com
SHIPROCKET_PASSWORD=your_shiprocket_password_here
SHIPROCKET_API_KEY=your_shiprocket_api_key_here
```
- **Purpose**: Shipping and delivery management
- **Required**: Yes (for shipping functionality)

**Setup**:
1. Go to https://app.shiprocket.in/
2. Sign up/Login
3. Go to Settings > API
4. Copy your credentials

---

### 9. Cloudinary (Image Storage)

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_cloudinary_api_key_here
CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here
```
- **Purpose**: Image storage for products, prescriptions, etc.
- **Required**: Yes (for image upload functionality)

**Setup**:
1. Go to https://cloudinary.com/
2. Sign up (free tier available)
3. Go to Dashboard
4. Copy Cloud Name, API Key, and API Secret from the dashboard

---

### 10. Node Environment

```env
NODE_ENV=development
```
- **Purpose**: Environment mode
- **Required**: No (defaults to development)
- **Options**:
  - `development` - Development mode with detailed errors
  - `production` - Production mode with optimizations

---

## File Structure

```
server/
├── .env              # Your actual environment variables (NOT committed to Git)
├── .env.example      # Template file (committed to Git)
└── .gitignore        # Contains .env to prevent accidental commits
```

---

## About .env.local and .env.production

The `.gitignore` file includes:
- `.env` - Your main environment file
- `.env.local` - Local overrides (optional)
- `.env.production` - Production-specific variables (optional)

**When to use multiple env files**:

1. **Single `.env` file** (Simple setup):
   - Use for most projects
   - Switch between environments by changing values manually

2. **Multiple env files** (Advanced setup):
   - `.env` - Base configuration
   - `.env.local` - Local development overrides
   - `.env.production` - Production configuration

**Note**: The current codebase uses a single `.env` file. Multiple env files are supported by the `.gitignore` but not actively used in the code.

---

## Security Best Practices

1. **Never commit `.env` to Git**
   - It's already in `.gitignore`
   - Contains sensitive credentials

2. **Use strong secrets**
   - JWT_SECRET: At least 32 random characters
   - API keys: Keep them secure

3. **Rotate credentials regularly**
   - Change API keys periodically
   - Update passwords every 90 days

4. **Use environment-specific values**
   - Different MongoDB for dev/prod
   - Different Razorpay test/live keys
   - Different email accounts

5. **Restrict database access**
   - Use strong MongoDB passwords
   - Whitelist IP addresses in MongoDB Atlas
   - Use read-only users where possible

---

## Testing Your Configuration

After setting up `.env`, test the configuration:

```bash
cd server
npm install
node server.js
```

You should see:
```
Connected to MongoDB
Server running on port 5000
```

If you see errors:
- Check MongoDB connection string
- Verify all required variables are set
- Check for typos in variable names

---

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: 
- Make sure MongoDB is running locally
- Or use MongoDB Atlas connection string

### Email Sending Error
```
Error: Invalid login
```
**Solution**:
- Check SMTP credentials
- For Gmail, use App Password (not your regular password)
- Enable 2FA on Gmail account

### Razorpay Error
```
Error: Invalid key
```
**Solution**:
- Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
- Make sure you're using the correct test/live keys

### CORS Error
```
Error: Blocked by CORS policy
```
**Solution**:
- Check FRONTEND_URL matches your frontend URL exactly
- Include protocol (http:// or https://)

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random string
- [ ] Use MongoDB Atlas (not local MongoDB)
- [ ] Update FRONTEND_URL to production domain
- [ ] Use production Razorpay keys (not test keys)
- [ ] Set NODE_ENV=production
- [ ] Use production email service (SendGrid/Mailgun)
- [ ] Set up Cloudinary for image storage
- [ ] Configure Shiprocket for shipping
- [ ] Enable HTTPS/SSL
- [ ] Set up proper firewall rules
- [ ] Regular backups configured
- [ ] Monitoring and logging set up

---

## Support

If you need help with environment configuration:
1. Check the error messages in the console
2. Verify all required variables are set
3. Check credentials are correct
4. Review the troubleshooting section above

For specific service setup:
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/
- Razorpay: https://razorpay.com/docs/
- Shiprocket: https://docs.shiprocket.in/
- Cloudinary: https://cloudinary.com/documentation
- SendGrid: https://docs.sendgrid.com/
