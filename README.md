# OptiKart - Professional Eyewear E-Commerce Platform

A full-featured, multi-vendor eyewear e-commerce platform built with React, Node.js, Express, and MongoDB.

## 🎯 Overview

OptiKart is a comprehensive e-commerce solution for eyewear products featuring:
- Multi-vendor marketplace (sellers, manufacturers, executives)
- AI-powered chatbot and face detection
- Voice and camera search capabilities
- Virtual try-on with AR
- Prescription management
- Automated commission and payout system
- Advanced analytics and reporting

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ and npm
- MongoDB (local or Atlas)
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/bytewavecurated/optikart-test.git
cd optikart-test
```

2. **Install dependencies**
```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

3. **Configure environment variables**

Create `server/.env` file:
```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/optikart

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAYX_KEY_ID=your_razorpayx_key
RAZORPAYX_KEY_SECRET=your_razorpayx_secret

# Shipping
SHIPROCKET_EMAIL=your_shiprocket_email
SHIPROCKET_PASSWORD=your_shiprocket_password
SHIPROCKET_API_KEY=your_shiprocket_api_key

# Image Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

# AI Services
OPENAI_API_KEY=your_openai_key

# Face Detection (choose one)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
# OR
GOOGLE_VISION_API_KEY=your_google_vision_key
# OR
AZURE_FACE_API_KEY=your_azure_face_key
AZURE_FACE_ENDPOINT=your_azure_endpoint

# Speech Recognition
GOOGLE_SPEECH_API_KEY=your_google_speech_key
```

4. **Seed the database** (creates test data)
```bash
cd server
node seed.js
```

5. **Start the application**
```bash
# Terminal 1 - Backend
cd server
node server.js

# Terminal 2 - Frontend
cd client
npm start
```

6. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔐 Test Credentials

### Admin
- **Email**: admin@optikart.com
- **Password**: Admin123@

### Seller
- **Email**: seller1@optikart.com
- **Password**: Seller123@

### Executive
- **Email**: executive@optikart.com
- **Password**: Executive123@

### Manufacturer
- **Email**: manufacturer@optikart.com
- **Password**: Manufacturer123@

### User
- **Email**: user@optikart.com
- **Password**: User123@

## 📁 Project Structure

```
optikart/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # Context providers (Auth, Cart, etc.)
│   │   ├── pages/         # Page components
│   │   │   ├── admin/     # Admin panel pages
│   │   │   ├── seller/    # Seller dashboard pages
│   │   │   ├── executive/ # Executive panel pages
│   │   │   ├── manufacturer/ # Manufacturer pages
│   │   │   └── ...        # Other pages
│   │   ├── services/      # API services
│   │   └── App.js         # Main app component
│   └── package.json
│
├── server/                # Node.js backend
│   ├── middleware/        # Auth, validation, rate limiting
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── services/         # Business logic (email, payment, etc.)
│   ├── seed.js           # Database seeder
│   ├── server.js         # Entry point
│   └── package.json
│
└── README.md             # This file
```

## 🎨 Design System

### Color Palette
- **Primary**: `#0A2540` - Dark navy for headers and navigation
- **Action**: `#007791` - Teal for CTAs, links, and active states
- **Accent**: `#C49A6C` - Gold for premium highlights
- **Neutral**: `#333333` - Dark gray for body text
- **Background**: `#FFFFFF` - White for clean interface

### Typography
- **Font Family**: Inter
- **Header**: Inter Bold, 36pt/48pt
- **Subheader**: Inter Medium, 20pt/28pt
- **Body**: Inter Regular, 16pt/24pt

## ✨ Features

### User Features
- Browse products by category, brand, gender
- Advanced search with filters
- Voice search (Web Speech API)
- Camera search with face shape detection
- Virtual try-on with AR
- Prescription upload and management
- Shopping cart and wishlist
- Order tracking
- Product comparison
- Coupon system
- Blog and help center

### Seller Features
- Seller dashboard with analytics
- Product management (add, edit, delete)
- Order management
- Inventory alerts (low stock notifications)
- Offer and discount management
- Payout history and tracking
- Performance metrics

### Manufacturer Features
- Brand-wise product management
- Seller management
- Bulk upload via spreadsheet
- Discontinued products handling
- Kids product type selection

### Executive Features
- Department-specific access
- Staff management
- Search and filter functionality
- Department data management

### Admin Features
- Complete platform oversight
- User and seller management
- Executive and manufacturer management
- Order and revenue tracking
- Commission management (3%)
- Chatbot knowledge base
- Sale events and banners
- Staff management
- Delivery tracking

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/auth/me` - Get current user

### Sellers
- `POST /api/seller/register` - Register seller
- `POST /api/seller/login` - Seller login
- `GET /api/seller/me` - Get seller profile
- `POST /api/seller/products` - Add product
- `GET /api/seller/orders` - Get seller orders
- `GET /api/seller/inventory-alerts` - Get inventory alerts
- `GET /api/seller/payouts/history` - Get payout history

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product details
- `GET /api/products/filters` - Get filter options
- `GET /api/products/:id/related` - Get related products

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `POST /api/orders/:id/review` - Add product review

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - Manage users
- `GET /api/admin/sellers` - Manage sellers
- `GET /api/admin/executives` - Manage executives
- `GET /api/admin/manufacturers` - Manage manufacturers
- `GET /api/admin/commissions` - Track commissions
- `POST /api/payouts/calculate` - Calculate seller payout
- `POST /api/payouts/process` - Process payouts

### AI Services
- `POST /api/chatbot/message` - Chat with AI
- `POST /api/face-detection/detect` - Detect face shape
- `POST /api/speech/search` - Voice search

## 🛠️ Tech Stack

### Frontend
- React 18
- React Router v6
- Context API (state management)
- Axios (HTTP client)
- React Icons
- Framer Motion (animations)

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Socket.io (real-time)
- Nodemailer (email)
- Multer (file uploads)

### Integrations
- Razorpay (payments)
- Shiprocket (shipping)
- Cloudinary (image storage)
- OpenAI (chatbot)
- AWS Rekognition / Google Vision / Azure Face (face detection)
- Google Speech API (voice recognition)

## 🔒 Security Features

- JWT-based authentication
- OTP verification for login
- Account lockout after failed attempts
- Role-based access control
- Data isolation between users/sellers
- Rate limiting on API endpoints
- Password hashing with bcrypt
- CORS configuration
- Input validation

## 📊 Database Models

### Core Models
- **User** - Customer accounts
- **Seller** - Seller accounts with KYC
- **Product** - Product listings
- **Order** - Order records
- **Cart** - Shopping cart
- **Wishlist** - User wishlists

### Extended Models
- **Executive** - Executive accounts
- **Manufacturer** - Manufacturer accounts
- **ManufacturerSeller** - Manufacturer's sellers
- **InventoryAlert** - Low stock alerts
- **SellerPayout** - Payout records
- **Commission** - Commission tracking
- **Banner** - Homepage banners
- **Blog** - Blog posts
- **Coupon** - Discount coupons
- **HelpArticle** - Help center content

## 🚢 Deployment

### Environment Variables for Production
Update `.env` with production values:
- Use MongoDB Atlas for database
- Configure production Razorpay keys
- Set up Cloudinary for images
- Enable HTTPS
- Configure production email service

### Build for Production
```bash
# Frontend
cd client
npm run build

# Backend
cd server
NODE_ENV=production node server.js
```

### Recommended Hosting
- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront
- **Backend**: Heroku, Railway, AWS EC2, or DigitalOcean
- **Database**: MongoDB Atlas
- **Images**: Cloudinary or AWS S3

## 📝 Important Notes

### Test Credentials
Test credentials are included in `seed.js` for development. **Remove them before production deployment** for security.

### File Uploads
The application uses Cloudinary for image storage in production. Local file storage is only for development.

### AI Services
- Chatbot falls back to knowledge base if OpenAI API key not configured
- Face detection falls back to simulation if no API configured
- Voice search uses browser's Web Speech API (no API key needed)

### Payment Processing
- Razorpay is configured for payments
- Seller payouts use RazorpayX for bank transfers
- Mock transfer function included for testing

## 🤝 Contributing

This is a production-ready application. For modifications:
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is proprietary software.

## 🆘 Support

For issues or questions:
- Check the documentation in this README
- Review API endpoints above
- Check environment variable configuration
- Review error logs in console

## 🎯 Roadmap

### Completed
- ✅ Multi-vendor marketplace
- ✅ AI chatbot and face detection
- ✅ Voice and camera search
- ✅ Virtual try-on
- ✅ Prescription management
- ✅ Commission and payout system
- ✅ Inventory alerts
- ✅ Admin panel with all features
- ✅ Executive and manufacturer panels
- ✅ Advanced analytics
- ✅ Security hardening

### Future Enhancements
- Real AR face tracking (requires specialized library)
- Firebase/OneSignal push notifications
- Multi-language support
- Advanced loyalty program
- Mobile app (React Native)

---

**Version**: 8.0.0  
**Last Updated**: October 2026  
**Status**: Production Ready ✅
