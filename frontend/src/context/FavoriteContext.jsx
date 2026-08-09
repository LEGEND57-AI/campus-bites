import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { favoriteAPI } from "../services/api";
import { useAuth } from "./AuthContext";


const FavoriteContext = createContext();

export const FavoriteProvider = ({ children }) => {

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const loadFavorites = useCallback(async () => {

    // Don't call API if user isn't logged in. (Previously checked
    // localStorage for a token, but the access token now lives in
    // memory only -- `user` from AuthContext is the right signal here.)
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {

      setLoading(true);

      const { data } = await favoriteAPI.getAll();

      setFavorites(data || []);

    } catch (error) {

      console.error(error);

    } finally {


      setLoading(false);

    }

  }, [user]);

  useEffect(() => {

    if (authLoading) {
      return;
    }

    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    loadFavorites();

  }, [authLoading, user, loadFavorites]);


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