import React, { useState } from "react";
import {
  ArrowRight,
  MapPin,
  MoreVertical,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { downloadReceipt } from "../../utils/downloadReceipt";

const OrderDesktopCard = ({ order }) => {

  const navigate = useNavigate();
  const { reorderItems } = useCart();
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {

      case "pending":
        return "bg-amber-100 text-amber-700 border border-amber-200";

      case "accepted":
        return "bg-sky-100 text-sky-700 border border-sky-200";

      case "preparing":
        return "bg-indigo-100 text-indigo-700 border border-indigo-200";

      case "ready":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";

      case "completed":
        return "bg-slate-100 text-slate-700 border border-slate-200";

      case "cancelled":
        return "bg-red-100 text-red-700 border border-red-200";

      default:
        return "bg-gray-100 text-gray-600 border border-gray-200";
    }
  };



  return (
    <div
      className="
      relative
      bg-white
      rounded-[24px]
      border
      border-slate-100
      px-8
      py-6
      shadow-sm
      hover:shadow-md
      transition
    "
    >
      <div
        className="
        grid
        grid-cols-[95px_2fr_1fr_180px]
        gap-8
        items-center
      "
      >
        {/* IMAGE */}
        <img
          src={order.order_items?.[0]?.food_items?.image_url}
          alt=""
          className="
            w-[95px]
            h-[95px]
            rounded-[18px]
            object-cover
          "
        />

        {/* ORDER INFO */}
        <div>
          <div className="flex items-center gap-2">
            <h3
              className="
              text-[18px]
              font-bold
              text-slate-900
            "
            >
              Order #CC{10000 + order.id}
            </h3>

            <button
              onClick={() => downloadReceipt(order)}
              className="text-slate-400 hover:text-blue-600 transition"
            >
              <Receipt size={14} />
            </button>
          </div>

          <p
            className="
              text-gray-500
              text-xs
              mt-1
            "
          >
            {new Date(order.created_at).toLocaleString()}
          </p>

          <p
            className="
              mt-3
              font-semibold
              text-slate-800
              text-[15px]
            "
          >
            {order.order_items
              ?.map((item) => item.food_items?.name)
              .join(", ")}
          </p>

          <div
            className="
              flex
              items-center
              gap-2
              mt-2
              text-gray-500
              text-xs
            "
          >
            <MapPin size={12} />
            Main Cafeteria
          </div>
        </div>

        {/* STATUS */}
        <div>
          <span
            className={`
              inline-flex
              px-3
              py-1.5
              rounded-full
              text-xs
              font-medium
              ${getStatusColor(order.status)}
            `}
          >
            {order.status}
          </span>

          <div className="mt-4">
            <p className="text-gray-400 text-xs">
              Estimated Delivery
            </p>

            <p
              className="
                text-blue-600
                font-semibold
                text-sm
                mt-1
              "
            >
              10 mins • 15 mins
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div
          className="
            flex
            flex-col
            items-end
            justify-between
            h-full
            relative
          "
        >
          <div className="flex items-start gap-2">
            <div className="text-right leading-none">
              <p className="text-gray-500 text-xs mb-1">
                Total Amount
              </p>

              <h2
                className="
                text-[34px]
                font-bold
                text-slate-900
              "
              >
                ₹{Number(order.total_amount).toFixed(2)}
              </h2>
            </div>

            <button
              onClick={() =>
                setShowMenu(!showMenu)
              }
              className="
                p-1
                rounded-lg
                hover:bg-slate-100
              "
            >
              <MoreVertical size={18} />
            </button>
          </div>

          {showMenu && (
            <div
              className="
            absolute
            top-10
            right-0
            bg-white
            rounded-2xl
            shadow-2xl
            border
            border-slate-100
            overflow-hidden
            z-50
            min-w-[210px]
        "
            >

              <button
                onClick={() => {
                  downloadReceipt(order);
                  setShowMenu(false);
                }}
                className="
                w-full
                flex
                items-center
                gap-3
                px-5
                py-4
                hover:bg-blue-50
                transition
            "
              >
                <Receipt size={16} />
                Payment Receipt
              </button>

            </div>
          )}

          {order.status?.toLowerCase() === "ready" ||
            order.status?.toLowerCase() === "completed" ? (
            <button
              onClick={async () => {

                const success = await reorderItems(order.order_items);

                if (success) {

                  setShowMenu(false);

                  navigate("/cart");

                }

              }}
              className="
                mt-5
                w-[140px]
                h-[42px]
                rounded-xl
                bg-blue-50
                hover:bg-blue-100
                text-blue-600
                font-semibold
                flex
                items-center
                justify-center
                gap-2
                transition
              "
            >
              <RotateCcw size={15} />
              Reorder
            </button>
          ) : (
            <button
              onClick={() => navigate(`/track-order/${order.id}`)}
              className="
                mt-5
                w-[140px]
                h-[42px]
                rounded-xl
                bg-blue-600
                hover:bg-blue-700
                text-white
                font-semibold
                flex
                items-center
                justify-center
                gap-2
                transition
              "
            >
              Track Order
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDesktopCard;