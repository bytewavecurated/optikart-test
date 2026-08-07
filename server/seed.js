import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Seller from './models/Seller.js';
import Product from './models/Product.js';
import Coupon from './models/Coupon.js';
import HelpArticle from './models/HelpArticle.js';
import Blog from './models/Blog.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await User.deleteMany({});
    await Seller.deleteMany({});
    await Product.deleteMany({});
    await Coupon.deleteMany({});
    await HelpArticle.deleteMany({});
    await Blog.deleteMany({});
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
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        rating: 4.5,
        totalSales: 150
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
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        rating: 4.2,
        totalSales: 200
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
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        rating: 4.7,
        totalSales: 100
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
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        rating: 0,
        totalSales: 0
      }
    ]);
    console.log(`${sellers.length} sellers created`);

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
        frameType: 'N/A',
        frameShape: 'N/A',
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
        frameType: 'N/A',
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
        title: 'Subscription plans',
        content: 'Monthly subscription of ₹590 (including GST) gives you access to sell on the platform. Auto-renewal available.',
        category: 'seller_subscription',
        forRole: 'seller',
        faq: true,
        question: 'What are the subscription charges?',
        answer: '₹590/month (₹500 + ₹90 GST) with auto-renewal.'
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
    console.log('Admin login: samedayopticians@gmail.com / Sameday123@');
    console.log('Test user logins: testuser@optikart.com / Test123@, demo@optikart.com / Demo123@');
    console.log('Seller logins: opticalworld@gmail.com, visioncare@gmail.com, lensstudio@gmail.com, eyefashion@gmail.com / Seller123@');

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
