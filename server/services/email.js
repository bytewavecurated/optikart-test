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

export const sendShippingUpdate = async (email, order) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Shipping Update - Order ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #007791 0%, #00a8c8 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Your Order is on its Way!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Shipping Confirmation</h2>
          <p style="color: #666;">Great news! Your order <strong>${order.orderNumber}</strong> has been shipped.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Tracking Information</h3>
            <p style="color: #666;"><strong>Tracking Number:</strong> ${order.trackingNumber || 'N/A'}</p>
            <p style="color: #666;"><strong>Courier:</strong> ${order.courier || 'Standard Shipping'}</p>
            <p style="color: #666;"><strong>Estimated Delivery:</strong> ${order.estimatedDelivery || '3-5 business days'}</p>
            ${order.trackingUrl ? `<p style="color: #666;"><a href="${order.trackingUrl}" style="color: #007791;">Track Your Package</a></p>` : ''}
          </div>
          <p style="color: #666;">You'll receive another email when your order is delivered.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending shipping update:', error);
    return { success: false, error: error.message };
  }
};

export const sendDeliveryConfirmation = async (email, order) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Order Delivered - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #26a541 0%, #4caf50 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Order Delivered!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Your Order Has Arrived</h2>
          <p style="color: #666;">Your order <strong>${order.orderNumber}</strong> has been successfully delivered.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
            <ul style="color: #666; line-height: 1.8;">
              <li>Check your items carefully</li>
              <li>Leave a review to help other customers</li>
              <li>Need help? Contact our support team</li>
            </ul>
          </div>
          <p style="color: #666;">Thank you for shopping with us!</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending delivery confirmation:', error);
    return { success: false, error: error.message };
  }
};

export const sendSellerOrderNotification = async (email, order, seller) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `New Order Received - ${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #C49A6C 0%, #d4af37 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">New Order Alert</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${seller.name},</h2>
          <p style="color: #666;">You have received a new order for your store <strong>${seller.storeName}</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Order Details</h3>
            <p style="color: #666;"><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p style="color: #666;"><strong>Customer:</strong> ${order.customerName}</p>
            <p style="color: #666;"><strong>Items:</strong> ${order.items.length}</p>
            <p style="color: #666;"><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
            <p style="color: #666;"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
          <p style="color: #666;">Please process this order as soon as possible.</p>
          <p style="color: #666;">Login to your seller dashboard to view full details.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending seller order notification:', error);
    return { success: false, error: error.message };
  }
};

export const sendLowStockAlert = async (email, product, seller) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Low Stock Alert - ${product.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff9f00 0%, #ff6161 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Low Stock Alert</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${seller.name},</h2>
          <p style="color: #666;">This is a reminder that the following product is running low on stock:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${product.title}</h3>
            <p style="color: #666;"><strong>Current Stock:</strong> ${product.stock} units</p>
            <p style="color: #666;"><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
            <p style="color: #666;"><strong>Price:</strong> ₹${product.price}</p>
          </div>
          <p style="color: #666;">Please restock this item soon to avoid missing sales.</p>
          <p style="color: #666;">Login to your seller dashboard to update inventory.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    return { success: false, error: error.message };
  }
};

export const sendWishlistPriceDropAlert = async (email, product, user, oldPrice, newPrice) => {
  const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Price Drop Alert - ${product.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #C49A6C 0%, #d4af37 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Price Drop Alert!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${user.name},</h2>
          <p style="color: #666;">Great news! An item in your wishlist has dropped in price.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${product.title}</h3>
            <p style="color: #666;"><strong>Brand:</strong> ${product.brand}</p>
            <p style="color: #666;"><strong>Old Price:</strong> <span style="text-decoration: line-through;">₹${oldPrice}</span></p>
            <p style="color: #666;"><strong>New Price:</strong> <span style="color: #26a541; font-size: 20px; font-weight: bold;">₹${newPrice}</span></p>
            <p style="color: #26a541; font-weight: bold;">You save ${discount}%!</p>
          </div>
          <p style="color: #666;">Don't miss out! Visit your wishlist to purchase now.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending wishlist price drop alert:', error);
    return { success: false, error: error.message };
  }
};

export const sendReturnConfirmation = async (email, returnRequest) => {
  const mailOptions = {
    from: `"Eyewear Platform" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Return Request Confirmed - ${returnRequest.returnId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #007791 0%, #00a8c8 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Return Request Confirmed</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Your Return Has Been Initiated</h2>
          <p style="color: #666;">We've received your return request and it's being processed.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Return Details</h3>
            <p style="color: #666;"><strong>Return ID:</strong> ${returnRequest.returnId}</p>
            <p style="color: #666;"><strong>Order Number:</strong> ${returnRequest.orderNumber}</p>
            <p style="color: #666;"><strong>Reason:</strong> ${returnRequest.reason}</p>
            <p style="color: #666;"><strong>Status:</strong> ${returnRequest.status}</p>
          </div>
          <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #26a541; margin-top: 0;">Next Steps</h4>
            <ol style="color: #666; line-height: 1.8;">
              <li>Pack the item securely in original packaging</li>
              <li>Attach the return label (if provided)</li>
              <li>Drop off at the nearest courier location</li>
              <li>We'll process your refund within 5-7 business days</li>
            </ol>
          </div>
          <p style="color: #666;">Questions? Contact our support team.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending return confirmation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a generic email
 */

const rupees = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `"OptiKart" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || '',
      html: html || `<p>${text || subject}</p>`
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};


/**
 * Simple recipient/subject/body sender.
 *
 * Several services historically called sendEmail(email, subject, body) even
 * though sendEmail takes a single options object, which silently sent mail to
 * `undefined`. This wrapper keeps that ergonomic call style working.
 */
export const notify = async (to, subject, body) => {
  if (!to) return { success: false, error: 'No recipient supplied' };
  const text = typeof body === 'string' ? body : String(body || '');
  return sendEmail({
    to,
    subject,
    text,
    html: '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">' + text.replace(/\n/g, '<br/>') + '</div>'
  });
};


// ---------------------------------------------------------------------------
// Shared, restrained email shell.
// ---------------------------------------------------------------------------
const EMAIL_ACCENT = '#2874f0';
const EMAIL_INK = '#14161a';
const EMAIL_MUTED = '#5c6470';

const emailShell = (title, introHtml, bodyHtml, footerNote = '') => `
  <div style="font-family: Arial, Helvetica, sans-serif; background: #f7f8fa; padding: 28px 16px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e3e6ea; border-radius: 12px; overflow: hidden;">
      <div style="padding: 20px 24px; border-bottom: 1px solid #eef0f3;">
        <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.02em; color: ${EMAIL_INK};">Opti<span style="color: ${EMAIL_ACCENT};">Kart</span></span>
      </div>
      <div style="padding: 26px 24px;">
        <h1 style="font-size: 20px; margin: 0 0 8px; color: ${EMAIL_INK}; letter-spacing: -0.02em;">${title}</h1>
        <p style="font-size: 14px; line-height: 1.7; color: ${EMAIL_MUTED}; margin: 0 0 20px;">${introHtml}</p>
        ${bodyHtml}
        ${footerNote ? `<p style="font-size: 12px; color: #8a929e; margin: 22px 0 0;">${footerNote}</p>` : ''}
      </div>
      <div style="padding: 16px 24px; background: #f7f8fa; border-top: 1px solid #eef0f3;">
        <p style="font-size: 12px; color: #8a929e; margin: 0;">You are receiving this because you have an OptiKart account.</p>
      </div>
    </div>
  </div>
`;

const row = (label, value) =>
  `<tr><td style="padding: 8px 0; font-size: 13px; color: ${EMAIL_MUTED}; white-space: nowrap;">${label}</td>
   <td style="padding: 8px 0; font-size: 13px; color: ${EMAIL_INK}; font-weight: 600; text-align: right;">${value}</td></tr>`;

/**
 * Seller / manufacturer: one of their listings was edited (by them or staff).
 * Sent as an audit trail so an unauthorised change is noticeable.
 */
export const sendProductUpdateNotification = async (email, product, changes, actorLabel = 'OptiKart team') => {
  const subject = `Listing updated - ${product.title}`;
  const rows = Object.entries(changes || {})
    .map(([field, value]) => row(field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), value))
    .join('');
  const html = emailShell(
    'Your listing was updated',
    `The following changes were recorded on <strong>${product.title}</strong> (${product.brand || 'unbranded'}) by ${actorLabel}. If you did not expect these, please review them before they go live.`,
    `<table role="presentation" style="width: 100%; border-collapse: collapse; background: #f7f8fa; border-radius: 8px; padding: 4px 12px;">${rows}</table>`,
    'Listing reference: ' + (product.sku || product.modelNumber || product._id)
  );
  return sendEmail({ to: email, subject, html, text: `${subject}\n${Object.entries(changes || {}).map(([k, v]) => k + ': ' + v).join('\n')}` });
};

/**
 * Seller / manufacturer: a price on one of their listings moved.
 */
export const sendPriceChangeNotification = async (email, product, oldPrice, newPrice, actorLabel = 'the seller') => {
  const up = Number(newPrice) > Number(oldPrice);
  const subject = `${up ? 'Price increased' : 'Price reduced'} - ${product.title}`;
  const html = emailShell(
    up ? 'Price increased' : 'Price reduced',
    `The selling price of <strong>${product.title}</strong> changed${actorLabel ? ' (' + actorLabel + ')' : ''}.`,
    `<table role="presentation" style="width: 100%; border-collapse: collapse; background: #f7f8fa; border-radius: 8px; padding: 4px 12px;">
       ${row('Previous price', rupees(oldPrice))}
       ${row('New price', rupees(newPrice))}
       ${row('Change', (up ? '+' : '-') + rupees(Math.abs(Number(oldPrice) - Number(newPrice))))}
       ${product.stock !== undefined ? row('Stock on hand', product.stock + ' units') : ''}
     </table>`,
    'No action is needed unless this change was unexpected.'
  );
  return sendEmail({ to: email, subject, html, text: `${subject}: ${oldPrice} -> ${newPrice}` });
};

/**
 * Customer: the status of an order moved along.
 */
const ORDER_STATUS_COPY = {
  confirmed: ['Order confirmed', 'We have received your order and it is being prepared.'],
  packed: ['Order packed', 'Your order has been packed and is waiting for pickup.'],
  picked_up: ['Picked up', 'The delivery partner has collected your order.'],
  in_transit: ['On its way', 'Your order is in transit to your address.'],
  delivered: ['Delivered', 'Your order has been delivered. We hope you love it.'],
  cancelled: ['Order cancelled', 'Your order has been cancelled. Any payment made is refunded to the original method.'],
  return_requested: ['Return requested', 'We have received your return request and it is being reviewed.'],
  returned: ['Returned', 'Your return has been completed and the refund is on its way.']
};

export const sendOrderStatusNotification = async (email, order, status) => {
  const [title, blurb] = ORDER_STATUS_COPY[status] || ['Order update', `Your order is now marked as ${status}.`];
  const subject = `${title} - ${order.orderNumber || order.orderId || ''}`.trim();
  const items = (order.items || [])
    .map((i) => row(i.name || 'Item', `${i.quantity} x ${rupees(i.price)}`))
    .join('');
  const html = emailShell(
    title,
    blurb,
    `<table role="presentation" style="width: 100%; border-collapse: collapse; background: #f7f8fa; border-radius: 8px; padding: 4px 12px;">
       ${items}
       ${order.totalAmount !== undefined ? row('Order total', rupees(order.totalAmount)) : ''}
       ${order.shiprocketTrackingId ? row('Tracking ID', order.shiprocketTrackingId) : ''}
     </table>`,
    order.shiprocketTrackingUrl ? `Track it here: ${order.shiprocketTrackingUrl}` : ''
  );
  return sendEmail({ to: email, subject, html, text: `${subject}` });
};

export default transporter;
