import React from "react";
import { motion } from "framer-motion";
import { Camera, Mail, Phone, Package, Wallet, Heart } from "lucide-react";

const StatCard = ({ icon: Icon, value, label }) => (
    <div className="rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 px-3 sm:px-4 py-4 flex flex-col items-center text-center">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon size={16} className="text-white" />
        </div>
        <h3 className="mt-2.5 sm:mt-3 text-xl sm:text-2xl font-extrabold text-white">{value}</h3>
        <p className="text-blue-100 text-[11px] sm:text-xs mt-1">{label}</p>
    </div>
);

const ProfileHero = ({ profile, orders, favoritesCount = 0 }) => {

    const totalOrders = orders?.length || 0;

    const totalSpent =
        orders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;

    const initials =
        profile?.name
            ?.split(" ")
            ?.map((word) => word[0])
            ?.join("")
            ?.substring(0, 2)
            ?.toUpperCase() || "U";

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="
                relative
                overflow-hidden
                rounded-[32px]
                bg-gradient-to-br
                from-[#2563EB]
                via-[#2F73F5]
                to-[#3BAEF6]
                shadow-[0_25px_60px_rgba(37,99,235,.22)]
                px-6
                md:px-8
                py-8
            "
        >
            {/* Decorative dot grid */}
            <div
                className="
                    absolute
                    inset-0
                    opacity-[0.05]
                    bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_1px)]
                    bg-[length:20px_20px]
                "
            />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-8 sm:gap-10">

                {/* LEFT: Avatar + Info — centered on mobile, left-aligned row from sm up */}
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-5 sm:gap-6 flex-1 min-w-0">

                    <div className="relative shrink-0">
                        <div
                            className="
                                w-24
                                h-24
                                rounded-full
                                bg-white
                                shadow-[0_15px_35px_rgba(0,0,0,.18)]
                                border-4
                                border-white/20
                                flex
                                items-center
                                justify-center
                                overflow-hidden
                                mx-auto
                            "
                        >
                            {
                                profile?.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt={profile?.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-[#2563EB] text-3xl font-black">
                                        {initials}
                                    </span>
                                )
                            }
                        </div>

                        <button
                            className="
                                absolute
                                bottom-0
                                right-0
                                w-8
                                h-8
                                rounded-full
                                bg-[#2563EB]
                                text-white
                                shadow-lg
                                border-2
                                border-white
                                flex
                                items-center
                                justify-center
                                hover:scale-105
                                transition
                            "
                        >
                            <Camera size={14} />
                        </button>
                    </div>

                    <div className="min-w-0">

                        <h2 className="text-2xl sm:text-3xl font-black text-white">
                            {profile?.name || "CampusCraves User"}
                        </h2>

                        <span
                            className="
                                inline-flex
                                w-fit
                                items-center
                                justify-center
                                px-3
                                py-1
                                mt-2
                                rounded-full
                                bg-white/15
                                backdrop-blur-xl
                                text-white
                                text-xs
                                font-semibold
                            "
                        >
                            Student
                        </span>

                        <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-center sm:justify-start gap-2 text-white text-sm">
                                <Mail size={14} className="shrink-0" />
                                <span className="break-all">{profile?.email || "Not Available"}</span>
                            </div>
                            <div className="flex items-center justify-center sm:justify-start gap-2 text-white text-sm">
                                <Phone size={14} className="shrink-0" />
                                <span>{profile?.phone || "Not Added"}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT: Stats — 3 across, always one row */}
                <div className="grid grid-cols-3 gap-3 w-full sm:w-[420px] shrink-0">
                    <StatCard icon={Package} value={totalOrders} label="Orders" />
                    <StatCard icon={Wallet} value={`₹${totalSpent}`} label="Spent" />
                    <StatCard icon={Heart} value={favoritesCount} label="Favorites" />
                </div>

            </div>
        </motion.section>
    );
};

export default ProfileHero;