import {
  Plus,
  Heart,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useFavorite } from "../context/FavoriteContext";
import { favoriteAPI } from "../services/api";
import Logo from "../assets/CampusCraves-Logo.png";

const FoodCard = ({
  item,
  onAddToCart,
}) => {
  const {
    favorites,
    loadFavorites,
  } = useFavorite();
  const [loading, setLoading] = useState(false);

  const isFavorite = favorites.some(
    (fav) => fav.id === item.id
  );

  const isAvailable =
    item.available !== false;

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




  return (

    <div
      className="
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

        flex
        flex-col
      "
    >


      {/* IMAGE SECTION */}
      <div
        className="
          relative
          h-40
          lg:h-44

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
        {
          !isAvailable && (

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

          )
        }


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
          p-4
          flex
          flex-col
          flex-1
        "
      >

        {/* Food Name */}
        <h3
          className="
            text-[17px]
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
          {
            item.description ||
            "Tasty & fresh food"
          }
        </p>


        {/* Category */}
        <div className="mt-3">

          <span
            className="
              px-3
              py-1

              rounded-full

              text-xs
              text-gray-600

              bg-gray-100
            "
          >

            {
              item.categories?.name ||
              "Food"
            }

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
                text-xl
                font-bold
                text-gray-900
              "
            >
              ₹{Number(item.price).toFixed(2)}
            </p>


            {
              !isAvailable && (

                <p
                  className="
                    text-xs
                    text-red-500
                    font-medium
                  "
                >
                  Currently unavailable
                </p>

              )
            }

          </div>


          {/* Add Button */}
          <button

            disabled={!isAvailable}

            onClick={() => onAddToCart(item)}

            className={`
              px-5
              h-10

              rounded-full

              text-sm
              font-semibold

              transition-all
              duration-200

              flex
              items-center
              justify-center
              gap-1

              ${isAvailable
                ?
                `
                  bg-blue-600
                  text-white

                  hover:bg-blue-700
                  hover:scale-105

                  active:scale-95
                  shadow-lg
                  shadow-blue-500/30
                  `
                :
                `
                  bg-gray-200
                  text-gray-400
                  cursor-not-allowed
                  `
              }
            `}

          >

            <Plus size={16} />

            Add

          </button>


        </div>


      </div>


    </div>

  );

};


export default FoodCard;