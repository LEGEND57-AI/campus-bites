import React from "react";

const OrderFilters = ({
  activeFilter,
  setActiveFilter,
}) => {

  const filters = [
    "All",
    "Past Orders",
  ];

  return (
    <div
      className="
        grid
        grid-cols-2
        gap-3

        bg-white
        border
        border-gray-100

        rounded-3xl
        p-3
      "
    >
      {filters.map((filter) => (

        <button
          key={filter}
          onClick={() =>
            setActiveFilter(filter)
          }
          className={`
            h-14
            rounded-2xl
            font-medium
            transition-all

            ${activeFilter === filter
              ? `
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  shadow-lg
                `
              : `
                  bg-gray-50
                  text-gray-700
                  hover:bg-gray-100
                `
            }
          `}
        >
          {filter}
        </button>

      ))}
    </div>
  );
};

export default OrderFilters;