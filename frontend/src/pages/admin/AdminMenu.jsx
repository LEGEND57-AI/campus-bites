import { useEffect, useState } from 'react';
import { adminAPI, categoryAPI, uploadAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  X,
  UploadCloud,
  PackageCheck,
  PackageX,
} from 'lucide-react';
const AdminMenu = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploading, setUploading] = useState(false);


  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category_id: '',
    available: true,
  });

  useEffect(() => {
    fetchMenu();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const fetchMenu = async () => {
    try {
      const { data } = await adminAPI.getMenu();
      setItems(data || []);
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await categoryAPI.getAll();
      setCategories(data || []);
    } catch {
      toast.error('Failed to load categories');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      image_url: '',
      category_id: '',
      available: true,
    });

    setEditingItem(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);

    setFormData({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      image_url: item.image_url || '',
      category_id: item.category_id || '',
      available: item.available ?? true,
    });

    setShowModal(true);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      setUploading(true);

      const { data } = await uploadAPI.uploadImage(file);

      setFormData((prev) => ({
        ...prev,
        image_url: data.url,
      }));

      toast.success('Image uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) return toast.error('Enter item name');
    if (!formData.price) return toast.error('Enter price');
    if (!formData.category_id) return toast.error('Select category');
    if (!formData.image_url) return toast.error('Upload image first');

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
      };

      if (editingItem) {
        await adminAPI.updateMenu(editingItem.id, payload);
        toast.success('Item updated successfully');
      } else {
        await adminAPI.createMenu(payload);
        toast.success('Item added successfully');
      }

      fetchMenu();
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Menu Item?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await adminAPI.deleteMenu(id);
      await Swal.fire({
        title: 'Deleted!',
        text: 'Menu item removed successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      fetchMenu();

    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Error',
        text: 'Failed to delete menu item.',
        icon: 'error',
      });
    }
  };

  const handleAvailability = async (item) => {
    try {
      await adminAPI.updateAvailability(
        item.id,
        !item.available
      );

      toast.success(
        item.available
          ? 'Marked as Out of Stock'
          : 'Marked as In Stock'
      );

      fetchMenu();

    } catch (err) {
      console.error(err);
      toast.error('Failed to update stock');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500 text-lg">
        Loading menu...
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold text-slate-800">
          Menu Management
        </h2>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl
                     bg-gradient-to-r from-blue-500 to-indigo-600
                     text-white font-semibold shadow-lg hover:scale-105
                     transition-all"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ y: -6 }}
            className="bg-white rounded-3xl overflow-hidden
                       shadow-lg hover:shadow-2xl transition-all"
          >
            <div className="relative">

              {!item.available && (
                <div
                  className="absolute top-3 right-3 z-10
                 bg-red-600 text-white
                 px-3 py-1 rounded-full
                 text-xs font-bold shadow-lg"
                >
                  OUT OF STOCK
                </div>
              )}

              <img
                src={
                  item.image_url ||
                  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400'
                }
                alt={item.name}
                className={`h-44 w-full object-cover ${!item.available
                  ? 'opacity-60 grayscale'
                  : ''
                  }`}
              />

            </div>

            <div className="p-4">
              <h3 className="font-bold text-2xl text-slate-800 leading-tight">
                {item.name}
              </h3>

              <p className="text-blue-600 font-bold text-3xl mt-2">
                ₹{Number(item.price || 0).toFixed(2)}
              </p>

              <p className="text-gray-500 mt-3 min-h-[45px] text-base leading-relaxed">
                {item.description || 'No description available'}
              </p>

              <span className="inline-block mt-3 px-4 py-1 rounded-full
                               bg-slate-100 text-slate-500 text-sm">
                {categories.find((c) => c.id == item.category_id)?.name}
              </span>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => openEdit(item)}
                  className="text-blue-500 hover:text-blue-700"
                  title="Edit"
                >
                  <Edit size={24} />
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 size={24} />
                </button>

                <button
                  onClick={() => handleAvailability(item)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition ${item.available
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                >
                  {item.available ? (
                    <>
                      <PackageCheck size={16} />
                      In Stock
                    </>
                  ) : (
                    <>
                      <PackageX size={16} />
                      Out of Stock
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm
                       flex items-center justify-center z-50 px-4"
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl
                         w-full max-w-xl overflow-hidden"
            >
              {/* HEADER */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600
                              text-white px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                </h3>

                <button
                  onClick={closeModal}
                  className="hover:bg-white/20 p-2 rounded-full transition"
                >
                  <X size={22} />
                </button>
              </div>

              {/* FORM */}
              <form
                onSubmit={handleSubmit}
                className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    Item Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter item name"
                    className="w-full border border-gray-200 rounded-2xl p-3
                               focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter price"
                    className="w-full border border-gray-200 rounded-2xl p-3
                               focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    Description
                  </label>
                  <textarea
                    rows="3"
                    placeholder="Enter description"
                    className="w-full border border-gray-200 rounded-2xl p-3
                               focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-3">
                    Upload Image
                  </label>

                  <label
                    className="border-2 border-dashed border-gray-300 rounded-2xl
                               p-6 flex flex-col items-center justify-center
                               cursor-pointer hover:border-blue-500 transition"
                  >
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-gray-500 text-sm">
                      Click to upload image
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageUpload(e.target.files[0])
                      }
                      className="hidden"
                    />
                  </label>

                  {uploading && (
                    <p className="text-blue-500 mt-3 text-sm">
                      Uploading image...
                    </p>
                  )}

                  {formData.image_url && (
                    <div className="mt-4">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-24 h-24 rounded-2xl object-cover border"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category_id: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl p-3
                               focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Category</option>

                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-3 pt-3">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl
                               bg-gradient-to-r from-blue-500 to-indigo-600
                               text-white font-bold text-base
                               hover:shadow-xl transition"
                  >
                    {editingItem ? 'Update Item' : 'Save Item'}
                  </button>

                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full py-3 rounded-2xl border
                               text-gray-600 font-semibold
                               hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminMenu;


