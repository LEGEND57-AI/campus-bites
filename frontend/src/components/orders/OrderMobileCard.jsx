import React, { useState, useRef, useEffect } from "react";
import {
    ArrowRight,
    MapPin,
    MoreVertical,
    Receipt,
    RotateCcw,
    CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { downloadReceipt } from "../../utils/downloadReceipt";
import { orderAPI } from "../../services/api";
import { useCart } from "../../context/CartContext";

const OrderMobileCard = ({ order }) => {

    const navigate = useNavigate();
    const { reorderItems } = useCart();
    const [showMenu, setShowMenu] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
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

            case "rejected":
                return "bg-red-100 text-red-700 border border-red-200";

            default:
                return "bg-gray-100 text-gray-600 border border-gray-200";
        }
    };

    const handleReceipt = () => {
        downloadReceipt(order);
        setShowMenu(false);
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
        <>
            <div
                className={`
      relative
      bg-white
      rounded-[22px]
      p-4
      shadow-[0_4px_20px_rgba(0,0,0,0.05)]
      hover:shadow-md
      transition-all
      duration-300
      border

      ${["pending", "accepted", "preparing"].includes(order.status?.toLowerCase())
                        ? "bg-amber-50/30 border-amber-200 border-l-[5px] border-l-amber-500"
                        : order.status?.toLowerCase() === "ready"
                            ? "bg-blue-50/30 border-blue-200 border-l-[5px] border-l-blue-500"
                            : order.status?.toLowerCase() === "completed"
                                ? "bg-emerald-50/30 border-emerald-200 border-l-[5px] border-l-emerald-500"
                                : order.status?.toLowerCase() === "rejected"
                                    ? "bg-red-50/30 border-red-200 border-l-[5px] border-l-red-500"
                                    : "border-slate-100"
                    }
    `}
            >




                <div className="flex gap-3">

                    <img
                        src={order.order_items?.[0]?.food_items?.image_url}
                        alt=""
                        className="
      w-[72px]
      h-[72px]
      rounded-[16px]
      object-cover
      flex-shrink-0
    "
                    />

                    <div className="flex-1 min-w-0">

                        <div className="flex justify-between items-start">

                            <div>

                                <h3 className="text-[15px] font-bold text-slate-900">
                                    #CC{10000 + order.id}
                                </h3>

                                <p className="text-[10px] text-slate-400 mt-1">
                                    {new Date(order.created_at).toLocaleDateString()}
                                </p>

                            </div>

                            <div
                                ref={menuRef}
                                className="relative flex items-center gap-1"
                            >

                                <span
                                    className={`
            px-2.5
            py-1
            rounded-full
            text-[10px]
            font-semibold
            ${getStatusColor(order.status)}
          `}
                                >
                                    {order.status}
                                </span>

                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="
            p-1.5
            rounded-lg
            hover:bg-slate-100
            transition
          "
                                >
                                    <MoreVertical size={14} />
                                </button>

                                {showMenu && (
                                    <div
                                        className="
absolute
top-9
right-0
w-52
bg-white
rounded-xl
border
border-slate-200
shadow-xl
z-50
overflow-hidden
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
        flex
        items-center
        gap-3
        px-4
        py-3
        text-sm
        text-red-600
        hover:bg-red-50
        w-full
      "
                                                >
                                                    ❌ Cancel Order
                                                </button>

                                                <div className="border-t border-slate-100" />
                                            </>
                                        )}

                                        <button
                                            onClick={handleReceipt}
                                            className="
        flex
        items-center
        gap-3
        px-4
        py-3
        text-sm
        hover:bg-blue-50
        w-full
      "
                                        >

                                            <div
                                                className="
          w-8
          h-8
          rounded-lg
          bg-blue-50
          flex
          items-center
          justify-center
          text-blue-600
        "
                                            >
                                                <Receipt size={14} />
                                            </div>

                                            <span className="font-medium whitespace-nowrap">
                                                Payment Receipt
                                            </span>

                                        </button>

                                    </div>
                                )}

                            </div>

                        </div>

                        {/* FOOD ITEMS */}

                        <p
                            className="
        mt-2
        text-[12px]
        font-medium
        text-slate-800
        line-clamp-2
      "
                        >
                            {order.order_items
                                ?.map(
                                    (item) =>
                                        item.food_items?.name
                                )
                                .join(", ")}
                        </p>

                        {/* ETA */}

                        {order.status?.toLowerCase() === "rejected" ? (

                            <p
                                className="
          mt-3
          text-[11px]
          text-red-600
          font-semibold
        "
                            >
                                ❌ Cancelled by Admin
                            </p>

                        ) : order.status?.toLowerCase() === "completed" ? (

                            <p
                                className="
          mt-3
          text-[11px]
          text-emerald-600
          font-semibold
        "
                            >
                                ✅ Completed On •{" "}
                                {order.completed_at
                                    ? new Date(order.completed_at).toLocaleString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })
                                    : "--"}
                            </p>

                        ) : (

                            <p
                                className="
          mt-3
          text-[11px]
          text-blue-600
          font-semibold
        "
                            >
                                Estimated Pickup • 10-15 mins
                            </p>

                        )}

                        {/* BOTTOM SECTION */}

                        <div
                            className="
        flex
        justify-between
        items-end
        mt-3
      "
                        >

                            <div>

                                <p
                                    className="
        text-[10px]
        text-slate-400
    "
                                >
                                    Total Amount
                                </p>

                                <h4
                                    className="
        text-[28px]
        font-bold
        text-slate-900
        leading-none
        mt-1
    "
                                >
                                    ₹{Number(order.total_amount).toFixed(2)}
                                </h4>

                            </div>

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
  h-9
  px-4
  rounded-xl
  bg-gradient-to-r
  from-blue-600
  via-blue-500
  to-cyan-500
  text-white
  text-[11px]
  font-semibold
  flex
  items-center
  justify-center
  gap-1.5
  shadow-md
  shadow-blue-500/30
  hover:shadow-lg
  hover:shadow-blue-500/40
  hover:-translate-y-0.5
  active:scale-[0.98]
  transition-all
  duration-300
"
                                >
                                    <RotateCcw size={12} />
                                    Reorder
                                </button>

                            ) : (

                                <button

                                    onClick={() => navigate(`/track-order/${order.id}`)}
                                    className="
  h-9
  px-4
  rounded-xl
  bg-gradient-to-r
  from-blue-600
  via-blue-500
  to-cyan-500
  text-white
  text-[11px]
  font-semibold
  flex
  items-center
  justify-center
  gap-1.5
  shadow-md
  shadow-blue-500/30
  hover:shadow-lg
  hover:shadow-blue-500/40
  hover:-translate-y-0.5
  active:scale-[0.98]
  transition-all
  duration-300
"
                                >
                                    {order.status?.toLowerCase() === "rejected"
                                        ? "Details"
                                        : "Track"}
                                    <ArrowRight size={12} />
                                </button>

                            )}

                        </div>

                    </div>

                </div>

            </div>

            {
                showCancelModal && (
                    <div
                        className="
      fixed
      inset-0
      z-[999]
      bg-black/40
      backdrop-blur-sm
      flex
      items-center
      justify-center
      p-5
    "
                    >
                        <div
                            className="
        w-full
        max-w-sm
        bg-white
        rounded-3xl
        p-6
        shadow-2xl
      "
                        >
                            <div className="text-center">

                                <div className="text-5xl mb-3">
                                    ⚠️
                                </div>

                                <h2 className="text-xl font-bold text-slate-900">
                                    Cancel Order?
                                </h2>

                                <p className="mt-3 text-slate-500 text-sm">
                                    Are you sure you want to cancel this order?
                                </p>

                                <p className="mt-2 text-red-500 text-sm">
                                    This action cannot be undone.
                                </p>

                            </div>

                            <div className="mt-6 space-y-3">

                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="
            w-full
            h-11
            rounded-xl
            border
            border-slate-200
            font-semibold
          "
                                >
                                    Keep Order
                                </button>

                                <button
                                    onClick={handleCancelOrder}
                                    className="
            w-full
            h-11
            rounded-xl
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

        </>

    );

};

export default OrderMobileCard;
