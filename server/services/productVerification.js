import ProductVerification from '../models/ProductVerification.js';
import Product from '../models/Product.js';
import { sendEmail } from './email.js';

const ACCEPTANCE_DEADLINE_DAYS = 7; // 7 working days

/**
 * Submit product for verification
 */
export const submitProductForVerification = async (productId, manufacturerId, submittedById) => {
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    // Check if verification already exists
    const existingVerification = await ProductVerification.findOne({
      product: productId,
      status: { $in: ['pending', 'verified'] }
    });

    if (existingVerification) {
      throw new Error('Product already submitted for verification');
    }

    // Calculate acceptance deadline (7 working days from now)
    const acceptanceDeadline = new Date();
    acceptanceDeadline.setDate(acceptanceDeadline.getDate() + ACCEPTANCE_DEADLINE_DAYS);

    const verification = await ProductVerification.create({
      product: productId,
      manufacturer: manufacturerId,
      submittedBy: submittedById,
      status: 'pending',
      submittedAt: new Date(),
      acceptanceDeadline
    });

    // Send email to admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'New Product Submitted for Verification',
      text: `A new product "${product.title}" has been submitted for verification by manufacturer.`
    });

    return {
      success: true,
      verification
    };
  } catch (error) {
    console.error('Error submitting product for verification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify product (admin)
 */
export const verifyProduct = async (verificationId, adminId, notes = '') => {
  try {
    const verification = await ProductVerification.findById(verificationId)
      .populate('product')
      .populate('manufacturer');

    if (!verification) {
      throw new Error('Verification not found');
    }

    verification.status = 'verified';
    verification.verifiedBy = adminId;
    verification.verificationNotes = notes;
    verification.verifiedAt = new Date();
    await verification.save();

    // Update product status
    const product = await Product.findById(verification.product._id);
    product.verificationStatus = 'verified';
    product.isActive = true; // Make product visible on marketplace
    await product.save();

    // Send email to manufacturer
    await sendEmail({
      to: verification.manufacturer.email,
      subject: 'Product Verified Successfully',
      text: `Your product "${product.title}" has been verified and is now live on the marketplace. Please accept within 7 working days.`
    });

    return {
      success: true,
      verification,
      product
    };
  } catch (error) {
    console.error('Error verifying product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reject product (admin)
 */
export const rejectProduct = async (verificationId, adminId, reason, updateRequired = []) => {
  try {
    const verification = await ProductVerification.findById(verificationId)
      .populate('product')
      .populate('manufacturer');

    if (!verification) {
      throw new Error('Verification not found');
    }

    verification.status = 'needs_update';
    verification.verifiedBy = adminId;
    verification.rejectionReason = reason;
    verification.updateRequired = updateRequired;
    verification.verifiedAt = new Date();
    await verification.save();

    // Update product status
    const product = await Product.findById(verification.product._id);
    product.verificationStatus = 'rejected';
    product.isActive = false;
    await product.save();

    // Send email to manufacturer
    await sendEmail({
      to: verification.manufacturer.email,
      subject: 'Product Verification Requires Updates',
      text: `Your product "${product.title}" requires updates. Reason: ${reason}. Please update and resubmit.`
    });

    return {
      success: true,
      verification,
      product
    };
  } catch (error) {
    console.error('Error rejecting product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Manufacturer accepts verified product
 */
export const manufacturerAcceptProduct = async (verificationId, manufacturerId) => {
  try {
    const verification = await ProductVerification.findById(verificationId);

    if (!verification) {
      throw new Error('Verification not found');
    }

    if (verification.manufacturer.toString() !== manufacturerId.toString()) {
      throw new Error('Unauthorized');
    }

    if (verification.status !== 'verified') {
      throw new Error('Product is not verified');
    }

    verification.acceptedByManufacturer = true;
    verification.acceptedAt = new Date();
    await verification.save();

    return {
      success: true,
      verification
    };
  } catch (error) {
    console.error('Error accepting product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get manufacturer's pending verifications
 */
export const getManufacturerPendingVerifications = async (manufacturerId) => {
  try {
    const verifications = await ProductVerification.find({
      manufacturer: manufacturerId,
      status: { $in: ['pending', 'verified', 'needs_update'] }
    })
      .populate('product')
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1 });

    return {
      success: true,
      verifications
    };
  } catch (error) {
    console.error('Error getting manufacturer pending verifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all verifications (admin)
 */
export const getAllVerifications = async (filters = {}) => {
  try {
    const verifications = await ProductVerification.find(filters)
      .populate('product')
      .populate('manufacturer', 'name companyName')
      .populate('submittedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1 });

    return {
      success: true,
      verifications
    };
  } catch (error) {
    console.error('Error getting all verifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check for expired acceptances
 */
export const checkExpiredAcceptances = async () => {
  try {
    const expiredVerifications = await ProductVerification.find({
      status: 'verified',
      acceptedByManufacturer: false,
      acceptanceDeadline: { $lt: new Date() }
    });

    for (const verification of expiredVerifications) {
      // Deactivate product
      await Product.findByIdAndUpdate(verification.product, {
        isActive: false,
        verificationStatus: 'expired'
      });

      // Send notification
      await sendEmail({
        to: verification.manufacturer.email,
        subject: 'Product Verification Expired',
        text: `Your product verification has expired as it was not accepted within 7 working days.`
      });
    }

    return {
      success: true,
      expiredCount: expiredVerifications.length
    };
  } catch (error) {
    console.error('Error checking expired acceptances:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  submitProductForVerification,
  verifyProduct,
  rejectProduct,
  manufacturerAcceptProduct,
  getManufacturerPendingVerifications,
  getAllVerifications,
  checkExpiredAcceptances
};
