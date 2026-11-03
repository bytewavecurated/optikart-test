import express from 'express';
import SiteContent from '../models/SiteContent.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

const ICON_NAMES = new Set([
  'Sun', 'Eye', 'Droplet', 'BookOpen', 'Activity', 'Zap', 'Monitor', 'Tool', 'Smile',
  'Percent', 'Gift', 'Award', 'Truck', 'Shield', 'RefreshCw', 'Headphones', 'Tag', 'User'
]);

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Everything the admin can save is checked here rather than trusting the form.
 * A bad value is reported as that field, so the editor can show why it refused:
 * silently dropping a broken tile is how a hidden promotion comes back later.
 */
export const validateHome = (input = {}) => {
  const errors = [];
  const clean = {};

  const str = (value, max, where) => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') {
      errors.push(`${where}: must be text`);
      return '';
    }
    const trimmed = value.trim();
    if (trimmed.length > max) errors.push(`${where}: longer than ${max} characters`);
    return trimmed.slice(0, max);
  };

  if (input.headings && typeof input.headings === 'object') {
    const out = {};
    Object.entries(input.headings).forEach(([k, v]) => {
      out[k] = str(v, k.endsWith('Sub') ? 120 : 80, `Heading "${k}"`);
    });
    clean.headings = out;
  }

  if (input.visible && typeof input.visible === 'object') {
    const out = {};
    Object.entries(input.visible).forEach(([k, v]) => {
      if (typeof v !== 'boolean') errors.push(`Block "${k}": visibility must be true or false`);
      else out[k] = v;
    });
    clean.visible = out;
  }

  const entries = (value, where, { needIcon, needLink, max } = {}) => {
    if (!Array.isArray(value)) {
      errors.push(`${where}: expected a list`);
      return [];
    }
    if (value.length > (max || 24)) errors.push(`${where}: more than ${max || 24} items`);
    return value.slice(0, max || 24).map((raw, i) => {
      const item = raw || {};
      const row = {
        name: str(item.name, 60, `${where} item ${i + 1} name`),
        slug: str(item.slug, 80, `${where} item ${i + 1} slug`),
        link: str(item.link, 120, `${where} item ${i + 1} link`),
        icon: str(item.icon, 30, `${where} item ${i + 1} icon`),
        tint: str(item.tint, 20, `${where} item ${i + 1} tint`),
        fg: str(item.fg, 20, `${where} item ${i + 1} colour`),
        image: str(item.image, 200, `${where} item ${i + 1} image`),
        subtitle: str(item.subtitle, 90, `${where} item ${i + 1} subtitle`)
      };
      if (!row.name) errors.push(`${where} item ${i + 1}: needs a name`);
      if (needIcon && row.icon && !ICON_NAMES.has(row.icon)) {
        errors.push(`${where} item ${i + 1}: icon "${row.icon}" is not one of ${[...ICON_NAMES].join(', ')}`);
        row.icon = '';
      }
      if (needLink && !row.link && !row.slug) {
        errors.push(`${where} item ${i + 1}: give it a link or a category slug`);
      }
      if (row.link && !/^(\/|https:\/\/)/.test(row.link)) {
        errors.push(`${where} item ${i + 1}: link must start with / or https://`);
        row.link = '';
      }
      ['tint', 'fg'].forEach((field) => {
        if (row[field] && !COLOR.test(row[field])) {
          errors.push(`${where} item ${i + 1}: ${field} must be a hex colour such as #2874f0`);
          row[field] = '';
        }
      });
      if (row.image && !/^(\/|https:\/\/)/.test(row.image)) {
        errors.push(`${where} item ${i + 1}: image must be a path starting with / or a https:// URL`);
        row.image = '';
      }
      return row;
    }).filter((row) => row.name);
  };

  if (input.categoryRail !== undefined) clean.categoryRail = entries(input.categoryRail, 'Category tiles', { needIcon: true, needLink: true });
  if (input.promoTiles !== undefined) clean.promoTiles = entries(input.promoTiles, 'Promo tiles', { needIcon: true, needLink: true });
  if (input.genderTiles !== undefined) clean.genderTiles = entries(input.genderTiles, 'Gender tiles');

  const words = (value, where) => {
    if (!Array.isArray(value)) {
      errors.push(`${where}: expected a list`);
      return [];
    }
    if (value.length > 24) errors.push(`${where}: more than 24 values`);
    return value.map((v, i) => str(v, 40, `${where} #${i + 1}`)).filter(Boolean);
  };
  if (input.faceShapes !== undefined) clean.faceShapes = words(input.faceShapes, 'Face shapes');
  if (input.frameTypes !== undefined) clean.frameTypes = words(input.frameTypes, 'Frame types');
  if (input.frameMaterials !== undefined) clean.frameMaterials = words(input.frameMaterials, 'Materials');

  if (input.notes !== undefined) clean.notes = str(input.notes, 400, 'Notes');

  return { errors, clean };
};

/** Public: the overrides only. The client owns the defaults and merges them. */
router.get('/home', async (req, res) => {
  try {
    const doc = await SiteContent.findOne({ key: 'home' }).lean();
    res.json({ success: true, home: doc || { key: 'home' }, defaults: false });
  } catch (error) {
    console.error('Site content read error:', error);
    // The home page renders from its built-in defaults when this fails, so a
    // broken response here must never take the storefront down.
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/home', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { errors, clean } = validateHome(req.body || {});
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Some values need attention. Nothing was saved.', errors: errors.slice(0, 20) });
    }
    const doc = await SiteContent.findOneAndUpdate(
      { key: 'home' },
      { ...clean, key: 'home', updatedBy: req.user.id || req.user._id, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ success: true, home: doc });
  } catch (error) {
    console.error('Site content save error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Back to the code defaults: clears only the blocks named, or everything. */
router.delete('/home', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await SiteContent.deleteOne({ key: 'home' });
    res.json({ success: true, message: 'Storefront content reset to the built-in defaults.' });
  } catch (error) {
    console.error('Site content reset error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
