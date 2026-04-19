import { Plus } from "lucide-react";

const FoodCard = ({ item, onAddToCart }) => {
  return (
    <div className="glass-card card-hover overflow-hidden flex flex-col h-full">

      {/* IMAGE */}
      <div className="h-44 w-full overflow-hidden group">
        <img
          src={item.image_url || "https://via.placeholder.com/300"}
          alt={item.name}
          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>

      {/* CONTENT */}
      <div className="p-4 flex flex-col flex-grow">

        {/* TITLE + PRICE */}
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-semibold text-slate-800 text-sm line-clamp-1">
            {item.name}
          </h3>

          <span className="text-blue-600 font-bold text-sm">
            ₹{Number(item.price).toFixed(2)}
          </span>
        </div>

        {/* DESCRIPTION */}
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
          {item.description || "Tasty & fresh food"}
        </p>

        {/* CATEGORY */}
        <span className="mt-2 px-2.5 py-1 text-[10px] rounded-full bg-gray-100 text-gray-600 w-fit">
          {item.categories?.name || "Food"}
        </span>

        {/* BOTTOM SECTION */}
        <div className="flex items-center justify-between mt-auto pt-4">

          <span className="text-[11px] text-gray-400">
            Add to cart
          </span>

          {/* 🔥 FINAL BUTTON FIX */}
          <button
            onClick={() => onAddToCart(item)}
            className="bg-blue-600 text-white p-2.5 rounded-full shadow-md 
                       hover:bg-blue-700 hover:scale-110 active:scale-95 
                       transition-all duration-200 flex items-center justify-center"
          >
            <Plus size={16} />
          </button>

        </div>

      </div>
    </div>
  );
};

export default FoodCard;