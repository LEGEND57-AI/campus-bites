import React from 'react';
import { motion } from 'framer-motion';

const CategoryFilter = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelectCategory('all')}
        className={`px-5 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
          selectedCategory === 'all'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'bg-white/70 backdrop-blur-sm text-gray-600 hover:bg-white'
        }`}
      >
        All Items
      </motion.button>
      {categories.map((category) => (
        <motion.button
          key={category.id}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectCategory(category.id.toString())}
          className={`px-5 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
            selectedCategory === category.id.toString()
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'bg-white/70 backdrop-blur-sm text-gray-600 hover:bg-white'
          }`}
        >
          {category.name}
        </motion.button>
      ))}
    </div>
  );
};

export default CategoryFilter;