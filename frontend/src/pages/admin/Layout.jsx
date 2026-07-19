import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../../components/admin/Sidebar";
import Topbar from "../../components/admin/Topbar";
import AdminMobileBottomNav from "../../components/admin/AdminMobileBottomNav";

const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-[#F3F6FB] p-0 lg:p-5">
      <div
        className="
          bg-white
          rounded-[32px]
          overflow-hidden
          lg:min-h-[calc(100vh-40px)] min-h-screen
          shadow-[0_15px_40px_rgba(0,0,0,0.08)]
          flex
        "
      >
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Topbar />

          <main className="px-4 md:px-6 lg:px-8 py-5 pb-24">
            <Outlet />
          </main>

          <AdminMobileBottomNav />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;