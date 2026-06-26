import React, { createContext, useState, useContext, useEffect } from "react";
import toast from "react-hot-toast";
import { foodAPI } from "../services/api";

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

const CART_STORAGE_KEY = "campusbites_cart";

export const CartProvider = ({ children }) => {

  // Load cart
  const [items, setItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      return savedCart ? JSON.parse(savedCart) : [];
    } catch {
      return [];
    }
  });

  const [total, setTotal] = useState(0);

  // Save cart + calculate total
  useEffect(() => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(items)
    );

    const newTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    setTotal(Number(newTotal.toFixed(2)));

  }, [items]);

  // ==========================
  // ADD TO CART
  // ==========================

  const addToCart = (foodItem) => {

    const existingItem = items.find(
      (item) => item.id === foodItem.id
    );

    setItems((prevItems) => {

      if (existingItem) {

        return prevItems.map((item) =>
          item.id === foodItem.id
            ? {
              ...item,
              quantity: item.quantity + 1,
            }
            : item
        );

      }

      return [
        ...prevItems,
        {
          ...foodItem,
          quantity: 1,
        },
      ];

    });

    toast.success(
      existingItem
        ? `Added another ${foodItem.name}`
        : `${foodItem.name} added to cart`,
      {
        id: `cart-${foodItem.id}`,
      }
    );

  };

  // ==========================
  // UPDATE QUANTITY
  // ==========================

  const updateQuantity = (id, delta) => {

    const item = items.find((i) => i.id === id);

    if (!item) return;

    const newQuantity = item.quantity + delta;

    setItems((prevItems) => {

      if (newQuantity <= 0) {
        return prevItems.filter((i) => i.id !== id);
      }

      return prevItems.map((i) =>
        i.id === id
          ? {
            ...i,
            quantity: newQuantity,
          }
          : i
      );

    });

    if (newQuantity <= 0) {
      toast.success("Item removed from cart", {
        id: `remove-${id}`,
      });
    }

  };

  // ==========================
  // REMOVE ITEM
  // ==========================

  const removeItem = (id) => {

    setItems((prevItems) =>
      prevItems.filter((i) => i.id !== id)
    );

    toast.success("Item removed from cart", {
      id: `remove-${id}`,
    });

  };

  // ==========================
  // CLEAR CART
  // ==========================

  const clearCart = () => {

    setItems([]);

    toast.success("Cart cleared", {
      id: "clear-cart",
    });

  };

  // ==========================
  // REORDER
  // ==========================

  const reorderItems = async (orderItems) => {

    try {

      // Latest available menu
      const { data } = await foodAPI.getItems();

      const availableItems = data || [];

      let addedCount = 0;
      let unavailableCount = 0;
      let priceChanged = false;

      setItems((prevItems) => {

        const updatedCart = [...prevItems];

        orderItems.forEach((item) => {

          // Check latest menu
          const latestItem = availableItems.find(
            (food) => food.id === item.food_items.id
          );

          if (
            latestItem &&
            Number(latestItem.price) !== Number(item.price_at_time)
          ) {
            priceChanged = true;
          }

          // Item unavailable
          if (!latestItem) {
            unavailableCount++;
            return;
          }

          // Already in cart
          const existing = updatedCart.find(
            (cartItem) => cartItem.id === latestItem.id
          );

          if (existing) {

            existing.quantity += item.quantity;

          } else {

            updatedCart.push({
              id: latestItem.id,
              name: latestItem.name,
              image_url: latestItem.image_url,
              price: Number(latestItem.price), // latest price
              quantity: item.quantity,
            });

          }

          addedCount += item.quantity;

        });

        return updatedCart;

      });

      if (addedCount > 0) {

        toast.success(
          `${addedCount} item${addedCount > 1 ? "s" : ""} added to cart 🛒`
        );

      }

      if (unavailableCount > 0 && addedCount > 0) {

        toast(
          `${unavailableCount} item${unavailableCount > 1 ? "s are" : " is"} currently unavailable`,
          {
            icon: "⚠️",
          }
        );

      }

      if (addedCount === 0) {

        toast.error("All items in this order are currently unavailable.");

      }

      if (priceChanged) {
        toast(
          "Some item prices have been updated based on the latest menu.",
          {
            icon: "💰",
          }
        );
      }

    } catch (err) {

      console.error(err);

      toast.error("Failed to reorder items");

      return false;

    }

    return true;

  };

  // ==========================
  // TOTAL COUNT
  // ==========================

  const getItemCount = () => {
    return items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
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
        reorderItems,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );

};