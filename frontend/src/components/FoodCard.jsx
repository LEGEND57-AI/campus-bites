import {
  Plus,
  Minus,
  Heart,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useFavorite } from "../context/FavoriteContext";
import { favoriteAPI } from "../services/api";
import Logo from "../assets/CampusCraves-Logo.png";
import { useCart } from "../context/CartContext";

// Small helper: colors the category tag the way Image 2's "Veg"/"Beverage"
// badges look. Falls back to a neutral blue-gray for anything unmapped —
// easy to extend if you add more category keywords later.
const getTagStyle = () => "bg-green-50 text-green-700";

const FoodCard = ({
  item,
  onAddToCart,
  onRemoveFromCart, // optional — called on decrement. Falls back to local-only count if not provided.
}) => {
  const {
    favorites,
    loadFavorites,
  } = useFavorite();
  const [loading, setLoading] = useState(false);

  // Local quantity shown on the stepper. Parent cart state stays the
  // source of truth if item.quantity is passed in; otherwise this
  // component tracks its own count starting at 0.
  const { items: cartItems, addToCart, updateQuantity } = useCart();

  const cartEntry = cartItems.find((i) => i.id === item.id);
  const quantity = cartEntry?.quantity || 0;


  const isFavorite = favorites.some(
    (fav) => fav.id === item.id
  );

  const isAvailable =
    item.available !== false;

  const categoryName = item.categories?.name || "Food";
  const tagStyle = getTagStyle(categoryName);

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (isFavorite) {
        await favoriteAPI.remove(item.id);
      } else {
        await favoriteAPI.add(item.id);
      }
      await loadFavorites();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = () => {
    if (quantity >= 10) return;
    addToCart(item);
  };

  const handleDecrement = () => {
    updateQuantity(item.id, -1);
  };

  // Shared quantity stepper — swaps in for the Add button once quantity > 0.
  const QuantityStepper = ({ compact = false }) => (
    <div
      className={`
        flex items-center
        rounded-full
        bg-blue-600
        text-white
        shadow-lg
        shadow-blue-500/30
        ${compact ? "h-8" : "h-10"}
      `}
    >
      <button
        onClick={handleDecrement}
        className={`
          flex items-center justify-center
          ${compact ? "w-8 h-8" : "w-10 h-10"}
          rounded-full
          hover:bg-blue-700
          active:scale-95
          transition
        `}
      >
        <Minus size={compact ? 13 : 15} />
      </button>

      <span className={`font-semibold ${compact ? "text-sm w-4" : "text-sm w-5"} text-center`}>
        {quantity}
      </span>

      <button
        onClick={handleIncrement}
        className={`
          flex items-center justify-center
          ${compact ? "w-8 h-8" : "w-10 h-10"}
          rounded-full
          hover:bg-blue-700
          active:scale-95
          transition
        `}
      >
        <Plus size={compact ? 13 : 15} />
      </button>
    </div>
  );

  return (
    <>
      {/* ============================================================
          MOBILE / TABLET — horizontal row layout
          ============================================================ */}
      <div
        className="
          lg:hidden
          relative
          flex
          items-center
          gap-3
          bg-white
          rounded-2xl
          border
          border-gray-100
          shadow-sm
          p-4
        "
      >
        {/* Favorite Button */}
        <button
          disabled={loading}
          onClick={(e) => handleFavorite(e)}
          className="
            absolute
            top-2.5
            right-2.5
            z-20
            w-7
            h-7
            rounded-full
            bg-white/90
            flex
            items-center
            justify-center
            shadow-sm
            hover:bg-red-50
            transition
            disabled:opacity-60
            disabled:cursor-not-allowed
          "
        >
          <Heart
            size={14}
            className={
              isFavorite
                ? "fill-red-500 text-red-500"
                : "text-gray-500"
            }
          />
        </button>

        {/* Thumbnail */}
        <div
          className="
            relative
            w-24
            h-24
            sm:w-28
            sm:h-28
            rounded-xl
            overflow-hidden
            shrink-0
          "
        >
          {!isAvailable && (
            <div
              className="
                absolute
                top-1
                left-1
                z-20
                bg-red-600
                text-white
                px-1.5
                py-0.5
                rounded-full
                text-[9px]
                font-semibold
                flex
                items-center
                gap-0.5
              "
            >
              <AlertCircle size={9} />
              OUT
            </div>
          )}

          <img
            src={item.image_url || Logo}
            onError={(e) => {
              e.currentTarget.src = Logo;
            }}
            alt={item.name}
            className={`
              w-full
              h-full
              ${item.image_url ? "object-cover" : "object-contain p-3 bg-white"}
              ${!isAvailable ? "grayscale opacity-60" : ""}
            `}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[16px] font-bold text-gray-900 truncate">
              {item.name}
            </h3>

            <span
              className={`
                shrink-0
                px-2
                py-0.5
                rounded-full
                text-[10px]
                font-semibold
                ${tagStyle}
              `}
            >
              {categoryName}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
            {item.description || "Tasty & fresh food"}
          </p>

          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">
                ₹{Number(item.price) % 1 === 0
                  ? Number(item.price)
                  : Number(item.price).toFixed(2)}
              </p>
              {!isAvailable && (
                <p className="text-[10px] text-red-500 font-medium">
                  Currently unavailable
                </p>
              )}
            </div>

            {isAvailable ? (
              quantity > 0 ? (
                <QuantityStepper compact />
              ) : (
                <button
                  onClick={handleIncrement}
                  disabled={quantity >= 10}
                  className="
                    px-4
                    h-8
                    rounded-full
                    text-xs
                    font-semibold
                    bg-blue-600
                    text-white
                    hover:bg-blue-700
                    active:scale-95
                    transition-all
                    duration-200
                    flex
                    items-center
                    justify-center
                    gap-1
                    shadow-md
                    shadow-blue-500/30
                  "
                >
                  <Plus size={14} />
                  Add
                </button>
              )
            ) : (
              <button
                disabled
                className="
                  px-4
                  h-8
                  rounded-full
                  text-xs
                  font-semibold
                  bg-gray-200
                  text-gray-400
                  cursor-not-allowed
                "
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          DESKTOP / LAPTOP — grid card layout, made a bit bigger
          ============================================================ */}
      <div
        className="
          hidden
          lg:flex
          bg-white
          rounded-[24px]
          overflow-hidden
          border
          border-gray-100
          shadow-sm
          hover:shadow-xl
          transition-all
          duration-300
          hover:-translate-y-1
          flex-col
        "
      >
        {/* IMAGE SECTION */}
        <div
          className="
            relative
            h-48
            lg:h-52
            overflow-hidden
            group
          "
        >
          {/* Favorite Button */}
          <button
            disabled={loading}
            onClick={(e) => handleFavorite(e)}
            className="
              absolute
              top-3
              right-3
              z-20
              w-9
              h-9
              rounded-full
              bg-white/90
              flex
              items-center
              justify-center
              shadow-md
              hover:bg-red-50
              transition
              disabled:opacity-60
              disabled:cursor-not-allowed
            "
          >
            <Heart
              size={18}
              className={
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-gray-500 hover:text-red-500"
              }
            />
          </button>

          {/* Out of Stock */}
          {!isAvailable && (
            <div
              className="
                absolute
                top-3
                left-3
                z-20
                bg-red-600
                text-white
                px-3
                py-1
                rounded-full
                text-xs
                font-semibold
                flex
                items-center
                gap-1
                shadow-lg
              "
            >
              <AlertCircle size={12} />
              OUT OF STOCK
            </div>
          )}

          {/* Food Image */}
          <img
            src={item.image_url || Logo}
            onError={(e) => {
              e.currentTarget.src = Logo;
            }}
            alt={item.name}
            className={`
              w-full
              h-full
              ${item.image_url ? "object-cover" : "object-contain p-6 bg-white"}
              transition-transform
              duration-300
              group-hover:scale-105
              ${!isAvailable ? "grayscale opacity-60" : ""}
            `}
          />
        </div>

        {/* CONTENT */}
        <div
          className="
            p-5
            flex
            flex-col
            flex-1
          "
        >
          {/* Food Name */}
          <h3
            className="
              text-[18px]
              font-bold
              text-gray-900
              line-clamp-1
            "
          >
            {item.name}
          </h3>

          {/* Description */}
          <p
            className="
              mt-1
              text-sm
              text-gray-500
              line-clamp-2
            "
          >
            {item.description || "Tasty & fresh food"}
          </p>

          {/* Category */}
          <div className="mt-3">
            <span
              className={`
                px-3
                py-1
                rounded-full
                text-xs
                font-semibold
                ${tagStyle}
              `}
            >
              {categoryName}
            </span>
          </div>

          {/* Bottom Area */}
          <div
            className="
              mt-auto
              pt-4
              flex
              items-center
              justify-between
            "
          >
            {/* Price */}
            <div>
              <p
                className="
                  text-2xl
                  font-bold
                  text-gray-900
                "
              >
                ₹{Number(item.price) % 1 === 0
                  ? Number(item.price)
                  : Number(item.price).toFixed(2)}
              </p>

              {!isAvailable && (
                <p
                  className="
                    text-xs
                    text-red-500
                    font-medium
                  "
                >
                  Currently unavailable
                </p>
              )}
            </div>

            {/* Add Button / Quantity Stepper */}
            {isAvailable ? (
              quantity > 0 ? (
                <QuantityStepper />
              ) : (
                <button
                  onClick={handleIncrement}
                  className="
                    px-6
                    h-10
                    rounded-full
                    text-sm
                    font-semibold
                    bg-blue-600
                    text-white
                    hover:bg-blue-700
                    hover:scale-105
                    active:scale-95
                    shadow-lg
                    shadow-blue-500/30
                    transition-all
                    duration-200
                    flex
                    items-center
                    justify-center
                    gap-1
                  "
                >
                  <Plus size={16} />
                  Add
                </button>
              )
            ) : (
              <button
                disabled
                className="
                  px-6
                  h-10
                  rounded-full
                  text-sm
                  font-semibold
                  bg-gray-200
                  text-gray-400
                  cursor-not-allowed
                "
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FoodCard;