import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Seller from './models/Seller.js';
import Product from './models/Product.js';
import Coupon from './models/Coupon.js';
import HelpArticle from './models/HelpArticle.js';
import Executive from './models/Executive.js';
import Manufacturer from './models/Manufacturer.js';
import ManufacturerSeller from './models/ManufacturerSeller.js';
import Blog from './models/Blog.js';
import DeliveryPartner from './models/DeliveryPartner.js';
import StaffRole from './models/StaffRole.js';
import SellerStock from './models/SellerStock.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await User.deleteMany({});
    await Seller.deleteMany({});
    await Product.deleteMany({});
    await Coupon.deleteMany({});
    await HelpArticle.deleteMany({});
    await Blog.deleteMany({});
    await Executive.deleteMany({});
    await Manufacturer.deleteMany({});
    await ManufacturerSeller.deleteMany({});
    await DeliveryPartner.deleteMany({});
    await StaffRole.deleteMany({});
    console.log('Cleared existing data');

    const admin = await User.create({
      name: 'Admin',
      email: 'samedayopticians@gmail.com',
      password: 'Sameday123@',
      role: 'admin',
      phone: '9999999999'
    });
    console.log('Admin created:', admin.email);

    // Create test users
    const testUsers = await User.create([
      {
        name: 'Test User',
        email: 'testuser@optikart.com',
        password: 'Test123@',
        role: 'user',
        phone: '9876543219',
        isActive: true
      },
      {
        name: 'Demo Customer',
        email: 'demo@optikart.com',
        password: 'Demo123@',
        role: 'user',
        phone: '9876543218',
        isActive: true
      }
    ]);
    console.log('Test users created:', testUsers.map(u => u.email).join(', '));

    const sellers = await Seller.create([
      {
        name: 'Rajesh Kumar',
        email: 'opticalworld@gmail.com',
        phone: '9876543210',
        password: 'Seller123@',
        gstNumber: '29AABCU9603R1ZM',
        aadharNumber: '123456789012',
        panNumber: 'AABCU9603R',
        bankAccount: {
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          branchName: 'Mumbai Main'
        },
        storeName: 'Optical World',
        storeDescription: 'Premium eyewear collection with latest designs',
        isVerified: true,
        verifiedBy: admin._id,
        verifiedAt: new Date(),
        rating: 4.5,
        totalSales: 150,
        location: { type: 'Point', coordinates: [72.8777, 19.076] },
        address: {
          street: 'Linking Road, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
          country: 'India'
        },
        serviceRadius: 10
      },
      {
        name: 'Priya Sharma',
        email: 'visioncare@gmail.com',
        phone: '9876543211',
        password: 'Seller123@',
        gstNumber: '27AABCU9604R1ZK',
        aadharNumber: '234567890123',
        panNumber: 'AABCU9604R',
        bankAccount: {
          accountNumber: '2345678901',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank',
          branchName: 'Delhi CP'
        },
        storeName: 'Vision Care Hub',
        storeDescription: 'Affordable and stylish eyewear for everyone',
        isVerified: true,
        verifiedBy: admin._id,
        verifiedAt: new Date(),
        rating: 4.2,
        totalSales: 200,
        location: { type: 'Point', coordinates: [77.209, 28.6139] },
        address: {
          street: 'Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
          country: 'India'
        },
        serviceRadius: 10
      },
      {
        name: 'Amit Patel',
        email: 'lensstudio@gmail.com',
        phone: '9876543212',
        password: 'Seller123@',
        gstNumber: '24AABCU9605R1ZJ',
        aadharNumber: '345678901234',
        panNumber: 'AABCU9605R',
        bankAccount: {
          accountNumber: '3456789012',
          ifscCode: 'ICIC0001234',
          bankName: 'ICICI Bank',
          branchName: 'Ahmedabad'
        },
        storeName: 'Lens Studio',
        storeDescription: 'Designer frames and premium lenses',
        isVerified: true,
        verifiedBy: admin._id,
        verifiedAt: new Date(),
        rating: 4.7,
        totalSales: 100,
        location: { type: 'Point', coordinates: [72.5877, 23.0225] },
        address: {
          street: 'CG Road, Navrangpura',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '380009',
          country: 'India'
        },
        serviceRadius: 10
      },
      {
        name: 'Sneha Reddy',
        email: 'eyefashion@gmail.com',
        phone: '9876543213',
        password: 'Seller123@',
        gstNumber: '33AABCU9606R1ZI',
        aadharNumber: '456789012345',
        panNumber: 'AABCU9606R',
        bankAccount: {
          accountNumber: '4567890123',
          ifscCode: 'AXIS0001234',
          bankName: 'Axis Bank',
          branchName: 'Chennai'
        },
        storeName: 'Eye Fashion',
        storeDescription: 'Trendy sunglasses and fashion eyewear',
        isVerified: false,
        rating: 0,
        totalSales: 0,
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: {
          street: 'Brigade Road',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560025',
          country: 'India'
        },
        serviceRadius: 10
      }
    ]);
    console.log(`${sellers.length} sellers created`);

    // Create test executive
    const executive = await Executive.create({
      name: "Delivery Executive",
      email: "executive.delivery@optikart.com",
      password: "Executive123@",
      phone: "9876543220",
      department: "delivery",
      permissions: [{ module: "delivery", actions: ["view", "create", "edit", "delete"] }],
      isActive: true,
      createdBy: admin._id
    });
    console.log("Executive created:", executive.email);

    // Create a delivery partner so the admin-created partner login flow is
    // usable out of the box (admin panel can add more).
    const deliveryPartner = await DeliveryPartner.create({
      name: "Suresh Kumar",
      email: "suresh.partner@optikart.com",
      password: "Partner123@",
      phone: "9876543233",
      vehicleType: "bike",
      vehicleNumber: "MH12AB1234",
      licenseNumber: "MH1220200012345",
      aadharNumber: "123412341234",
      panNumber: "ABCDE1234F",
      bankDetails: {
        accountNumber: "987654321098",
        ifscCode: "HDFC0001234",
        bankName: "HDFC Bank",
        branchName: "Andheri East"
      },
      isActive: true,
      isVerified: true,
      status: "online",
      currentLocation: { latitude: 19.076, longitude: 72.8777 }
    });
    console.log("Delivery partner created:", deliveryPartner.email);

    // Staff accounts: a User (role 'staff') plus a StaffRole with the same
    // email, which is what verifyStaff looks up.
    const staffUser = await User.create({
      name: 'Priya Sharma',
      email: 'priya.staff@optikart.com',
      password: 'Staff123@',
      phone: '9876543244',
      role: 'staff'
    });
    const staffRole = await StaffRole.create({
      admin: admin._id,
      email: staffUser.email,
      name: staffUser.name,
      role: 'seller_manager',
      permissions: ['products:read', 'products:verify', 'sellers:read']
    });
    console.log("Staff account created:", staffRole.email);

    // Create test manufacturer
    const manufacturer = await Manufacturer.create({
      name: "Ray-Ban Admin",
      email: "rayban.manufacturer@optikart.com",
      password: "Manufacturer123@",
      phone: "9876543221",
      companyName: "Ray-Ban Manufacturing",
      gstNumber: "29AABCU9603R1ZM",
      panNumber: "AABCU9603R",
      address: {
        street: "123 Manufacturing St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001"
      },
      brands: ["Ray-Ban"],
      isActive: true,
      createdBy: admin._id
    });
    console.log("Manufacturer created:", manufacturer.email);

    // Create test manufacturer seller
    const manufacturerSeller = await ManufacturerSeller.create({
      name: "Ray-Ban Retailer",
      email: "rayban.retailer1@optikart.com",
      password: "Retailer123@",
      phone: "9876543222",
      storeName: "Ray-Ban Retail Store 1",
      storeAddress: {
        street: "456 Retail St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400002"
      },
      manufacturerCode: "RB-RET-001",
      manufacturer: manufacturer._id,
      gstNumber: "27AABCU9604R1ZK",
      panNumber: "AABCU9604R",
      bankDetails: {
        accountNumber: "1234567890",
        ifscCode: "SBIN0001234",
        bankName: "State Bank of India",
        branchName: "Mumbai Main"
      },
      isActive: true,
      createdBy: manufacturer._id
    });
    console.log("Manufacturer seller created:", manufacturerSeller.email);

    const products = await Product.create([
      {
        title: 'Ray-Ban Aviator Classic Sunglasses',
        description: 'Iconic aviator sunglasses with gold metal frame and green crystal lenses. UV400 protection. Lightweight and comfortable for all-day wear.',
        price: 8990,
        discountedPrice: 7192,
        images: ['/uploads/products/aviator-1.jpg', '/uploads/products/aviator-2.jpg'],
        category: 'sunglasses',
        brand: 'Ray-Ban',
        seller: sellers[0]._id,
        colors: [{ name: 'Gold/Green', hexCode: '#FFD700', images: [] }, { name: 'Silver/Blue', hexCode: '#C0C0C0', images: [] }],
        sizes: ['55mm', '58mm', '62mm'],
        materials: ['Metal'],
        frameType: 'Full Rim',
        frameShape: 'Aviator',
        frameColor: 'Gold',
        lensType: 'polarized',
        hasLenses: true,
        stock: 50,
        tags: ['aviator', 'classic', 'polarized', 'uv-protection'],
        features: ['UV400 Protection', 'Polarized Lenses', 'Lightweight Metal Frame', 'Includes Case'],
        dimensions: { width: 135, height: 50, bridge: 14, temple: 135 },
        weight: '28g',
        warranty: '2 years manufacturer warranty',
        gender: 'men',
        frameSize: 'medium'
      },
      {
        title: 'Ray-Ban Wayfarer Sunglasses',
        description: 'Classic Wayfarer design with acetate frame. Timeless style that suits all face shapes.',
        price: 9490,
        discountedPrice: 7592,
        images: ['/uploads/products/wayfarer-1.jpg'],
        category: 'sunglasses',
        brand: 'Ray-Ban',
        seller: sellers[0]._id,
        colors: [{ name: 'Black', hexCode: '#000000' }],
        sizes: ['50mm', '54mm'],
        materials: ['Acetate'],
        frameType: 'Full Rim',
        frameShape: 'Wayfarer',
        frameColor: 'Black',
        lensType: 'polarized',
        hasLenses: true,
        stock: 40,
        tags: ['wayfarer', 'classic', 'acetate'],
        features: ['UV400 Protection', 'Polarized', 'Acetate Frame', 'Iconic Design'],
        dimensions: { width: 140, height: 48, bridge: 18, temple: 150 },
        weight: '32g',
        warranty: '2 years',
        gender: 'men',
        frameSize: 'large'
      },
      {
        title: 'Fastrack Men\'s Aviator Sunglasses',
        description: 'Stylish aviator sunglasses with metal frame. Perfect for daily use and outdoor activities.',
        price: 1495,
        discountedPrice: 1196,
        images: ['/uploads/products/fastrack-aviator.jpg'],
        category: 'sunglasses',
        brand: 'Fastrack',
        seller: sellers[1]._id,
        colors: [{ name: 'Silver/Black', hexCode: '#C0C0C0' }, { name: 'Gold/Brown', hexCode: '#FFD700' }],
        sizes: ['58mm'],
        materials: ['Metal'],
        frameType: 'Full Rim',
        frameShape: 'Aviator',
        frameColor: 'Silver',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 100,
        tags: ['aviator', 'affordable', 'fastrack'],
        features: ['UV Protection', 'Metal Frame', 'Spring Hinges'],
        dimensions: { width: 138, height: 52, bridge: 14, temple: 130 },
        weight: '25g',
        warranty: '1 year',
        gender: 'men',
        frameSize: 'large'
      },
      {
        title: 'Fastrack Women\'s Cat Eye Sunglasses',
        description: 'Trendy cat eye sunglasses for women. Fashionable and lightweight.',
        price: 1295,
        discountedPrice: 999,
        images: ['/uploads/products/fastrack-cateye.jpg'],
        category: 'sunglasses',
        brand: 'Fastrack',
        seller: sellers[1]._id,
        colors: [{ name: 'Tortoise', hexCode: '#8B4513' }, { name: 'Black', hexCode: '#000000' }],
        sizes: ['54mm'],
        materials: ['Plastic'],
        frameType: 'Full Rim',
        frameShape: 'Cat Eye',
        frameColor: 'Tortoise',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 80,
        tags: ['cat-eye', 'women', 'fashion'],
        features: ['UV Protection', 'Lightweight', 'Trendy Design'],
        weight: '22g',
        warranty: '1 year',
        gender: 'women',
        frameSize: 'medium'
      },
      {
        title: 'Lenskart Air Flexi Round Eyeglasses',
        description: 'Lightweight titanium frame with flexible temples. Perfect for everyday use.',
        price: 2499,
        discountedPrice: 1999,
        images: ['/uploads/products/lenskart-air-1.jpg'],
        category: 'eyeglasses',
        brand: 'Lenskart Air',
        seller: sellers[2]._id,
        colors: [{ name: 'Matte Black', hexCode: '#1a1a1a' }, { name: 'Rose Gold', hexCode: '#B76E79' }],
        sizes: ['52mm', '54mm'],
        materials: ['Titanium'],
        frameType: 'Full Rim',
        frameShape: 'Round',
        frameColor: 'Matte Black',
        lensType: 'powered',
        hasLenses: false,
        poweredOptions: [
          { power: -1.0, cyl: 0, axis: 0, addition: 0 },
          { power: -2.0, cyl: -0.5, axis: 180, addition: 0 },
          { power: -3.0, cyl: -0.75, axis: 170, addition: 0 }
        ],
        stock: 60,
        tags: ['titanium', 'lightweight', 'flexible'],
        features: ['Ultra Lightweight', 'Flexible Temples', 'Anti-allergic', 'Rust-proof'],
        dimensions: { width: 130, height: 44, bridge: 18, temple: 140 },
        weight: '12g',
        warranty: '1 year',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Lenskart Air Rimless Eyeglasses',
        description: 'Ultra-light rimless design for a modern, sophisticated look.',
        price: 3499,
        discountedPrice: 2799,
        images: ['/uploads/products/lenskart-rimless.jpg'],
        category: 'eyeglasses',
        brand: 'Lenskart Air',
        seller: sellers[2]._id,
        colors: [{ name: 'Silver', hexCode: '#C0C0C0' }],
        sizes: ['54mm', '56mm'],
        materials: ['Titanium'],
        frameType: 'Rimless',
        frameShape: 'Rectangle',
        frameColor: 'Silver',
        lensType: 'powered',
        hasLenses: false,
        stock: 45,
        tags: ['rimless', 'titanium', 'premium'],
        features: ['Rimless Design', 'Ultra Light', 'Premium Titanium'],
        weight: '8g',
        warranty: '1 year',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'John Jacobs Urban Flex Eyeglasses',
        description: 'Premium acetate frame with flex hinges. Urban style meets comfort.',
        price: 3999,
        discountedPrice: 3199,
        images: ['/uploads/products/johnjacobs-1.jpg'],
        category: 'eyeglasses',
        brand: 'John Jacobs',
        seller: sellers[0]._id,
        colors: [{ name: 'Havana', hexCode: '#8B4513' }, { name: 'Tortoise', hexCode: '#654321' }],
        sizes: ['52mm', '54mm'],
        materials: ['Acetate'],
        frameType: 'Full Rim',
        frameShape: 'Rectangle',
        frameColor: 'Havana',
        lensType: 'powered',
        hasLenses: false,
        stock: 35,
        tags: ['acetate', 'premium', 'urban'],
        features: ['Flex Hinges', 'Premium Acetate', 'Anti-slip Nose Pads'],
        weight: '24g',
        warranty: '2 years',
        gender: 'men',
        frameSize: 'medium'
      },
      {
        title: 'John Jacobs Aviator Metal Eyeglasses',
        description: 'Classic aviator shape in lightweight metal. Professional and stylish.',
        price: 3499,
        discountedPrice: 2799,
        images: ['/uploads/products/johnjacobs-aviator.jpg'],
        category: 'eyeglasses',
        brand: 'John Jacobs',
        seller: sellers[0]._id,
        colors: [{ name: 'Gold', hexCode: '#FFD700' }, { name: 'Gunmetal', hexCode: '#2C3539' }],
        sizes: ['56mm', '58mm'],
        materials: ['Metal'],
        frameType: 'Full Rim',
        frameShape: 'Aviator',
        frameColor: 'Gold',
        lensType: 'powered',
        hasLenses: false,
        stock: 40,
        tags: ['aviator', 'metal', 'professional'],
        features: ['Lightweight Metal', 'Adjustable Nose Pads', 'Spring Hinges'],
        weight: '18g',
        warranty: '2 years',
        gender: 'men',
        frameSize: 'large'
      },
      {
        title: 'Vogue Women\'s Oversized Sunglasses',
        description: 'Glamorous oversized sunglasses with gradient lenses. Perfect for fashion-forward women.',
        price: 5990,
        discountedPrice: 4792,
        images: ['/uploads/products/vogue-oversized.jpg'],
        category: 'sunglasses',
        brand: 'Vogue',
        seller: sellers[1]._id,
        colors: [{ name: 'Black/Grey', hexCode: '#000000' }, { name: 'Brown/Tortoise', hexCode: '#8B4513' }],
        sizes: ['58mm'],
        materials: ['Acetate'],
        frameType: 'Full Rim',
        frameShape: 'Oversized',
        frameColor: 'Black',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 30,
        tags: ['oversized', 'women', 'glamorous'],
        features: ['Gradient Lenses', 'UV400 Protection', 'Oversized Design'],
        weight: '30g',
        warranty: '2 years',
        gender: 'women',
        frameSize: 'large'
      },
      {
        title: 'Vogue Cat Eye Eyeglasses',
        description: 'Chic cat eye frame with acetate construction. Elegant and feminine.',
        price: 4990,
        discountedPrice: 3992,
        images: ['/uploads/products/vogue-cateye.jpg'],
        category: 'eyeglasses',
        brand: 'Vogue',
        seller: sellers[1]._id,
        colors: [{ name: 'Tortoise', hexCode: '#8B4513' }, { name: 'Black', hexCode: '#000000' }],
        sizes: ['52mm', '54mm'],
        materials: ['Acetate'],
        frameType: 'Full Rim',
        frameShape: 'Cat Eye',
        frameColor: 'Tortoise',
        lensType: 'powered',
        hasLenses: false,
        stock: 25,
        tags: ['cat-eye', 'women', 'elegant'],
        features: ['Acetate Frame', 'Cat Eye Shape', 'Comfortable Fit'],
        weight: '26g',
        warranty: '2 years',
        gender: 'women',
        frameSize: 'small'
      },
      {
        title: 'Acuvue Moist Daily Contact Lenses',
        description: '30-pack daily disposable contact lenses with moisture technology. Comfortable all-day wear.',
        price: 1850,
        discountedPrice: 1599,
        images: ['/uploads/products/acuvue-moist.jpg'],
        category: 'contactlenses',
        brand: 'Acuvue',
        seller: sellers[2]._id,
        colors: [{ name: 'Clear', hexCode: '#FFFFFF' }],
        sizes: ['Daily 30-pack'],
        materials: ['Etafilcon A'],
        lensType: 'nonpowered',
        hasLenses: true,
        poweredOptions: [
          { power: -1.0, cyl: 0, axis: 0, addition: 0 },
          { power: -2.0, cyl: 0, axis: 0, addition: 0 },
          { power: -3.0, cyl: 0, axis: 0, addition: 0 },
          { power: -4.0, cyl: 0, axis: 0, addition: 0 }
        ],
        stock: 200,
        tags: ['daily', 'disposable', 'moisture'],
        features: ['Daily Disposable', 'Moisture Technology', 'UV Protection', '30 Lenses per Box'],
        weight: '50g',
        warranty: 'Until expiry date',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Bausch + Lomb SofLens Monthly Contacts',
        description: 'Monthly disposable contact lenses. High oxygen permeability for healthy eyes.',
        price: 999,
        discountedPrice: 799,
        images: ['/uploads/products/soflens.jpg'],
        category: 'contactlenses',
        brand: 'Bausch + Lomb',
        seller: sellers[2]._id,
        colors: [{ name: 'Clear', hexCode: '#FFFFFF' }],
        sizes: ['Monthly 6-pack'],
        materials: ['Hilafilcon B'],
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 150,
        tags: ['monthly', 'disposable', 'affordable'],
        features: ['Monthly Replacement', 'High Oxygen', 'ComfortFit Technology'],
        weight: '30g',
        warranty: 'Until expiry date',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Reading Glasses +2.0 Magnifying',
        description: 'Classic reading glasses with +2.0 magnification. Spring hinges for comfort.',
        price: 599,
        discountedPrice: 399,
        images: ['/uploads/products/reading-2.jpg'],
        category: 'readingglasses',
        brand: 'ClearVision',
        seller: sellers[1]._id,
        colors: [{ name: 'Black', hexCode: '#000000' }, { name: 'Brown', hexCode: '#8B4513' }],
        sizes: ['+1.0', '+1.5', '+2.0', '+2.5', '+3.0'],
        materials: ['Metal'],
        frameType: 'Full Rim',
        frameShape: 'Rectangle',
        frameColor: 'Black',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 120,
        tags: ['reading', 'magnifying', 'affordable'],
        features: ['Spring Hinges', 'Anti-scratch Lenses', 'Includes Case'],
        weight: '20g',
        warranty: '6 months',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Premium Blue Cut Reading Glasses',
        description: 'Reading glasses with blue light blocking technology. Perfect for screen time.',
        price: 1299,
        discountedPrice: 999,
        images: ['/uploads/products/bluecut-reading.jpg'],
        category: 'readingglasses',
        brand: 'EyeGuard',
        seller: sellers[2]._id,
        colors: [{ name: 'Matte Black', hexCode: '#1a1a1a' }],
        sizes: ['+1.0', '+1.5', '+2.0', '+2.5'],
        materials: ['TR90'],
        frameType: 'Full Rim',
        frameShape: 'Rectangle',
        frameColor: 'Matte Black',
        lensType: 'bluCut',
        hasLenses: true,
        stock: 90,
        tags: ['reading', 'blue-cut', 'screen'],
        features: ['Blue Light Blocking', 'TR90 Frame', 'Anti-glare', 'Lightweight'],
        weight: '18g',
        warranty: '1 year',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Sports Wraparound Sunglasses',
        description: 'High-performance sports sunglasses with anti-slip grip. Ideal for cycling and running.',
        price: 2499,
        discountedPrice: 1999,
        images: ['/uploads/products/sports-1.jpg'],
        category: 'sportseyewear',
        brand: 'SportFlex',
        seller: sellers[0]._id,
        colors: [{ name: 'Black/Red', hexCode: '#FF0000' }, { name: 'White/Blue', hexCode: '#0000FF' }],
        sizes: ['One Size'],
        materials: ['Polycarbonate'],
        frameType: 'Full Rim',
        frameShape: 'Wraparound',
        frameColor: 'Black',
        lensType: 'polarized',
        hasLenses: true,
        stock: 60,
        tags: ['sports', 'wraparound', 'polarized'],
        features: ['Polarized', 'Anti-slip Grip', 'Impact Resistant', 'Ventilation'],
        weight: '26g',
        warranty: '1 year',
        gender: 'men',
        frameSize: 'large'
      },
      {
        title: 'Swim Goggles Anti-Fog',
        description: 'Professional swimming goggles with anti-fog coating and UV protection.',
        price: 899,
        discountedPrice: 699,
        images: ['/uploads/products/swim-goggles.jpg'],
        category: 'sportseyewear',
        brand: 'AquaVision',
        seller: sellers[1]._id,
        colors: [{ name: 'Clear/Blue', hexCode: '#0000FF' }, { name: 'Smoke/Black', hexCode: '#000000' }],
        sizes: ['Adult', 'Junior'],
        materials: ['Silicone'],
        frameType: 'Full Rim',
        frameShape: 'Oval',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 75,
        tags: ['swimming', 'anti-fog', 'sports'],
        features: ['Anti-fog Coating', 'UV Protection', 'Silicone Seal', 'Adjustable Strap'],
        weight: '45g',
        warranty: '6 months',
        gender: 'unisex',
        frameSize: 'small'
      },
      {
        title: 'Kids Flexible Frame Eyeglasses',
        description: 'Durable and flexible frames designed for active kids. Safe and comfortable.',
        price: 1499,
        discountedPrice: 1199,
        images: ['/uploads/products/kids-frame.jpg'],
        category: 'kids',
        brand: 'KidzOptix',
        seller: sellers[1]._id,
        colors: [{ name: 'Blue', hexCode: '#0000FF' }, { name: 'Pink', hexCode: '#FFC0CB' }, { name: 'Green', hexCode: '#00FF00' }],
        sizes: ['44mm', '46mm'],
        materials: ['TR90'],
        frameType: 'Full Rim',
        frameShape: 'Round',
        frameColor: 'Blue',
        lensType: 'powered',
        hasLenses: false,
        stock: 50,
        tags: ['kids', 'flexible', 'durable'],
        features: ['Flexible Frame', 'Impact Resistant', 'Hypoallergenic', 'Adjustable Temples'],
        weight: '14g',
        warranty: '1 year',
        gender: 'kids',
        frameSize: 'small'
      },
      {
        title: 'Kids Sunglasses UV Protection',
        description: 'Fun and protective sunglasses for children. 100% UV protection.',
        price: 799,
        discountedPrice: 599,
        images: ['/uploads/products/kids-sunglasses.jpg'],
        category: 'kids',
        brand: 'KidzOptix',
        seller: sellers[1]._id,
        colors: [{ name: 'Red', hexCode: '#FF0000' }, { name: 'Blue', hexCode: '#0000FF' }],
        sizes: ['One Size'],
        materials: ['Polycarbonate'],
        frameType: 'Full Rim',
        frameShape: 'Round',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 80,
        tags: ['kids', 'sunglasses', 'uv-protection'],
        features: ['100% UV Protection', 'Shatterproof', 'Flexible Frame', 'Elastic Band'],
        weight: '16g',
        warranty: '6 months',
        gender: 'kids',
        frameSize: 'small'
      },
      {
        title: 'Photochromic Transition Eyeglasses',
        description: 'Smart lenses that adapt to light conditions. Clear indoors, dark outdoors.',
        price: 4999,
        discountedPrice: 3999,
        images: ['/uploads/products/photochromic.jpg'],
        category: 'eyeglasses',
        brand: 'TransVision',
        seller: sellers[2]._id,
        colors: [{ name: 'Silver', hexCode: '#C0C0C0' }],
        sizes: ['52mm', '54mm', '56mm'],
        materials: ['Metal'],
        frameType: 'Full Rim',
        frameShape: 'Rectangle',
        frameColor: 'Silver',
        lensType: 'photochromic',
        hasLenses: true,
        stock: 30,
        tags: ['photochromic', 'transition', 'smart'],
        features: ['Auto-darkening', 'UV Protection', 'Anti-glare', 'Scratch Resistant'],
        weight: '20g',
        warranty: '2 years',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Premium Progressive Eyeglasses',
        description: 'Multi-focal progressive lenses for presbyopia correction. Seamless vision at all distances.',
        price: 6999,
        discountedPrice: 5599,
        images: ['/uploads/products/progressive.jpg'],
        category: 'eyeglasses',
        brand: 'VisionPro',
        seller: sellers[0]._id,
        colors: [{ name: 'Gunmetal', hexCode: '#2C3539' }],
        sizes: ['52mm', '54mm'],
        materials: ['Titanium'],
        frameType: 'Full Rim',
        frameShape: 'Rectangle',
        frameColor: 'Gunmetal',
        lensType: 'powered',
        hasLenses: false,
        poweredOptions: [
          { power: -2.0, cyl: -1.0, axis: 180, addition: 2.0 },
          { power: -3.0, cyl: -0.75, axis: 170, addition: 2.5 }
        ],
        stock: 20,
        tags: ['progressive', 'multi-focal', 'premium'],
        features: ['Progressive Lenses', 'Wide Vision Zone', 'Anti-glare', 'Blue Light Filter'],
        weight: '16g',
        warranty: '2 years',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Ray-Ban Clubmaster Sunglasses',
        description: 'Retro-inspired browline sunglasses. A perfect blend of vintage and modern style.',
        price: 10990,
        discountedPrice: 8792,
        images: ['/uploads/products/clubmaster.jpg'],
        category: 'sunglasses',
        brand: 'Ray-Ban',
        seller: sellers[0]._id,
        colors: [{ name: 'Black/Gold', hexCode: '#000000' }],
        sizes: ['49mm', '51mm'],
        materials: ['Metal/Acetate'],
        frameType: 'Full Rim',
        frameShape: 'Browline',
        frameColor: 'Black',
        lensType: 'polarized',
        hasLenses: true,
        stock: 25,
        tags: ['clubmaster', 'retro', 'browline'],
        features: ['Polarized', 'UV400', 'Browline Design', 'Premium Case Included'],
        weight: '30g',
        warranty: '2 years',
        gender: 'men',
        frameSize: 'medium'
      },
      {
        title: 'Fastrack Retro Round Sunglasses',
        description: 'Retro round sunglasses with tinted lenses. Perfect for a vintage look.',
        price: 1195,
        discountedPrice: 899,
        images: ['/uploads/products/fastrack-retro.jpg'],
        category: 'sunglasses',
        brand: 'Fastrack',
        seller: sellers[1]._id,
        colors: [{ name: 'Gold/Yellow', hexCode: '#FFD700' }, { name: 'Silver/Grey', hexCode: '#C0C0C0' }],
        sizes: ['52mm'],
        materials: ['Metal'],
        frameType: 'Full Rim',
        frameShape: 'Round',
        frameColor: 'Gold',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 70,
        tags: ['retro', 'round', 'vintage'],
        features: ['Tinted Lenses', 'UV Protection', 'Metal Frame'],
        weight: '22g',
        warranty: '1 year',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Anti-Glare Computer Glasses',
        description: 'Computer glasses with anti-glare coating. Reduces eye strain during long screen sessions.',
        price: 1799,
        discountedPrice: 1399,
        images: ['/uploads/products/computer-glasses.jpg'],
        category: 'eyeglasses',
        brand: 'ScreenShield',
        seller: sellers[2]._id,
        colors: [{ name: 'Black', hexCode: '#000000' }, { name: 'Tortoise', hexCode: '#8B4513' }],
        sizes: ['52mm', '54mm'],
        materials: ['TR90'],
        frameType: 'Full Rim',
        frameShape: 'Rectangle',
        frameColor: 'Black',
        lensType: 'bluCut',
        hasLenses: true,
        stock: 100,
        tags: ['computer', 'anti-glare', 'blue-cut'],
        features: ['Anti-glare', 'Blue Light Filter', 'Lightweight TR90', 'Ergonomic Design'],
        weight: '18g',
        warranty: '1 year',
        gender: 'unisex',
        frameSize: 'medium'
      },
      {
        title: 'Half-Rim Reading Glasses',
        description: 'Elegant half-rim reading glasses. Lightweight and sophisticated.',
        price: 899,
        discountedPrice: 699,
        images: ['/uploads/products/halfrim-reading.jpg'],
        category: 'readingglasses',
        brand: 'ClearVision',
        seller: sellers[1]._id,
        colors: [{ name: 'Gold', hexCode: '#FFD700' }, { name: 'Silver', hexCode: '#C0C0C0' }],
        sizes: ['+1.0', '+1.5', '+2.0', '+2.5', '+3.0'],
        materials: ['Metal'],
        frameType: 'Half Rim',
        frameShape: 'Rectangle',
        frameColor: 'Gold',
        lensType: 'nonpowered',
        hasLenses: true,
        stock: 85,
        tags: ['reading', 'half-rim', 'elegant'],
        features: ['Half Rim Design', 'Lightweight', 'Spring Hinges'],
        weight: '16g',
        warranty: '6 months',
        gender: 'unisex',
        frameSize: 'small'
      }
    ]);
    console.log(`${products.length} products created`);

    // Seed data expresses the frame material as a `materials` list; the schema
    // filters on the single-value `frameMaterial` enum. Backfill it so the
    // material facet on the storefront returns results.
    const MATERIAL_TO_ENUM = {
      'stainless steel': 'stainless-steel',
      'stainless-steel': 'stainless-steel',
      'acetate': 'acetate',
      'metal': 'metal',
      'polycarbonate': 'polycarbonate',
      'tr90': 'tr90',
      'titanium': 'titanium',
      'plastic': 'plastic',
      'wood': 'wood'
    };
    for (const prod of products) {
      if (prod.frameMaterial) continue;
      const first = (prod.materials && prod.materials[0]) || '';
      const mapped = MATERIAL_TO_ENUM[String(first).toLowerCase().trim()];
      if (mapped) {
        prod.frameMaterial = mapped;
        await prod.save();
      }
    }
    console.log('Backfilled frameMaterial from materials list');

    // Approve the seeded catalogue so it is visible on the storefront. Use the
    // admin Product Verification screen to un-verify items and exercise that flow.
    await Product.updateMany({}, { verificationStatus: 'verified', verifiedAt: new Date() });
    console.log('Marked catalogue as verified');

    // Give eyewear products real colour/size/price variants. Without these there
    // is no per-variant stock to sell against, and the seller inventory screens
    // have nothing to manage.
    const VARIANT_PLAN = {
      sunglasses: {
        colors: [
          { name: 'Black', hex: '#111111' },
          { name: 'Tortoise', hex: '#8B5A2B' },
          { name: 'Gold', hex: '#C9A227' }
        ],
        sizes: ['S', 'M', 'L'],
        priceSteps: { S: -500, M: 0, L: 500 }
      },
      eyeglasses: {
        colors: [
          { name: 'Matte Black', hex: '#1c1c1c' },
          { name: 'Crystal', hex: '#E8E8E8' },
          { name: 'Rose Gold', hex: '#B76E79' }
        ],
        sizes: ['Small', 'Medium', 'Large'],
        priceSteps: { Small: -400, Medium: 0, Large: 400 }
      },
      readingglasses: {
        colors: [{ name: 'Black', hex: '#111111' }, { name: 'Blue', hex: '#2874f0' }],
        sizes: ['Medium'],
        priceSteps: { Medium: 0 }
      },
      sportseyewear: {
        colors: [{ name: 'Neon Green', hex: '#39FF14' }, { name: 'Orange', hex: '#FF7F00' }],
        sizes: ['One Size'],
        priceSteps: { 'One Size': 0 }
      },
      kids: {
        colors: [{ name: 'Pink', hex: '#FFB6C1' }, { name: 'Blue', hex: '#64B5F6' }],
        sizes: ['XS', 'S'],
        priceSteps: { XS: -200, S: 0 }
      }
    };

    let variantised = 0;
    for (const prod of products) {
      if (prod.category === 'contactlenses') continue;
      const plan = VARIANT_PLAN[prod.category];
      if (!plan) continue;

      const base = prod.discountedPrice || prod.price;
      const variants = [];
      for (const color of plan.colors) {
        for (const size of plan.sizes) {
          const step = plan.priceSteps[size] || 0;
          variants.push({
            color: color.name,
            size,
            gender: prod.gender || 'unisex',
            price: Math.max(99, base + step),
            originalPrice: Math.max(99, (prod.originalPrice || prod.price) + step),
            stock: 8 + ((color.name.length + size.length) % 14),
            sku: `${(prod.modelNumber || prod.title.slice(0, 6)).toString().replace(/\s+/g, '').toUpperCase()}-${color.name.split(' ')[0].slice(0, 3).toUpperCase()}-${size.slice(0, 3).toUpperCase()}`,
            isActive: true
          });
        }
      }

      prod.variants = variants;
      prod.colors = plan.colors.map((c) => ({ name: c.name, hexCode: c.hex, images: [] }));
      prod.sizes = plan.sizes;
      prod.stock = variants.reduce((sum, v) => sum + v.stock, 0);
      await prod.save();
      variantised += 1;
    }
    console.log(`Added colour/size variants to ${variantised} products`);

    // Seed references placeholder image paths; generate real PNG product
    // images so the marketplace never renders broken pictures.
    try {
      const pathMod = await import('path');
      const fsMod = await import('fs');
      const zlibMod = await import('zlib');
      const { fileURLToPath } = await import('url');
      const dir = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), 'uploads', 'products');
      fsMod.mkdirSync(dir, { recursive: true });

      const crcTable = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
      const crc32 = (buf) => {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
      const pngChunk = (type, data) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(body), 0);
        return Buffer.concat([len, body, crc]);
      };
      // Solid colour PNG; the product name is shown as text by the UI itself.
      const makePng = (file, rgb) => {
        const w = 600, h = 600;
        const pixel = Buffer.from(Uint8Array.from(rgb));
        const row = Buffer.alloc(1 + w * 3);
        row[0] = 0;
        for (let x = 0; x < w; x++) pixel.copy(row, 1 + x * 3);
        const raw = Buffer.concat(Array.from({ length: h }, () => row));
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(w, 0);
        ihdr.writeUInt32BE(h, 4);
        ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
        fsMod.writeFileSync(file, Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          pngChunk('IHDR', ihdr),
          pngChunk('IDAT', zlibMod.deflateSync(raw, { level: 9 })),
          pngChunk('IEND', Buffer.alloc(0))
        ]));
      };

      const palettes = [
        [0x28, 0x74, 0xf0], [0x66, 0x7e, 0xea], [0xf5, 0x57, 0x6c],
        [0x43, 0xe9, 0x7b], [0x4f, 0xac, 0xfe], [0xff, 0x9f, 0x00],
        [0x0a, 0x25, 0x40], [0x76, 0x4b, 0xa2]
      ];

      const productImages = await Product.find({}).select('images title').lean();
      let made = 0;
      for (const prod of productImages) {
        const seedNum = [...String(prod.title || 'eyewear')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        const base = palettes[seedNum % palettes.length];
        let idx = 0;
        for (const rel of prod.images || []) {
          if (typeof rel !== 'string' || !rel.startsWith('/uploads/products/')) continue;
          const file = pathMod.join(dir, pathMod.basename(rel));
          if (fsMod.existsSync(file)) continue;
          // Slight tint per gallery slot so multi-image products look distinct.
          const tint = base.map((v) => Math.max(0, Math.min(255, v - idx * 28)));
          makePng(file, tint);
          made += 1;
          idx += 1;
        }
      }
      console.log(`Generated ${made} placeholder product images`);
    } catch (imgErr) {
      console.log('Placeholder image note:', imgErr.message);
    }

    // Mark the eyewear brands as manufacturer-added catalogue so the home page
    // can show products grouped brand-wise (manufacturers, not seller picks).
    const manufacturerBrands = ['Ray-Ban', 'Fastrack', 'Lenskart Air', 'John Jacobs', 'Vogue'];
    await Product.updateMany(
      { brand: { $in: manufacturerBrands } },
      { manufacturer: manufacturer._id, isManufacturerProduct: true }
    );
    manufacturer.brands = manufacturerBrands;
    await manufacturer.save();
    console.log(`Manufacturer products tagged for brands: ${manufacturerBrands.join(', ')}`);

    const coupons = await Coupon.create([
      {
        code: 'WELCOME10',
        description: '10% off on your first order',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 500,
        maxDiscount: 500,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        usageLimit: 1000,
        isActive: true
      },
      {
        code: 'SUMMER200',
        description: 'Flat ₹200 off on orders above ₹1500',
        discountType: 'fixed',
        discountValue: 200,
        minOrderAmount: 1500,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        usageLimit: 500,
        isActive: true
      },
      {
        code: 'EYEWEAR25',
        description: '25% off on sunglasses',
        discountType: 'percentage',
        discountValue: 25,
        minOrderAmount: 1000,
        maxDiscount: 1000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: 200,
        applicableCategories: ['sunglasses'],
        isActive: true
      },
      {
        code: 'FREESHIP',
        description: 'Free delivery on all orders',
        discountType: 'fixed',
        discountValue: 16,
        minOrderAmount: 299,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        usageLimit: 5000,
        isActive: true
      }
    ]);
    console.log(`${coupons.length} coupons created`);

    const helpArticles = await HelpArticle.create([
      {
        title: 'How to place an order',
        content: 'Browse products, add items to cart, proceed to checkout, enter shipping address, and complete payment.',
        category: 'user_orders',
        forRole: 'user',
        faq: true,
        question: 'How do I place an order?',
        answer: 'Browse products, add to cart, checkout, enter address, and pay.'
      },
      {
        title: 'How to return a product',
        content: 'Go to My Orders, select the order, click Return. Fill in the reason and submit. Pickup will be scheduled within 48 hours.',
        category: 'user_returns',
        forRole: 'user',
        faq: true,
        question: 'How can I return a product?',
        answer: 'Go to My Orders > Select order > Click Return > Fill reason > Submit.'
      },
      {
        title: 'How to upload prescription',
        content: 'During checkout or in your account settings, you can upload your prescription. We accept images and PDF files.',
        category: 'user_prescription',
        forRole: 'user',
        faq: true,
        question: 'How do I upload my prescription?',
        answer: 'Upload during checkout or in account settings. We accept images and PDFs.'
      },
      {
        title: 'Account management',
        content: 'Update your profile, addresses, and preferences from the Account Settings page.',
        category: 'user_account',
        forRole: 'user'
      },
      {
        title: 'Getting started as a seller',
        content: 'Register with your business details, complete KYC verification, subscribe to the platform, and start listing products.',
        category: 'seller_general',
        forRole: 'seller',
        faq: true,
        question: 'How do I start selling?',
        answer: 'Register > Complete KYC > Subscribe > Start listing products.'
      },
      {
        title: 'Managing orders',
        content: 'View incoming orders in your dashboard. Confirm, pack, and hand over to the pickup partner. Track order status in real-time.',
        category: 'seller_orders',
        forRole: 'seller'
      },
      {
        title: 'Shipping and delivery',
        content: 'We use Shiprocket for shipping. Pickup is scheduled automatically once you pack the order. Delivery charge is ₹16 per item.',
        category: 'seller_shipping',
        forRole: 'seller'
      }
    ]);
    console.log(`${helpArticles.length} help articles created`);

    const blogs = await Blog.create([
      {
        title: 'How to Choose the Right Eyeglasses for Your Face Shape',
        slug: 'choose-eyeglasses-face-shape',
        content: 'Choosing the right eyeglasses depends on your face shape. For round faces, go for angular frames. For square faces, choose round or oval frames. Heart-shaped faces look great with cat-eye or rimless frames. Oval faces can pull off almost any frame style. Visit our store to try different styles and find your perfect match.',
        excerpt: 'Find the perfect frames for your face shape with our comprehensive guide.',
        coverImage: '/uploads/blogs/face-shape-guide.jpg',
        author: admin._id,
        category: 'style-guide',
        tags: ['eyeglasses', 'face-shape', 'style'],
        isPublished: true,
        views: 150,
        likes: 45
      },
      {
        title: 'Understanding Your Eye Prescription',
        slug: 'understanding-eye-prescription',
        content: 'Your eye prescription contains important information about your vision needs. SPH (Sphere) indicates the lens power needed. CYL (Cylinder) corrects astigmatism. AXIS shows the orientation. ADD is for reading addition in progressive lenses. Understanding these values helps you choose the right lenses for your needs.',
        excerpt: 'Learn to read and understand your eye prescription values.',
        coverImage: '/uploads/blogs/eye-prescription.jpg',
        author: admin._id,
        category: 'eye-care',
        tags: ['prescription', 'lenses', 'eye-care'],
        isPublished: true,
        views: 230,
        likes: 67
      },
      {
        title: 'Top 10 Sunglasses Trends for 2024',
        slug: 'sunglasses-trends-2024',
        content: 'Stay ahead of the curve with these top sunglasses trends. 1. Oversized frames 2. Retro cat-eye 3. Transparent frames 4. Aviator classics 5. Sporty wraparound 6. Geometric shapes 7. Colored lenses 8. Rimless designs 9. Eco-friendly materials 10. Smart sunglasses with tech features.',
        excerpt: 'Discover the hottest sunglasses trends that are dominating 2024.',
        coverImage: '/uploads/blogs/sunglasses-trends.jpg',
        author: admin._id,
        category: 'trends',
        tags: ['sunglasses', 'trends', 'fashion'],
        isPublished: true,
        views: 320,
        likes: 89
      },
      {
        title: 'Blue Light Protection: Do You Need It?',
        slug: 'blue-light-protection-guide',
        content: 'With increasing screen time, blue light protection has become essential. Blue light from screens can cause eye strain, headaches, and disrupt sleep. Blue cut lenses filter harmful blue light while allowing beneficial light through. If you spend more than 4 hours daily on screens, blue cut lenses are recommended.',
        excerpt: 'Everything you need to know about blue light and eye protection.',
        coverImage: '/uploads/blogs/blue-light.jpg',
        author: admin._id,
        category: 'eye-care',
        tags: ['blue-light', 'computer-glasses', 'eye-care'],
        isPublished: true,
        views: 180,
        likes: 52
      }
    ]);
    console.log(`${blogs.length} blog posts created`);

    console.log('\n=== Seed completed successfully! ===');
    console.log('Executive login: executive.delivery@optikart.com / Executive123@');
    console.log('Manufacturer login: rayban.manufacturer@optikart.com / Manufacturer123@');
    console.log('Manufacturer seller login: rayban.retailer1@optikart.com / Retailer123@');
    console.log('Admin login: samedayopticians@gmail.com / Sameday123@');
    console.log('Test user logins: testuser@optikart.com / Test123@, demo@optikart.com / Demo123@');
    const sellerEmails = sellers.map((s) => s.email).join(', ');

    // One consolidated block: every seeded principal, where to sign in, and the
    // password - so any panel can be opened without hunting through this file.
    // Publish each seller's stock of every eyewear product they can fulfil, so
    // proximity routing has real candidates to offer an order to.
    await SellerStock.deleteMany({});
    try {
      const stockable = await Product.find({ isActive: true, category: { $ne: 'contactlenses' } })
        .select('brand modelNumber category seller variants price discountedPrice').lean();
      const rows = [];
      for (const p of stockable) {
        // Every seller except the owner also lists it, at a small price spread.
        for (const sl of sellers) {
          const idx = sellers.findIndex((x) => String(x._id) === String(sl._id));
          const base = p.discountedPrice || p.price;
          const selling = Math.max(99, base + (idx - 1) * 100);
          rows.push({
            seller: sl._id,
            product: p._id,
            brand: p.brand,
            modelNumber: p.modelNumber || '',
            category: p.category,
            sellingPrice: selling,
            mrp: p.price,
            totalStock: (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0),
            variants: (p.variants || []).map((v) => ({
              color: v.color || '', size: v.size || '', stock: v.stock || 0, price: v.price || selling
            })),
            isListed: true
          });
        }
      }
      if (rows.length) await SellerStock.insertMany(rows, { ordered: false });
      console.log(`Published ${rows.length} seller stock listings for routing`);
    } catch (stockErr) {
      console.log('Seller stock seeding note:', stockErr.message);
    }

    console.log([
      '',
      '================================================================',
      '  DEMO LOGINS (seeded, development only)',
      '================================================================',
      '  Customer             http://localhost:3000/login',
      '     demo@optikart.com  / Demo123@',
      `  Seller               http://localhost:3000/seller/login`,
      `     ${sellers[0]?.email || 'n/a'}  / Seller123@   (also: ${sellerEmails})`,
      `  Admin                http://localhost:3000/admin/login`,
      `     ${admin.email}  / Sameday123@`,
      `  Staff                http://localhost:3000/staff/login`,
      `     ${staffUser.email}  / Staff123@`,
      `  Executive (delivery) http://localhost:3000/executive/login`,
      `     ${executive.email}  / Executive123@`,
      `  Manufacturer         http://localhost:3000/manufacturer/login`,
      `     ${manufacturer.email}  / Manufacturer123@`,
      `  Manufacturer seller  http://localhost:3000/manufacturer-seller/login`,
      `     ${manufacturerSeller.email}  / Retailer123@`,
      `  Delivery partner     http://localhost:3000/delivery-partner/login`,
      `     ${deliveryPartner.email}  / Partner123@`,
      '================================================================',
      '  Seed test accounts skip the email OTP step in development.',
      '  Set NODE_ENV=production (or AUTH_OTP_BYPASS=false) to require it.',
      '================================================================',
      ''
    ].join('\n'));

  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
};

export { seedDatabase };

// Allow running standalone
if (process.argv[1] && process.argv[1].includes('seed')) {
  (async () => {
    try {
      console.log('Connecting to MongoDB...');
      console.log('URI:', process.env.MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') || 'Not set');
      
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      });
      
      console.log('Connected to MongoDB');
      await seedDatabase();
      console.log('\n✅ Database seeded successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error connecting to MongoDB:\n');
      
      if (error.message.includes('IP') || error.message.includes('whitelist')) {
        console.error('🔧 FIX: Your IP address is not whitelisted in MongoDB Atlas');
        console.error('   1. Go to: https://cloud.mongodb.com/');
        console.error('   2. Click "Network Access" in left sidebar');
        console.error('   3. Click "Add IP Address"');
        console.error('   4. Click "Allow Access from Anywhere" (0.0.0.0/0)');
        console.error('   5. Click "Confirm"');
        console.error('   6. Wait 1-2 minutes and try again\n');
      } else if (error.message.includes('bad auth') || error.message.includes('Authentication')) {
        console.error('🔧 FIX: Invalid MongoDB username or password');
        console.error('   1. Check your MONGODB_URI in .env file');
        console.error('   2. Go to MongoDB Atlas → Database Access');
        console.error('   3. Reset your database user password');
        console.error('   4. Update .env with new password\n');
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('🔧 FIX: Cannot resolve MongoDB cluster address');
        console.error('   1. Check your internet connection');
        console.error('   2. Verify cluster name in MONGODB_URI');
        console.error('   3. Try flushing DNS: ipconfig /flushdns (Windows)\n');
      } else {
        console.error('Error details:', error.message);
        console.error('\n🔧 Check your MONGODB_URI in .env file');
        console.error('   Format: mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/eyewear-platform\n');
      }
      
      process.exit(1);
    }
  })();
}
