import React, { createContext, useState, useContext, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

const CART_STORAGE_KEY = 'campusbites_cart';

export const CartProvider = ({ children }) => {

  // 🔥 FIX 1: load cart directly from localStorage
  const [items, setItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      return savedCart ? JSON.parse(savedCart) : [];
    } catch {
      return [];
    }
  });

  const [total, setTotal] = useState(0);

  // 🔥 FIX 2: save + calculate total
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));

    const newTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    setTotal(Number(newTotal.toFixed(2)));
  }, [items]);

  // 🔥 ADD TO CART
  const addToCart = (foodItem) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === foodItem.id);

      let updatedItems;

      if (existingItem) {
        updatedItems = prevItems.map((item) =>
          item.id === foodItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );

        toast.success(`Added another ${foodItem.name}`, {
          id: `cart-${foodItem.id}`,
        });

      } else {
        updatedItems = [...prevItems, { ...foodItem, quantity: 1 }];

        toast.success(`${foodItem.name} added to cart`, {
          id: `cart-${foodItem.id}`,
        });
      }

      return updatedItems;
    });
  };

  // 🔥 UPDATE QUANTITY
  const updateQuantity = (id, delta) => {
    setItems((prevItems) => {
      const item = prevItems.find((i) => i.id === id);
      if (!item) return prevItems;

      const newQuantity = item.quantity + delta;

      if (newQuantity <= 0) {
        toast.success('Item removed from cart', { id: `remove-${id}` });
        return prevItems.filter((i) => i.id !== id);
      }

      return prevItems.map((i) =>
        i.id === id ? { ...i, quantity: newQuantity } : i
      );
    });
  };

  // 🔥 REMOVE ITEM
  const removeItem = (id) => {
    setItems((prevItems) => prevItems.filter((i) => i.id !== id));
    toast.success('Item removed from cart', { id: `remove-${id}` });
  };

  // 🔥 CLEAR CART
  const clearCart = () => {
    setItems([]);
    toast.success('Cart cleared', { id: 'clear-cart' });
  };

  // 🔥 TOTAL COUNT
  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        total,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};