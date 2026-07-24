import React, { useEffect, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  PackageCheck,
  Package,
  Wallet,
  XCircle,
  Settings,
  Megaphone,
  ChevronRight,
  Trash2,
} from "lucide-react";

const ICON_MAP = {
  order_placed: ClipboardList,
  order_confirmed: CheckCircle2,
  order_preparing: Clock,
  order_ready: Package,
  order_completed: CheckCircle2,
  order_cancelled: XCircle,
  payment_received: Wallet,
  system_update: Settings,
  announcement: Megaphone,
};

const COLOR_MAP = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  green: { bg: "bg-green-50", text: "text-green-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  red: { bg: "bg-red-50", text: "text-red-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
};

const TYPE_COLOR = {
  order_placed: "blue",
  order_confirmed: "green",
  order_preparing: "orange",
  order_ready: "purple",
  order_completed: "green",
  order_cancelled: "red",
  payment_received: "purple",
  system_update: "blue",
  announcement: "purple",
};

const formatRelativeTime = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const buildNavigationPath = (notification) => {

  // Highest priority -> use backend action_url
  if (notification.action_url) {
    return {
      path: notification.action_url,
    };
  }

  // Fallback if action_url is missing
  if (notification.order_id) {
    return {
      path: `/track-order/${notification.order_id}`,
    };
  }

  // Default
  return {
    path: "/notifications",
  };
};

const SWIPE_DELETE_THRESHOLD = -90;

const NotificationCard = ({ notification, onMarkRead, onDelete }) => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);

  const x = useMotionValue(0);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const Icon = ICON_MAP[notification.type] || Settings;
  const colorKey = TYPE_COLOR[notification.type] || "blue";
  const colors = COLOR_MAP[colorKey];

  const handleClick = () => {

    if (isDragging) return;

    if (!notification.is_read) {
      onMarkRead(notification.id);
    }

    const { path } = buildNavigationPath(notification);

    navigate(path);
  };

  const handleDragEnd = (_, info) => {
    setIsDragging(false);

    if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
      onDelete(notification.id);
    } else {
      x.set(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white">

      {/* Delete backdrop revealed on swipe (mobile only) */}
      <div className="absolute inset-0 lg:hidden pointer-events-none">

        <div className="absolute inset-0 bg-red-500 rounded-2xl" />

        <div className="absolute right-6 top-1/2 -translate-y-1/2">

          <Trash2
            size={22}
            className="text-white"
          />

        </div>

      </div>

      <motion.div
        style={{ x }}
        drag={isMobile ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        whileHover={!isMobile ? { y: -2 } : {}}
        exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0 }}
        initial={false}
        animate={{ x: 0 }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
        }}
        className={`
    relative
    z-10
    w-full
    bg-white
    group
    cursor-pointer
    touch-pan-y
    rounded-2xl
    border
    ${notification.is_read ? "border-slate-100" : "border-blue-100"}
    hover:border-blue-100
    hover:shadow-md
    transition-all
    duration-200
  `}
      >
        <div className="flex items-center gap-3 p-4">

          <div
            className={`
      w-12
      h-12
      rounded-xl
      ${colors.bg}
      flex
      items-center
      justify-center
      shrink-0
    `}
          >
            <Icon size={24} className={colors.text} />
          </div>

          <div className="flex-1 min-w-0">

            <div className="flex items-center gap-2 mb-2">

              <h4 className="font-semibold text-slate-900 text-[15px] truncate">
                {notification.title}
              </h4>

              {!notification.is_read && (
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              )}

            </div>

            {notification.token_number && (
              <div
                className={`
      inline-flex
      items-center
      px-5
      py-2
      mb-3
      rounded-full
      text-sm
      font-semibold
      ${colors.bg}
      ${colors.text}
    `}
              >
                Token #{notification.token_number}
              </div>
            )}

            <p className="text-[15px] text-slate-500 leading-6">
              {notification.message}
            </p>

          </div>

          <div className="flex flex-col items-end justify-between h-12 shrink-0">

            <span className="text-xs text-slate-400 whitespace-nowrap">
              {formatRelativeTime(notification.created_at)}
            </span>

            <ChevronRight
              size={17}
              className="hidden lg:block text-slate-300 group-hover:translate-x-1 transition"
            />

          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default NotificationCard;