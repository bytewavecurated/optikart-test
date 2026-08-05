import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

let authToken = null;
let tokenExpiry = null;

const shiprocketApi = axios.create({
  baseURL: SHIPROCKET_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const authenticate = async () => {
  try {
    if (authToken && tokenExpiry && new Date() < tokenExpiry) {
      return { success: true, token: authToken };
    }

    const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    });

    authToken = response.data.token;
    tokenExpiry = new Date(Date.now() + 20 * 60 * 1000);

    shiprocketApi.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    return { success: true, token: authToken };
  } catch (error) {
    console.error('Shiprocket authentication error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

const ensureAuth = async () => {
  if (!authToken || !tokenExpiry || new Date() >= tokenExpiry) {
    await authenticate();
  }
};

export const createOrder = async (orderDetails) => {
  try {
    await ensureAuth();

    const payload = {
      order_id: orderDetails.orderId,
      order_date: orderDetails.orderDate || new Date().toISOString().split('T')[0],
      pickup_date: orderDetails.pickupDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      billing_customer_name: orderDetails.billingCustomerName,
      billing_last_name: orderDetails.billingLastName || '',
      billing_address: orderDetails.billingAddress,
      billing_address_2: orderDetails.billingAddress2 || '',
      billing_city: orderDetails.billingCity,
      billing_pincode: orderDetails.billingPincode,
      billing_state: orderDetails.billingState,
      billing_country: orderDetails.billingCountry || 'India',
      billing_email: orderDetails.billingEmail,
      billing_phone: orderDetails.billingPhone,
      order_items: orderDetails.items.map(item => ({
        name: item.name,
        sku: item.sku || `SKU-${Date.now()}`,
        units: item.quantity,
        selling_price: item.price
      })),
      payment_method: orderDetails.paymentMethod || 'Prepaid',
      shipping_is_gift: false,
      sp_shipping_charges: orderDetails.shippingCharges || 0,
      sub_total: orderDetails.subtotal
    };

    const response = await shiprocketApi.post('/orders/create/adhoc', payload);

    return {
      success: true,
      orderId: response.data.order_id,
      shipmentId: response.data.shipment_id,
      awbCode: response.data.awb_code,
      courierId: response.data.courier_id,
      courierName: response.data.courier_name
    };
  } catch (error) {
    console.error('Shiprocket create order error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const schedulePickup = async (pickupDetails) => {
  try {
    await ensureAuth();

    const payload = {
      shipment_id: pickupDetails.shipmentId,
      pickup_date: pickupDetails.pickupDate,
      pickup_time: pickupDetails.pickupTime || '13:00-16:00',
      package_count: pickupDetails.packageCount || 1,
      package_type: pickupDetails.packageType || 'small'
    };

    const response = await shiprocketApi.post('/courier/assign/pickup', payload);

    return {
      success: true,
      pickupDate: response.data.pickup_date,
      pickupTime: response.data.pickup_time,
      pickupLocation: response.data.pickup_location
    };
  } catch (error) {
    console.error('Shiprocket schedule pickup error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const getTracking = async (awbNumber) => {
  try {
    await ensureAuth();

    const response = await shiprocketApi.get(`/courier/track/awb/${awbNumber}`);

    return {
      success: true,
      trackingData: response.data,
      trackingStatus: response.data.tracking_status,
      trackingStatusId: response.data.tracking_status_id,
      shipmentStatus: response.data.shipment_status,
      lastEvent: response.data.last_event,
      lastLocation: response.data.last_location
    };
  } catch (error) {
    console.error('Shiprocket tracking error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const cancelPickup = async (orderId) => {
  try {
    await ensureAuth();

    const response = await shiprocketApi.post('/courier/pickup/cancel', {
      awbs: [orderId]
    });

    return {
      success: true,
      message: 'Pickup cancelled successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Shiprocket cancel pickup error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const generateLabel = async (orderId) => {
  try {
    await ensureAuth();

    const response = await shiprocketApi.get(`/courier/generate/label`, {
      params: { shipment_id: orderId }
    });

    return {
      success: true,
      labelUrl: response.data.label_url
    };
  } catch (error) {
    console.error('Shiprocket generate label error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export default {
  authenticate,
  createOrder,
  schedulePickup,
  getTracking,
  cancelPickup,
  generateLabel
};
