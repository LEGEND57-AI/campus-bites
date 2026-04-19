import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { foodAPI, categoryAPI } from '../services/api';
import Navbar from '../components/Navbar';
import FoodCard from '../components/FoodCard';
import CategoryFilter from '../components/CategoryFilter';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [foodItems, setFoodItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  // 🔥 INITIAL LOAD
  useEffect(() => {
    fetchCategories();
    fetchFoodItems();
  }, []);

  // 🔥 FILTER CHANGE
  useEffect(() => {
    fetchFoodItems();
  }, [selectedCategory, searchQuery]);

  // 🔥 AUTO REFRESH FOOD (5 sec)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFoodItems();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedCategory, searchQuery]);

  // 🔥 AUTO REFRESH CATEGORY (10 sec)
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
      if (selectedCategory !== 'all') params.categoryId = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const { data } = await foodAPI.getItems(params);
      setFoodItems(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50"></div>

      {/* GLOW */}
      <div className="absolute -top-40 -left-40 w-[400px] h-[400px] bg-blue-400 opacity-20 blur-3xl rounded-full -z-10"></div>
      <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] bg-cyan-400 opacity-20 blur-3xl rounded-full -z-10"></div>

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4 
                         bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 
                         bg-clip-text text-transparent">
            What's for lunch today?
          </h1>

          <p className="text-slate-500 text-lg">
            Fresh, fast & delicious meals on your campus 🍔
          </p>
        </motion.div>

        {/* SEARCH */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-xl mx-auto mb-12"
        >
          <div className="relative bg-white/70 backdrop-blur-md border border-white/50 rounded-2xl shadow-md">

            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />

            <input
              type="text"
              placeholder="Search food, drinks, snacks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl outline-none bg-transparent"
            />
          </div>
        </motion.div>

        {/* CATEGORY */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex justify-center"
          >
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </motion.div>
        )}

        {/* GRID */}
        {loading ? (
          <LoadingSkeleton />
        ) : foodItems.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            No items found 😔
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {foodItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <FoodCard item={item} onAddToCart={addToCart} />
              </motion.div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;