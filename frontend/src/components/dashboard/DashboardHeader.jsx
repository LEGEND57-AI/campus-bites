import React from "react";
import {
  MapPin,
  Search,
  ShoppingCart,
  Bell,
  ChevronDown,
} from "lucide-react";

import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

const DashboardHeader = ({
  searchQuery,
  setSearchQuery,
  showSearch = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const { getItemCount } = useCart();

  const handleNotification = () => {
    toast("Notifications coming soon 🔔");
  };

  return (
    <>
      {/* DESKTOP HEADER */}
      <header
        className="
        hidden lg:flex
        items-center justify-between
        bg-white
        px-8
        h-20
        border-b border-slate-100
      "
      >
        {/* Location */}
        <button
          className="
          flex items-center gap-2
          text-slate-700
          hover:text-blue-600
          transition
        "
        >
          <MapPin size={18} />

          <span className="font-medium">
            GSFC Campus
          </span>

          <ChevronDown size={16} />
        </button>

        {/* Search */}
        {showSearch && (
          <div className="relative w-[500px]">
            <Search
              size={18}
              className="
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
            />


            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {

                if (!setSearchQuery) return;

                const value = e.target.value;

                setSearchQuery(value);

                if (location.pathname === "/") {
                  navigate(`/menu?search=${encodeURIComponent(value)}`);
                }

              }}
              placeholder="Search for food, drinks, snacks..."
              className="
              w-full
              h-14
              pl-12
              pr-24
              rounded-3xl
              border border-slate-200
              outline-none
              focus:border-blue-500
            "
            />

            <div
              className="
            absolute
            right-4
            top-1/2
            -translate-y-1/2
            text-xs
            text-slate-400
            border
            border-slate-200
            rounded-lg
            px-2 py-1
          "
            >
              Ctrl + K
            </div>
          </div>
        )}

        {/* Right Side */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/cart")}
            className="relative"
          >
            <ShoppingCart size={23} />

            {getItemCount() > 0 && (
              <span
                className="
                absolute
                -top-2
                -right-2
                w-5
                h-5
                rounded-full
                bg-blue-600
                text-white
                text-[10px]
                flex
                items-center
                justify-center
              "
              >
                {getItemCount()}
              </span>
            )}
          </button>

          <button
            onClick={handleNotification}
            className="relative"
          >
            <Bell size={23} />

            <span
              className="
              absolute
              -top-1
              -right-1
              w-2
              h-2
              rounded-full
              bg-blue-600
            "
            />
          </button>

          <button
            onClick={() => navigate("/profile")}
            className="
              flex items-center gap-3
              hover:bg-slate-50
              px-3 py-2
              rounded-xl
            "
          >
            <div
              className="
              w-11
              h-11
              rounded-full
              bg-blue-600
              text-white
              flex
              items-center
              justify-center
              font-semibold
            "
            >
              {user?.name?.charAt(0) || "U"}
            </div>

            <span className="font-medium">
              {user?.name || "User"}
            </span>

            <ChevronDown size={16} />
          </button>
        </div>
      </header>

      {/* MOBILE HEADER */}
      <header
        className="
        lg:hidden
        bg-white
        px-5
        pt-5
        pb-3
      "
      >
        {/* Top */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="
              text-[26px]
              font-extrabold
              tracking-tight
            "
            >
              Campus
              <span className="text-blue-600">
                Craves
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Cart */}
            <button
              onClick={() => navigate("/cart")}
              className="relative"
            >
              <ShoppingCart size={20} />

              {getItemCount() > 0 && (
                <span
                  className="
                  absolute
                  -top-2
                  -right-2
                  w-4
                  h-4
                  rounded-full
                  bg-blue-600
                  text-white
                  text-[8px]
                  flex
                  items-center
                  justify-center
                "
                >
                  {getItemCount()}
                </span>
              )}
            </button>

            {/* Notification */}
            <button
              onClick={handleNotification}
              className="relative"
            >
              <Bell size={20} />

              <span
                className="
                absolute
                -top-1
                -right-1
                w-2
                h-2
                bg-blue-600
                rounded-full
              "
              />
            </button>

            {/* Profile */}
            <button
              onClick={() =>
                navigate("/profile")
              }
              className="
                w-10
                h-10
                rounded-full
                bg-blue-600
                text-white
                font-semibold
                flex
                items-center
                justify-center
              "
            >
              {user?.name?.charAt(0) || "U"}
            </button>
          </div>
        </div>

        {/* Location */}
        <button
          className="
          mt-4
          flex items-center gap-2
          text-sm
          text-slate-600
        "
        >
          <MapPin size={15} />

          GSFC Campus

          <ChevronDown size={14} />
        </button>
      </header>
    </>
  );
};

export default DashboardHeader;