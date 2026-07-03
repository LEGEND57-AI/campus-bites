import React from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronRight,
    ClipboardList,
    CalendarClock,
    TrendingUp,
    CalendarDays,
    Heart,
    LogOut,
} from "lucide-react";

const Row = ({ icon: Icon, title, subtitle, onClick, tone = "blue" }) => {

    const toneMap = {
        blue: "bg-blue-100 text-blue-600",
        red: "bg-red-100 text-red-500",
    };

    return (
        <button
            onClick={onClick}
            className="
                w-full
                flex
                items-center
                justify-between
                gap-3
                p-3.5
                sm:p-4
                rounded-2xl
                hover:bg-slate-50
                transition
                text-left
            "
        >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl flex items-center justify-center ${toneMap[tone]}`}>
                    <Icon size={17} />
                </div>
                <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 text-[15px] sm:text-base">
                        {title}
                    </h4>
                    {
                        subtitle && (
                            <p className="text-xs sm:text-sm text-slate-500 leading-snug mt-0.5">
                                {subtitle}
                            </p>
                        )
                    }
                </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
    );
};

const MetricRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-center justify-between py-3.5 border-b last:border-0 border-slate-100">
        <div className="flex items-center gap-3 text-slate-600">
            <Icon size={18} className="text-blue-500" />
            <span className="font-medium">{label}</span>
        </div>
        <span className="font-bold text-slate-900">{value}</span>
    </div>
);

const ProfileGrid = ({ profile, orders, onLogout }) => {

    const navigate = useNavigate();

    const totalOrders = orders?.length || 0;

    const totalSpent =
        orders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;

    const now = new Date();

    const ordersThisMonth =
        orders?.filter((order) => {
            const d = new Date(order.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length || 0;

    const avgOrderValue = totalOrders ? Math.round(totalSpent / totalOrders) : 0;

    const firstOrderDate =
        orders?.length
            ? new Date(Math.min(...orders.map((o) => new Date(o.created_at).getTime())))
                .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

    return (
        <div className="grid xl:grid-cols-2 gap-6">

            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900">Order Activity</h2>
                <div className="mt-4">
                    <MetricRow icon={ClipboardList} label="Total Orders" value={totalOrders} />
                    <MetricRow icon={CalendarClock} label="Orders This Month" value={ordersThisMonth} />
                    <MetricRow icon={TrendingUp} label="Average Order Value" value={`₹${avgOrderValue}`} />
                    <MetricRow icon={CalendarDays} label="First Order Date" value={firstOrderDate} />
                </div>
            </div>

            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
                <div className="mt-4 space-y-1">
                    <Row
                        icon={ClipboardList}
                        title="View Order History"
                        subtitle="See all your past orders"
                        onClick={() => navigate("/orders")}
                    />
                    <Row
                        icon={Heart}
                        title="Favorite Foods"
                        subtitle="Your saved favorite items"
                        onClick={() => navigate("/favorites")}
                        tone="red"
                    />
                    <Row
                        icon={LogOut}
                        title="Logout"
                        subtitle="Sign out from your account"
                        onClick={onLogout}
                        tone="red"
                    />
                </div>
            </div>

        </div>
    );
};

export default ProfileGrid;