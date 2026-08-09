import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const SellerLogin = lazy(() => import('./pages/seller/SellerLogin'));
const SellerRegister = lazy(() => import('./pages/seller/SellerRegister'));
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'));
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerAnalytics = lazy(() => import('./pages/seller/SellerAnalytics'));
const SellerProfile = lazy(() => import('./pages/seller/SellerProfile'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageSellers = lazy(() => import('./pages/admin/ManageSellers'));
const ManageOrders = lazy(() => import('./pages/admin/ManageOrders'));
const Subscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const Revenue = lazy(() => import('./pages/admin/Revenue'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const BlogManagement = lazy(() => import('./pages/admin/BlogManagement'));
const DeliveryManagement = lazy(() => import('./pages/admin/DeliveryManagement'));
const SaleEvents = lazy(() => import('./pages/admin/SaleEvents'));
const BannerManagement = lazy(() => import('./pages/admin/BannerManagement'));
const UserDetailView = lazy(() => import('./pages/admin/UserDetailView'));
const SellerDetailView = lazy(() => import('./pages/admin/SellerDetailView'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const UserOrders = lazy(() => import('./pages/UserOrders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const Categories = lazy(() => import('./pages/Categories'));
const AllBrands = lazy(() => import('./pages/AllBrands'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const HelpCategory = lazy(() => import('./pages/HelpCategory'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const UploadPrescription = lazy(() => import('./pages/UploadPrescription'));
const VirtualTryOn = lazy(() => import('./pages/VirtualTryOn'));
const AvailableCoupons = lazy(() => import('./pages/AvailableCoupons'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const Careers = lazy(() => import('./pages/Careers'));
const Press = lazy(() => import('./pages/Press'));
const CorporateInfo = lazy(() => import('./pages/CorporateInfo'));
const PaymentsInfo = lazy(() => import('./pages/PaymentsInfo'));
const ShippingInfo = lazy(() => import('./pages/ShippingInfo'));
const Cancellation = lazy(() => import('./pages/Cancellation'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const ReportInfringement = lazy(() => import('./pages/ReportInfringement'));
const ReturnPolicy = lazy(() => import('./pages/ReturnPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const Security = lazy(() => import('./pages/Security'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Sitemap = lazy(() => import('./pages/Sitemap'));
const EPRCompliance = lazy(() => import('./pages/EPRCompliance'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="spinner spinner-lg" />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, seller, admin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    if (allowedRoles.includes('user') && user) return children;
    if (allowedRoles.includes('seller') && seller) return children;
    if (allowedRoles.includes('admin') && admin) return children;
    return <Navigate to="/login" replace />;
  }

  return children;
};

const SellerRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['seller']}>{children}</ProtectedRoute>
);

const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin']}>{children}</ProtectedRoute>
);

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/seller/login" element={<SellerLogin />} />
        <Route path="/seller/register" element={<SellerRegister />} />
        <Route path="/seller/dashboard" element={<SellerRoute><SellerDashboard /></SellerRoute>} />
        <Route path="/seller/products" element={<SellerRoute><SellerProducts /></SellerRoute>} />
        <Route path="/seller/orders" element={<SellerRoute><SellerOrders /></SellerRoute>} />
        <Route path="/seller/analytics" element={<SellerRoute><SellerAnalytics /></SellerRoute>} />
        <Route path="/seller/profile" element={<SellerRoute><SellerProfile /></SellerRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="users/:id" element={<UserDetailView />} />
          <Route path="sellers" element={<ManageSellers />} />
          <Route path="sellers/:id" element={<SellerDetailView />} />
          <Route path="orders" element={<ManageOrders />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="blogs" element={<BlogManagement />} />
          <Route path="delivery" element={<DeliveryManagement />} />
          <Route path="sale-events" element={<SaleEvents />} />
          <Route path="banners" element={<BannerManagement />} />
        </Route>
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<UserOrders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:category" element={<CategoryPage />} />
        <Route path="/brands" element={<AllBrands />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/help/contact" element={<ContactUs />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/help/payments" element={<PaymentsInfo />} />
        <Route path="/help/shipping" element={<ShippingInfo />} />
        <Route path="/help/cancellation" element={<Cancellation />} />
        <Route path="/help/faq" element={<FAQPage />} />
        <Route path="/help/report" element={<ReportInfringement />} />
        <Route path="/help/:category" element={<HelpCategory />} />
        <Route path="/prescription" element={<UploadPrescription />} />
        <Route path="/virtual-tryon" element={<VirtualTryOn />} />
        <Route path="/coupons" element={<AvailableCoupons />} />
        <Route path="/brands/:brand" element={<BrandPage />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/press" element={<Press />} />
        <Route path="/corporate" element={<CorporateInfo />} />
        <Route path="/policy/return" element={<ReturnPolicy />} />
        <Route path="/policy/terms" element={<TermsOfUse />} />
        <Route path="/policy/security" element={<Security />} />
        <Route path="/policy/privacy" element={<PrivacyPolicy />} />
        <Route path="/policy/epr" element={<EPRCompliance />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
