import React from "react";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Topbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* DESKTOP TOPBAR */}
      <header
        className="
          hidden lg:flex
          items-center
          justify-between
          bg-white
          px-8
          h-20
          border-b
          border-slate-100
        "
      >
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>

        <button
          onClick={() => navigate("/admin/profile")}
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
            {user?.name?.charAt(0) || "A"}
          </div>

          <span className="font-medium">{user?.name || "Admin"}</span>

          <ChevronDown size={16} />
        </button>
      </header>

      {/* MOBILE TOPBAR */}
      <header className="lg:hidden bg-white px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold tracking-tight">
            Campus
            <span className="text-blue-600">Craves</span>
            <span className="ml-2 text-sm font-semibold text-gray-400 align-middle">
              ADMIN
            </span>
          </h1>

          <button
            onClick={() => navigate("/admin/profile")}
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
            {user?.name?.charAt(0) || "A"}
          </button>
        </div>
      </header>
    </>
  );
};

export default Topbar;