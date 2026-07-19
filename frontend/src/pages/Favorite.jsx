import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";
import FavoritesGrid from "../components/favorites/FavoritesGrid";
import { useCart } from "../context/CartContext";
import { useState } from "react";
import { useFavorite } from "../context/FavoriteContext";



const Favorite = () => {
    const [activeCategory, setActiveCategory] = useState("All");
    const { addToCart } = useCart();
    const { favorites, loading } = useFavorite();

    
    const categories = [
        "All",
        ...new Set(
            favorites
                .map((item) => item.categories?.name)
                .filter(Boolean)
        ),
    ];


    const filteredFavorites =
        activeCategory === "All"
            ? favorites
            : favorites.filter(
                (item) => item.categories?.name === activeCategory
            );


    return (
        <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">

            <div className="bg-white rounded-[32px] overflow-hidden min-h-[calc(100vh-24px)] shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex">

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <main className="px-4 md:px-6 lg:px-8 py-5 pb-24">

                        <div className="flex items-center justify-between mb-8">

                            <div>

                                <h1 className="text-4xl font-bold text-slate-900">
                                    ❤️ Favorites
                                </h1>

                                <p className="text-gray-500 mt-2">
                                    Your favorite foods, all in one place.
                                </p>

                            </div>


                        </div>


                        <div className="mb-6">

                            <div className="flex gap-3 overflow-x-auto scrollbar-hide">

                                {categories.map((category) => (

                                    <button
                                        key={category}
                                        onClick={() => setActiveCategory(category)}
                                        className={`
          whitespace-nowrap
          px-6
          py-3
          rounded-2xl
          border
          transition-all
          duration-300
          font-medium

          ${activeCategory === category
                                                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg"
                                                : "bg-white border-gray-200 hover:border-blue-500 hover:text-blue-600"
                                            }
        `}
                                    >
                                        {category}
                                    </button>

                                ))}



                            </div>

                        </div>

                        {loading ? (

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">

                                {[...Array(6)].map((_, index) => (

                                    <div
                                        key={index}
                                        className="
          bg-white
          rounded-3xl
          border
          border-slate-100
          overflow-hidden
          shadow-sm
          animate-pulse
        "
                                    >

                                        <div className="h-48 bg-slate-200" />

                                        <div className="p-5">

                                            <div className="h-6 w-2/3 bg-slate-200 rounded mb-3" />

                                            <div className="h-4 w-full bg-slate-200 rounded mb-2" />

                                            <div className="h-4 w-3/4 bg-slate-200 rounded mb-5" />

                                            <div className="flex justify-between items-center">

                                                <div className="h-8 w-20 bg-slate-200 rounded" />

                                                <div className="h-10 w-28 bg-slate-200 rounded-2xl" />

                                            </div>

                                        </div>

                                    </div>

                                ))}

                            </div>

                        ) : (

                            <FavoritesGrid
                                items={filteredFavorites}
                                onAddToCart={addToCart}
                            />

                        )}

                    </main>

                    <MobileBottomNav />

                </div>

            </div>

        </div>
    );
};

export default Favorite;