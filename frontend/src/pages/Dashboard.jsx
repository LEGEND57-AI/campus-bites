import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { useCart } from "../context/CartContext";
import { foodAPI, categoryAPI } from "../services/api";
import { getSocket } from "../socket/socket";
import { SocketEvents } from "../socket/constants";

import FoodCard from "../components/FoodCard";
import LoadingSkeleton from "../components/LoadingSkeleton";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import HeroBanner from "../components/dashboard/HeroBanner";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

const Dashboard = () => {

    const navigate = useNavigate();

    const [foodItems, setFoodItems] = useState([]);
    const [popularItems, setPopularItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("all");

    const [loading, setLoading] = useState(true);
    const [popularLoading, setPopularLoading] = useState(true);

    const { addToCart } = useCart();


    // ================= INITIAL LOAD =================

    useEffect(() => {

        fetchCategories();
        fetchFoodItems();
        fetchPopularItems();

    }, []);


    // ================= SOCKET MENU UPDATE =================

    useEffect(() => {

        const socket = getSocket();

        if (!socket) return;

        const handleMenuUpdate = () => {

            fetchCategories();
            fetchFoodItems();
            fetchPopularItems();

        };

        socket.on(
            SocketEvents.MENU_UPDATED,
            handleMenuUpdate
        );

        return () => {

            socket.off(
                SocketEvents.MENU_UPDATED,
                handleMenuUpdate
            );

        };

    }, []);


    // ================= FETCH CATEGORIES =================

    const fetchCategories = async () => {

        try {

            const { data } =
                await categoryAPI.getAll();

            setCategories(data || []);

        } catch (error) {

            console.error(error);

        }

    };


    // ================= FETCH FOOD ITEMS =================

    const fetchFoodItems = async () => {

        try {

            const params = {};

            const { data } =
                await foodAPI.getItems(params);

            setFoodItems(
                data?.items || data || []
            );

        } catch (error) {

            console.error(error);

            toast.error(
                "Failed to load menu"
            );

        } finally {

            setLoading(false);

        }

    };


    // ================= FETCH POPULAR ITEMS =================

    const fetchPopularItems = async () => {

        setPopularLoading(true);

        try {

            const { data } =
                await foodAPI.getPopular();

            setPopularItems(
                data || []
            );

        } catch (error) {

            console.error(error);

            setPopularItems([]);

        } finally {

            setPopularLoading(false);

        }

    };


    return (

        /*
         * Mobile:
         * Full-screen / flat layout
         *
         * Desktop:
         * Rounded white dashboard card with shadow
         * Same structure as Orders page
         */

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

                {/* ================= SIDEBAR ================= */}

                <Sidebar />


                {/* ================= RIGHT CONTENT ================= */}

                <div className="flex-1 min-w-0">


                    {/* ================= HEADER ================= */}

                    <DashboardHeader />


                    {/* ================= MAIN AREA ================= */}

                    <main
                        className="
                            px-3
                            sm:px-4
                            md:px-6
                            lg:px-8
                            py-4
                            md:py-5
                            pb-24
                            max-w-full
                            md:max-w-none
                        "
                    >


                        {/* ================= HERO ================= */}

                        <HeroBanner />


                        {/* ================= DASHBOARD CONTENT ================= */}

                        <div className="mt-6">


                            {/* ================= SECTION HEADING ================= */}

                            <div
                                className="
                                    flex
                                    justify-between
                                    items-center
                                    mb-6
                                "
                            >

                                <div>

                                    <h2
                                        className="
                                            text-2xl
                                            font-bold
                                            text-gray-900
                                        "
                                    >
                                        Popular Right Now 🔥
                                    </h2>


                                    <p
                                        className="
                                            text-gray-500
                                            text-sm
                                            mt-1
                                        "
                                    >
                                        Fresh picks loved by students
                                    </p>


                                    {/* Mobile View Full Menu */}

                                    <button
                                        onClick={() =>
                                            navigate("/menu")
                                        }
                                        className="
                                            md:hidden
                                            mt-3
                                            text-blue-600
                                            font-semibold
                                        "
                                    >
                                        View Full Menu →
                                    </button>

                                </div>


                                {/* Desktop View Full Menu */}

                                <button
                                    onClick={() =>
                                        navigate("/menu")
                                    }
                                    className="
                                        hidden
                                        md:flex
                                        items-center
                                        gap-2
                                        text-blue-600
                                        font-semibold
                                        hover:text-blue-700
                                        transition-all
                                        duration-200
                                    "
                                >
                                    View Full Menu →
                                </button>

                            </div>


                            {/* ================= FOOD GRID ================= */}

                            {popularLoading ? (

                                <LoadingSkeleton />

                            ) : popularItems.length === 0 ? (

                                <div
                                    className="
                                        bg-white
                                        rounded-3xl
                                        py-20
                                        text-center
                                        text-gray-400
                                        shadow-sm
                                    "
                                >
                                    No food items found 😔
                                </div>

                            ) : (

                                <div
                                    className="
                                        grid
                                        grid-cols-1
                                        gap-4

                                        sm:grid-cols-2
                                        sm:gap-6

                                        xl:grid-cols-4
                                    "
                                >

                                    {popularItems.map(
                                        (item, index) => (

                                            <motion.div
                                                key={item.id}
                                                initial={{
                                                    opacity: 0,
                                                    y: 20,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    y: 0,
                                                }}
                                                transition={{
                                                    delay:
                                                        index * 0.04,
                                                }}
                                            >

                                                <FoodCard
                                                    item={item}
                                                    onAddToCart={
                                                        addToCart
                                                    }
                                                />

                                            </motion.div>

                                        )
                                    )}

                                </div>

                            )}

                        </div>

                    </main>


                    {/* ================= MOBILE NAV ================= */}

                    <MobileBottomNav />

                </div>

            </div>

        </div>

    );

};

export default Dashboard;