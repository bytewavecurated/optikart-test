import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AIChatbot from './components/AIChatbot';

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
const SellerPayouts = lazy(() => import('./pages/seller/SellerPayouts'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageSellers = lazy(() => import('./pages/admin/ManageSellers'));
const ManageOrders = lazy(() => import('./pages/admin/ManageOrders'));
const Revenue = lazy(() => import('./pages/admin/Revenue'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const BlogManagement = lazy(() => import('./pages/admin/BlogManagement'));
const DeliveryManagement = lazy(() => import('./pages/admin/DeliveryManagement'));
const ManageDeliveryPartners = lazy(() => import('./pages/admin/ManageDeliveryPartners'));
const PriceChangeConfirm = lazy(() => import('./pages/account/PriceChangeConfirm'));
const SaleEvents = lazy(() => import('./pages/admin/SaleEvents'));
const BannerManagement = lazy(() => import('./pages/admin/BannerManagement'));
const UserDetailView = lazy(() => import('./pages/admin/UserDetailView'));
const SellerDetailView = lazy(() => import('./pages/admin/SellerDetailView'));
const StaffLogin = lazy(() => import('./pages/staff/StaffLogin'));
const StaffLayout = lazy(() => import('./pages/staff/StaffLayout'));
const StaffWorkspace = lazy(() => import('./pages/staff/StaffWorkspace'));
const ProductsBrowse = lazy(() => import('./pages/ProductsBrowse'));
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
const ProductCompare = lazy(() => import('./pages/ProductCompare'));
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
const ManageExecutives = lazy(() => import('./pages/admin/ManageExecutives'));
const ManageManufacturers = lazy(() => import('./pages/admin/ManageManufacturers'));
const Commissions = lazy(() => import('./pages/admin/Commissions'));
const ChatbotManagement = lazy(() => import('./pages/admin/ChatbotManagement'));
const ExecutiveLogin = lazy(() => import('./pages/executive/ExecutiveLogin'));
const ExecutiveDashboard = lazy(() => import('./pages/executive/ExecutiveDashboard'));
const ExecutiveSection = lazy(() => import('./pages/executive/ExecutiveSection'));
const ManufacturerLogin = lazy(() => import('./pages/manufacturer/ManufacturerLogin'));
const ManufacturerDashboard = lazy(() => import('./pages/manufacturer/ManufacturerDashboard'));
const ManufacturerSellerLogin = lazy(() => import('./pages/manufacturerSeller/ManufacturerSellerLogin'));
const ManufacturerSellerDashboard = lazy(() => import('./pages/manufacturerSeller/ManufacturerSellerDashboard'));
const FaceShapeGuide = lazy(() => import('./pages/FaceShapeGuide'));
const SellerInventory = lazy(() => import('./pages/seller/SellerInventory'));
const SellerStock = lazy(() => import('./pages/seller/SellerStock'));
const SellerReturns = lazy(() => import('./pages/seller/SellerReturns'));
const DeliveryPartnerLogin = lazy(() => import('./pages/deliveryPartner/DeliveryPartnerLogin'));
const DeliveryPartnerDashboard = lazy(() => import('./pages/deliveryPartner/DeliveryPartnerDashboard'));
const LensConfiguration = lazy(() => import('./pages/LensConfiguration'));
const SellerInventoryAnalytics = lazy(() => import('./pages/seller/SellerInventoryAnalytics'));
const SellerReturnAnalytics = lazy(() => import('./pages/seller/SellerReturnAnalytics'));
const SellerCommission = lazy(() => import('./pages/seller/SellerCommission'));
const AdminReturnAnalytics = lazy(() => import('./pages/admin/AdminReturnAnalytics'));
const CommissionDashboard = lazy(() => import('./pages/admin/CommissionDashboard'));
const OrderAssignment = lazy(() => import('./pages/admin/OrderAssignment'));
const ProductVerification = lazy(() => import('./pages/admin/ProductVerification'));
const LensSelection = lazy(() => import('./pages/LensSelection'));
const AdvancedSearch = lazy(() => import('./components/AdvancedSearch'));
const ContactLenses = lazy(() => import('./pages/ContactLenses'));
const ContactLensConfigure = lazy(() => import('./pages/contactLenses/ContactLensConfigure'));
const DeliveryRouteOptimization = lazy(() => import('./pages/deliveryPartner/DeliveryRouteOptimization'));
const CustomerReturnPortal = lazy(() => import('./pages/CustomerReturnPortal'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="spinner spinner-lg" />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const {
    isAuthenticated, activeRole, user, seller, admin, staff, executive,
    manufacturer, manufacturerSeller, deliveryPartner, loading
  } = useAuth();

  // Wait for auth initialization to complete
  if (loading) {
    return <LoadingFallback />;
  }

  /*
   * The role used to be read straight from localStorage, and any page could put
   * whatever it liked in that key: writing optikart_role="staff" while signed in
   * as a manufacturer was enough to walk into the staff panel. The role now comes
   * from the identity the server returned at sign-in, and a session with no
   * identity behind it is treated as signed out.
   */
  const sessionExists = !!(user || seller || admin || staff || executive || manufacturer || manufacturerSeller || deliveryPartner);
  const isAuth = isAuthenticated && sessionExists;

  if (!isAuth) {
    // Determine redirect based on current path
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/seller')) {
      return <Navigate to="/seller/login" replace />;
    } else if (currentPath.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace />;
    } else if (currentPath.startsWith('/executive')) {
      return <Navigate to="/executive/login" replace />;
    } else if (currentPath.startsWith('/manufacturer-seller')) {
      return <Navigate to="/manufacturer-seller/login" replace />;
    } else if (currentPath.startsWith('/manufacturer')) {
      return <Navigate to="/manufacturer/login" replace />;
    } else if (currentPath.startsWith('/delivery-partner')) {
      return <Navigate to="/delivery-partner/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    // Check if user has the required role
    // 'user' is also satisfied by an admin or staff session, because those people
    // browse the storefront too; nothing else crosses over.
    const hasRole = allowedRoles.some((r) => {
      if (r === activeRole) return true;
      if (r === 'user' && activeRole === 'customer') return true;
      return false;
    });

    if (hasRole) return children;
    
    // Redirect based on role
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/seller')) {
      return <Navigate to="/seller/login" replace />;
    } else if (currentPath.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace />;
    } else if (currentPath.startsWith('/executive')) {
      return <Navigate to="/executive/login" replace />;
    } else if (currentPath.startsWith('/manufacturer-seller')) {
      return <Navigate to="/manufacturer-seller/login" replace />;
    } else if (currentPath.startsWith('/manufacturer')) {
      return <Navigate to="/manufacturer/login" replace />;
    } else if (currentPath.startsWith('/delivery-partner')) {
      return <Navigate to="/delivery-partner/login" replace />;
    }
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

/*
 * The account pages had no guard at all: signed out, /profile still painted the
 * profile shell - empty, but present - instead of asking for a sign-in.
 */
const UserRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['user']}>{children}</ProtectedRoute>
);

const StaffRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['staff']}>{children}</ProtectedRoute>
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
        <Route path="/seller/payouts" element={<SellerRoute><SellerPayouts /></SellerRoute>} />
        <Route path="/seller/inventory" element={<SellerRoute><SellerInventory /></SellerRoute>} />
        <Route path="/seller/stock" element={<SellerRoute><SellerStock /></SellerRoute>} />
        <Route path="/seller/returns" element={<SellerRoute><SellerReturns /></SellerRoute>} />
        <Route path="/seller/inventory-analytics" element={<SellerRoute><SellerInventoryAnalytics /></SellerRoute>} />
        <Route path="/seller/return-analytics" element={<SellerRoute><SellerReturnAnalytics /></SellerRoute>} />
        <Route path="/seller/commission" element={<SellerRoute><SellerCommission /></SellerRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="users/:id" element={<UserDetailView />} />
          <Route path="sellers" element={<ManageSellers />} />
          <Route path="sellers/:id" element={<SellerDetailView />} />
          <Route path="orders" element={<ManageOrders />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="blogs" element={<BlogManagement />} />
          <Route path="delivery" element={<DeliveryManagement />} />
          <Route path="delivery-partners" element={<ManageDeliveryPartners />} />
          <Route path="sale-events" element={<SaleEvents />} />
          <Route path="banners" element={<BannerManagement />} />
          <Route path="executives" element={<ManageExecutives />} />
          <Route path="manufacturers" element={<ManageManufacturers />} />
          <Route path="commissions" element={<Commissions />} />
          <Route path="chatbot" element={<ChatbotManagement />} />
          <Route path="return-analytics" element={<AdminReturnAnalytics />} />
          <Route path="commission" element={<CommissionDashboard />} />
          <Route path="order-assignment" element={<OrderAssignment />} />
          <Route path="product-verification" element={<ProductVerification />} />
        </Route>
        <Route path="/product/:productId/lenses" element={<LensSelection />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/staff" element={<StaffRoute><StaffLayout /></StaffRoute>}>
          <Route index element={<StaffWorkspace view="overview" />} />
          <Route path="dashboard" element={<StaffWorkspace view="overview" />} />
          <Route path="blogs" element={<StaffWorkspace view="overview" />} />
          <Route path="blogs/manage" element={<StaffWorkspace view="blogs" />} />
          <Route path="support" element={<StaffWorkspace view="overview" />} />
          <Route path="support/tickets" element={<StaffWorkspace view="returns" />} />
          <Route path="products" element={<StaffWorkspace view="overview" />} />
          <Route path="products/manage" element={<StaffWorkspace view="products" />} />
          <Route path="orders" element={<StaffWorkspace view="overview" />} />
          <Route path="orders/manage" element={<StaffWorkspace view="orders" />} />
        </Route>
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<UserRoute><UserOrders /></UserRoute>} />
        <Route path="/orders/:id" element={<UserRoute><OrderDetail /></UserRoute>} />
        <Route path="/wishlist" element={<UserRoute><Wishlist /></UserRoute>} />
        <Route path="/profile" element={<UserRoute><UserProfile /></UserRoute>} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/products" element={<ProductsBrowse />} />
        <Route path="/category/:category" element={<ProductsBrowse />} />
        <Route path="/price-change/:stockId" element={<PriceChangeConfirm />} />
        <Route path="/contact-lenses" element={<ContactLenses />} />
        <Route path="/contact-lenses/configure/:productId" element={<ContactLensConfigure />} />
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
        <Route path="/face-shape-guide" element={<FaceShapeGuide />} />
        <Route path="/lens-configuration/:productId" element={<LensConfiguration />} />
        <Route path="/delivery-partner/login" element={<DeliveryPartnerLogin />} />
        <Route path="/delivery-partner/dashboard" element={<ProtectedRoute allowedRoles={['deliveryPartner']}><DeliveryPartnerDashboard /></ProtectedRoute>} />
        <Route path="/delivery-partner/route-optimization" element={<ProtectedRoute allowedRoles={['deliveryPartner']}><DeliveryRouteOptimization /></ProtectedRoute>} />
        <Route path="/orders/:orderId/return" element={<ProtectedRoute><CustomerReturnPortal /></ProtectedRoute>} />
        <Route path="/compare" element={<ProductCompare />} />
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
        <Route path="/executive/login" element={<ExecutiveLogin />} />
        <Route path="/executive/dashboard" element={<ProtectedRoute allowedRoles={['executive']}><ExecutiveDashboard /></ProtectedRoute>} />
        <Route path="/executive/deliveries" element={<ProtectedRoute allowedRoles={['executive']}><ExecutiveSection section="deliveries" /></ProtectedRoute>} />
        <Route path="/executive/customers" element={<ProtectedRoute allowedRoles={['executive']}><ExecutiveSection section="customers" /></ProtectedRoute>} />
        <Route path="/executive/reports" element={<ProtectedRoute allowedRoles={['executive']}><ExecutiveSection section="reports" /></ProtectedRoute>} />
        <Route path="/executive/delivery/:id" element={<ProtectedRoute allowedRoles={['executive']}><ExecutiveSection section="detail" /></ProtectedRoute>} />
        <Route path="/manufacturer/login" element={<ManufacturerLogin />} />
        <Route path="/manufacturer/dashboard" element={<ProtectedRoute allowedRoles={['manufacturer']}><ManufacturerDashboard /></ProtectedRoute>} />
        <Route path="/manufacturer-seller/login" element={<ManufacturerSellerLogin />} />
        <Route path="/manufacturer-seller/dashboard" element={<ProtectedRoute allowedRoles={['manufacturerSeller']}><ManufacturerSellerDashboard /></ProtectedRoute>} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AIChatbot />
    </Suspense>
  );
}

export default App;
