import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  MapPin,
  MoreVertical,
  Receipt,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { downloadReceipt } from "../../utils/downloadReceipt";
import { orderAPI } from "../../services/api";

const OrderDesktopCard = ({ order }) => {

  const navigate = useNavigate();
  const { reorderItems } = useCart();
  const [showMenu, setShowMenu] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {

      case "pending":
        return "bg-amber-100 text-amber-700 border border-amber-200";

      case "accepted":
        return "bg-sky-100 text-sky-700 border border-sky-200";

      case "preparing":
        return "bg-indigo-100 text-indigo-700 border border-indigo-200";

      case "ready":
        return "bg-blue-100 text-blue-700 border border-blue-200";

      case "completed":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";

      case "cancelled":
        return "bg-red-100 text-red-700 border border-red-200";

      case "rejected":
        return "bg-red-100 text-red-700 border border-red-200";

      case "refunded":
        return "bg-sky-100 text-sky-700 border border-sky-200";

      default:
        return "bg-gray-100 text-gray-600 border border-gray-200";
    }
  };

  const handleCancelOrder = async () => {
    try {

      await orderAPI.cancelOrder(order.id);

      setShowCancelModal(false);
      setShowMenu(false);

      window.location.reload();

    } catch (err) {

      alert(
        err.response?.data?.error ||
        "Failed to cancel order."
      );

    }
  };

  return (
    <div
      className={`
    relative
    bg-white
    rounded-[24px]
    border
    px-8
    py-6
    shadow-sm
    hover:shadow-md
    transition

    ${["pending", "accepted", "preparing"].includes(order.status?.toLowerCase())
          ? "bg-amber-50/30 border-amber-200 border-l-[5px] border-l-amber-500"
          : order.status?.toLowerCase() === "ready"
            ? "bg-blue-50/30 border-blue-200 border-l-[5px] border-l-blue-500"
            : order.status?.toLowerCase() === "completed"
              ? "bg-emerald-50/30 border-emerald-200 border-l-[5px] border-l-emerald-500"
              : order.status?.toLowerCase() === "refunded"
                ? "bg-blue-50/30 border-blue-200 border-l-[5px] border-l-blue-500"
                : ["rejected", "cancelled"].includes(order.status?.toLowerCase())
                  ? "bg-red-50/30 border-red-200 border-l-[5px] border-l-red-500"
                  : "border-slate-100"
        }
  `}
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
              Token #{order.token_number}
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
            {new Date(order.created_at).toLocaleString("en-IN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
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
            {order.status?.toLowerCase() === "refunded"
              ? "Refund Initiated"
              : order.status}
          </span>

          <div className="mt-4">

            {order.status?.toLowerCase() === "cancelled" ? (

              <>
                <p className="text-gray-400 text-xs">
                  Order Status
                </p>

                <p className="text-red-600 font-semibold text-sm mt-1">
                  Cancelled by You
                </p>
              </>

            ) : order.status?.toLowerCase() === "rejected" ? (

              <>
                <p className="text-gray-400 text-xs">
                  Order Status
                </p>

                <p className="text-red-600 font-semibold text-sm mt-1">
                  Cancelled by Admin
                </p>
              </>

            ) : order.status?.toLowerCase() === "completed" ? (

              <>
                <p className="text-gray-400 text-xs">
                  Completed On
                </p>

                <p className="text-emerald-600 font-semibold text-sm mt-1">
                  {order.completed_at
                    ? new Date(order.completed_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    : "--"}
                </p>
              </>

            ) : order.status?.toLowerCase() === "refunded" ? (

              <>
                <p className="text-gray-400 text-xs">
                  Refund Status
                </p>

                <p className="text-blue-600 font-semibold text-sm mt-1">
                  Refund Initiated
                </p>

                <p className="text-blue-600 font-semibold text-sm mt-1">
                  3–7 Business Days
                </p>
              </>

            ) : (

              <>
                <p className="text-gray-400 text-xs">
                  Estimated Delivery
                </p>

                <p className="text-blue-600 font-semibold text-sm mt-1">
                  10 mins • 15 mins
                </p>
              </>

            )}

          </div>

        </div>

        {/* RIGHT */}
        <div
          ref={menuRef}
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

              {order.status?.toLowerCase() === "pending" && (
                <>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowCancelModal(true);
                    }}
                    className="
                w-full
                flex
                items-center
                gap-3
                px-5
                py-4
                text-red-600
                hover:bg-red-50
                transition
            "
                  >
                    ❌ Cancel Order
                  </button>

                  <div className="border-t border-slate-100" />
                </>
              )}

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



          {order.status?.toLowerCase() === "completed" ? (
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
  w-[132px]
h-[40px]
rounded-xl
  bg-gradient-to-r
  from-blue-600
  via-blue-500
  to-cyan-500
  text-white
  text-sm
font-semibold
  flex
  items-center
  justify-center
  gap-2
  shadow-lg
  shadow-blue-500/30
  hover:shadow-xl
  hover:shadow-blue-500/40
  hover:-translate-y-0.5
  active:scale-[0.98]
  transition-all
  duration-300
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
  w-[132px]
h-[40px]
rounded-xl
  bg-gradient-to-r
  from-blue-600
  via-blue-500
  to-cyan-500
  text-white
  text-sm
font-semibold
  flex
  items-center
  justify-center
  gap-2
  shadow-lg
  shadow-blue-500/30
  hover:shadow-xl
  hover:shadow-blue-500/40
  hover:-translate-y-0.5
  active:scale-[0.98]
  transition-all
  duration-300
"
            >
              {["rejected", "cancelled", "refunded"].includes(order.status?.toLowerCase())
                ? "Details"
                : "Track"}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {showCancelModal && (
        <div
          className="
            fixed
            inset-0
            bg-black/40
            backdrop-blur-sm
            z-[999]
            flex
            items-center
            justify-center
            p-4
          "
        >
          <div
            className="
              w-full
              max-w-md
              bg-white
              rounded-3xl
              p-7
              shadow-2xl
            "
          >
            <div className="text-center">

              <div className="text-5xl mb-3">
                ⚠️
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                Cancel Order?
              </h2>

              <p className="mt-3 text-slate-500">
                Are you sure you want to cancel this order?
              </p>

              <p className="text-sm text-red-500 mt-2">
                This action cannot be undone.
              </p>

            </div>

            <div className="flex gap-3 mt-8">

              <button
                onClick={() => setShowCancelModal(false)}
                className="
                  flex-1
                  h-12
                  rounded-2xl
                  border
                  border-slate-200
                  font-semibold
                  hover:bg-slate-50
                "
              >
                Keep Order
              </button>

              <button
                onClick={handleCancelOrder}
                className="
                  flex-1
                  h-12
                  rounded-2xl
                  bg-red-600
                  hover:bg-red-700
                  text-white
                  font-semibold
                "
              >
                Cancel Order
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default OrderDesktopCard;