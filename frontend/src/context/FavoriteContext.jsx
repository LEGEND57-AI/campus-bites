import { createContext, useContext, useEffect, useState } from "react";
import { favoriteAPI } from "../services/api";

const FavoriteContext = createContext();

export const FavoriteProvider = ({ children }) => {

  const [favorites, setFavorites] = useState([]);

  const loadFavorites = async () => {

    const token = localStorage.getItem("token");

    // Don't call API if user isn't logged in
    if (!token) {
      setFavorites([]);
      return;
    }

    try {

      const { data } = await favoriteAPI.getAll();

      setFavorites(data || []);

    } catch (error) {

      console.error(error);

    }

  };

  useEffect(() => {

    if (!localStorage.getItem("token")) return;

    loadFavorites();

  }, []);

  return (
    <FavoriteContext.Provider
      value={{
        favorites,
        setFavorites,
        loadFavorites,
      }}
    >
      {children}
    </FavoriteContext.Provider>
  );
};

export const useFavorite = () => useContext(FavoriteContext);