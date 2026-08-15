import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
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


  // Same reasoning as CartContext: the object literal was rebuilt on every
  // render of this provider, re-rendering every consumer even when nothing in
  // it had changed. loadFavorites is already memoised on [user] above and is
  // deliberately left as it is -- the effect below and Favorite.jsx both
  // depend on its identity.
  //
  // setFavorites is omitted from the dependency list because React guarantees
  // a state setter's identity is stable for the lifetime of the component; it
  // is not an unlisted dependency.
  const value = useMemo(
    () => ({
      favorites,
      loading,
      setFavorites,
      loadFavorites,
    }),
    [favorites, loading, loadFavorites]
  );

  return (
    <FavoriteContext.Provider value={value}>
      {children}
    </FavoriteContext.Provider>
  );
};

export const useFavorite = () => useContext(FavoriteContext);