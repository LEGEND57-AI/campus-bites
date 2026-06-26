import React from "react";
import {
    Mail,
    Phone,
    GraduationCap,
    CreditCard,
    Clock,
    ChevronRight,
    Package,
} from "lucide-react";

const ProfileGrid = ({ profile, orders }) => {

    const recentOrders = orders.slice(0, 4);

    const info = [

        {
            icon: Mail,
            label: "Email",
            value: profile?.email || "Not Available",
        },

        {
            icon: Phone,
            label: "Phone",
            value: profile?.phone || "Not Added",
        },

        {
            icon: GraduationCap,
            label: "Department",
            value: "Computer Science",
        },

        {
            icon: CreditCard,
            label: "Student ID",
            value: "CC2026",
        },

    ];

    return (

        <div className="grid xl:grid-cols-3 gap-6">

            {/* LEFT */}

            <div
                className="
                    xl:col-span-1
                    bg-white
                    rounded-[28px]
                    border
                    border-slate-100
                    shadow-sm
                    p-6
                "
            >

                <h2 className="text-2xl font-bold">

                    Personal Information

                </h2>

                <div className="mt-6 space-y-4">

                    {

                        info.map((item) => {

                            const Icon = item.icon;

                            return (

                                <div
                                    key={item.label}
                                    className="
                                        flex
                                        items-center
                                        justify-between
                                        p-4
                                        rounded-2xl
                                        bg-slate-50
                                    "
                                >

                                    <div className="flex gap-4 items-center">

                                        <div
                                            className="
                                                w-12
                                                h-12
                                                rounded-xl
                                                bg-blue-100
                                                flex
                                                items-center
                                                justify-center
                                            "
                                        >

                                            <Icon
                                                size={18}
                                                className="text-blue-600"
                                            />

                                        </div>

                                        <div>

                                            <p className="text-xs text-slate-500">

                                                {item.label}

                                            </p>

                                            <h4 className="font-semibold">

                                                {item.value}

                                            </h4>

                                        </div>

                                    </div>

                                    <ChevronRight size={18} />

                                </div>

                            );

                        })

                    }

                </div>

            </div>

            {/* RIGHT */}

            <div
                className="
                    xl:col-span-2
                    bg-white
                    rounded-[28px]
                    border
                    border-slate-100
                    shadow-sm
                    p-6
                "
            >

                <div className="flex items-center justify-between">

                    <h2 className="text-2xl font-bold">

                        Recent Orders

                    </h2>

                    <button className="text-blue-600 font-semibold">

                        View All

                    </button>

                </div>

                <div className="mt-6 space-y-4">

                    {

                        recentOrders.length === 0 ?

                            (

                                <div className="text-center py-10 text-slate-400">

                                    No Orders Yet

                                </div>

                            )

                            :

                            recentOrders.map((order) => (

                                <div
                                    key={order.id}
                                    className="
                                        flex
                                        items-center
                                        justify-between
                                        rounded-2xl
                                        border
                                        border-slate-100
                                        p-5
                                    "
                                >

                                    <div className="flex items-center gap-4">

                                        <div
                                            className="
                                                w-12
                                                h-12
                                                rounded-xl
                                                bg-blue-100
                                                flex
                                                items-center
                                                justify-center
                                            "
                                        >

                                            <Package
                                                size={20}
                                                className="text-blue-600"
                                            />

                                        </div>

                                        <div>

                                            <h4 className="font-semibold">

                                                #{order.id}

                                            </h4>

                                            <p className="text-sm text-slate-500">

                                                {order.status}

                                            </p>

                                        </div>

                                    </div>

                                    <div className="text-right">

                                        <h4 className="font-bold">

                                            ₹{order.total_amount}

                                        </h4>

                                        <div className="flex items-center gap-1 text-xs text-slate-400">

                                            <Clock size={12} />

                                            {new Date(order.created_at).toLocaleDateString()}

                                        </div>

                                    </div>

                                </div>

                            ))

                    }

                </div>

            </div>

        </div>

    );

};

export default ProfileGrid;