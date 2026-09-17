# OptiKart - API Documentation & Test Credentials

## 🔐 Test Credentials

### Admin
- **Email**: samedayopticians@gmail.com
- **Password**: Sameday123@
- **Login URL**: /admin/login

### Regular Sellers
- **Email**: opticalworld@gmail.com
- **Password**: Seller123@
- **Login URL**: /seller/login

### Test Users
- **Email**: testuser@optikart.com
- **Password**: Test123@
- **Login URL**: /login

---

## 👔 Executive Admin Panel

### Test Credentials
- **Email**: executive.delivery@optikart.com
- **Password**: Executive123@
- **Department**: delivery
- **Login URL**: /executive/login
- **Dashboard URL**: /executive/dashboard

### Executive Departments
Executives can be assigned to specific departments:
- `delivery` - Delivery management
- `staff` - Staff management
- `users` - User management
- `sellers` - Seller management
- `manufacturers` - Manufacturer management
- `orders` - Order management
- `products` - Product management

### Executive Permissions
Executives have limited access based on their department:
- Can only access their assigned department
- Cannot access admin credentials or data
- Cannot modify admin settings
- Access can be revoked by admin at any time

### How to Assign Tasks to Executives
1. Admin logs into admin panel
2. Navigate to "Manage Executives"
3. Click "Add Executive"
4. Fill in details:
   - Name, Email, Phone
   - Select Department
   - Set Permissions (view, create, edit, delete for specific modules)
5. Executive receives email with credentials
6. Executive logs in at /executive/login

---

## 🏭 Manufacturer Admin Panel

### Test Credentials
- **Email**: rayban.manufacturer@optikart.com
- **Password**: Manufacturer123@
- **Company**: Ray-Ban Manufacturing
- **Manufacturer ID**: MFR00001
- **Login URL**: /manufacturer/login
- **Dashboard URL**: /manufacturer/dashboard

### Manufacturer Features
- Upload brand-wise products with pricing and images
- Products auto-categorized by brand
- Edit product data
- Mark products as discontinued (removes from all seller dashboards)
- Re-continue discontinued products
- Bulk upload products via spreadsheet
- Manage manufacturer's sellers (retailers)
- Manage manufacturer's staff

### Bulk Upload Format (Excel/CSV)
Required columns:
- title (Product name)
- price (Numeric)
- category (sunglasses/eyeglasses/contactlenses/readingglasses/sportseyewear/kids)
- brand (Brand name)
- description (Optional)
- discountedPrice (Optional)
- images (Pipe-separated URLs: url1|url2|url3)
- colors (Pipe-separated: Black|Brown|Blue)
- sizes (Pipe-separated: S|M|L)
- stock (Numeric)

### Discontinued Products
When a manufacturer marks a product as discontinued:
1. Product is removed from all seller dashboards
2. Product is removed from homepage
3. Product is removed from user view
4. Product appears in "Discontinued" section
5. Sellers cannot toggle it on

When re-continued:
1. Product becomes available again
2. Sellers can toggle it on with their pricing/stock
3. Product appears on homepage and user view

---

## 🏪 Manufacturer's Seller Panel

### Test Credentials
- **Email**: rayban.retailer1@optikart.com
- **Password**: Retailer123@
- **Store**: Ray-Ban Retail Store 1
- **Manufacturer Code**: RB-RET-001
- **Login URL**: /manufacturer-seller/login
- **Dashboard URL**: /manufacturer-seller/dashboard

### Manufacturer Seller Features
- View available products from manufacturer
- Toggle products on/off (add to inventory)
- Set custom pricing and stock
- Products visible to users randomly (no hierarchy)
- Cannot access other manufacturers' products

### How Manufacturer Adds Sellers
1. Manufacturer logs into manufacturer panel
2. Navigate to "Your Sellers"
3. Click "Add Seller" or "Bulk Upload"
4. Fill in seller details:
   - Name, Email, Phone
   - Store Name, Address
   - Manufacturer Code (unique code)
   - GST Number, PAN Number
   - Bank Details
5. System auto-generates password
6. Seller receives email with credentials
7. Seller logs in at /manufacturer-seller/login

### Bulk Upload Sellers (Excel/CSV)
Required columns:
- name (Seller name)
- email (Seller email)
- phone (Phone number)
- storeName (Store name)
- manufacturerCode (Unique code from manufacturer)
- gstNumber (GST number)
- panNumber (PAN number)
- accountNumber (Bank account)
- ifscCode (Bank IFSC)
- bankName (Bank name)
- branchName (Branch name)
- street, city, state, pincode (Optional address fields)

---

## 🤖 AI Chatbot

### Current Implementation
- **Type**: Rule-based chatbot
- **API**: No external API used
- **Technology**: React component with predefined responses
- **Features**:
  - Basic conversation flow
  - Order tracking assistance
  - Product information
  - Return policy information
  - Payment methods info
  - Shipping information
  - Authentication-aware responses

### Future Enhancement
To integrate advanced AI chatbot, you can use:
- **OpenAI GPT API**: https://platform.openai.com/
- **Google Dialogflow**: https://cloud.google.com/dialogflow
- **AWS Lex**: https://aws.amazon.com/lex/
- **IBM Watson**: https://www.ibm.com/cloud/watson-assistant

---

## 📷 Camera Face Scan

### Current Implementation
- **Type**: Simulated face shape detection
- **API**: No external API used (random selection)
- **Technology**: Browser MediaDevices API for camera access
- **Features**:
  - Camera access via browser
  - Simulated face shape detection
  - Returns random face shape (oval, round, square, heart, oblong)
  - Recommends glasses based on detected shape

### Production Implementation
For real face shape detection, integrate one of these APIs:

#### 1. AWS Rekognition
- **URL**: https://aws.amazon.com/rekognition/
- **Features**: Face detection, analysis, comparison
- **Pricing**: Pay per use
- **Setup**:
  ```javascript
  // Add to .env
  AWS_ACCESS_KEY_ID=your_key
  AWS_SECRET_ACCESS_KEY=your_secret
  AWS_REGION=us-east-1
  ```

#### 2. Google Cloud Vision API
- **URL**: https://cloud.google.com/vision
- **Features**: Face detection, landmark detection
- **Pricing**: Pay per use
- **Setup**:
  ```javascript
  // Add to .env
  GOOGLE_VISION_API_KEY=your_key
  ```

#### 3. Azure Face API
- **URL**: https://azure.microsoft.com/en-us/services/cognitive-services/face/
- **Features**: Face detection, recognition, analysis
- **Pricing**: Pay per use
- **Setup**:
  ```javascript
  // Add to .env
  AZURE_FACE_API_KEY=your_key
  AZURE_FACE_ENDPOINT=your_endpoint
  ```

#### 4. Face++ API
- **URL**: https://www.faceplusplus.com/
- **Features**: Face detection, analysis
- **Pricing**: Free tier available
- **Setup**:
  ```javascript
  // Add to .env
  FACEPP_API_KEY=your_key
  FACEPP_API_SECRET=your_secret
  ```

---

## 🔑 How Task Assignment Works

### Admin Panel → Executive Assignment
1. Admin creates executive with specific department
2. Executive can only access that department's data
3. Executive cannot access admin data
4. Admin can revoke access anytime

### Admin Panel → Manufacturer Assignment
1. Admin creates manufacturer with unique ID
2. Manufacturer gets their own panel
3. Manufacturer can manage their products and sellers
4. Admin can oversee all manufacturers

### Manufacturer → Seller Assignment
1. Manufacturer adds sellers with unique codes
2. System generates credentials
3. Sellers get their own panel
4. Sellers can only see manufacturer's products
5. Manufacturer can ban/delete sellers

### Manufacturer → Staff Assignment
1. Manufacturer creates staff with specific roles
2. Staff can only access assigned tasks
3. Manufacturer can manage staff
4. Admin and executives can oversee manufacturer staff

---

## 📊 Access Hierarchy

```
Admin (Full Access)
├── Executive (Department-specific access)
│   ├── Delivery Executive
│   ├── Staff Executive
│   ├── Users Executive
│   ├── Sellers Executive
│   ├── Manufacturers Executive
│   ├── Orders Executive
│   └── Products Executive
├── Manufacturer (Own products and sellers)
│   ├── Manufacturer Staff (Assigned tasks)
│   └── Manufacturer Seller (Own inventory)
└── Regular Seller (Own products)
```

---

## 🔒 Security Notes

1. **No Cross-Access**: Executives cannot access admin data
2. **Department Isolation**: Executives can only access their department
3. **Manufacturer Isolation**: Manufacturers can only see their products
4. **Seller Isolation**: Sellers can only see their inventory
5. **OTP Verification**: All logins require OTP (except test credentials)
6. **Session Management**: Automatic logout after session expiry
7. **Rate Limiting**: Prevents brute force attacks
8. **Password Hashing**: All passwords are bcrypt hashed

---

## 🚀 API Endpoints Summary

### Executive Endpoints
- `POST /api/executive/login` - Executive login
- `POST /api/executive/verify-login-otp` - Verify OTP
- `GET /api/executive/me` - Get profile
- `GET /api/executive/dashboard` - Get dashboard stats

### Manufacturer Endpoints
- `POST /api/manufacturer/login` - Manufacturer login
- `POST /api/manufacturer/verify-login-otp` - Verify OTP
- `GET /api/manufacturer/me` - Get profile
- `POST /api/manufacturer/products` - Add product
- `GET /api/manufacturer/products` - Get products
- `PUT /api/manufacturer/products/:id` - Update product
- `POST /api/manufacturer/products/:id/discontinue` - Discontinue product
- `POST /api/manufacturer/products/:id/recontinue` - Re-continue product
- `POST /api/manufacturer/products/bulk-upload` - Bulk upload
- `POST /api/manufacturer/sellers` - Add seller
- `GET /api/manufacturer/sellers` - Get sellers
- `POST /api/manufacturer/sellers/bulk-upload` - Bulk upload sellers
- `POST /api/manufacturer/sellers/:id/ban` - Ban seller
- `POST /api/manufacturer/staff` - Add staff
- `GET /api/manufacturer/staff` - Get staff

### Manufacturer Seller Endpoints
- `POST /api/manufacturer-seller/login` - Seller login
- `POST /api/manufacturer-seller/verify-login-otp` - Verify OTP
- `GET /api/manufacturer-seller/me` - Get profile
- `GET /api/manufacturer-seller/available-products` - Get available products
- `POST /api/manufacturer-seller/products/:id/toggle` - Toggle product
- `GET /api/manufacturer-seller/products` - Get my products

### Admin Management Endpoints
- `GET /api/admin/executives` - Get all executives
- `POST /api/admin/executives` - Create executive
- `PUT /api/admin/executives/:id` - Update executive
- `DELETE /api/admin/executives/:id` - Delete executive
- `PUT /api/admin/executives/:id/ban` - Ban executive
- `GET /api/admin/manufacturers` - Get all manufacturers
- `POST /api/admin/manufacturers` - Create manufacturer
- `PUT /api/admin/manufacturers/:id` - Update manufacturer
- `DELETE /api/admin/manufacturers/:id` - Delete manufacturer
- `PUT /api/admin/manufacturers/:id/ban` - Ban manufacturer
- `GET /api/admin/manufacturers/:id/products` - Get manufacturer products
- `GET /api/admin/manufacturers/:id/sellers` - Get manufacturer sellers

---

## 📝 Notes

1. **Test Credentials**: Use test credentials for development/testing only
2. **Production**: Remove test credentials before production deployment
3. **API Keys**: Add real API keys for face detection and chatbot in production
4. **Spreadsheet Upload**: Ensure spreadsheet format matches requirements
5. **Bulk Upload**: Large uploads may take time, show loading indicator
6. **Discontinued Products**: Cannot be toggled by sellers
7. **Executive Access**: Strictly department-based, no cross-department access

---

**Last Updated**: September 16, 2026  
**Version**: 2.0.0
