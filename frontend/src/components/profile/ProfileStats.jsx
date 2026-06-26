import React from "react";
import {
    Heart,
    ShoppingBag,
    Wallet,
    Bell,
} from "lucide-react";

const ProfileStats = ({
    orders,
    onLogout,
}) => {

    const totalOrders = orders.length;

    const totalSpent =
        orders.reduce(
            (sum, order) =>
                sum + (order.total_amount || 0),
            0
        );

    return (

        <div className="space-y-6">

            {/* Stats */}

            <div
                className="
                    grid
                    grid-cols-2
                    lg:grid-cols-4
                    gap-6
                "
            >

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">

                    <ShoppingBag
                        className="text-blue-600"
                        size={30}
                    />

                    <h2 className="mt-5 text-3xl font-bold">

                        {totalOrders}

                    </h2>

                    <p className="text-slate-500 mt-1">

                        Orders

                    </p>

                </div>

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">

                    <Wallet
                        className="text-green-600"
                        size={30}
                    />

                    <h2 className="mt-5 text-3xl font-bold">

                        ₹{totalSpent}

                    </h2>

                    <p className="text-slate-500 mt-1">

                        Total Spent

                    </p>

                </div>

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">

                    <Heart
                        className="text-red-500"
                        size={30}
                    />

                    <h2 className="mt-5 text-3xl font-bold">

                        0

                    </h2>

                    <p className="text-slate-500 mt-1">

                        Favorites

                    </p>

                </div>

                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">

                    <Bell
                        className="text-yellow-500"
                        size={30}
                    />

                    <h2 className="mt-5 text-3xl font-bold">

                        0

                    </h2>

                    <p className="text-slate-500 mt-1">

                        Notifications

                    </p>

                </div>

            </div>

            <div className="flex justify-center mt-2">

                <button
                    onClick={onLogout}
                    className="
        w-full
        h-14
        rounded-2xl
        bg-red-500
        hover:bg-red-600
        text-white
        font-semibold
        transition
    "
                >
                    Logout
                </button>

            </div>

        </div>

    );

};

export default ProfileStats;