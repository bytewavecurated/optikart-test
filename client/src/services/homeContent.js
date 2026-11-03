import { useCallback, useEffect, useState } from 'react';
import {
  FiActivity, FiAirplay, FiAward, FiBookOpen, FiCamera, FiDroplet, FiEye, FiGift,
  FiHeadphones, FiHexagon, FiLayers, FiMonitor, FiPercent, FiPhoneCall, FiRefreshCw,
  FiShield, FiSmile, FiSun, FiTag, FiTool, FiTruck, FiUser, FiZap
} from 'react-icons/fi';
import api from './api';

/**
 * Home page content the administrator can change.
 *
 * The store holds only what was overridden and this hook merges it onto the
 * defaults that live next to the components using them. Two consequences matter:
 * the storefront still renders a complete home page if this API errors or is slow
 * (the defaults are local, so there is no blank-page failure), and the copy does
 * not get duplicated into a second place that can drift from the catalogue.
 */
/*
 * Icons are chosen from this list by name in the admin editor. Storing a name
 * instead of markup means the only thing the server can hand back is one of the
 * components we already ship, so a bad value cannot inject anything.
 */
export const HOME_ICONS = {
  Sun: FiSun, Eye: FiEye, Droplet: FiDroplet, BookOpen: FiBookOpen,
  Activity: FiActivity, Zap: FiZap, Monitor: FiMonitor, Tool: FiTool,
  Smile: FiSmile, Percent: FiPercent, Gift: FiGift, Award: FiAward,
  Truck: FiTruck, Shield: FiShield, RefreshCw: FiRefreshCw,
  Headphones: FiHeadphones, Tag: FiTag, User: FiUser,
  Layers: FiLayers, Hexagon: FiHexagon, Camera: FiCamera,
  Phone: FiPhoneCall, Airplay: FiAirplay
};

export const ICON_NAMES = Object.keys(HOME_ICONS).sort();

/** The stored icon name as a component, or null when it is empty or unknown. */
export const iconFor = (name) => HOME_ICONS[name] || null;

const DEFAULT_HEADINGS = {
  categories: 'Shop by Category',
  categoriesSub: 'Find exactly what you are looking for',
  faceShape: 'Shop by Face Shape',
  faceShapeSub: 'Pick the frame that suits you best',
  frameType: 'Shop by Frame Type',
  frameTypeSub: 'Full rim, half rim and rimless constructions',
  material: 'Shop by Material',
  materialSub: 'The material decides the weight, feel and durability',
  offers: 'Offers',
  trending: 'Trending Now',
  deals: 'Deals of the Day'
};

const DEFAULT_VISIBLE = {
  categoryRail: true,
  faceShapeRail: true,
  frameTypeRail: true,
  materialRail: true,
  promoTiles: true,
  gender: true
};

export function useHomeContent() {
  const [overrides, setOverrides] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/site-content/home');
      setOverrides(res.data.home || {});
    } catch (error) {
      // Rendered from defaults underneath; an outage here is not worth a toast.
      setOverrides({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stored = overrides || {};
  return {
    loading,
    reload: load,
    stored,
    hasOverrides: Boolean(
      (stored.categoryRail || []).length
      || (stored.promoTiles || []).length
      || (stored.genderTiles || []).length
      || Object.keys(stored.headings || {}).some((k) => (stored.headings[k] || '') !== '')
    ),
    heading: (key) => (stored.headings && stored.headings[key]) || DEFAULT_HEADINGS[key] || '',
    visible: (key) => stored.visible?.[key] !== undefined ? stored.visible[key] : DEFAULT_VISIBLE[key],
    categoryRail: (stored.categoryRail || []).length ? stored.categoryRail : null,
    promoTiles: (stored.promoTiles || []).length ? stored.promoTiles : null,
    genderTiles: (stored.genderTiles || []).length ? stored.genderTiles : null,
    faceShapes: (stored.faceShapes || []).length ? stored.faceShapes : null,
    frameTypes: (stored.frameTypes || []).length ? stored.frameTypes : null,
    frameMaterials: (stored.frameMaterials || []).length ? stored.frameMaterials : null,
    defaults: { headings: DEFAULT_HEADINGS, visible: DEFAULT_VISIBLE }
  };
}
