import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendOTP = async (email, otp, type = 'login') => {
  const subjectMap = {
    login: 'Your Login OTP',
    register: 'Your Registration OTP',
    reset: 'Password Reset OTP',
    phone: 'Phone Verification OTP'
  };

  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subjectMap[type] || 'Your OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Eyewear Platform</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Your One-Time Password</h2>
          <p style="color: #666; font-size: 16px;">Use the following OTP for ${type}. This code is valid for 10 minutes.</p>
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #999; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

export const sendOrderConfirmation = async (email, order) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Order Confirmed!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Thank you for your order</h2>
          <p style="color: #666;">Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Order Details</h3>
            <p style="color: #666;"><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p style="color: #666;"><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
            <p style="color: #666;"><strong>Items:</strong> ${order.items.length}</p>
          </div>
          <p style="color: #666;">We'll notify you when your order is shipped.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending order confirmation:', error);
    return { success: false, error: error.message };
  }
};

export const sendPickupAlert = async (email, pickupDetails) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'New Pickup Scheduled',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Pickup Alert</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">New Pickup Scheduled</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666;"><strong>Order:</strong> ${pickupDetails.orderNumber}</p>
            <p style="color: #666;"><strong>Pickup Date:</strong> ${pickupDetails.pickupDate}</p>
            <p style="color: #666;"><strong>Address:</strong> ${pickupDetails.address}</p>
          </div>
          <p style="color: #666;">Please ensure the package is ready for pickup.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending pickup alert:', error);
    return { success: false, error: error.message };
  }
};

export const sendSubscriptionReminder = async (email, seller) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Subscription Renewal Reminder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Subscription Reminder</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${seller.name},</h2>
          <p style="color: #666;">Your seller subscription is expiring soon. Please renew to continue selling on our platform.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666;"><strong>Store:</strong> ${seller.storeName}</p>
            <p style="color: #666;"><strong>Expiry Date:</strong> ${seller.subscriptionExpiry}</p>
            <p style="color: #666;"><strong>Renewal Amount:</strong> ₹590 (including GST)</p>
          </div>
          <p style="color: #666;">Login to your seller dashboard to renew your subscription.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending subscription reminder:', error);
    return { success: false, error: error.message };
  }
};

export const sendPasswordReset = async (email, otp) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #666;">Use the following OTP to reset your password. This code is valid for 10 minutes.</p>
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #999; font-size: 14px;">If you didn't request a password reset, please ignore this email.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

export default transporter;
