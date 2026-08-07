import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { MongoMemoryServer } from 'mongodb-memory-server';

import authRoutes from './routes/auth.js';
import adminAuthRoutes from './routes/adminAuth.js';
import sellerRoutes from './routes/seller.js';
import productRoutes from './routes/product.js';
import orderRoutes from './routes/order.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes from './routes/payment.js';
import wishlistRoutes from './routes/wishlist.js';
import couponRoutes from './routes/coupon.js';
import blogRoutes from './routes/blog.js';
import helpRoutes from './routes/help.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notification.js';
import shiprocketRoutes from './routes/shiprocket.js';
import saleEventRoutes from './routes/saleEvent.js';
import bannerRoutes from './routes/banners.js';
import { apiLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadDirs = ['uploads', 'uploads/products', 'uploads/prescriptions', 'uploads/store', 'uploads/avatars', 'uploads/blogs', 'uploads/banners'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shiprocket', shiprocketRoutes);
app.use('/api/sale-events', saleEventRoutes);
app.use('/api/banners', bannerRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Eyewear Platform API is running',
    timestamp: new Date().toISOString()
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (data) => {
    if (data.userId) socket.join(`user_${data.userId}`);
    if (data.sellerId) socket.join(`seller_${data.sellerId}`);
    if (data.adminId) socket.join('admin_room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max size is 5MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists.` });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: 'Validation error', errors: messages });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

const PORT = process.env.PORT || 5000;
let mongodInstance = null; // Keep reference to prevent garbage collection

const startServer = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;
    
    // If no MONGODB_URI is set, use in-memory MongoDB
    if (!mongoUri) {
      console.log('No MONGODB_URI found in .env, starting in-memory MongoDB...');
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'eyewear-platform'
        }
      });
      mongoUri = mongodInstance.getUri();
      console.log('In-memory MongoDB started');
    } else {
      console.log('Connecting to MongoDB Atlas...');
    }
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log('Connected to MongoDB');
    
    // Run seed script
    try {
      const { seedDatabase } = await import('./seed.js');
      await seedDatabase();
      console.log('Database seeded successfully');
    } catch (seedErr) {
      console.log('Seed note:', seedErr.message);
    }
    
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    console.error('\nTroubleshooting:');
    console.error('1. Check your MONGODB_URI in .env file');
    console.error('2. Make sure MongoDB Atlas IP whitelist includes your IP or 0.0.0.0/0');
    console.error('3. Verify your MongoDB Atlas username and password');
    console.error('4. Wait 1-2 minutes after updating IP whitelist');
    process.exit(1);
  }
};

startServer();

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

export { app, io };
