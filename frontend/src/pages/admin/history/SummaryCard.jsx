import React from "react";
import { motion } from "framer-motion";

const SummaryCard = ({
    icon: Icon,
    label,
    value,
    bg,
    color,
    delay = 0,
    onClick,
    isActive = false,
}) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        whileHover={{ y: -3 }}
        onClick={onClick}
        className={`
    bg-white
    rounded-2xl
    p-4
    sm:p-5
    transition-all
    duration-300
    ${isActive
                ? "border-2 border-blue-500 shadow-[0_8px_30px_rgba(59,130,246,0.18)] -translate-y-0.5"
                : "border border-slate-100 shadow-sm"
            }
    ${onClick ? "cursor-pointer hover:shadow-md" : ""}
`}
    >
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${bg} flex items-center justify-center mb-3`}>
            <Icon size={18} className={color} />
        </div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className={`text-xl sm:text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </motion.div>
);

export default SummaryCard;