import Manufacturer from '../models/Manufacturer.js';
import { saveUpload } from './storage.js';
import { isDisallowedHost, fetchSameOriginGuarded } from '../routes/manufacturer.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import Product from '../models/Product.js';
import { sendEmail, notify } from './email.js';
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
      manufacturer: manufacturerId,
    });

    if (!seller) {
      return {
        success: false,
        error: 'Seller not found or not authorized',
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
    await notify(
      seller.email,
      'Account Deactivated',
      `Your seller account has been deactivated by the manufacturer. If you have questions, please contact the manufacturer directly.`
    );

    return {
      success: true,
      message: 'Seller deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting manufacturer seller:', error);
    return {
      success: false,
      error: error.message,
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
      manufacturer: manufacturerId,
    });

    if (!seller) {
      return {
        success: false,
        error: 'Seller not found or not authorized',
      };
    }

    seller.isBanned = true;
    seller.banReason = reason;
    seller.bannedAt = new Date();
    seller.bannedBy = manufacturerId;

    await seller.save();

    // Notify seller
    await notify(seller.email, 'Account Banned', `Your seller account has been banned. Reason: ${reason}`);

    return {
      success: true,
      message: 'Seller banned successfully',
    };
  } catch (error) {
    console.error('Error banning manufacturer seller:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Validate bulk upload file
 * Check if file contains mixed products (sunglasses + eyeglasses)
 */
export const validateBulkUpload = async (products) => {
  try {
    const categories = new Set(products.map((p) => p.category));

    if (categories.size > 1) {
      return {
        success: false,
        error: 'Mixed products detected. Please upload sunglasses and eyeglasses in separate files.',
        categories: Array.from(categories),
      };
    }

    // Validate required fields
    const requiredFields = ['title', 'brand', 'category', 'price', 'frameShape', 'frameType', 'frameMaterial'];
    const invalidProducts = [];

    products.forEach((product, index) => {
      const missingFields = requiredFields.filter((field) => !product[field]);
      if (missingFields.length > 0) {
        invalidProducts.push({
          index: index + 1,
          missingFields,
        });
      }
    });

    if (invalidProducts.length > 0) {
      return {
        success: false,
        error: 'Some products are missing required fields',
        invalidProducts,
      };
    }

    return {
      success: true,
      message: 'Bulk upload validation passed',
      category: Array.from(categories)[0],
    };
  } catch (error) {
    console.error('Error validating bulk upload:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Convert image URL to product images
 * Download image from URL and save to server
 */
export const convertImageLink = async (imageUrl, productId) => {
  /*
   * Downloading an arbitrary URL and then writing it under
   * `path.extname(imageUrl) || '.jpg'` - straight into process.cwd's
   * uploads/products - carried the extension with no whitelist at all: a link
   * ending in `.php` or `.html` was written, with that name, into the directory
   * this app serves to browsers. The size was unbounded, the bytes were never
   * checked for actually being an image, and the Cloudinary-or-local decision
   * that every other upload now makes did not exist here.
   *
   * saveUpload() owns the naming, the extension whitelist, the folder whitelist
   * and the provider; the fetch re-checks every redirect for the same reason
   * described in routes/manufacturer.js (an approved host can 302 to an internal
   * one).
   *
   * `null` is no longer a valid answer. This function is called while a bulk
   * upload runs, and `null` used to disappear into that loop, so a sheet whose
   * images all failed to download still reported a successful import with
   * missing pictures. Callers get the reason and can say it per row.
   */
  try {
    const target = new URL(String(imageUrl));
    if (!/^https?:$/.test(target.protocol)) return { ok: false, reason: 'not an http(s) URL' };
    if (isDisallowedHost(target.hostname)) {
      return { ok: false, reason: "the link points inside this server's own network, which the app will not fetch" };
    }
    const response = await fetchSameOriginGuarded(target.toString(), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { ok: false, reason: `the image host answered HTTP ${response.status}` };

    const type = String(response.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(type)) {
      return { ok: false, reason: `that URL returned "${type || 'no content type'}", not an image` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return { ok: false, reason: 'the image host returned no bytes' };

    const asset = await saveUpload({
      buffer,
      originalname: `link.${type.split('/')[1].replace('jpeg', 'jpg')}`,
      mimeType: type,
      folder: 'products',
    });
    return { ok: true, url: asset.url, provider: asset.provider };
  } catch (error) {
    console.error('convertImageLink failed:', String(error?.message || error).slice(0, 160));
    return { ok: false, reason: String(error?.message || error).slice(0, 160) };
  }
};

/**
 * Process bulk upload with image conversion
 */
export const processBulkUploadWithImages = async (products, manufacturerId) => {
  try {
    const processedProducts = [];
    const imageWarnings = [];

    for (const product of products) {
      // Convert image URLs if present
      if (product.imageLinks && Array.isArray(product.imageLinks)) {
        /*
         * The old loop dropped a failed download on the floor: `if (imagePath)`
         * with convertImageLink returning null on every error meant a sheet whose
         * image hosts were down still imported, with product.images = [], and the
         * manufacturer was told the upload succeeded. Images are the listing; an
         * import that silently produces none is a defect that shows up weeks later
         * as a customer complaint.
         *
         * Now the failures are collected and returned with the products, so the
         * route can name the rows that lost their pictures instead of pretending
         * they have none by accident.
         */
        const imagePaths = [];
        const imageFailures = [];
        for (const link of product.imageLinks) {
          const result = await convertImageLink(link, product.title);
          if (result && result.ok) imagePaths.push(result.url);
          else imageFailures.push({ link: String(link).slice(0, 120), reason: result?.reason || 'unknown' });
        }
        product.images = imagePaths;
        if (imageFailures.length) {
          imageWarnings.push({ product: product.title || '(untitled)', failures: imageFailures });
        }
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
      products: processedProducts,
      /*
       * Without this the warnings were computed and thrown away - the same
       * shape of mistake as returning nothing for a failed download, one layer
       * up. A caller that does not look cannot report what it does not have.
       */
      imageWarnings,
    };
  } catch (error) {
    console.error('Error processing bulk upload:', error);
    return {
      success: false,
      error: error.message,
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
      verificationStatus: 'pending',
    }).sort({ createdAt: -1 });

    return {
      success: true,
      count: products.length,
      products,
    };
  } catch (error) {
    console.error('Error getting pending products:', error);
    return {
      success: false,
      error: error.message,
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
      verificationStatus: { $in: ['pending', 'data_incorrect'] },
    });

    if (!product) {
      return {
        success: false,
        error: 'Product not found or cannot be edited',
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
      product,
    };
  } catch (error) {
    console.error('Error updating pending product:', error);
    return {
      success: false,
      error: error.message,
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
      verificationStatus: { $in: ['pending', 'data_incorrect'] },
    });

    if (!product) {
      return {
        success: false,
        error: 'Product not found or cannot be deleted',
      };
    }

    await Product.findByIdAndDelete(productId);

    return {
      success: true,
      message: 'Product deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting pending product:', error);
    return {
      success: false,
      error: error.message,
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
  deletePendingProduct,
};
