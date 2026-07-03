import React from "react";
import { ShieldCheck, BadgeCheck } from "lucide-react";

const ProfileStats = ({ profile }) => {

    const lastLogin =
        profile?.last_login
            ? new Date(profile.last_login).toLocaleString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
              })
            : "Today";

    return (
        <div
            className="
                rounded-[28px]
                bg-blue-50/60
                border
                border-blue-100
                px-6
                py-5
                flex
                flex-col
                sm:flex-row
                items-center
                justify-between
                gap-4
            "
        >
            <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} className="text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900">Your account is secure</h4>
                    <p className="text-sm text-slate-500">
                        We use top-level security to keep your data safe and protected.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-green-600 font-medium shrink-0">
                <BadgeCheck size={16} />
                Last login: {lastLogin}
            </div>
        </div>
    );
};

export default ProfileStats;