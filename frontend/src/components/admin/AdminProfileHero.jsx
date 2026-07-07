import React from "react";
import { motion } from "framer-motion";
import { Mail, Phone, ShieldCheck } from "lucide-react";

const AdminProfileHero = ({ user }) => {

    const initials =
        user?.name
            ?.split(" ")
            ?.map((word) => word[0])
            ?.join("")
            ?.substring(0, 2)
            ?.toUpperCase() || "A";

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

            <div className="relative z-10 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-5 sm:gap-6">

                <div
                    className="
                        w-24
                        h-24
                        shrink-0
                        rounded-full
                        bg-white
                        shadow-[0_15px_35px_rgba(0,0,0,.18)]
                        border-4
                        border-white/20
                        flex
                        items-center
                        justify-center
                        overflow-hidden
                    "
                >
                    <span className="text-[#2563EB] text-3xl font-black">
                        {initials}
                    </span>
                </div>

                <div className="min-w-0">

                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                        {user?.name || "Admin"}
                    </h2>

                    <span
                        className="
                            inline-flex
                            w-fit
                            items-center
                            gap-1.5
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
                        <ShieldCheck size={13} />
                        Admin
                    </span>

                    <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-white text-sm">
                            <Mail size={14} className="shrink-0" />
                            <span className="break-all">{user?.email || "Not Available"}</span>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-white text-sm">
                            <Phone size={14} className="shrink-0" />
                            <span>{user?.phone || "Not Added"}</span>
                        </div>
                    </div>

                </div>
            </div>
        </motion.section>
    );
};

export default AdminProfileHero;