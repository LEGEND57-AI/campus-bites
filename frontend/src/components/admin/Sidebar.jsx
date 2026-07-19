import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  History,
  UtensilsCrossed,
  BarChart3,
  Tags,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
    { path: "/admin/orders", icon: ShoppingBag, label: "Orders" },
    { path: "/admin/menu", icon: UtensilsCrossed, label: "Menu" },
    { path: "/admin/history", icon: History, label: "History" },
    { path: "/admin/categories", icon: Tags, label: "Categories" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className="
        hidden
        lg:flex
        flex-col
        w-[220px]
        h-[calc(100vh-40px)]
        sticky
        top-5
        bg-white
        border-r
        border-gray-100
        flex-shrink-0
      "
    >
      {/* Logo */}
      <div className="px-8 pt-7 pb-5">
        <h1 className="text-[22px] font-extrabold tracking-tight leading-tight">
          Campus
          <span className="text-blue-600">Craves</span>
          <br />
          <span className="text-sm font-semibold text-gray-400 tracking-wide">
            ADMIN
          </span>
        </h1>
      </div>

      {/* Navigation */}
      <div className="px-5 mt-4">
        <div className="space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `
                    w-full
                    flex
                    items-center
                    gap-4
                    px-6
                    py-5
                    rounded-[22px]
                    text-[16px]
                    font-medium
                    transition-all
                    duration-300
                    ${
                      isActive
                        ? `
                          bg-gradient-to-r
                          from-blue-600
                          to-cyan-500
                          text-white
                          shadow-xl
                          shadow-blue-500/30
                        `
                        : `
                          text-gray-600
                          hover:bg-blue-50
                          hover:text-blue-600
                        `
                    }
                  `
                }
              >
                <Icon size={22} />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-auto px-5 pb-5">
        <button
          onClick={handleLogout}
          className="
            w-full
            flex
            items-center
            gap-4
            px-6
            py-5
            rounded-[22px]
            text-[16px]
            font-medium
            text-red-500
            hover:bg-red-50
            transition-all
            duration-300
          "
        >
          <LogOut size={22} />
          Logout
        </button>

        <div className="mt-6 px-2 text-xs text-gray-400 leading-5">
          © 2026 CampusCraves
          <br />
          All rights reserved.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;