import React, { useEffect, useState } from "react";

import {
    ArrowLeft,
    Phone,
    MessageCircle,
    Receipt,
    Clock3,
    CheckCircle2,
    PackageCheck,
    ChefHat,
    MapPin,
    CreditCard,
    Store,
    Sparkles,
} from "lucide-react";
import { ShoppingBag } from "lucide-react";


import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { orderAPI } from "../services/api";
import { supabase } from "../lib/supabaseClient";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";
import { downloadReceipt } from "../utils/downloadReceipt";

const TrackOrder = () => {

    const navigate = useNavigate();
    const { id } = useParams();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);

    useEffect(() => {

        window.scrollTo(0, 0);

        fetchOrder();

        const channel = supabase
            .channel(`order-${id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "orders",
                    filter: `id=eq.${id}`,
                },
                () => {
                    fetchOrder();
                }
            )
            .subscribe();

        const interval = setInterval(() => {
            fetchOrder();
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };

    }, [id]);

    const fetchOrder = async () => {

        try {

            const { data } = await orderAPI.getOrder(id);

            setOrder(data);

        } catch (err) {

            console.error(err);
            toast.error("Failed to load order");

        }

        finally {

            if (loading) {
                setLoading(false);
            }

        }

    };

    const statusIndex = {
        Pending: 0,
        Accepted: 1,
        Preparing: 2,
        Ready: 3,
        Completed: 4,
        Cancelled: -1,
    };

    const currentStep = statusIndex[order?.status] ?? 0;
    const isRejected =
        order?.status === "Rejected" ||
        order?.status === "Cancelled";

    const isRefunded = order?.status === "Refunded";

    const statusDetails = {
        Pending: {
            title: "Order Received",
            message: "Your order has been received and is waiting for kitchen confirmation.",
            icon: Receipt,
        },

        Accepted: {
            title: "Order Accepted",
            message: "The kitchen has accepted your order and will start preparing it shortly.",
            icon: CheckCircle2,
        },

        Preparing: {
            title: "Kitchen is Preparing Your Meal",
            message: "Our chefs are preparing your delicious food with care.",
            icon: ChefHat,
        },

        Ready: {
            title: "Order Ready for Pickup",
            message: "Your food is ready. Please collect it from the counter.",
            icon: PackageCheck,
        },

        Completed: {
            title: "Order Collected 🎉",
            message:
                "Your order has been successfully collected from the counter. Enjoy your meal, and thank you for choosing CampusCraves!",
            icon: CheckCircle2,
        },

        Cancelled: {
            title: "Order Cancelled",
            message: "This order has been cancelled.",
            icon: Receipt,
        },
    };

    const currentStatus =
        statusDetails[order?.status] ||
        statusDetails.Pending;

    const StatusIcon = currentStatus.icon;

    const steps = [

        {
            title: "Order Placed",
            icon: <Receipt size={18} />,
            active: currentStep >= 0,
        },

        {
            title: "Accepted",
            icon: <CheckCircle2 size={18} />,
            active: currentStep >= 1,
        },

        {
            title: "Preparing",
            icon: <ChefHat size={18} />,
            active: currentStep >= 2,
        },

        {
            title: "Ready",
            icon: <PackageCheck size={18} />,
            active: currentStep >= 3,
        },

        {
            title: "Completed",
            icon: <CheckCircle2 size={18} />,
            active: currentStep >= 4,
        },

    ];

    if (loading) {

        return (

            <div className="min-h-screen bg-[#F3F6FB] lg:p-5 animate-pulse">

                <div className="bg-white min-h-screen lg:min-h-[calc(100vh-40px)] lg:rounded-[34px] flex">

                    <Sidebar />

                    <div className="flex-1">

                        <DashboardHeader />

                        <main className="px-4 lg:px-8 py-6">

                            {/* Hero Skeleton */}

                            <div className="rounded-[32px] bg-slate-200 h-[230px]" />

                            {/* Timeline Skeleton */}

                            <div className="mt-8 rounded-[30px] bg-white border border-slate-100 p-6">

                                <div className="h-8 w-60 bg-slate-200 rounded mb-8" />

                                <div className="h-24 bg-slate-200 rounded-2xl" />

                                <div className="mt-8 h-24 bg-slate-200 rounded-3xl" />

                            </div>

                            {/* Bottom Cards */}

                            <div className="grid lg:grid-cols-2 gap-6 mt-8">

                                <div className="bg-white rounded-[30px] border border-slate-100 p-7 h-[340px]" />

                                <div className="bg-white rounded-[30px] border border-slate-100 p-7 h-[340px]" />

                            </div>

                        </main>

                    </div>

                </div>

            </div>

        );

    }

    if (!order) return null;

    return (
        <div className="min-h-screen bg-[#F3F6FB] lg:p-5">

            <div
                className="
      bg-white
      min-h-screen
      lg:min-h-[calc(100vh-40px)]
      lg:rounded-[34px]
      overflow-hidden
      shadow-[0_15px_45px_rgba(0,0,0,.08)]
      flex
    "
            >

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <main className="px-4 lg:px-8 py-6 pb-28">

                        {/* HERO */}

                        <motion.div

                            initial={{ opacity: 0, y: 20 }}

                            animate={{ opacity: 1, y: 0 }}

                            className={`
relative
overflow-hidden
rounded-[32px]
p-6
lg:p-8
text-white
${isRefunded
                                    ? "bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-500"
                                    : isRejected
                                        ? "bg-gradient-to-br from-red-600 via-red-500 to-rose-500"
                                        : "bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500"
                                }
`}

                        >

                            {/* BACK */}

                            <button

                                onClick={() => navigate("/orders")}

                                className="
              w-11
              h-11
              rounded-full
              bg-white/20
              backdrop-blur
              flex
              items-center
              justify-center
              hover:bg-white/30
              transition
            "

                            >

                                <ArrowLeft size={20} />

                            </button>


                            {/* CONTENT */}

                            <div className="mt-6 lg:flex lg:justify-between lg:items-center gap-8">

                                {/* LEFT */}

                                <div className="flex gap-5">

                                    <img

                                        src={order.order_items?.[0]?.food_items?.image_url}

                                        alt=""

                                        className="
                  w-28
                  h-28
                  lg:w-40
                  lg:h-40
                  rounded-[28px]
                  object-cover
                  shadow-xl
                "

                                    />

                                    <div>

                                        <div
                                            className="
                    inline-flex
                    items-center
                    gap-2
                    px-4
                    py-2
                    rounded-full
                    bg-white/20
                    backdrop-blur
                    text-sm
                    font-semibold
                  "
                                        >

                                            <Sparkles size={16} />

                                            {isRefunded
                                                ? "Refund Initiated"
                                                : order.status}

                                        </div>

                                        <h1
                                            className="
                    mt-4
                    text-3xl
                    lg:text-5xl
                    font-black
                  "
                                        >
                                            Order #{10000 + order.id}
                                        </h1>

                                        <p
                                            className="
                    mt-2
                    text-blue-100
                  "
                                        >
                                            Main Cafeteria
                                        </p>

                                        <div
                                            className="
                    mt-5
                    flex
                    flex-wrap
                    gap-3
                  "
                                        >

                                            <div
                                                className="
                    bg-white/20
                    border
                  border-white/20
                      backdrop-blur
                      rounded-2xl
                      px-4
                      py-3
                    "
                                            >

                                                <p className="text-xs text-red-100">
                                                    {isRefunded ? "Refund Amount" : isRejected ? "Cancelled At" : "Token"}
                                                </p>

                                                <h2 className="text-2xl font-bold">
                                                    {isRefunded
                                                        ? `₹${order.refund_amount}`
                                                        : isRejected
                                                            ? new Date(order.created_at).toLocaleTimeString("en-IN", {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })
                                                            : `#${order.token_number}`}
                                                </h2>

                                            </div>

                                            {!isRejected && !isRefunded && (
                                                <div
                                                    className="
      bg-white/15
      backdrop-blur
      rounded-2xl
      px-4
      py-3
    "
                                                >
                                                    <p className="text-xs text-blue-100">
                                                        ETA
                                                    </p>

                                                    <h2 className="text-2xl font-bold">
                                                        15 min
                                                    </h2>
                                                </div>
                                            )}

                                        </div>

                                    </div>

                                </div>



                            </div>

                        </motion.div>


                        {/* ============================
                LIVE ORDER TRACKING
          ============================ */}

                        {!isRejected && !isRefunded && (

                            <motion.div
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: .2 }}
                                className="
              mt-8
              bg-white
              rounded-[30px]
              border
              border-slate-100
              shadow-sm
              p-6
              lg:p-8
            "
                            >

                                <div className="flex items-center justify-between">

                                    <div>

                                        <h2
                                            className="
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                                        >
                                            Live Order Tracking
                                        </h2>

                                        <p className="text-slate-500 mt-1">
                                            Your meal is being prepared 🍔
                                        </p>

                                    </div>

                                    <div
                                        className="
                  hidden
                  lg:flex
                  items-center
                  gap-2
                  text-blue-600
                  font-semibold
                "
                                    >

                                        <Clock3 size={18} />

                                        Estimated 15 mins

                                    </div>

                                </div>


                                {/* Timeline */}

                                <div
                                    className="
relative
mt-14
grid
grid-cols-5
gap-1
"
                                >

                                    {/* Blue Line */}

                                    <div
                                        className="
                  absolute
                  left-0
                  right-0
                  top-5
                  h-[5px]
                  rounded-full
                  bg-slate-200
                "
                                    />

                                    <div
                                        className="
                  absolute
                  left-0
                  top-5
                  h-[5px]
                  rounded-full
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                "
                                        style={{
                                            width:
                                                currentStep === 0
                                                    ? "10%"
                                                    : currentStep === 1
                                                        ? "30%"
                                                        : currentStep === 2
                                                            ? "55%"
                                                            : currentStep === 3
                                                                ? "80%"
                                                                : currentStep >= 4
                                                                    ? "100%"
                                                                    : "0%",
                                        }}
                                    />



                                    {steps.map((step, index) => (

                                        <div
                                            key={index}
                                            className="
                    relative
                    z-10
                    flex
                    flex-col
                    items-center
                    w-full
                  "
                                        >

                                            <div
                                                className={`
                      w-11
                      h-11
                      rounded-full
                      flex
                      items-center
                      justify-center
                      transition-all
                      duration-300

                      ${step.active
                                                        ? "bg-blue-600 text-white shadow-xl shadow-blue-200"
                                                        : "bg-slate-200 text-slate-500"
                                                    }

                    `}
                                            >

                                                {step.icon}

                                            </div>

                                            <h4
                                                className={`
        mt-3
        text-[10px]
        sm:text-sm
        leading-tight
        text-center
        whitespace-normal
        break-words
        max-w-[60px]
        sm:max-w-none
        font-semibold
        ${step.active
                                                        ? "text-blue-600"
                                                        : "text-slate-500"
                                                    }
    `}
                                            >
                                                {step.title}
                                            </h4>

                                        </div>

                                    ))}

                                </div>


                                {/* Current Status */}

                                <div
                                    className="
                mt-10
                rounded-3xl
                bg-blue-50
                border
                border-blue-100
                p-6
              "
                                >

                                    <div className="flex items-center gap-4">

                                        <div
                                            className="
                    w-14
                    h-14
                    rounded-2xl
                    bg-blue-600
                    text-white
                    flex
                    items-center
                    justify-center
                  "
                                        >

                                            <StatusIcon size={24} />

                                        </div>

                                        <div>

                                            <h3
                                                className="
      text-xl
      font-bold
      text-slate-900
    "
                                            >
                                                {currentStatus.title}
                                            </h3>

                                            <p
                                                className="
      text-slate-500
      mt-1
    "
                                            >
                                                {currentStatus.message}
                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </motion.div>

                        )}

                        {isRejected && (
                            <motion.div
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="
mt-8
bg-red-50
border
border-red-200
rounded-3xl
p-6
"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-3xl">
                                        ❌
                                    </div>

                                    <div className="text-left">
                                        <h2 className="text-2xl font-bold text-red-600">
                                            Order Cancelled
                                        </h2>

                                        <p className="text-slate-500 mt-1">
                                            This order has been cancelled.
                                        </p>

                                        <p className="mt-2 text-sm font-medium text-red-600">
                                            Reason: {order.cancel_reason || "Cancelled by Admin"}
                                        </p>
                                    </div>
                                </div>


                            </motion.div>
                        )}

                        {isRefunded && (

                            <motion.div
                                className="
mt-8
bg-blue-50
border-blue-200
border
rounded-3xl
p-6
"
                            >

                                <div className="flex items-center gap-4">

                                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-3xl">
                                        💸
                                    </div>

                                    <div>

                                        <h2 className="text-2xl font-bold text-blue-700">
                                            Refund Initiated
                                        </h2>

                                        <p className="text-slate-600 mt-1">
                                            Your refund request has been submitted successfully.
                                        </p>

                                        <p className="mt-2 text-sm text-slate-500">
                                            The refund will be credited to your original payment method
                                            within <b>3–7 business days.</b>
                                        </p>

                                        <p className="mt-2 text-sm font-semibold text-blue-700">
                                            Reason: {order.refund_reason}
                                        </p>

                                    </div>

                                </div>

                            </motion.div>

                        )}

                        {/* ==========================================
                    ORDER DETAILS
          ========================================== */}

                        <motion.div
                            initial={{ opacity: 0, y: 25 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: .35 }}
                            className="
              mt-8
              grid
              lg:grid-cols-2
              gap-6
            "
                        >

                            {/* LEFT CARD */}

                            <div
                                className="
                bg-white
                rounded-[30px]
                border
                border-slate-100
                shadow-sm
                p-7
              "
                            >

                                <h2
                                    className="
                  text-2xl
                  font-bold
                  text-slate-900
                  mb-6
                "
                                >
                                    Order Summary
                                </h2>

                                <div className="space-y-5">

                                    {order.order_items?.map((item, index) => {

                                        return (

                                            <div
                                                key={`${item.food_items?.id}-${index}`}
                                                className="
                    flex
                    justify-between
                    items-center
                    pb-4
                    border-b
                    border-slate-100
                "
                                            >


                                                <div className="flex items-center gap-4">

                                                    <img
                                                        src={item.food_items?.image_url}
                                                        alt=""
                                                        className="
                          w-16
                          h-16
                          rounded-2xl
                          object-cover
                        "
                                                    />

                                                    <div>

                                                        <h4
                                                            className="
                            font-semibold
                            text-slate-900
                          "
                                                        >
                                                            {item.food_items?.name}
                                                        </h4>

                                                        <p
                                                            className="
                            text-sm
                            text-slate-500
                            mt-1
                          "
                                                        >
                                                            Qty : {item.quantity}
                                                        </p>

                                                    </div>

                                                </div>

                                                <h3
                                                    className="
                        text-lg
                        font-bold
                        text-slate-900
                      "
                                                >

                                                    ₹{(item.price_at_time || 0) * item.quantity}
                                                </h3>

                                            </div>

                                        );

                                    })}
                                </div>

                            </div>



                            {/* RIGHT CARD */}

                            <div
                                className="
                bg-white
                rounded-[30px]
                border
                border-slate-100
                shadow-sm
                p-7
              "
                            >

                                <h2
                                    className="
                  text-2xl
                  font-bold
                  text-slate-900
                  mb-6
                "
                                >
                                    Payment Details
                                </h2>

                                <div className="space-y-5">

                                    <div className="flex justify-between">

                                        <span className="text-slate-500">
                                            Payment Method
                                        </span>

                                        <span className="font-semibold">

                                            {order.payment_method}

                                        </span>

                                    </div>

                                    <div className="flex justify-between">

                                        <span className="text-slate-500">
                                            Payment Status
                                        </span>

                                        <span
                                            className={`font-semibold ${order.payment_status === "PAID"
                                                ? "text-green-600"
                                                : order.payment_status === "PENDING"
                                                    ? "text-yellow-600"
                                                    : "text-red-600"
                                                }`}
                                        >
                                            {order.payment_status === "CANCELLED"
                                                ? "FAILED"
                                                : order.payment_status}
                                        </span>

                                    </div>

                                    {isRefunded && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">
                                                    Refund Status
                                                </span>

                                                <span className="font-semibold text-blue-600">
                                                    Refund Initiated
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-slate-500">
                                                    Refund Amount
                                                </span>

                                                <span className="font-semibold">
                                                    ₹{order.refund_amount}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-slate-500">
                                                    Refund Type
                                                </span>

                                                <span className="font-semibold capitalize">
                                                    {order.refund_type}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-slate-500">
                                                    Refund ID
                                                </span>

                                                <span className="font-semibold">
                                                    {order.refund_id}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    {!isRejected && !isRefunded && (
                                        <div className="flex justify-between">

                                            <span className="text-slate-500">
                                                Token Number
                                            </span>

                                            <span className="font-bold">
                                                #{order.token_number}
                                            </span>

                                        </div>
                                    )}

                                    <div className="flex justify-between">

                                        <span className="text-slate-500">
                                            Order ID
                                        </span>

                                        <span className="font-semibold">

                                            #{10000 + order.id}

                                        </span>

                                    </div>

                                    <div className="border-t pt-5">

                                        <div className="flex justify-between">

                                            <span className="text-lg font-semibold">

                                                Total Paid

                                            </span>

                                            <span
                                                className="
                        text-3xl
                        font-black
                        text-blue-600
                      "
                                            >

                                                ₹{order.total_amount}

                                            </span>

                                        </div>

                                    </div>

                                </div>


                                {/* Pickup */}

                                {!isRejected && !isRefunded && (
                                    <div
                                        className="
          mt-8
          rounded-3xl
          bg-slate-50
          p-5
        "
                                    >

                                        <div className="flex gap-4">

                                            <div
                                                className="
                  w-12
                  h-12
                  rounded-2xl
                  bg-blue-100
                  text-blue-600
                  flex
                  items-center
                  justify-center
                "
                                            >
                                                <Store size={22} />
                                            </div>

                                            <div>

                                                <h4
                                                    className="
                      font-bold
                      text-slate-900
                    "
                                                >
                                                    Pickup Location
                                                </h4>

                                                <p
                                                    className="
                      text-slate-500
                      mt-1
                    "
                                                >
                                                    Main Cafeteria
                                                </p>

                                                <p
                                                    className="
                      text-sm
                      text-slate-400
                    "
                                                >
                                                    Ground Floor • Food Court
                                                </p>

                                            </div>

                                        </div>

                                    </div>
                                )}

                            </div>

                        </motion.div>



                        {/* ==========================
                 BOTTOM BUTTONS
          ========================== */}

                        <div
                            className="
      mt-8
      grid
      grid-cols-1
      lg:grid-cols-3
      gap-4
    "
                        >

                            <button

                                onClick={() => downloadReceipt(order)}

                                className="
order-3 lg:order-1
h-14
rounded-2xl
bg-white
border
border-slate-200
text-slate-700
font-semibold
hover:border-blue-300
hover:bg-blue-50
hover:text-blue-700
transition-all
duration-300
flex
items-center
justify-center
gap-2
"
                            >

                                <Receipt size={18} />

                                Download Receipt

                            </button>



                            <button

                                onClick={() => navigate("/orders")}

                                className="
order-2
h-14
rounded-2xl
bg-slate-100
border
border-slate-200
text-slate-700
font-semibold
hover:bg-slate-200
hover:border-slate-300
transition-all
duration-300
flex
items-center
justify-center
gap-2
"
                            >

                                <ArrowLeft size={18} />

                                <span>Back to Orders</span>

                            </button>



                            {(order.status === "Completed" ||
                                isRejected ||
                                isRefunded) && (
                                    <button
                                        onClick={() => navigate("/menu")}
                                        className="
order-1 lg:order-3
h-14
rounded-2xl
bg-gradient-to-r
from-blue-600
to-blue-500
text-white
font-bold
shadow-lg
shadow-blue-500/30
hover:shadow-xl
hover:shadow-blue-500/40
hover:-translate-y-0.5
active:scale-[0.98]
transition-all
duration-300
flex
items-center
justify-center
gap-2
"
                                    >
                                        <ShoppingBag size={18} />

                                        <span>Order Again</span>
                                    </button>
                                )}

                        </div>

                    </main>

                    <MobileBottomNav />

                </div>

            </div>

        </div>

    );

};

export default TrackOrder;