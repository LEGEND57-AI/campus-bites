import React from "react";
import { motion } from "framer-motion";
import {
    User,
    Pencil,
    ShieldCheck,
    Mail,
    Phone,
    Package,
    Wallet,
    Clock3,
    Heart,
} from "lucide-react";

const ProfileHero = ({ profile, orders }) => {

    const totalOrders = orders?.length || 0;

    const totalSpent =
        orders?.reduce(
            (sum, order) => sum + (order.total_amount || 0),
            0
        ) || 0;

    const pendingOrders =
        orders?.filter((order) =>
            ["pending", "accepted", "preparing"].includes(
                order.status?.toLowerCase()
            )
        ).length || 0;

    // Temporary
    const favoriteItems = 0;

    return (

        <motion.div
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
            }}
            className="
        relative
        overflow-hidden
        rounded-[36px]
        bg-gradient-to-br
        from-blue-700
        via-blue-600
        to-cyan-500
        p-6
        lg:p-8
        text-white
        shadow-[0_20px_60px_rgba(37,99,235,.25)]
      "
        >

            {/* Background */}

            <div
                className="
          absolute
          -right-16
          -top-16
          w-80
          h-80
          rounded-full
          bg-white/10
        "
            />

            <div
                className="
          absolute
          left-[45%]
          top-0
          w-72
          h-72
          rounded-full
          bg-white/5
        "
            />

            <div
                className="
          absolute
          -bottom-20
          left-1/2
          w-72
          h-72
          rounded-full
          bg-white/5
        "
            />

            <div className="relative z-10">

                <div
                    className="
            flex
            flex-col
            xl:flex-row
            justify-between
            xl:items-center
            gap-8
          "
                >

                    {/* LEFT */}

                    <div
                        className="
              flex
              flex-col
              md:flex-row
              items-center
              md:items-center
              gap-6
            "
                    >

                        {/* Avatar */}

                        <div
                            className="
                w-28
                h-28
                lg:w-32
                lg:h-32
                rounded-full
                bg-white
                border-[5px]
                border-white/20
                shadow-2xl
                flex
                items-center
                justify-center
                text-blue-600
                text-5xl
                font-black
                shrink-0
              "
                        >

                            {

                                profile?.name
                                    ? profile.name.charAt(0).toUpperCase()
                                    : <User size={48} />

                            }

                        </div>

                        {/* User Details */}

                        <div className="text-center md:text-left">

                            <h1
                                className="
                  text-3xl
                  lg:text-4xl
                  font-black
                  tracking-tight
                "
                            >

                                {profile?.name || "CampusCraves User"}

                            </h1>

                            <div
                                className="
                  mt-3
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  bg-white/15
                  backdrop-blur-xl
                  px-4
                  py-2
                  text-sm
                  font-semibold
                "
                            >

                                <ShieldCheck size={18} />

                                Verified Student

                            </div>

                            <div
                                className="
                  mt-5
                  flex
                  flex-col
                  lg:flex-row
                  gap-3
                "
                            >

                                <div
                                    className="
                    flex
                    items-center
                    gap-3
                    rounded-2xl
                    bg-white/10
                    backdrop-blur-xl
                    px-4
                    py-3
                  "
                                >

                                    <Mail size={18} />

                                    <span>

                                        {profile?.email || "No Email"}

                                    </span>

                                </div>

                                <div
                                    className="
                    flex
                    items-center
                    gap-3
                    rounded-2xl
                    bg-white/10
                    backdrop-blur-xl
                    px-4
                    py-3
                  "
                                >

                                    <Phone size={18} />

                                    <span>

                                        {profile?.phone ?? "Not added yet"}

                                    </span>

                                </div>

                            </div>

                        </div>

                    </div>


                    {/* RIGHT */}

                    <div
                        className="
              flex
              items-center
              justify-center
              xl:justify-end
            "
                    >

                        <button
                            className="
                bg-white
                text-blue-600
                px-7
                py-4
                rounded-2xl
                font-bold
                shadow-xl
                hover:scale-105
                hover:shadow-2xl
                transition-all
                duration-300
                flex
                items-center
                gap-3
              "
                        >

                            <Pencil size={20} />

                            Edit Profile

                        </button>

                    </div>

                </div>

                {/* STATS */}

                <div
                    className="
            mt-8
            grid
            grid-cols-2
            lg:grid-cols-4
            gap-4
          "
                >

                    {/* Orders */}

                    <div
                        className="
              rounded-3xl
              bg-white/10
              backdrop-blur-xl
              border
              border-white/15
              p-5
            "
                    >

                        <Package
                            size={24}
                            className="text-white/90"
                        />

                        <h2
                            className="
                mt-4
                text-3xl
                font-black
              "
                        >

                            {totalOrders}

                        </h2>

                        <p className="mt-1 text-blue-100">

                            Orders

                        </p>

                    </div>

                    {/* Total Spent */}

                    <div
                        className="
              rounded-3xl
              bg-white/10
              backdrop-blur-xl
              border
              border-white/15
              p-5
            "
                    >

                        <Wallet
                            size={24}
                            className="text-white/90"
                        />

                        <h2
                            className="
                mt-4
                text-3xl
                font-black
              "
                        >

                            ₹{totalSpent}

                        </h2>

                        <p className="mt-1 text-blue-100">

                            Total Spent

                        </p>

                    </div>

                    {/* Pending */}

                    <div
                        className="
              rounded-3xl
              bg-white/10
              backdrop-blur-xl
              border
              border-white/15
              p-5
            "
                    >

                        <Clock3
                            size={24}
                            className="text-white/90"
                        />

                        <h2
                            className="
                mt-4
                text-3xl
                font-black
              "
                        >

                            {pendingOrders}

                        </h2>

                        <p className="mt-1 text-blue-100">

                            Pending

                        </p>

                    </div>

                    {/* Favorites */}

                    <div
                        className="
              rounded-3xl
              bg-white/10
              backdrop-blur-xl
              border
              border-white/15
              p-5
            "
                    >

                        <Heart
                            size={24}
                            className="text-white/90"
                        />

                        <h2
                            className="
                mt-4
                text-3xl
                font-black
              "
                        >

                            {favoriteItems}

                        </h2>

                        <p className="mt-1 text-blue-100">

                            Favorites

                        </p>

                    </div>

                </div>


            </div>

        </motion.div>

    );

};

export default ProfileHero;