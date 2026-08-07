# OptiKart - Eyewear E-commerce Platform

A full-stack, multi-vendor eyewear e-commerce platform built with React, Node.js, Express, and MongoDB. Features Flipkart-like design with comprehensive seller management, user authentication, and admin controls.

## 🚀 Features

### For Customers
- Browse products by category (Sunglasses, Eyeglasses, Contact Lenses, etc.)
- Advanced product filtering (price, brand, frame shape, size, gender, lens type)
- Product search with auto-suggestions
- Shopping cart with 20-item limit
- Wishlist functionality
- Prescription upload (PDF/Image)
- Virtual try-on feature
- Product ratings and reviews
- Order tracking
- Multiple payment options (Razorpay integration)

### For Sellers
- Seller registration with KYC verification (GST, Aadhar, PAN)
- Product management (add, edit, delete)
- Order management and fulfillment
- Sales analytics dashboard
- Offer and discount management
- Performance metrics tracking
- Subscription management (₹500 + 18% GST/month)

### For Admin
- Complete platform oversight
- User and seller management
- Role-based staff access control
- Sale event management (platform-wide discounts)
- Banner management
- Coupon/discount system
- Blog CMS
- Help & Support ticket system
- Revenue tracking and analytics

### Security Features
- OTP-based authentication for all user types
- Account lockout after failed attempts
  - Users: 3 attempts, 3-minute lockout
  - Sellers: 3 attempts, 3-minute lockout
  - Admin: 2 attempts, 5-minute lockout
- JWT token-based sessions
- Role-based access control
- Data isolation between users/sellers

## 🛠️ Tech Stack

### Frontend
- React 18
- React Router v6
- Context API (State Management)
- Framer Motion (Animations)
- React Icons
- Axios (HTTP Client)
- Socket.io Client (Real-time)

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Socket.io (Real-time notifications)
- Nodemailer (Email service)
- Multer (File uploads)

### Integrations
- Razorpay (Payment Gateway)
- Shiprocket (Shipping & Delivery)
- Cloudinary (Image Storage)
- SMTP (Email notifications)

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v4.4 or higher) - [Download](https://www.mongodb.com/try/download/community)
  - OR use MongoDB Atlas (cloud) - [Sign up](https://www.mongodb.com/cloud/atlas)
- **npm** or **yarn** package manager
- **Git** - [Download](https://git-scm.com/)

### Optional (for full functionality)
- Razorpay account - [Sign up](https://razorpay.com/)
- Shiprocket account - [Sign up](https://www.shiprocket.in/)
- Cloudinary account - [Sign up](https://cloudinary.com/)
- Gmail account with App Password (for OTP emails)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/bytewavecurated/optikart-test.git
cd optikart-test
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Configure Environment Variables

**Important**: You need to create a `.env` file in the `server` directory with your configuration.

```bash
cd server
cp .env.example .env
```

Edit the `.env` file and add your credentials:

```env
# Server
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/eyewear-platform

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Admin Email
ADMIN_EMAIL=admin@example.com

# Email (SMTP) - For OTP emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Shiprocket Shipping
SHIPROCKET_EMAIL=your_shiprocket_email
SHIPROCKET_PASSWORD=your_shiprocket_password
SHIPROCKET_API_KEY=your_shiprocket_api_key

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

📖 **Detailed setup guide**: See [ENV_SETUP.md](./ENV_SETUP.md) for complete instructions on obtaining and configuring each variable.

### 4. Seed the Database (Optional)

To populate the database with sample data:

```bash
cd server
node seed.js
```

This creates:
- Admin user
- Test sellers
- Sample products
- Sample categories
- Help articles

### 5. Start the Application

**Terminal 1 - Backend Server**:
```bash
cd server
node server.js
```

Server will run on `http://localhost:5000`

**Terminal 2 - Frontend Server**:
```bash
cd client
npm start
```

Frontend will run on `http://localhost:3000`

## 🔐 Test Credentials

After running the seed script, use these credentials to test:

### Admin Login
- **Email**: `samedayopticians@gmail.com`
- **Password**: `Sameday123@`
- **URL**: http://localhost:3000/admin/login

### Test Users
- **Email**: `testuser@optikart.com`
- **Password**: `Test123@`

- **Email**: `demo@optikart.com`
- **Password**: `Demo123@`

### Test Sellers
- **Email**: `opticalworld@gmail.com`
- **Password**: `Seller123@`

- **Email**: `visioncare@gmail.com`
- **Password**: `Seller123@`

- **Email**: `lensstudio@gmail.com`
- **Password**: `Seller123@`

- **Email**: `eyefashion@gmail.com`
- **Password**: `Seller123@`

**Note**: Test credentials bypass OTP for easy testing. Remove this bypass before production deployment.

## 📁 Project Structure

```
optikart-test/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # Context providers
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── middleware/        # Auth, validation, rate limiting
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── services/         # Email, payment, shipping services
│   ├── .env              # Environment variables (not in git)
│   ├── .env.example      # Environment template
│   ├── seed.js           # Database seeder
│   ├── server.js         # Entry point
│   └── package.json
│
├── ENV_SETUP.md           # Detailed environment setup guide
├── README.md             # This file
└── .gitignore
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login (with OTP)
- `POST /api/auth/verify-login-otp` - Verify login OTP
- `GET /api/auth/me` - Get current user

### Sellers
- `POST /api/seller/register` - Register seller
- `POST /api/seller/login` - Seller login (with OTP)
- `GET /api/seller/me` - Get seller profile
- `POST /api/seller/products` - Add product
- `GET /api/seller/orders` - Get seller orders

### Products
- `GET /api/products` - Get all products (with filters)
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
- `POST /api/admin/sale-events` - Create sale event

📖 **Full API documentation**: See API routes in `server/routes/`

## 🔒 Security Features

### Authentication
- OTP-based login for all user types
- JWT token sessions with expiry
  - Users: 30 days
  - Sellers: 24 hours
  - Admin: 7 days

### Account Lockout
- **Users**: 3 failed attempts → 3-minute lockout
- **Sellers**: 3 failed attempts → 3-minute lockout
- **Admin**: 2 failed attempts → 5-minute lockout

### Data Protection
- Password hashing with bcrypt
- Role-based access control
- Data isolation between users/sellers
- Input validation and sanitization
- Rate limiting on authentication endpoints

## 🚢 Deployment

### Backend Deployment (Heroku/Railway/Render)

1. Set environment variables in your hosting platform
2. Use MongoDB Atlas for database
3. Deploy the `server` directory

### Frontend Deployment (Vercel/Netlify)

1. Build the React app:
   ```bash
   cd client
   npm run build
   ```
2. Deploy the `client/build` directory
3. Set environment variable: `REACT_APP_API_URL=your_backend_url`

### Environment Variables for Production

Update your `.env` file:
```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
MONGODB_URI=mongodb+srv://...
# ... other production credentials
```

📖 **Complete deployment guide**: See [ENV_SETUP.md](./ENV_SETUP.md)

## 🧪 Testing the Application

### 1. Test User Flow
1. Register/Login as user
2. Browse products
3. Add to cart
4. Upload prescription (optional)
5. Checkout with Razorpay

### 2. Test Seller Flow
1. Login as seller
2. Add new products
3. Manage orders
4. View analytics
5. Create offers

### 3. Test Admin Flow
1. Login as admin
2. View dashboard
3. Manage users/sellers
4. Create sale events
5. Manage banners
6. View revenue

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Start MongoDB service or use MongoDB Atlas

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Change PORT in `.env` or kill the process using port 5000

### OTP Email Not Sending
**Solution**: 
- Check SMTP credentials in `.env`
- For Gmail, use App Password (not regular password)
- Enable 2FA on Gmail account

### CORS Error
**Solution**: 
- Check FRONTEND_URL in `.env`
- Ensure it matches your frontend URL exactly

📖 **More troubleshooting**: See [ENV_SETUP.md](./ENV_SETUP.md)

## 📝 Scripts

```bash
# Backend
cd server
npm start          # Start server
npm run dev        # Start with nodemon (development)
node seed.js       # Seed database

# Frontend
cd client
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- **bytewavecurated** - [GitHub](https://github.com/bytewavecurated)

## 🙏 Acknowledgments

- Design inspiration from Flipkart
- Icons from React Icons
- UI components built with custom CSS

## 📞 Support

For support and questions:
- Open an issue on GitHub
- Email: admin@optikart.com

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Advanced search with Elasticsearch
- [ ] Push notifications
- [ ] Seller verification badges
- [ ] Product comparison feature

---

**Made with ❤️ for the eyewear industry**
