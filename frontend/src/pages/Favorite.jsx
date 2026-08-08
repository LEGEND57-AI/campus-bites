import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";
import FavoritesGrid from "../components/favorites/FavoritesGrid";
import LoadingSkeleton from "../components/LoadingSkeleton";

import { useCart } from "../context/CartContext";
import { useState, useEffect } from "react";
import { useFavorite } from "../context/FavoriteContext";

import { getSocket } from "../socket/socket";
import { SocketEvents } from "../socket/constants";

const Favorite = () => {

    const [activeCategory, setActiveCategory] =
        useState("All");

    // Controls only the initial visual skeleton
    const [showInitialSkeleton, setShowInitialSkeleton] =
        useState(true);

    const { addToCart } = useCart();

    const {
        favorites,
        loading,
        loadFavorites,
    } = useFavorite();


    // ================= CATEGORIES =================

    const categories = [
        "All",
        ...new Set(
            favorites
                .map(
                    (item) =>
                        item.categories?.name
                )
                .filter(Boolean)
        ),
    ];


    // ================= FILTERED FAVORITES =================

    const filteredFavorites =
        activeCategory === "All"
            ? favorites
            : favorites.filter(
                (item) =>
                    item.categories?.name ===
                    activeCategory
            );


    // ================= INITIAL SKELETON =================

    useEffect(() => {

        if (loading) {

            setShowInitialSkeleton(true);

            return;

        }

        // Keep skeleton visible briefly
        // so it is actually visible before
        // the cards animate in.

        const timer = setTimeout(() => {

            setShowInitialSkeleton(false);

        }, 700);

        return () => {

            clearTimeout(timer);

        };

    }, [loading]);


    // ================= SOCKET MENU UPDATE =================

    useEffect(() => {

        const socket = getSocket();

        if (!socket) return;

        const handleMenuUpdate = () => {

            loadFavorites();

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

    }, [loadFavorites]);


    return (

        <div
            className="
                min-h-screen
                bg-[#F3F6FB]
                p-0
                md:p-3
                lg:p-5
            "
        >

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


                    {/* ================= MAIN ================= */}

                    <main
                        className="
                            px-3
                            sm:px-4
                            md:px-6
                            lg:px-8
                            py-4
                            md:py-5
                            pb-24
                        "
                    >


                        {/* ================= PAGE HEADER ================= */}

                        <div
                            className="
                                flex
                                items-center
                                justify-between
                                mb-8
                            "
                        >

                            <div>

                                <h1
                                    className="
                                        text-4xl
                                        font-bold
                                        text-slate-900
                                    "
                                >
                                    ❤️ Favorites
                                </h1>

                                <p
                                    className="
                                        text-gray-500
                                        mt-2
                                    "
                                >
                                    Your favorite foods,
                                    all in one place.
                                </p>

                            </div>

                        </div>


                        {/* ================= CATEGORY FILTER ================= */}

                        <div className="mb-6">

                            <div
                                className="
                                    flex
                                    gap-3
                                    overflow-x-auto
                                    scrollbar-hide
                                "
                            >

                                {categories.map(
                                    (category) => (

                                        <button
                                            key={category}
                                            onClick={() =>
                                                setActiveCategory(
                                                    category
                                                )
                                            }
                                            className={`
                                                whitespace-nowrap
                                                px-6
                                                py-3
                                                rounded-2xl
                                                border
                                                transition-all
                                                duration-300
                                                font-medium

                                                ${
                                                    activeCategory ===
                                                    category
                                                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg"
                                                        : "bg-white border-gray-200 hover:border-blue-500 hover:text-blue-600"
                                                }
                                            `}
                                        >

                                            {category}

                                        </button>

                                    )
                                )}

                            </div>

                        </div>


                        {/* ================= FAVORITES ================= */}

                        {showInitialSkeleton ? (

                            <LoadingSkeleton />

                        ) : (

                            <FavoritesGrid
                                items={filteredFavorites}
                                onAddToCart={addToCart}
                            />

                        )}

                    </main>


                    {/* ================= MOBILE NAV ================= */}

                    <MobileBottomNav />

                </div>

            </div>

        </div>

    );

};

export default Favorite;