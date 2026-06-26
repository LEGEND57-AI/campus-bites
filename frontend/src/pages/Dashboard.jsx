import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

import { useCart } from "../context/CartContext";
import { foodAPI, categoryAPI } from "../services/api";

import FoodCard from "../components/FoodCard";
import CategoryFilter from "../components/CategoryFilter";
import LoadingSkeleton from "../components/LoadingSkeleton";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import HeroBanner from "../components/dashboard/HeroBanner";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

const Dashboard = () => {
  const [foodItems, setFoodItems] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const { addToCart } = useCart();


  useEffect(() => {
    fetchCategories();
    fetchFoodItems();
    fetchPopularItems();
  }, []);

  useEffect(() => {
    fetchFoodItems();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchFoodItems();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCategories();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await categoryAPI.getAll();
      setCategories(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFoodItems = async () => {
    try {
      const params = {};

      if (selectedCategory !== "all") {
        params.categoryId = selectedCategory;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const { data } = await foodAPI.getItems(params);

      setFoodItems(data || []);

    } catch (error) {
      console.error(error);
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularItems = async () => {
    try {

      const { data } = await foodAPI.getPopular();

      setPopularItems(data || []);

    } catch (error) {

      console.error(error);

    }
  };


  return (
    <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">

      {/* Main Dashboard Card */}
      <div
        className="
          bg-white
          rounded-[32px]
          overflow-hidden
          min-h-[calc(100vh-24px)]
          shadow-[0_15px_40px_rgba(0,0,0,0.08)]
          flex
        "
      >

        {/* Sidebar Desktop */}
        <Sidebar />


        {/* Right Content */}
        <div className="flex-1 min-w-0">

          {/* Header */}
          <DashboardHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />


          {/* Main Area */}
          <main className="
            px-4
            md:px-6
            lg:px-8
            py-5
            pb-24
          ">

            {/* Hero */}
            <HeroBanner />


            {/* Dashboard Content */}
            <div className="mt-6">


              {/* Mobile Search */}
              <div className="lg:hidden mb-5">

                <div className="
                  relative
                  bg-white
                  border
                  border-gray-200
                  rounded-2xl
                  shadow-sm
                ">

                  <Search
                    size={18}
                    className="
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                    "
                  />

                  <input
                    type="text"
                    placeholder="Search food, drinks, snacks..."
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    className="
                      w-full
                      pl-12
                      pr-4
                      py-3
                      rounded-2xl
                      outline-none
                    "
                  />

                </div>

              </div>


              {/* Categories */}
              {
                categories.length > 0 && (
                  <div className="mb-7">

                    <div className="relative z-20">
                      <CategoryFilter
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                      />
                    </div>

                  </div>
                )
              }


              {/* Section Heading */}
              <div className="
                flex
                justify-between
                items-center
                mb-6
              ">

                <div>

                  <h2 className="
                    text-2xl
                    font-bold
                    text-gray-900
                  ">
                    Popular Right Now 🔥
                  </h2>

                  <p className="
                    text-gray-500
                    text-sm
                    mt-1
                  ">
                    Fresh picks loved by students
                  </p>

                </div>


                <button className="
                  hidden md:block
                  text-blue-600
                  font-semibold
                  hover:text-blue-700
                ">

                  View All →

                </button>

              </div>


              {/* Food Grid */}
              {
                loading ? (
                  <LoadingSkeleton />

                ) : popularItems.length === 0 ? (

                  <div className="
                    bg-white
                    rounded-3xl
                    py-20
                    text-center
                    text-gray-400
                    shadow-sm
                  ">

                    No food items found 😔

                  </div>

                ) : (

                  <div className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    xl:grid-cols-4
                    gap-6
                  ">

                    {
                      popularItems.map((item, index) => (

                        <motion.div
                          key={item.id}
                          initial={{
                            opacity: 0,
                            y: 20
                          }}
                          animate={{
                            opacity: 1,
                            y: 0
                          }}
                          transition={{
                            delay: index * 0.04
                          }}
                        >

                          <FoodCard
                            item={item}
                            onAddToCart={addToCart}
                          />

                        </motion.div>

                      ))
                    }

                  </div>

                )

              }

            </div>

          </main>


          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />

        </div>

      </div>

    </div>

  );

};

export default Dashboard;