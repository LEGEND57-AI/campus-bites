import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { Pencil, Trash2, Plus } from "lucide-react";

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

            setFormData({
                name: "",
                image: null,
                image_url: "",
            });
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
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-5">
                            <h2 className="text-3xl font-bold text-white">
                                {editingCategory ? "Edit Category" : "Add New Category"}
                            </h2>

                            <button
                                onClick={closeModal}
                                className="text-4xl text-white transition hover:rotate-90"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-5 p-8">
                            <div>
                                <label className="font-semibold text-gray-700">Category Name</label>

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
                                    className="mt-2 w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-gray-700">
                                    Category Image
                                </label>

                                <label
                                    className="
            mt-2 flex h-40 cursor-pointer items-center justify-center
            rounded-2xl border-2 border-dashed border-blue-400
            bg-blue-50 transition hover:bg-blue-100
        "
                                >
                                    <div className="text-center text-gray-500">
                                        <div className="mb-2 text-4xl">📷</div>

                                        <p className="font-medium">
                                            Click to upload image
                                        </p>

                                        <p className="text-sm">
                                            PNG, JPG, WEBP
                                        </p>
                                    </div>

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

                                {/* Image Preview */}
                                {(formData.image || formData.image_url) && (
                                    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                                        <img
                                            src={
                                                formData.image
                                                    ? URL.createObjectURL(formData.image)
                                                    : formData.image_url
                                            }
                                            alt="Category Preview"
                                            className="h-52 w-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>


                            <div className="flex gap-3 pt-3">
                                <button
                                    className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold"
                                    onClick={closeModal}
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={handleSaveCategory}
                                    disabled={uploading}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
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

            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">🏷 Category Management</h2>

                <button
                    onClick={() => {
                        setEditingCategory(null);
                        resetForm();
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                >
                    <Plus size={18} />
                    Add Category
                </button>
            </div>

            {categories.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow">
                    <p className="text-lg text-gray-500">No categories found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {categories.map((category, index) => (
                        <motion.div
                            key={category.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            className="overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                        >
                            <div className="h-48 w-full bg-gray-100">
                                <img
                                    src={
                                        category.image_url ||
                                        "https://placehold.co/600x400?text=Category"
                                    }
                                    alt={category.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="p-5">
                                <h3 className="text-xl font-bold text-gray-800">
                                    {category.name}
                                </h3>

                                <div className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                                    🍽 {category.total_items || 0} Menu Items
                                </div>

                                <div className="mt-5 flex gap-3">
                                    <button
                                        onClick={() => handleEditCategory(category)}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-100 py-2 font-medium text-blue-700 transition hover:bg-blue-200"
                                    >
                                        <Pencil size={16} />
                                        Edit
                                    </button>

                                    {
                                        category.total_items > 0 ? (

                                            <button
                                                disabled
                                                className="
                flex flex-1 items-center justify-center gap-2
                rounded-xl bg-gray-100 py-2 font-medium text-gray-400 cursor-not-allowed
            "
                                            >
                                                🔒 In Use
                                            </button>

                                        ) : (

                                            <button
                                                onClick={() => handleDeleteCategory(category)}
                                                className="
                flex flex-1 items-center justify-center gap-2
                rounded-xl bg-red-100 py-2 font-medium text-red-600
                transition hover:bg-red-200
            "
                                            >
                                                <Trash2 size={16} />
                                                Delete
                                            </button>

                                        )
                                    }
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