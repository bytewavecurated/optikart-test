import React, { createContext, useContext, useState, useEffect } from 'react';

const UserBehaviorContext = createContext();

export const useUserBehavior = () => {
  const context = useContext(UserBehaviorContext);
  if (!context) {
    throw new Error('useUserBehavior must be used within UserBehaviorProvider');
  }
  return context;
};

export const UserBehaviorProvider = ({ children }) => {
  const [searchHistory, setSearchHistory] = useState([]);
  const [browsingHistory, setBrowsingHistory] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [cartItems, setCartItems] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedSearchHistory = localStorage.getItem('searchHistory');
    const savedBrowsingHistory = localStorage.getItem('browsingHistory');
    const savedWishlist = localStorage.getItem('wishlist');
    const savedCartItems = localStorage.getItem('cartItems');

    if (savedSearchHistory) setSearchHistory(JSON.parse(savedSearchHistory));
    if (savedBrowsingHistory) setBrowsingHistory(JSON.parse(savedBrowsingHistory));
    if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
    if (savedCartItems) setCartItems(JSON.parse(savedCartItems));
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('browsingHistory', JSON.stringify(browsingHistory));
  }, [browsingHistory]);

  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems]);

  const addSearchQuery = (query) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== query);
      return [query, ...filtered].slice(0, 20); // Keep last 20 searches
    });
  };

  const addBrowsingHistory = (product) => {
    setBrowsingHistory(prev => {
      const filtered = prev.filter(item => item._id !== product._id);
      return [product, ...filtered].slice(0, 50); // Keep last 50 products
    });
  };

  const updateWishlist = (items) => {
    setWishlist(items);
  };

  const updateCartItems = (items) => {
    setCartItems(items);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    setBrowsingHistory([]);
    localStorage.removeItem('searchHistory');
    localStorage.removeItem('browsingHistory');
  };

  const value = {
    searchHistory,
    browsingHistory,
    wishlist,
    cartItems,
    addSearchQuery,
    addBrowsingHistory,
    updateWishlist,
    updateCartItems,
    clearHistory
  };

  return (
    <UserBehaviorContext.Provider value={value}>
      {children}
    </UserBehaviorContext.Provider>
  );
};
