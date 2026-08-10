# OptiKart Admin & Feature Guide

## Table of Contents
1. [Staff Management & Access Control](#staff-management--access-control)
2. [Help & Support Ticket System](#help--support-ticket-system)
3. [Product Variations (Color & Size)](#product-variations-color--size)
4. [Guest Browsing](#guest-browsing)
5. [Seller Signup with OTP Verification](#seller-signup-with-otp-verification)
6. [Banner Management](#banner-management)
7. [Carousel Brand Linking](#carousel-brand-linking)
8. [Data Access & Management](#data-access--management)

---

## Staff Management & Access Control

### How Staff Login Works

When you create a staff member in the admin panel:

1. **Create Staff Account**
   - Go to Admin Panel → Staff Management
   - Click "Add Staff Member"
   - Enter email, name, and assign role (e.g., "blog_manager", "support_agent")
   - System generates a temporary password and sends it to the staff email

2. **Staff Login URL**
   - Staff members login at: `http://localhost:3000/staff/login`
   - They use their email and the password provided
   - First login requires password change

3. **Access Control**
   - Each staff role has specific permissions:
     - `blog_manager`: Can only access blog management
     - `support_agent`: Can only access help & support tickets
     - `product_manager`: Can only access product management
     - `order_manager`: Can only access order management
   - Staff cannot access admin-only features
   - All staff actions are logged for audit

### Creating Custom Roles

You can create custom roles with specific permissions:

```javascript
// Example: Create a "coupon_manager" role
{
  name: "coupon_manager",
  permissions: ["coupons.view", "coupons.create", "coupons.edit", "coupons.delete"]
}
```

---

## Help & Support Ticket System

### For Customers/Sellers

1. **Submit a Query**
   - Go to Help Center → Contact Us
   - Fill out the form with:
     - Subject
     - Category (Order Issue, Product Query, Technical Support, etc.)
     - Description
     - Attachments (optional)
   - Submit the form

2. **Track Tickets**
   - Customers can view their tickets in: Profile → My Tickets
   - Each ticket has a unique ID (e.g., `TKT-12345`)
   - Status updates: Open → In Progress → Resolved → Closed

### For Admin/Staff

1. **View All Tickets**
   - Admin Panel → Help & Support
   - See all tickets with filters:
     - Status (Open, In Progress, Resolved, Closed)
     - Priority (Low, Medium, High, Urgent)
     - Category
     - Date range

2. **Assign Tickets**
   - Click on a ticket
   - Assign to a support agent (staff with "support_agent" role)
   - Add internal notes (not visible to customer)
   - Change priority and status

3. **Respond to Tickets**
   - Type response in the reply box
   - Attach files if needed
   - Customer receives email notification
   - Conversation thread is maintained

4. **Ticket Actions**
   - **Resolve**: Mark as resolved (customer can reopen within 7 days)
   - **Close**: Permanently close the ticket
   - **Escalate**: Mark as urgent and notify admin
   - **Transfer**: Reassign to different agent

### Setting Up Support Staff

1. Create staff account with "support_agent" role
2. Staff logs in at `/staff/login`
3. They see only the Help & Support section
4. Tickets are automatically distributed among available agents
5. Admin can monitor response times and resolution rates

---

## Product Variations (Color & Size)

### How It Works

When a product has multiple colors and sizes:

1. **Color Selection**
   - Product page shows color swatches
   - Click a color to:
     - Update main product images
     - Show color-specific images (if uploaded)
     - Update price (if different per color)

2. **Size Selection**
   - Available sizes shown as buttons
   - Out-of-stock sizes are grayed out
   - Selected size is highlighted

3. **Add to Cart**
   - Selected color and size are saved with the cart item
   - Cart shows: "Product Name - Black, Size M"
   - Checkout maintains these selections

### Adding Product Variations (Seller)

1. **Upload Product**
   - Go to Seller Dashboard → Add Product
   - Fill basic details (name, price, description)

2. **Add Colors**
   - Click "Add Color"
   - Enter color name (e.g., "Black", "Navy Blue")
   - Select hex code or upload color swatch
   - Upload color-specific images (optional)
   - Repeat for all colors

3. **Add Sizes**
   - Enter sizes (e.g., "S", "M", "L", "XL")
   - Set stock for each size
   - Set price variation (if any)

4. **Save Product**
   - Product is saved with all variations
   - Customers can select any combination

### Example

```
Product: Ray-Ban Aviator Sunglasses
Colors: Black, Gold, Silver
Sizes: 55mm, 58mm, 62mm

Customer selects: Gold, 58mm
→ Shows gold frame images
→ Price: ₹8,500
→ Added to cart as "Ray-Ban Aviator - Gold, 58mm"
```

---

## Guest Browsing

### What Guests Can Do

Without logging in, users can:

✅ **Browse Products**
- View all products and categories
- Use search and filters
- View product details
- See product images (all colors)
- Read reviews and ratings

✅ **Compare Products**
- Add products to comparison
- View side-by-side comparison

✅ **View Cart**
- Add items to cart (stored in browser)
- View cart contents
- Update quantities

✅ **Wishlist (Limited)**
- Add items to wishlist (stored in browser)
- View wishlist

### What Requires Login

❌ **Checkout**
- Must login to complete purchase
- Cart is preserved after login

❌ **Persistent Wishlist**
- Wishlist is saved to account only after login
- Guest wishlist is lost on browser clear

❌ **Order History**
- Must login to view past orders
- Track current orders

❌ **Write Reviews**
- Must login and purchase to review
- Prevents fake reviews

### Cart Persistence

- Guest cart is stored in browser localStorage
- Valid for 30 days
- Merges with account cart after login
- If conflict, user chooses which to keep

---

## Seller Signup with OTP Verification

### Signup Process

1. **Initial Registration**
   - Go to: `http://localhost:3000/seller/register`
   - Fill form:
     - Email address
     - Password
     - Store name
     - Owner name
     - Phone number
     - GST number
     - PAN number
     - Bank details
     - Store address
   - Upload signature image
   - Click "Register"

2. **Email OTP Verification**
   - System sends 6-digit OTP to email
   - Enter OTP on verification page
   - OTP valid for 10 minutes
   - Resend option available

3. **Phone OTP Verification**
   - System sends 6-digit OTP to phone
   - Enter OTP on verification page
   - OTP valid for 10 minutes

4. **Admin Approval**
   - After OTP verification, account is "Pending"
   - Admin reviews documents
   - Admin approves or rejects
   - Seller receives email notification

5. **Login**
   - Once approved, seller can login
   - Login requires OTP (email or phone)
   - 2-factor authentication enabled

### Signature Upload

- Format: JPG, PNG, PDF
- Max size: 2MB
- Used for legal documents
- Stored securely in database
- Visible only to admin

### Data Storage

All seller data is stored in MongoDB:

```javascript
{
  email: "seller@example.com",
  phone: "+919876543210",
  storeName: "Optical World",
  ownerName: "John Doe",
  gstNumber: "27AABCU9603R1ZM",
  panNumber: "AABCU9603R",
  bankDetails: {
    accountNumber: "1234567890",
    ifscCode: "SBIN0001234",
    bankName: "State Bank of India"
  },
  signature: "data:image/png;base64,...",
  isVerified: true,
  verificationDate: "2026-01-15T10:30:00Z"
}
```

---

## Banner Management

### Creating Banners

1. **Go to Banner Management**
   - Admin Panel → Banners
   - Click "Add Banner"

2. **Fill Banner Details**
   - **Title**: Internal name (e.g., "Summer Sale 2026")
   - **Image**: Upload banner image
     - Desktop: 1920x600px (landscape)
     - Tablet: 1024x400px (landscape)
     - Mobile: 750x1000px (portrait)
   - **Link URL**: Where banner clicks go
     - Internal: `/category/sunglasses`
     - External: `https://example.com`
   - **Start Date**: When banner appears
   - **End Date**: When banner disappears
   - **Priority**: Order (1 = first, 10 = last)
   - **Active**: Toggle on/off

3. **Device-Specific Images**
   - Upload separate images for each device
   - System auto-selects based on screen size
   - Ensures optimal display on all devices

4. **Save Banner**
   - Banner appears on homepage carousel
   - Visible based on date range
   - Can be edited or deleted anytime

### Banner Placement

Banners appear in these locations:

1. **Homepage Carousel** (Main banner slider)
   - Top of homepage
   - Auto-rotates every 5 seconds
   - Shows device-appropriate image

2. **Category Pages** (Optional)
   - Can assign banner to specific category
   - Appears at top of category page

3. **Brand Pages** (Optional)
   - Can assign banner to specific brand
   - Appears at top of brand page

### Banner Targeting

You can target banners to:

- **All Users**: Show to everyone
- **Logged-in Users**: Only registered users
- **Guest Users**: Only non-logged-in users
- **Specific Categories**: Only on certain category pages
- **Specific Brands**: Only on certain brand pages

Example:
```javascript
{
  title: "Ray-Ban Summer Sale",
  targetBrands: ["ray-ban"],
  targetCategories: ["sunglasses"],
  targetUsers: "all"
}
```

---

## Carousel Brand Linking

### Linking Carousel to Brands

When creating a banner, you can link it to a specific brand:

1. **Create Banner**
   - Admin Panel → Banners → Add Banner
   - Upload banner image
   - In "Link URL" field, enter: `/brands/ray-ban`
   - This links to Ray-Ban brand page

2. **Brand Page URL Format**
   - `/brands/[brand-name]`
   - Examples:
     - `/brands/ray-ban` → Ray-Ban page
     - `/brands/fastrack` → Fastrack page
     - `/brands/lenskart-air` → Lenskart Air page

3. **Category Links**
   - `/category/sunglasses` → Sunglasses category
   - `/category/eyeglasses` → Eyeglasses category
   - `/category/contact-lenses` → Contact lenses category

4. **Product Links**
   - `/product/[product-id]` → Specific product
   - Example: `/product/64f1a2b3c4d5e6f7g8h9i0j1`

### Example: Link to Ray-Ban

1. Create banner with Ray-Ban image
2. Set Link URL: `/brands/ray-ban`
3. When user clicks banner:
   - Redirects to Ray-Ban brand page
   - Shows all Ray-Ban products
   - User can browse and filter

### Carousel Auto-Rotation

- Banners rotate every 5 seconds
- User can manually navigate with arrows
- Pause on hover
- Responsive to device size

---

## Data Access & Management

### Where Data is Stored

All data is stored in MongoDB database:

```
Database: optikart
├── Collections:
│   ├── users          → Customer accounts
│   ├── sellers        → Seller accounts
│   ├── products       → Product listings
│   ├── orders         → Order records
│   ├── reviews        → Product reviews
│   ├── banners        → Homepage banners
│   ├── tickets        → Support tickets
│   ├── staff          → Staff accounts
│   └── audit_logs     → Action logs
```

### Accessing Data

#### 1. MongoDB Compass (GUI)

```bash
# Install MongoDB Compass
# Download from: https://www.mongodb.com/products/compass

# Connect to database
Connection String: mongodb://localhost:27017/optikart

# Browse collections
# - Click on collection name
# - View documents
# - Run queries
```

#### 2. MongoDB Shell (CLI)

```bash
# Connect to database
mongosh mongodb://localhost:27017/optikart

# List collections
show collections

# View users
db.users.find().pretty()

# View sellers
db.sellers.find().pretty()

# View products
db.products.find().pretty()

# View orders
db.orders.find().pretty()

# Search for specific user
db.users.findOne({ email: "user@example.com" })

# Count documents
db.products.countDocuments()
```

#### 3. Admin Panel (Web Interface)

- **Users**: Admin → Manage Users
- **Sellers**: Admin → Manage Sellers
- **Products**: Admin → Manage Products
- **Orders**: Admin → Manage Orders
- **Banners**: Admin → Manage Banners
- **Tickets**: Admin → Help & Support

### Exporting Data

#### Export to CSV

```bash
# Export users
mongoexport --db=optikart --collection=users --type=csv --fields=email,name,phone --out=users.csv

# Export orders
mongoexport --db=optikart --collection=orders --type=csv --fields=orderNumber,user,totalAmount --out=orders.csv
```

#### Export to JSON

```bash
# Export all products
mongoexport --db=optikart --collection=products --out=products.json

# Export specific seller's products
mongoexport --db=optikart --collection=products --query='{"seller":"seller_id_here"}' --out=seller-products.json
```

### Data Backup

#### Automatic Backup (Recommended)

```bash
# Create backup script: backup.sh
#!/bin/bash
BACKUP_DIR="/backups/optikart"
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db=optikart --out=$BACKUP_DIR/backup_$DATE

# Run daily via cron
# crontab -e
0 2 * * * /path/to/backup.sh
```

#### Manual Backup

```bash
# Backup entire database
mongodump --db=optikart --out=/backups/optikart_backup

# Restore from backup
mongorestore --db=optikart /backups/optikart_backup/optikart
```

### Searching Data

#### Search Users by Email

```javascript
// MongoDB Shell
db.users.find({ email: /gmail.com$/ })

// Admin Panel
// Go to Manage Users → Search box → Enter "gmail.com"
```

#### Search Orders by Date Range

```javascript
// MongoDB Shell
db.orders.find({
  createdAt: {
    $gte: ISODate("2026-01-01"),
    $lte: ISODate("2026-01-31")
  }
})

// Admin Panel
// Go to Manage Orders → Filter by date range
```

#### Search Products by Brand

```javascript
// MongoDB Shell
db.products.find({ brand: "Ray-Ban" })

// Admin Panel
// Go to Manage Products → Filter by brand → Select "Ray-Ban"
```

### Data Security

1. **Authentication**
   - MongoDB requires username/password
   - Connection string includes credentials
   - Never share connection string publicly

2. **Encryption**
   - Enable encryption at rest
   - Use SSL/TLS for connections
   - Encrypt sensitive fields (PAN, bank details)

3. **Access Control**
   - Create read-only users for reporting
   - Limit admin access to trusted personnel
   - Audit all data access

4. **Backups**
   - Daily automatic backups
   - Store backups in secure location
   - Test restore process regularly

---

## Quick Reference

### Admin Panel URLs

| Feature | URL |
|---------|-----|
| Dashboard | `/admin` |
| Manage Users | `/admin/users` |
| Manage Sellers | `/admin/sellers` |
| Manage Products | `/admin/products` |
| Manage Orders | `/admin/orders` |
| Manage Banners | `/admin/banners` |
| Help & Support | `/admin/support` |
| Staff Management | `/admin/staff` |
| Settings | `/admin/settings` |

### Seller URLs

| Feature | URL |
|---------|-----|
| Seller Login | `/seller/login` |
| Seller Register | `/seller/register` |
| Dashboard | `/seller/dashboard` |
| My Products | `/seller/products` |
| My Orders | `/seller/orders` |
| Analytics | `/seller/analytics` |

### Customer URLs

| Feature | URL |
|---------|-----|
| Home | `/` |
| Login | `/login` |
| Register | `/register` |
| Products | `/products` |
| Cart | `/cart` |
| Checkout | `/checkout` |
| My Orders | `/orders` |
| Wishlist | `/wishlist` |
| Help Center | `/help` |

---

## Support

For technical issues or questions:

- **Email**: support@optikart.com
- **Documentation**: `/help`
- **Admin Guide**: This document
- **API Docs**: `/api-docs` (if enabled)

---

**Last Updated**: August 2026  
**Version**: 1.0.0
