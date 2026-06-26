import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { useCart } from "../context/CartContext";
import { foodAPI, categoryAPI } from "../services/api";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

import FoodCard from "../components/FoodCard";
import CategoryFilter from "../components/CategoryFilter";
import LoadingSkeleton from "../components/LoadingSkeleton";

const Menu = () => {
  const [foodItems, setFoodItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const { addToCart } = useCart();

  useEffect(() => {
    fetchCategories();
    fetchFoodItems();
  }, []);

  useEffect(() => {
    fetchFoodItems();
  }, [selectedCategory, searchQuery]);

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

  return (
    <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">
      <div className="bg-white rounded-[32px] overflow-hidden min-h-[calc(100vh-24px)] shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex">

        <Sidebar />

        <div className="flex-1 min-w-0">

          <DashboardHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          <main className="px-4 md:px-6 lg:px-8 py-5 pb-24">

            {/* PAGE TITLE */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-900">
                Menu
              </h1>

              <p className="text-gray-500 mt-2">
                Discover delicious meals and snacks on campus.
              </p>
            </div>

            {/* CATEGORY FILTER */}
            <div className="mb-8">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            {/* ALL ITEMS */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                All Items
              </h2>

              <span className="text-sm text-gray-500">
                {foodItems.length} Items
              </span>
            </div>

            {loading ? (
              <LoadingSkeleton />
            ) : foodItems.length === 0 ? (
              <div className="bg-white rounded-3xl py-20 text-center text-gray-400">
                No food items found 😔
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {foodItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <FoodCard
                      item={item}
                      onAddToCart={addToCart}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </main>

          <MobileBottomNav />

        </div>
      </div>
    </div>
  );
};

export default Menu;