import React, { useRef } from "react";
import { motion } from "framer-motion";
import {
  Grid2X2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";


const CategoryFilter = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {


  // Scroll Reference
  const scrollRef = useRef(null);


  // Scroll Right
  const scrollRight = () => {

    if (scrollRef.current) {

      scrollRef.current.scrollBy({
        left: 250,
        behavior: "smooth",
      });

    }

  };


  // Scroll Left
  const scrollLeft = () => {

    if (scrollRef.current) {

      scrollRef.current.scrollBy({
        left: -250,
        behavior: "smooth",
      });

    }

  };


  return (

    <div className="relative flex items-center">


      {/* LEFT ARROW */}
      <button

        onClick={scrollLeft}

        className="
          hidden
          lg:flex

          w-10
          h-10

          flex-shrink-0

          items-center
          justify-center

          bg-white
          rounded-full

          border
          border-gray-200

          shadow-md

          hover:bg-gray-50

          transition

          mr-3
        "

      >

        <ChevronLeft
          size={18}
          className="text-gray-600"
        />

      </button>


      {/* CATEGORY SCROLL AREA */}

      <div
        ref={scrollRef}

        className="
  flex
  items-center
  gap-3
  overflow-x-auto
  hide-scrollbar
  scroll-smooth
  flex-1
  py-1
"
      >


        {/* ALL ITEMS */}
        <motion.button

          whileTap={{
            scale: 0.97
          }}

          onClick={() =>
            onSelectCategory("all")
          }

          className={`
            flex
            items-center
            gap-2

            flex-shrink-0

            px-5
            h-10

            rounded-full

            text-sm
            font-medium

            transition-all

            ${selectedCategory === "all"

              ?

              `
              bg-gradient-to-r
              from-blue-600
              to-cyan-500
              text-white
              shadow-lg
              shadow-blue-500/25
              `

              :

              `
              bg-white
              border
              border-gray-200
              text-gray-700
              hover:bg-gray-50
              `
            }

          `}
        >

          <Grid2X2 size={16} />

          All Items

        </motion.button>

        {/* DYNAMIC CATEGORIES */}
        {
          categories.map((category) => (

            <motion.button

              key={category.id}

              whileTap={{
                scale: 0.97
              }}

              onClick={() =>
                onSelectCategory(
                  category.id.toString()
                )
              }


              className={`
                flex-shrink-0

                px-5
                h-10

                rounded-full

                text-sm
                font-medium

                transition-all
                duration-200


                ${selectedCategory === category.id.toString()

                  ?

                  `
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500

                  text-white

                  shadow-lg
                  shadow-blue-500/25
                  `

                  :

                  `
                  bg-white

                  border
                  border-gray-200

                  text-gray-700

                  hover:bg-gray-50
                  hover:border-gray-300
                  `
                }

              `}
            >

              {category.name}

            </motion.button>

          ))
        }


      </div>


      {/* RIGHT ARROW */}
      <button

        onClick={scrollRight}

        className="
          hidden
          lg:flex

          ml-3

          w-10
          h-10

          flex-shrink-0

          items-center
          justify-center

          bg-white

          rounded-full

          border
          border-gray-200

          shadow-md

          hover:bg-gray-50

          transition
        "

      >

        <ChevronRight
          size={18}
          className="text-gray-600"
        />

      </button>

    </div>

  );

};


export default CategoryFilter;