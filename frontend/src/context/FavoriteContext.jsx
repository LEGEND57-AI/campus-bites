import { createContext, useContext, useEffect, useState } from "react";
import { favoriteAPI } from "../services/api";

const FavoriteContext = createContext();

export const FavoriteProvider = ({ children }) => {

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {

    const token = localStorage.getItem("token");

    // Don't call API if user isn't logged in
    if (!token) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {

      setLoading(true);

      const { data } = await favoriteAPI.getAll();
      await new Promise(resolve => setTimeout(resolve, 3000));

      setFavorites(data || []);

    } catch (error) {

      console.error(error);

    } finally {


      setLoading(false);

    }

  };

  useEffect(() => {

    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }

    loadFavorites();

  }, []);


  return (
    <FavoriteContext.Provider
      value={{
        favorites,
        loading,
        setFavorites,
        loadFavorites,
      }}
    >
      {children}
    </FavoriteContext.Provider>
  );
};

export const useFavorite = () => useContext(FavoriteContext);