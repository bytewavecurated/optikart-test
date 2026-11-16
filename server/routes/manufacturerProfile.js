import express from 'express';
import Manufacturer from '../models/Manufacturer.js';
import Product from '../models/Product.js';
import ManufacturerSeller from '../models/ManufacturerSeller.js';
import { verifyManufacturer } from '../middleware/auth.js';
import { notifyAdmins } from '../services/notifications.js';
import { validateBrandListOwnership, clashMessage } from '../services/brandOwnership.js';

/*
 * A manufacturer's own profile: who they are, how they are registered, and which
 * brands they make.
 *
 * The account could already see its own record through `GET /me`, and the admin
 * console could edit it, but the manufacturer could not correct their own GST,
 * PAN, address or brand list. That gap has a cost with a receipt attached to it:
 * a company's GST and PAN appear on the invoices a buyer eventually holds, and a
 * brand list that nobody can edit is a brand list that drifts from what the
 * accountant filed.
 *
 * Validation lives here, once, so the two write paths (manufacturer self-edit
 * below, and the admin console) cannot disagree about what a legal GST or PAN
 * looks like. The admin create path currently copies fields without checking any
 * of them - that is noted as a gap rather than left implied.
 */

/*
 * State code (2 digits) + PAN (5 letters + 4 digits) + entity type letter +
 * entity number + 2 check characters = 15. The first version appended a further
 * [A-Z] at the end, demanding 16, which rejected every genuine GSTIN while
 * accepting nothing: the failure mode is a manufacturer who cannot file their
 * correct tax number and a screen that blames them for it.
 */
const GST = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]{3}$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
const PHONE = /^[6-9]\d{9}$/;
const PINCODE = /^\d{6}$/;

/**
 * Validate and merge a profile edit onto the document.
 *
 * Written as a pure-ish step returning errors so both write routes share it. Every
 * rejection names the field: "invalid" alone tells a shop owner nothing about what
 * to fix, and every rejected request here means somebody's invoice details.
 */
const applyProfileEdit = (manufacturer, body = {}) => {
  const errors = [];
  const changed = [];
  const text = (v) => String(v ?? '').trim();

  /*
   * Record a change only where the value differs.
   *
   * The first pass pushed every submitted field into `changed`, so editing a
   * profile is enough to make this endpoint claim - and tell the desk - that a
   * GSTIN or PAN was modified when the same value was simply resubmitted. The
   * admin notice exists because a tax identity changing is an event worth
   * looking at; a notice that fires on every save trains people to ignore it.
   */
  const setScalar = (field, value) => {
    if (String(manufacturer[field] ?? '') !== String(value ?? '')) {
      manufacturer[field] = value;
      changed.push(field);
      return true;
    }
    return false;
  };

  if (body.companyName !== undefined) {
    const v = text(body.companyName);
    if (v.length < 2) errors.push({ field: 'companyName', message: 'Company name is required.' });
    else setScalar('companyName', v);
  }

  if (body.name !== undefined) {
    const v = text(body.name);
    if (v.length < 2) errors.push({ field: 'name', message: 'Contact name is required.' });
    else setScalar('name', v);
  }

  if (body.phone !== undefined) {
    const v = text(body.phone);
    if (!PHONE.test(v)) errors.push({ field: 'phone', message: 'Phone must be 10 digits starting 6-9.' });
    else setScalar('phone', v);
  }

  // Email is deliberately not editable here. It is the login identity and the
  // OTP destination; changing it under the same request that returns a session
  // would let a stolen token move an account to an attacker's inbox, and the
  // "profile edit" screen is not the place to negotiate that risk. Admins move
  // logins through their own audited path instead.
  if (body.email !== undefined && text(body.email).toLowerCase() !== String(manufacturer.email || '').toLowerCase()) {
    errors.push({
      field: 'email',
      message: 'The sign-in email cannot be changed here. Ask OptiKart support to move the account.',
    });
  }

  if (body.gstNumber !== undefined) {
    const v = text(body.gstNumber).toUpperCase().replace(/\s/g, '');
    if (v && !GST.test(v))
      errors.push({ field: 'gstNumber', message: 'GST must be the 15-character GSTIN, e.g. 27ABCDE1234F1Z5.' });
    else setScalar('gstNumber', v);
  }

  if (body.panNumber !== undefined) {
    const v = text(body.panNumber).toUpperCase().replace(/\s/g, '');
    if (v && !PAN.test(v))
      errors.push({ field: 'panNumber', message: 'PAN must be the 10-character form, e.g. ABCDE1234F.' });
    else setScalar('panNumber', v);
  }

  if (body.address !== undefined && body.address !== null) {
    const a = body.address || {};
    const street = text(a.street);
    const city = text(a.city);
    const state = text(a.state);
    const pincode = text(a.pincode);
    if (street && street.length < 6)
      errors.push({ field: 'address.street', message: 'Street address looks too short to be deliverable.' });
    if (pincode && !PINCODE.test(pincode))
      errors.push({ field: 'address.pincode', message: 'PIN code must be 6 digits.' });
    const addressNow = manufacturer.address || {};
    const sameAddress =
      (addressNow.street || '') === (street || addressNow.street || '') &&
      (addressNow.city || '') === (city || addressNow.city || '') &&
      (addressNow.state || '') === (state || addressNow.state || '') &&
      String(addressNow.pincode || '') === String(pincode || addressNow.pincode || '');
    manufacturer.address = {
      ...(manufacturer.address?.toObject?.() || manufacturer.address || {}),
      street: street || manufacturer.address?.street || '',
      city: city || manufacturer.address?.city || '',
      state: state || manufacturer.address?.state || '',
      pincode: pincode || manufacturer.address?.pincode || '',
      country: text(a.country) || manufacturer.address?.country || 'India',
    };
    if (!sameAddress) changed.push('address');
  }

  if (body.website !== undefined) {
    const v = text(body.website);
    if (v && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v)) {
      errors.push({ field: 'website', message: 'Website must be a full http(s) address.' });
    } else setScalar('website', v);
  }

  if (body.description !== undefined) {
    const v = text(body.description);
    if (v.length > 1200) errors.push({ field: 'description', message: 'Description is limited to 1200 characters.' });
    else setScalar('description', v);
  }

  /*
   * Brands.
   *
   * This list decides which brand names a retailer of this manufacturer may see,
   * and the product pages group by it - so dropping a brand here while products
   * still carry it would strand catalogue the shop can no longer describe. Names
   * are de-duplicated case-insensitively because "Ray-Ban" and "ray-ban" read the
   * same to a shopper and behave as two brands to a filter.
   */
  if (body.brands !== undefined) {
    if (!Array.isArray(body.brands)) {
      errors.push({ field: 'brands', message: 'Brands must be a list.' });
    } else {
      const given = body.brands.map((b) => String(b ?? '').trim()).filter(Boolean);
      const clean = [...new Set(given)];
      if (clean.length !== given.length) {
        errors.push({ field: 'brands', message: 'Brand names must not repeat.' });
      }
      /*
       * A case-folded collision is the same problem wearing a different spelling:
       * "Ray-Ban" and "ray-ban" are one brand to a shopper, and keeping both makes
       * the brand pages show two of them and the filters disagree with each other.
       * Refused rather than merged, because merging silently would rewrite a name
       * the shop did not ask to change.
       */
      const folded = new Map();
      for (const name of clean) {
        const f = name.toLowerCase();
        if (folded.has(f)) {
          errors.push({
            field: 'brands',
            message: `"${name}" repeats "${folded.get(f)}" - a brand is one name whatever the capitalisation.`,
          });
        } else folded.set(f, name);
      }
      const dropping = (manufacturer.brands || []).filter(
        (b) => !clean.some((c) => c.toLowerCase() === String(b).toLowerCase())
      );
      const sameBrands =
        clean.length === (manufacturer.brands || []).length &&
        clean.every((b, i) => String((manufacturer.brands || [])[i] || '') === b);
      manufacturer.brands = clean;
      if (!sameBrands) changed.push('brands');
      if (dropping.length) {
        // Not refused outright, because renaming a brand legitimately retires a
        // name - but it must never be silent.
        console.log(
          JSON.stringify({
            event: 'brand_retired',
            manufacturer: String(manufacturer._id),
            brands: dropping,
            note: 'products may still carry these brand names until reassigned',
          })
        );
      }
    }
  }

  return { errors, changed };
};

export const registerProfileRoutes = (router) => {
  router.get('/profile', verifyManufacturer, async (req, res) => {
    try {
      const manufacturer = await Manufacturer.findById(req.manufacturer._id).lean();
      if (!manufacturer) return res.status(404).json({ success: false, message: 'Account not found.' });

      const [productCount, brandCounts, retailerCount] = await Promise.all([
        Product.countDocuments({ manufacturer: manufacturer._id }),
        Product.aggregate([
          { $match: { manufacturer: manufacturer._id } },
          { $group: { _id: '$brand', count: { $sum: 1 } } },
        ]),
        ManufacturerSeller.countDocuments({ manufacturer: manufacturer._id }),
      ]);

      res.json({
        success: true,
        profile: manufacturer,
        // What the declared brands actually carry, so a mismatch between the list
        // and the catalogue is visible on the screen rather than inferred.
        catalogue: {
          products: productCount,
          retailers: retailerCount,
          brandsInUse: brandCounts
            .filter((b) => b._id)
            .map((b) => ({ brand: b._id, count: b.count }))
            .sort((a, b) => String(a.brand).localeCompare(String(b.brand))),
        },
      });
    } catch (error) {
      console.error('Manufacturer profile read error:', error);
      res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
  });

  router.put('/profile', verifyManufacturer, async (req, res) => {
    try {
      const manufacturer = await Manufacturer.findById(req.manufacturer._id);
      if (!manufacturer) return res.status(404).json({ success: false, message: 'Account not found.' });

      const brandsBefore = [...(manufacturer.brands || [])];
      const { errors, changed } = applyProfileEdit(manufacturer, req.body || {});

      /*
       * Brand ownership is an async lookup, so it runs in the route rather than
       * inside the merge helper: that helper deliberately stays synchronous so
       * the two write paths (this profile save and the admin edit) share exactly
       * the same field rules without an await chain appearing in a pure function.
       *
       * On a clash the brand list is put back as it was and nothing is saved. A
       * half-applied profile - correct phone, someone else's brand - is the worst
       * outcome, because the shop then sees their own claim recorded.
       */
      if (!errors.length && changed.includes('brands')) {
        const clash = await validateBrandListOwnership(manufacturer.brands, manufacturer._id);
        if (clash.clashes.length) {
          manufacturer.brands = brandsBefore;
          return res.status(400).json({
            success: false,
            message:
              clash.clashes.length === 1
                ? 'That brand belongs to another manufacturer.'
                : `${clash.clashes.length} brands belong to other manufacturers.`,
            errors: clash.clashes.map((c) => ({ field: 'brands', message: clashMessage(c) })),
          });
        }
      }

      if (errors.length) {
        return res.status(400).json({
          success: false,
          message: errors.length === 1 ? errors[0].message : `${errors.length} fields need attention.`,
          errors,
        });
      }
      if (!changed.length) {
        return res.json({ success: true, message: 'Nothing to change.', profile: manufacturer.toJSON() });
      }

      manufacturer.updatedByPrincipal = { kind: 'manufacturer', id: String(manufacturer._id), at: new Date() };
      await manufacturer.save();

      await notifyAdmins({
        title: 'A manufacturer changed their profile',
        message: `${manufacturer.companyName} updated ${changed.join(', ')}${changed.includes('gstNumber') || changed.includes('panNumber') ? ' - these appear on invoices' : ''}.`,
        type: 'account',
        data: { manufacturerId: String(manufacturer._id), changed },
        io: req.app.get('io'),
      });

      res.json({ success: true, message: 'Profile saved.', changed, profile: manufacturer.toJSON() });
    } catch (error) {
      console.error('Manufacturer profile save error:', error);
      res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
  });

  return router;
};

/*
 * `verifyManufacturer` is imported rather than wrapped. The first version of this
 * file defined a local `verifyManufacturerGuard()` that called `next()`
 * unconditionally and claimed, in a comment, that the rules lived elsewhere: a
 * profile write that authenticates nobody, compiling cleanly, passing any test
 * that logs in first, and readable in review only by someone already suspicious
 * of it. Guard stubs that default to allow are the most dangerous kind of
 * placeholder, so there is no indirection here to get wrong.
 */
