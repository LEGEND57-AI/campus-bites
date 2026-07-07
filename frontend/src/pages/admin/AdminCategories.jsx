import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { Pencil, Trash2, Plus, X, UploadCloud, Tag } from "lucide-react";

import { categoryAPI, uploadAPI } from "../../services/api";

const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        image: null,
        image_url: "",
    });

    const resetForm = () => {
        setFormData({
            name: "",
            image: null,
            image_url: "",
        });
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        resetForm();
    };

    const fetchCategories = useCallback(async () => {
        try {
            const { data } = await categoryAPI.getAdminCategories();
            setCategories(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") closeModal();
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            image: null,
            image_url: category.image_url || "",
        });
        setShowModal(true);
    };

    const handleDeleteCategory = async (category) => {
        const result = await Swal.fire({
            title: "Delete Category?",
            text: `Are you sure you want to delete ${category.name}?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#ef4444",
        });

        if (!result.isConfirmed) return;

        try {
            await categoryAPI.deleteCategory(category.id);
            toast.success("Category deleted successfully");
            fetchCategories();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || "Cannot delete category");
        }
    };

    const handleSaveCategory = async () => {
        if (!formData.name.trim()) {
            toast.error("Category name is required");
            return;
        }

        try {
            let image_url = formData.image_url;

            if (formData.image) {
                setUploading(true);
                const response = await uploadAPI.uploadImage(formData.image);
                image_url = response.data.url;
            }

            if (!editingCategory) {
                await categoryAPI.createCategory(formData.name, image_url);
                toast.success("Category added successfully");
            } else {
                await categoryAPI.updateCategory(
                    editingCategory.id,
                    formData.name,
                    image_url
                );
                toast.success("Category updated successfully");
            }

            resetForm();
            setEditingCategory(null);
            setShowModal(false);
            fetchCategories();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || "Failed to save category");
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-xl bg-gray-200" />
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* MODAL */}
            {showModal && (
                <div
                    onClick={closeModal}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 px-6 sm:px-8 py-4 sm:py-5">
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                {editingCategory ? "Edit Category" : "Add New Category"}
                            </h2>

                            <button
                                onClick={closeModal}
                                className="hover:bg-white/20 p-2 rounded-full transition text-white"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div className="space-y-5 p-6 sm:p-8 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">
                                    Category Name
                                </label>

                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value,
                                        })
                                    }
                                    placeholder="Enter category name"
                                    className="w-full rounded-2xl border border-gray-200 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-3">
                                    Category Image
                                </label>

                                <label
                                    className="
                                        flex flex-col items-center justify-center
                                        h-36 sm:h-40
                                        cursor-pointer
                                        rounded-2xl border-2 border-dashed border-gray-300
                                        hover:border-blue-500 transition
                                    "
                                >
                                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                                    <span className="text-gray-500 text-sm font-medium">
                                        Click to upload image
                                    </span>
                                    <span className="text-gray-400 text-xs mt-0.5">
                                        PNG, JPG, WEBP
                                    </span>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                image: e.target.files[0],
                                            })
                                        }
                                    />
                                </label>

                                {(formData.image || formData.image_url) && (
                                    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                                        <img
                                            src={
                                                formData.image
                                                    ? URL.createObjectURL(formData.image)
                                                    : formData.image_url
                                            }
                                            alt="Category Preview"
                                            className="h-40 sm:h-52 w-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 rounded-2xl border py-3 font-semibold text-gray-600 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={handleSaveCategory}
                                    disabled={uploading}
                                    className="flex-1 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3 font-bold text-white shadow-lg hover:shadow-xl transition disabled:opacity-50"
                                >
                                    {uploading
                                        ? "Uploading..."
                                        : editingCategory
                                            ? "Update Category"
                                            : "Add Category"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h2 className="text-2xl sm:text-4xl font-bold text-slate-800">
                        Category Management
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm sm:text-base">
                        Organize your menu into categories
                    </p>
                </div>

                <button
                    onClick={() => {
                        setEditingCategory(null);
                        resetForm();
                        setShowModal(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl
                               bg-gradient-to-r from-blue-500 to-indigo-600
                               text-white font-semibold shadow-lg hover:scale-105
                               transition-all w-full sm:w-auto"
                >
                    <Plus size={20} />
                    Add Category
                </button>
            </div>

            {/* GRID */}
            {categories.length === 0 ? (
                <div className="bg-white rounded-3xl py-20 text-center text-gray-400">
                    <Tag size={40} className="mx-auto mb-3 text-gray-300" />
                    No categories found
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-8">
                    {categories.map((category, index) => (
                        <motion.div
                            key={category.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.06 }}
                            whileHover={{ y: -6 }}
                            className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
                        >
                            <div className="h-36 sm:h-44 w-full bg-gray-100">
                                <img
                                    src={
                                        category.image_url ||
                                        "https://placehold.co/600x400?text=Category"
                                    }
                                    alt={category.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="p-4 sm:p-5">
                                <h3 className="font-bold text-lg sm:text-xl text-slate-800 truncate">
                                    {category.name}
                                </h3>

                                <span className="inline-flex items-center gap-1.5 mt-2 sm:mt-3 px-3 sm:px-4 py-1 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium">
                                    🍽 {category.total_items || 0} Menu Items
                                </span>

                                <div className="flex gap-2 sm:gap-3 mt-4">
                                    <button
                                        onClick={() => handleEditCategory(category)}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-100 py-2 text-sm sm:text-base font-medium text-blue-700 transition hover:bg-blue-200"
                                    >
                                        <Pencil size={15} />
                                        Edit
                                    </button>

                                    {category.total_items > 0 ? (
                                        <button
                                            disabled
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-2 text-sm sm:text-base font-medium text-gray-400 cursor-not-allowed"
                                        >
                                            🔒 In Use
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleDeleteCategory(category)}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-100 py-2 text-sm sm:text-base font-medium text-red-600 transition hover:bg-red-200"
                                        >
                                            <Trash2 size={15} />
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminCategories;