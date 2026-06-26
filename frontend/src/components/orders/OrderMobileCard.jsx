import React, { useState } from "react";
import {
    ArrowRight,
    RotateCcw,
    MoreVertical,
    Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { downloadReceipt } from "../../utils/downloadReceipt";
import { useCart } from "../../context/CartContext";

const OrderMobileCard = ({ order }) => {

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

    const handleReceipt = () => {
        downloadReceipt(order);
        setShowMenu(false);
    };

    return (<div
        className="
   relative
   bg-white
   rounded-[22px]
   border
   border-slate-100
   p-4
   shadow-[0_4px_20px_rgba(0,0,0,0.05)]
   hover:shadow-md
   transition
 "
    >

        {showMenu && (
            <div
                className="
      absolute
      top-10
      right-3
      bg-white
      rounded-2xl
      border
      border-slate-100
      shadow-xl
      z-50
      overflow-hidden
      min-w-[190px]
    "
            >

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

                    <span className="font-medium">
                        Payment Receipt
                    </span>

                </button>

            </div>
        )}

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

                    <div className="flex items-center gap-1">

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
                h-9
                px-5
                rounded-xl
                bg-blue-50
                hover:bg-blue-100
                text-blue-600
                text-xs
                font-semibold
                flex
                items-center
                gap-1
                transition
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
                px-5
                rounded-xl
                bg-blue-600
                hover:bg-blue-700
                text-white
                text-xs
                font-semibold
                flex
                items-center
                gap-1
                transition
              "
                        >
                            Track
                            <ArrowRight size={12} />
                        </button>

                    )}

                </div>

            </div>

        </div>

    </div>
    );

};

export default OrderMobileCard;


