import Manufacturer from '../models/Manufacturer.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import Product from '../models/Product.js';
import { sendEmail } from './email.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Delete manufacturer seller (by manufacturer)
 */
export const deleteManufacturerSeller = async (sellerId, manufacturerId) => {
  try {
    const seller = await ManufacturerSeller.findOne({
      _id: sellerId,
      manufacturer: manufacturerId
    });

    if (!seller) {
      return {
        success: false,
        error: 'Seller not found or not authorized'
      };
    }

    // Soft delete
    seller.isActive = false;
    seller.isBanned = true;
    seller.banReason = 'Deleted by manufacturer';
    seller.bannedAt = new Date();
    seller.bannedBy = manufacturerId;

    await seller.save();

    // Notify seller
    await sendEmail(
      seller.email,
      'Account Deactivated',
      `Your seller account has been deactivated by the manufacturer. If you have questions, please contact the manufacturer directly.`
    );

    return {
      success: true,
      message: 'Seller deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting manufacturer seller:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Ban manufacturer seller
 */
export const banManufacturerSeller = async (sellerId, manufacturerId, reason) => {
  try {
    const seller = await ManufacturerSeller.findOne({
      _id: sellerId,
      manufacturer: manufacturerId
    });

    if (!seller) {
      return {
        success: false,
        error: 'Seller not found or not authorized'
      };
    }

    seller.isBanned = true;
    seller.banReason = reason;
    seller.bannedAt = new Date();
    seller.bannedBy = manufacturerId;

    await seller.save();

    // Notify seller
    await sendEmail(
      seller.email,
      'Account Banned',
      `Your seller account has been banned. Reason: ${reason}`
    );

    return {
      success: true,
      message: 'Seller banned successfully'
    };
  } catch (error) {
    console.error('Error banning manufacturer seller:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validate bulk upload file
 * Check if file contains mixed products (sunglasses + eyeglasses)
 */
export const validateBulkUpload = async (products) => {
  try {
    const categories = new Set(products.map(p => p.category));
    
    if (categories.size > 1) {
      return {
        success: false,
        error: 'Mixed products detected. Please upload sunglasses and eyeglasses in separate files.',
        categories: Array.from(categories)
      };
    }

    // Validate required fields
    const requiredFields = ['title', 'brand', 'category', 'price', 'frameShape', 'frameType', 'frameMaterial'];
    const invalidProducts = [];

    products.forEach((product, index) => {
      const missingFields = requiredFields.filter(field => !product[field]);
      if (missingFields.length > 0) {
        invalidProducts.push({
          index: index + 1,
          missingFields
        });
      }
    });

    if (invalidProducts.length > 0) {
      return {
        success: false,
        error: 'Some products are missing required fields',
        invalidProducts
      };
    }

    return {
      success: true,
      message: 'Bulk upload validation passed',
      category: Array.from(categories)[0]
    };
  } catch (error) {
    console.error('Error validating bulk upload:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Convert image URL to product images
 * Download image from URL and save to server
 */
export const convertImageLink = async (imageUrl, productId) => {
  try {
    // Download image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    // Generate filename
    const ext = path.extname(imageUrl) || '.jpg';
    const filename = `product_${productId}_${Date.now()}${ext}`;
    const filepath = path.join(process.cwd(), 'uploads', 'products', filename);

    // Save image
    fs.writeFileSync(filepath, response.data);

    // Return relative URL
    return `/uploads/products/${filename}`;
  } catch (error) {
    console.error('Error converting image link:', error);
    return null;
  }
};

/**
 * Process bulk upload with image conversion
 */
export const processBulkUploadWithImages = async (products, manufacturerId) => {
  try {
    const processedProducts = [];

    for (const product of products) {
      // Convert image URLs if present
      if (product.imageLinks && Array.isArray(product.imageLinks)) {
        const imagePaths = [];
        for (const link of product.imageLinks) {
          const imagePath = await convertImageLink(link, product.title);
          if (imagePath) {
            imagePaths.push(imagePath);
          }
        }
        product.images = imagePaths;
      }

      // Add manufacturer ID
      product.manufacturer = manufacturerId;
      product.verificationStatus = 'pending';

      // Create product
      const newProduct = new Product(product);
      await newProduct.save();
      processedProducts.push(newProduct);
    }

    return {
      success: true,
      message: `Successfully processed ${processedProducts.length} products`,
      products: processedProducts
    };
  } catch (error) {
    console.error('Error processing bulk upload:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get manufacturer's pending products
 */
export const getManufacturerPendingProducts = async (manufacturerId) => {
  try {
    const products = await Product.find({
      manufacturer: manufacturerId,
      verificationStatus: 'pending'
    }).sort({ createdAt: -1 });

    return {
      success: true,
      count: products.length,
      products
    };
  } catch (error) {
    console.error('Error getting pending products:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update pending product (by manufacturer)
 */
export const updatePendingProduct = async (productId, updateData, manufacturerId) => {
  try {
    const product = await Product.findOne({
      _id: productId,
      manufacturer: manufacturerId,
      verificationStatus: { $in: ['pending', 'data_incorrect'] }
    });

    if (!product) {
      return {
        success: false,
        error: 'Product not found or cannot be edited'
      };
    }

    // Update product
    Object.assign(product, updateData);
    product.verificationStatus = 'pending';
    product.submittedAt = new Date();

    await product.save();

    return {
      success: true,
      message: 'Product updated and resubmitted for verification',
      product
    };
  } catch (error) {
    console.error('Error updating pending product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete pending product (by manufacturer)
 */
export const deletePendingProduct = async (productId, manufacturerId) => {
  try {
    const product = await Product.findOne({
      _id: productId,
      manufacturer: manufacturerId,
      verificationStatus: { $in: ['pending', 'data_incorrect'] }
    });

    if (!product) {
      return {
        success: false,
        error: 'Product not found or cannot be deleted'
      };
    }

    await Product.findByIdAndDelete(productId);

    return {
      success: true,
      message: 'Product deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting pending product:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  deleteManufacturerSeller,
  banManufacturerSeller,
  validateBulkUpload,
  convertImageLink,
  processBulkUploadWithImages,
  getManufacturerPendingProducts,
  updatePendingProduct,
  deletePendingProduct
};
