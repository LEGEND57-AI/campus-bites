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
    const { favorites } = useFavorite();


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

                        <FavoritesGrid
                            items={filteredFavorites}
                            onAddToCart={addToCart}
                        />

                    </main>

                    <MobileBottomNav />

                </div>

            </div>

        </div>
    );
};

export default Favorite;