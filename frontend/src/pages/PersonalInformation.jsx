import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, User, Mail, Phone, Save } from "lucide-react";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

import { userAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const PersonalInformation = () => {

    const navigate = useNavigate();
    const { updateUser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
    });

    useEffect(() => {

        loadProfile();

    }, []);

    const loadProfile = async () => {

        try {

            const res = await userAPI.getProfile();

            setForm({
                name: res.data?.name || "",
                email: res.data?.email || "",
                phone: res.data?.phone || "",
            });

        } catch (err) {

            console.error(err);

        } finally {

            setLoading(false);

        }

    };

    const handleChange = (field) => (e) => {

        setForm((prev) => ({
            ...prev,
            [field]: e.target.value,
        }));

    };

    const handleSave = async (e) => {

        e.preventDefault();

        setSaving(true);

        try {

            const res = await userAPI.updateProfile(form);

            // Sync AuthContext (and localStorage) so the header,
            // sidebar, and anywhere else using useAuth() update instantly
            updateUser(res?.data || form);

            navigate("/profile");

        } catch (err) {

            console.error(err);

        } finally {

            setSaving(false);

        }

    };

    return (
        <div className="min-h-screen bg-[#F3F6FB] p-3 lg:p-5">
            <div
                className="
                    bg-white
                    rounded-[32px]
                    overflow-hidden
                    min-h-[calc(100vh-24px)]
                    shadow-[0_15px_40px_rgba(0,0,0,0.08)]
                    flex
                "
            >
                <Sidebar />

                <div className="flex-1 min-w-0">

                    <DashboardHeader />

                    <motion.main
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="px-4 md:px-6 lg:px-8 py-5 pb-24"
                    >

                        <div className="max-w-3xl">

                            <button
                                onClick={() => navigate("/profile")}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition mb-6"
                            >
                                <ArrowLeft size={18} />
                                Back to Profile
                            </button>

                            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Personal Information</h1>
                            <p className="text-gray-500 mt-2">Update your name, phone number and profile picture</p>

                        </div>

                        {
                            loading ? (
                                <div className="mt-8 max-w-3xl h-[420px] rounded-[28px] bg-slate-200 animate-pulse" />
                            ) : (
                                <form
                                    onSubmit={handleSave}
                                    className="mt-8 max-w-3xl bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 sm:p-8 lg:p-10"
                                >

                                    <div className="flex flex-col items-center">
                                        <div className="relative">
                                            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                                                <span className="text-blue-600 text-3xl font-black">
                                                    {form.name?.[0]?.toUpperCase() || "U"}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white shadow-lg border-2 border-white flex items-center justify-center hover:scale-105 transition"
                                            >
                                                <Camera size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-8 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">

                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                                                <User size={15} className="text-blue-500" />
                                                Full Name
                                            </label>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={handleChange("name")}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                                placeholder="Your full name"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                                                <Phone size={15} className="text-blue-500" />
                                                Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                value={form.phone}
                                                onChange={handleChange("phone")}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>

                                        <div className="lg:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                                                <Mail size={15} className="text-blue-500" />
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                value={form.email}
                                                disabled
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 outline-none"
                                            />
                                            <p className="text-xs text-slate-400 mt-1.5">Email cannot be changed</p>
                                        </div>

                                    </div>

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="mt-8 w-full lg:w-auto lg:px-10 h-13 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition"
                                    >
                                        <Save size={17} />
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>

                                </form>
                            )
                        }

                    </motion.main>

                    <MobileBottomNav />

                </div>
            </div>
        </div>
    );
};

export default PersonalInformation;