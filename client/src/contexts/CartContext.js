import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUserBehavior } from './UserBehaviorContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const CartContext = createContext(null);

const CART_KEY = 'optikart_cart';
const DESELECT_KEY = 'optikart_cart_deselected';

// Stable identity for a cart line, so selection survives reordering.
export const lineKey = (item) =>
  [item?.product?._id || item?.product || '', item?.variant?.color || '', item?.variant?.size || '', item?.variant?.lensType || ''].join('|');
const COUPON_KEY = 'optikart_coupon';
// Logged-in shoppers may hold up to 25 line items in the cart.
const MAX_ITEMS = 25;
const DELIVERY_CHARGE_PER_ITEM = 16;

export const CartProvider = ({ children }) => {
  const { updateCartItems } = useUserBehavior();
  const { isAuthenticated } = useAuth();
  
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Which lines the shopper intends to buy. Defaults to everything selected so
  // the common case needs no interaction.
  const [deselected, setDeselectedRaw] = useState(() => {
    try {
      const raw = localStorage.getItem('optikart_cart_deselected');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [coupon, setCoupon] = useState(() => {
    try {
      const stored = localStorage.getItem(COUPON_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    // Sync with UserBehaviorContext
    updateCartItems(items);
  }, [items]);

  useEffect(() => {
    if (coupon) {
      localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
    } else {
      localStorage.removeItem(COUPON_KEY);
    }
  }, [coupon]);

  const addToCart = useCallback((product, selectedVariant = null, quantity = 1) => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to cart');
      return false;
    }

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) =>
          item.product._id === product._id &&
          (selectedVariant
            ? item.variant?.power === selectedVariant.power &&
              item.variant?.cylinder === selectedVariant.cylinder
            : !item.variant)
      );

      if (existingIndex > -1) {
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingIndex];
        const newQty = existingItem.quantity + quantity;
        updatedItems[existingIndex] = {
          ...existingItem,
          quantity: Math.min(newQty, 10),
        };
        return updatedItems;
      }

      if (prevItems.length >= MAX_ITEMS) {
        toast.error(`Cart is full (max ${MAX_ITEMS} items)`);
        return prevItems;
      }

      const newItem = {
        product,
        variant: selectedVariant,
        quantity,
        addedAt: new Date().toISOString(),
      };

      toast.success('Added to cart!');
      return [...prevItems, newItem];
    });
    return true;
  }, [isAuthenticated]);

  const removeFromCart = useCallback((index) => {
    setItems((prevItems) => {
      const target = prevItems[index];
      if (target) {
        setDeselectedRaw((prev) => {
          const next = new Set(prev);
          next.delete(lineKey(target));
          return next;
        });
      }
      return prevItems.filter((_, i) => i !== index);
    });
  }, []);

  const isSelected = useCallback((item) => !deselected.has(lineKey(item)), [deselected]);

  const toggleSelected = useCallback((item) => {
    const key = lineKey(item);
    setDeselectedRaw((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setDeselectedRaw(new Set()), []);

  const clearSelection = useCallback(() => {
    setDeselectedRaw(new Set(items.map(lineKey)));
  }, [items]);

  const updateQuantity = useCallback((index, quantity) => {
    if (quantity < 1) return;
    if (quantity > 10) return;

    setItems((prevItems) => {
      const updatedItems = [...prevItems];
      updatedItems[index] = {
        ...updatedItems[index],
        quantity,
      };
      return updatedItems;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
  }, []);

  const applyCoupon = useCallback((couponData) => {
    if (!couponData) return;
    // The API returns { code, discountType, discountValue, discount }; the cart
    // maths works in terms of type/value. Normalise so either shape works.
    const normalised = {
      ...couponData,
      code: couponData.code,
      type: couponData.type || couponData.discountType,
      value: couponData.value !== undefined ? couponData.value : couponData.discountValue,
      maxDiscount: couponData.maxDiscount
    };
    setCoupon(normalised);
  }, []);

  const removeCoupon = useCallback(() => {
    setCoupon(null);
  }, []);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Price of one line, honouring the colour/size actually chosen.
  const linePrice = (item) => {
    const p = item.product || {};
    const variant = (p.variants || []).find((v) => {
      const sel = item.variant || {};
      const wanted = Object.entries(sel).filter(([, val]) => val !== undefined && val !== null && String(val) !== '');
      if (wanted.length === 0) return false;
      return wanted.every(([key, val]) =>
        String(v[key] ?? '').trim().toLowerCase() === String(val).trim().toLowerCase());
    });
    const base = variant
      ? (variant.discountedPrice || variant.price)
      : (p.discountedPrice || p.price || 0);
    const lens = item.lensConfig?.price || 0;
    return base + lens;
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + linePrice(item) * item.quantity, 0);
  }, [items]);

  const deliveryCharges = useMemo(() => {
    if (items.length === 0) return 0;
    return items.length * DELIVERY_CHARGE_PER_ITEM;
  }, [items]);

  const discount = useMemo(() => {
    if (!coupon) return 0;

    if (coupon.type === 'percentage') {
      const calculated = (subtotal * coupon.value) / 100;
      return coupon.maxDiscount
        ? Math.min(calculated, coupon.maxDiscount)
        : calculated;
    }

    if (coupon.type === 'flat') {
      return Math.min(coupon.value, subtotal);
    }

    return 0;
  }, [coupon, subtotal]);

  const selectedItems = useMemo(
    () => items.filter((item) => !deselected.has(lineKey(item))),
    [items, deselected]
  );

  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + linePrice(item) * item.quantity, 0),
    [selectedItems]
  );

  const selectedCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems]
  );

  // Delivery is charged per selected line only.
  const selectedDelivery = useMemo(
    () => (selectedItems.length === 0 ? 0 : selectedItems.length * DELIVERY_CHARGE_PER_ITEM),
    [selectedItems]
  );

  const selectedDiscount = useMemo(() => {
    if (!coupon || selectedSubtotal === 0) return 0;
    if (coupon.type === 'percentage') {
      const calculated = (selectedSubtotal * coupon.value) / 100;
      return coupon.maxDiscount ? Math.min(calculated, coupon.maxDiscount) : calculated;
    }
    if (coupon.type === 'flat') return Math.min(coupon.value, selectedSubtotal);
    return 0;
  }, [coupon, selectedSubtotal]);

  const selectedTotal = useMemo(
    () => Math.max(0, Math.round((selectedSubtotal + selectedDelivery - selectedDiscount) * 100) / 100),
    [selectedSubtotal, selectedDelivery, selectedDiscount]
  );

  const total = useMemo(() => {
    const calculated = subtotal + deliveryCharges - discount;
    return Math.max(calculated, 0);
  }, [subtotal, deliveryCharges, discount]);

  const value = {
    items,
    totalItems,
    subtotal,
    deliveryCharges,
    discount,
    total,
    coupon,
    addToCart,
    removeFromCart,
    updateQuantity,
    linePrice,
    isSelected,
    toggleSelected,
    selectAll,
    clearSelection,
    selectedItems,
    selectedSubtotal,
    selectedCount,
    selectedTotal,
    selectedDelivery,
    MAX_ITEMS,
    clearCart,
    applyCoupon,
    removeCoupon,
    MAX_ITEMS,
    DELIVERY_CHARGE_PER_ITEM,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
