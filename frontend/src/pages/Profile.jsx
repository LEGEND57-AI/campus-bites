import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

import ProfileHero from "../components/profile/ProfileHero";
import ProfileGrid from "../components/profile/ProfileGrid";
import ProfileStats from "../components/profile/ProfileStats";
import LogoutModal from "../components/profile/LogoutModal";

import { userAPI, orderAPI } from "../services/api";

const Profile = () => {

    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState("");

    const [profile, setProfile] = useState(null);

    const [orders, setOrders] = useState([]);

    const [loading, setLoading] = useState(true);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    useEffect(() => {

        loadProfile();

    }, []);

    const loadProfile = async () => {

        try {

            const [profileRes, ordersRes] = await Promise.all([

                userAPI.getProfile(),

                orderAPI.getOrders(),

            ]);

            console.log("PROFILE DATA:", profileRes.data);

            setProfile(profileRes.data);

            setOrders(ordersRes.data || []);

        } catch (err) {

            console.error(err);

        } finally {

            setLoading(false);

        }

    };

    const handleLogout = () => {

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");

    setShowLogoutModal(false);

    navigate("/login", {
        replace: true,
    });

};



    return (

        <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">

            <div
                className="
                    bg-white
                    rounded-[32px]
                    overflow-hidden
                    min-h-[calc(100vh-24px)]
                    shadow-[0_15px_40px_rgba(0,0,0,0.08)]
                    flex
                "
            >

                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                    />

                    <motion.main
                        initial={{
                            opacity: 0,
                            y: 20,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.35,
                            ease: "easeOut",
                        }}
                        className="
        px-4
        md:px-6
        lg:px-8
        py-5
        pb-24
    "
                    >

                        <div className="mb-8">

                            <h1 className="text-4xl font-bold text-slate-900">

                                My Profile

                            </h1>

                            <p className="text-gray-500 mt-2">

                                Manage your CampusCraves account

                            </p>

                        </div>

                        {
                            loading ? (

                                <div
                                    className="
                h-[520px]
                rounded-[36px]
                bg-slate-200
                animate-pulse
            "
                                />

                            ) : (

                                <ProfileHero
                                    profile={profile}
                                    orders={orders}
                                />

                            )
                        }

                        <div className="mt-8">

                            {
                                loading ? (

                                    <div
                                        className="
                    h-[420px]
                    rounded-[36px]
                    bg-slate-200
                    animate-pulse
                "
                                    />

                                ) : (

                                    <ProfileGrid
                                        profile={profile}
                                        orders={orders}
                                    />

                                )
                            }

                        </div>

                        <div className="mt-8">

                            {

                                loading ? (

                                    <div
                                        className="
                    h-[280px]
                    rounded-[36px]
                    bg-slate-200
                    animate-pulse
                "
                                    />

                                ) : (

                                    <ProfileStats
                                        profile={profile}
                                        orders={orders}
                                        onLogout={() => setShowLogoutModal(true)}
                                    />



                                )

                            }

                        </div>


                    </motion.main>

                    <LogoutModal
                        open={showLogoutModal}
                        onClose={() => setShowLogoutModal(false)}
                        onLogout={handleLogout}
                    />

                    <MobileBottomNav />

                </div>

            </div>

        </div >

    );

};

export default Profile;