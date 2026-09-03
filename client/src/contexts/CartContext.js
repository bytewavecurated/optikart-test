import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUserBehavior } from './UserBehaviorContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const CartContext = createContext(null);

const CART_KEY = 'optikart_cart';
const COUPON_KEY = 'optikart_coupon';
const MAX_ITEMS = 20;
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
        toast.error('Cart is full (max 20 items)');
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
    setItems((prevItems) => prevItems.filter((_, i) => i !== index));
  }, []);

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
    setCoupon(couponData);
  }, []);

  const removeCoupon = useCallback(() => {
    setCoupon(null);
  }, []);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = item.product.price || 0;
      return sum + price * item.quantity;
    }, 0);
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
