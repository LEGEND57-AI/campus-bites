import React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

const CartItem = ({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}) => {
  return (
    <div
      className="
        bg-white
        rounded-[28px]
        border
        border-slate-200
        p-5
        shadow-sm
        hover:shadow-lg
        transition-all
        duration-300
      "
    >
      <div className="flex flex-col sm:flex-row gap-5">

        {/* Food Image */}

        <div className="flex-shrink-0">

          <img
            src={item.image}
            alt={item.name}
            className="
              w-full
              sm:w-32
              h-44
              sm:h-32
              rounded-2xl
              object-cover
            "
          />

        </div>

        {/* Details */}

        <div className="flex-1 flex flex-col justify-between">

          {/* Top */}

          <div className="flex justify-between gap-4">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                {item.name}
              </h2>

              <p className="text-slate-500 mt-1">
                {item.variant || "Regular"}
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-slate-400">
                Price
              </p>

              <h2 className="text-2xl font-bold text-blue-600">
                ₹{item.price}
              </h2>

            </div>

          </div>

          {/* Bottom */}

          <div className="flex items-center justify-between mt-6">

            {/* Quantity */}

            <div
              className="
                flex
                items-center
                rounded-2xl
                border
                border-slate-200
                overflow-hidden
              "
            >

              <button
                onClick={onDecrease}
                className="
                  w-11
                  h-11
                  hover:bg-slate-100
                  flex
                  items-center
                  justify-center
                "
              >
                <Minus size={18} />
              </button>

              <span className="w-12 text-center font-semibold">
                {item.quantity}
              </span>

              <button
                onClick={onIncrease}
                className="
                  w-11
                  h-11
                  hover:bg-slate-100
                  flex
                  items-center
                  justify-center
                "
              >
                <Plus size={18} />
              </button>

            </div>

            {/* Remove */}

            <button
              onClick={onRemove}
              className="
                w-11
                h-11
                rounded-xl
                bg-red-50
                text-red-500
                hover:bg-red-100
                transition
                flex
                items-center
                justify-center
              "
            >
              <Trash2 size={18} />
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};

export default CartItem;