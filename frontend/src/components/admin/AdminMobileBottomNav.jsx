import React from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Tags,
  BarChart3,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const AdminMobileBottomNav = () => {
  const items = [
    { path: "/admin", icon: LayoutDashboard, name: "Home", end: true },
    { path: "/admin/orders", icon: ShoppingBag, name: "Orders" },
    { path: "/admin/menu", icon: UtensilsCrossed, name: "Menu" },
    { path: "/admin/categories", icon: Tags, name: "Categories" },
    { path: "/admin/analytics", icon: BarChart3, name: "Analytics" },
  ];

  return (
    <nav
      className="
        lg:hidden
        fixed
        bottom-0
        left-0
        right-0
        z-50
        bg-white/95
        backdrop-blur-xl
        border-t
        border-gray-200
        px-2
        py-2
        shadow-[0_-8px_30px_rgba(0,0,0,0.08)]
      "
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 min-w-[60px] py-2 rounded-xl transition-all duration-300 ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`
              }
            >
              <Icon size={19} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default AdminMobileBottomNav;