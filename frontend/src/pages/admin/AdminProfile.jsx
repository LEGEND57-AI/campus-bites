import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LayoutDashboard, LogOut } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import AdminProfileHero from "../../components/admin/AdminProfileHero";
import LogoutModal from "../../components/profile/LogoutModal";

const AdminProfile = () => {

    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogout = () => {
        logout();
        setShowLogoutModal(false);
        navigate("/login", { replace: true });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
        >

            <div className="mb-8">

                <button
                    onClick={() => navigate("/admin")}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition mb-6"
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                    My Profile
                </h1>

                <p className="text-gray-500 mt-2">
                    Manage your CampusCraves admin account
                </p>

            </div>

            <AdminProfileHero user={user} />

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">

                <button
                    onClick={() => navigate("/admin")}
                    className="
                        flex
                        items-center
                        gap-4
                        bg-white
                        border
                        border-slate-100
                        shadow-sm
                        rounded-2xl
                        p-5
                        text-left
                        hover:shadow-md
                        transition
                    "
                >
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <LayoutDashboard size={20} className="text-blue-600" />
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-900">Dashboard</h3>
                        <p className="text-sm text-gray-500">Back to admin overview</p>
                    </div>
                </button>

                <button
                    onClick={() => setShowLogoutModal(true)}
                    className="
                        flex
                        items-center
                        gap-4
                        bg-white
                        border
                        border-slate-100
                        shadow-sm
                        rounded-2xl
                        p-5
                        text-left
                        hover:shadow-md
                        transition
                    "
                >
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <LogOut size={20} className="text-red-500" />
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-900">Logout</h3>
                        <p className="text-sm text-gray-500">Sign out of admin account</p>
                    </div>
                </button>

            </div>

            <LogoutModal
                open={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onLogout={handleLogout}
            />

        </motion.div>
    );
};

export default AdminProfile;