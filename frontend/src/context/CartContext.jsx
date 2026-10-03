import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { foodAPI } from "../services/api";

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

const CART_STORAGE_KEY = "campuscraves_cart";

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

  // Reads `items` to resolve whether the item is already in the cart, so it
  // must be rebuilt when items change -- capturing a stale list here would
  // append a duplicate row instead of incrementing the existing one.
  const addToCart = useCallback((foodItem) => {

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


  }, [items]);

  // ==========================
  // UPDATE QUANTITY
  // ==========================

  // Also reads `items`, to resolve the current quantity before applying delta.
  const updateQuantity = useCallback((id, delta) => {

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

  }, [items]);

  // ==========================
  // REMOVE ITEM
  // ==========================

  // Empty deps are genuine here, not a shortcut: this reads no state from the
  // closure. setItems is a functional update and is stable, so the identity
  // can safely live for the provider's whole lifetime.
  const removeItem = useCallback((id) => {

    setItems((prevItems) =>
      prevItems.filter((i) => i.id !== id)
    );


  }, []);

  // ==========================
  // CLEAR CART
  // ==========================

  const clearCart = useCallback(() => {

    setItems([]);


  }, []);

  // ==========================
  // REORDER
  // ==========================

  // Reads nothing from the closure either: the menu comes from foodAPI and the
  // merge happens against prevItems inside the updater, so no cart state is
  // captured.
  const reorderItems = useCallback(async (orderItems) => {

    try {

      let availableItems = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await foodAPI.getItems({ page, limit: 24 });
        availableItems = availableItems.concat(data?.items || []);
        hasMore = Boolean(data?.hasMore);
        page += 1;
      }

      setItems((prevItems) => {

        const updatedCart = [...prevItems];

        orderItems.forEach((item) => {

          // Check latest menu
          const latestItem = availableItems.find(
            (food) => food.id === item.food_items.id
          );

          // Item unavailable: skip it, keeping the rest of the reorder.
          if (!latestItem) {
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

        });

        return updatedCart;

      });

    } catch (err) {

      console.error(err);


      return false;

    }

    return true;

  }, []);

  // ==========================
  // TOTAL COUNT
  // ==========================

  const getItemCount = useCallback(() => {
    return items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [items]);

  // A fresh object literal here re-rendered every cart consumer on any parent
  // render -- including every route change, since CartProvider sits inside
  // App. Memoising it means the value changes only when something in it
  // actually changed. The exported shape is unchanged.
  const value = useMemo(
    () => ({
      items,
      total,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart,
      reorderItems,
      getItemCount,
    }),
    [
      items,
      total,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart,
      reorderItems,
      getItemCount,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );

};