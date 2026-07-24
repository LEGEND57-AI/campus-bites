import React from "react";

const NotificationSkeleton = () => (
  <div className="flex items-center gap-4 rounded-2xl px-4 py-4 sm:px-5 border border-slate-100 bg-white animate-pulse">
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-200 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-40 bg-slate-200 rounded" />
      <div className="h-3 w-64 bg-slate-100 rounded" />
    </div>
    <div className="h-3 w-12 bg-slate-100 rounded shrink-0" />
  </div>
);

export default NotificationSkeleton;