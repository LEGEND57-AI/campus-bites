import React, { useEffect, useState } from "react";
import {
    ClipboardList,
    Plus,
    Clock3,
    CheckCircle2,
    PackageCheck,
    ArrowRight,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

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

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {

            const { data } = await orderAPI.getOrders();
            setOrders(data || []);

        } catch (error) {

            console.error(error);
            toast.error("Failed to load orders");

        } finally {

            setLoading(false);

        }
    };

    const filteredOrders = orders.filter((order) => {

        if (activeTab === "all") return true;
        if (activeTab === "pending") return order.status === "Pending";
        if (activeTab === "accepted") return order.status === "Accepted";
        if (activeTab === "ready") return order.status === "Ready";

        return true;
    });

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
        <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">

            <div className="
        bg-white
        rounded-[32px]
        overflow-hidden
        min-h-[calc(100vh-24px)]
        shadow-[0_15px_40px_rgba(0,0,0,0.08)]
        flex
      ">

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <main className="
            px-4
            md:px-6
            lg:px-8
            py-5
            pb-24
          ">

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

                            {/* PENDING TAB */}
                            <button
                                onClick={() => setActiveTab("pending")}
                                className={`
    h-14
    rounded-2xl
    font-medium
    flex
    items-center
    justify-center
    gap-2
    transition-all

    ${activeTab === "pending"
                                        ? "bg-orange-500 text-white"
                                        : "bg-gray-50 text-gray-600"
                                    }
  `}
                            >
                                <Clock3 size={18} />
                                Pending
                            </button>

                            {/* ACCEPTED TAB */}
                            <button
                                onClick={() => setActiveTab("accepted")}
                                className={`
    h-14
    rounded-2xl
    font-medium
    flex
    items-center
    justify-center
    gap-2
    transition-all

    ${activeTab === "accepted"
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-50 text-gray-600"
                                    }
  `}
                            >
                                <CheckCircle2 size={18} />
                                Accepted
                            </button>

                            {/* READY TAB */}
                            <button
                                onClick={() => setActiveTab("ready")}
                                className={`
    h-14
    rounded-2xl
    font-medium
    flex
    items-center
    justify-center
    gap-2
    transition-all

    ${activeTab === "ready"
                                        ? "bg-green-500 text-white"
                                        : "bg-gray-50 text-gray-600"
                                    }
  `}
                            >
                                <PackageCheck size={18} />
                                Ready
                            </button>

                        </div>

                        {/* ORDERS */}

                        {
                            loading ? (

                                <div className="
      py-24
      text-center
      text-gray-500
    ">
                                    Loading Orders...
                                </div>

                            ) : filteredOrders.length === 0 ? (

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

                                <div className="space-y-5">

                                    {filteredOrders.map((order) => (
                                        <React.Fragment key={order.id}>

                                            <div className="hidden lg:block">
                                                <OrderDesktopCard order={order} />
                                            </div>

                                            <div className="lg:hidden">
                                                <OrderMobileCard order={order} />
                                            </div>

                                        </React.Fragment>
                                    ))}
                                </div>

                            )
                        }

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

                    </main>

                    <MobileBottomNav />

                </div>

            </div>

        </div>

    );

};

export default Orders;