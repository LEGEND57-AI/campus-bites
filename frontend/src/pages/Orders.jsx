import React, {
    useEffect,
    useState,
    useRef,
    useCallback,
} from "react";
import {
    ClipboardList,
    Plus,
    Clock3,
    CheckCircle2,
    XCircle,
    History,
    ArrowRight,
} from "lucide-react";


import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { getSocket } from "../socket/socket";
import { SocketEvents } from "../socket/constants";

import { orderAPI } from "../services/api";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";
import OrderDesktopCard from "../components/orders/OrderDesktopCard";
import OrderMobileCard from "../components/orders/OrderMobileCard";

const Orders = () => {

    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all");
    const [page, setPage] = useState(1);

    const [hasMore, setHasMore] = useState(true);

    const [loadingMore, setLoadingMore] = useState(false);
    const observer = useRef();

    useEffect(() => {

        fetchOrders(1);

        const socket = getSocket();

        if (socket) {

            socket.on(
                SocketEvents.ORDER_UPDATED,
                (updatedOrder) => {

                    setOrders((prev) =>
                        prev.map((order) =>
                            order.id === updatedOrder.id
                                ? {
                                    ...order,
                                    ...updatedOrder,
                                }
                                : order
                        )
                    );

                }
            );

        }

        return () => {
            socket?.off(SocketEvents.ORDER_UPDATED);
        };

    }, []);

    const fetchOrders = async (
        pageNumber = 1,
        append = false
    ) => {

        try {

            if (pageNumber === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const { data } =
                await orderAPI.getOrders(
                    pageNumber,
                    20
                );

            if (append) {

                setOrders(prev => [
                    ...prev,
                    ...data.orders
                ]);

            } else {

                setOrders(data.orders);

            }

            setHasMore(data.hasMore);

        } catch (error) {

            console.error(error);

            toast.error(
                "Failed to load orders"
            );

        } finally {

            setLoading(false);

            setLoadingMore(false);

        }

    };

    const lastOrderRef = useCallback(

        (node) => {

            if (loadingMore) return;

            if (observer.current) {
                observer.current.disconnect();
            }

            observer.current =
                new IntersectionObserver(

                    (entries) => {

                        if (
                            entries[0].isIntersecting &&
                            hasMore
                        ) {

                            const nextPage =
                                page + 1;

                            setPage(nextPage);

                            fetchOrders(
                                nextPage,
                                true
                            );

                        }

                    }

                );

            if (node) {
                observer.current.observe(node);
            }

        },

        [
            loadingMore,
            hasMore,
            page,
        ]

    );

    const filteredOrders = orders.filter((order) => {

        if (activeTab === "all") {
            return (
                order.status === "Pending" ||
                order.status === "Accepted" ||
                order.status === "Preparing" ||
                order.status === "Ready"
            );
        }

        if (activeTab === "past") {
            return (
                order.status === "Completed" ||
                order.status === "Rejected" ||
                order.status === "Cancelled" ||
                order.status === "Refunded"
            );
        }

        return true;
    });

    const activeOrders = orders.filter((order) =>
        ["Pending", "Accepted", "Preparing", "Ready"].includes(order.status)
    );

    const recentOrders = orders
        .filter((order) =>
            ["Completed", "Rejected", "Cancelled", "Refunded"].includes(order.status)
        )
        .sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

    const hasActiveOrders = activeOrders.length > 0;
    const hasRecentOrders = recentOrders.length > 0;

    const getStatusColor = (status) => {

        switch (status) {

            case "Pending":
                return "bg-orange-100 text-orange-700";

            case "Accepted":
                return "bg-blue-100 text-blue-700";

            case "Ready":
                return "bg-green-100 text-green-700";

            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    return (

        <div className="min-h-screen bg-[#F3F6FB] p-0 md:p-3 lg:p-5">

            <div
                className="
            bg-white
            flex
            min-h-screen

            rounded-none
            shadow-none
            overflow-visible

            md:rounded-[32px]
            md:overflow-hidden
            md:min-h-[calc(100vh-24px)]
            md:shadow-[0_15px_40px_rgba(0,0,0,0.08)]
        "
            >

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <main
                        className="
        px-3
        sm:px-4
        md:px-6
        lg:px-8
        py-4
        md:py-5
        pb-24
        min-w-0
        overflow-x-hidden
    "

                    >

                        {/* HEADER */}

                        <div className="
              flex
              justify-between
              items-center
              mb-8
            ">

                            <div className="flex items-center gap-4">

                                <div className="
                  w-16
                  h-16
                  rounded-2xl
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  flex
                  items-center
                  justify-center
                ">
                                    <ClipboardList size={30} />
                                </div>

                                <div>

                                    <h1 className="
                    text-4xl
                    font-bold
                    text-slate-900
                  ">
                                        My Orders
                                    </h1>

                                    <p className="
                    text-gray-500
                    mt-1
                  ">
                                        Track, manage & reorder your favorite meals
                                    </p>

                                </div>

                            </div>

                            <button
                                onClick={() => navigate("/menu")}
                                className="
                  hidden
                  lg:flex
                  items-center
                  gap-2
                  px-7
                  py-4
                  rounded-2xl
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  font-semibold
                  shadow-xl
                "
                            >
                                <Plus size={18} />
                                New Order
                            </button>

                        </div>

                        {/* FILTERS */}

                        <div className="
              bg-white
              border
              border-gray-100
              rounded-3xl
              p-2
              mb-8
              grid
              grid-cols-2
              lg:grid-cols-4
              gap-2
            ">

                            {/* ALL TAB */}
                            <button
                                onClick={() => setActiveTab("all")}
                                className={`
    h-14
    rounded-2xl
    font-medium
    flex
    items-center
    justify-center
    gap-2
    transition-all

    ${activeTab === "all"
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-50 text-gray-600"
                                    }
  `}
                            >
                                <ClipboardList size={18} />
                                All Orders
                            </button>

                            {/* PAST ORDERS TAB */}
                            <button
                                onClick={() => setActiveTab("past")}
                                className={`
    h-14
    rounded-2xl
    font-medium
    flex
    items-center
    justify-center
    gap-2
    transition-all

    ${activeTab === "past"
                                        ? "bg-emerald-500 text-white"
                                        : "bg-gray-50 text-gray-600"
                                    }
  `}
                            >
                                <CheckCircle2 size={18} />
                                Past Orders
                            </button>

                        </div>

                        {/* ORDERS */}

                        {
                            loading ? (

                                <div className="space-y-5 w-full min-w-0">

                                    {[1, 2, 3].map((item) => (

                                        <div
                                            key={item}
                                            className="
                        w-full
                        max-w-full
                        min-w-0
                        overflow-hidden
                        bg-white
                        rounded-[24px]
                        border
                        border-slate-100
                        p-4
                        sm:p-5
                        animate-pulse
                    "
                                        >

                                            <div className="flex items-center gap-4 min-w-0">

                                                {/* Image */}

                                                <div
                                                    className="
                                w-20
                                h-20
                                sm:w-24
                                sm:h-24
                                shrink-0
                                rounded-2xl
                                bg-slate-200
                            "
                                                />

                                                {/* Content */}

                                                <div className="flex-1 min-w-0 space-y-3">

                                                    <div
                                                        className="
                                    h-5
                                    w-32
                                    sm:w-44
                                    max-w-full
                                    bg-slate-200
                                    rounded
                                "
                                                    />

                                                    <div
                                                        className="
                                    h-4
                                    w-24
                                    sm:w-32
                                    max-w-full
                                    bg-slate-200
                                    rounded
                                "
                                                    />

                                                    <div
                                                        className="
                                    h-4
                                    w-40
                                    sm:w-64
                                    max-w-full
                                    bg-slate-200
                                    rounded
                                "
                                                    />

                                                    <div
                                                        className="
                                    h-4
                                    w-28
                                    sm:w-36
                                    max-w-full
                                    bg-slate-200
                                    rounded
                                "
                                                    />

                                                </div>

                                            </div>

                                        </div>

                                    ))}

                                </div>

                            ) : (activeTab === "all"
                                ? activeOrders.length === 0 && recentOrders.length === 0
                                : filteredOrders.length === 0
                            ) ? (

                                <div className="
      bg-white
      rounded-3xl
      border
      border-gray-100
      py-24
      text-center
    ">
                                    <ClipboardList
                                        size={60}
                                        className="
          mx-auto
          text-gray-300
        "
                                    />

                                    <h3 className="
        mt-4
        text-xl
        font-semibold
      ">
                                        No Orders Found
                                    </h3>

                                    <p className="
        text-gray-500
        mt-2
      ">
                                        Start ordering your favorite food.
                                    </p>
                                </div>

                            ) : (

                                <div className="space-y-10">

                                    {activeTab === "all" && (
                                        <>

                                            {/* ACTIVE ORDERS */}

                                            {hasActiveOrders && (

                                                <section>

                                                    <div className="mb-5">

                                                        <h2 className="text-2xl font-bold text-slate-900">
                                                            Active Orders
                                                        </h2>

                                                        <p className="text-sm text-slate-500 mt-1">
                                                            {activeOrders.length} orders in progress
                                                        </p>

                                                    </div>

                                                    <div className="space-y-5">

                                                        {activeOrders.map((order, index) => {

                                                            const isLast =
                                                                index === activeOrders.length - 1;

                                                            return (

                                                                <React.Fragment key={order.id}>

                                                                    <motion.div
                                                                        ref={isLast ? lastOrderRef : null}
                                                                        initial={{
                                                                            opacity: 0,
                                                                            y: 20,
                                                                        }}
                                                                        animate={{
                                                                            opacity: 1,
                                                                            y: 0,
                                                                        }}
                                                                        transition={{
                                                                            delay: index * 0.03,
                                                                        }}
                                                                        className="hidden lg:block"
                                                                    >
                                                                        <OrderDesktopCard order={order} />
                                                                    </motion.div>

                                                                    <motion.div
                                                                        initial={{
                                                                            opacity: 0,
                                                                            y: 20,
                                                                        }}
                                                                        animate={{
                                                                            opacity: 1,
                                                                            y: 0,
                                                                        }}
                                                                        transition={{
                                                                            delay: index * 0.03,
                                                                        }}
                                                                        className="lg:hidden"
                                                                    >
                                                                        <OrderMobileCard order={order} />
                                                                    </motion.div>

                                                                </React.Fragment>

                                                            );

                                                        })}

                                                    </div>

                                                </section>

                                            )}

                                            {/* Divider */}

                                            {hasActiveOrders && hasRecentOrders && (
                                                <div className="my-8 border-t border-slate-200" />
                                            )}


                                            {/* RECENT ORDERS */}

                                            {hasRecentOrders && (

                                                <section>

                                                    <div className="mb-5">

                                                        <h2 className="text-2xl font-bold text-slate-900">
                                                            Recent Activity
                                                        </h2>

                                                        <p className="text-sm text-slate-500 mt-1">
                                                            Showing your latest 5 completed, refunded or cancelled orders
                                                        </p>

                                                    </div>

                                                    <div className="space-y-5">

                                                        {recentOrders.slice(0, 5).map((order, index) => (

                                                            <React.Fragment key={order.id}>

                                                                {/* Desktop */}
                                                                <motion.div
                                                                    initial={{
                                                                        opacity: 0,
                                                                        y: 20,
                                                                    }}
                                                                    animate={{
                                                                        opacity: 1,
                                                                        y: 0,
                                                                    }}
                                                                    transition={{
                                                                        delay: index * 0.03,
                                                                    }}
                                                                    className="hidden lg:block"
                                                                >
                                                                    <OrderDesktopCard order={order} />
                                                                </motion.div>


                                                                {/* Mobile */}
                                                                <motion.div
                                                                    initial={{
                                                                        opacity: 0,
                                                                        y: 20,
                                                                    }}
                                                                    animate={{
                                                                        opacity: 1,
                                                                        y: 0,
                                                                    }}
                                                                    transition={{
                                                                        delay: index * 0.03,
                                                                    }}
                                                                    className="lg:hidden"
                                                                >
                                                                    <OrderMobileCard order={order} />
                                                                </motion.div>

                                                            </React.Fragment>

                                                        ))}

                                                    </div>

                                                </section>

                                            )}

                                        </>
                                    )}

                                    {activeTab === "past" && (

                                        <>

                                            <div className="mb-5">

                                                <h2 className="text-2xl font-bold text-slate-900">
                                                    Past Orders
                                                </h2>

                                                <p className="text-sm text-slate-500 mt-1">
                                                    Complete order history
                                                </p>

                                            </div>

                                            <div className="space-y-5">

                                                {filteredOrders.map((order, index) => {

                                                    const isLast =
                                                        index === filteredOrders.length - 1;

                                                    return (

                                                        <React.Fragment key={order.id}>

                                                            <motion.div
                                                                ref={isLast ? lastOrderRef : null}
                                                                initial={{
                                                                    opacity: 0,
                                                                    y: 20,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0,
                                                                }}
                                                                transition={{
                                                                    delay: index * 0.03,
                                                                }}
                                                                className="hidden lg:block"
                                                            >
                                                                <OrderDesktopCard order={order} />
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{
                                                                    opacity: 0,
                                                                    y: 20,
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0,
                                                                }}
                                                                transition={{
                                                                    delay: index * 0.03,
                                                                }}
                                                                className="lg:hidden"
                                                            >
                                                                <OrderMobileCard order={order} />
                                                            </motion.div>

                                                        </React.Fragment>

                                                    );

                                                })}

                                            </div>

                                        </>

                                    )}

                                    {loadingMore && (

                                        <div className="py-8 text-center">

                                            <p className="text-slate-500">
                                                Loading more orders...
                                            </p>

                                        </div>

                                    )}

                                </div>

                            )
                        }

                        {!loading && (
                            <>
                                {/* HUNGRY AGAIN SECTION */}

                                <div
                                    className="
    mt-10

    bg-[#F7FAFF]

    border
    border-blue-100

    rounded-[32px]

    p-8

    flex
    flex-col
    lg:flex-row

    items-center
    justify-between

    gap-6
  "
                                >

                                    <div>

                                        <h2
                                            className="
        text-3xl
        font-bold
        text-slate-900
      "
                                        >
                                            Hungry Again? 🍔
                                        </h2>

                                        <p
                                            className="
        mt-2
        text-gray-500
      "
                                        >
                                            Explore delicious meals and order your favorites again.
                                        </p>

                                    </div>

                                    <button
                                        onClick={() =>
                                            navigate("/menu")
                                        }
                                        className="
      bg-blue-600
      text-white

      font-semibold

      px-6
      py-4

      rounded-2xl

      hover:bg-blue-700
      hover:scale-105

      transition-all

      flex
      items-center
      gap-2
    "
                                    >

                                        Browse Menu

                                        <ArrowRight size={18} />

                                    </button>

                                </div>

                            </>
                        )}

                    </main>

                    <MobileBottomNav />

                </div>

            </div>

        </div>

    );

};

export default Orders;