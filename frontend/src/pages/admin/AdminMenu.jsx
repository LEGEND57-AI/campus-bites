import { useEffect, useState } from 'react';
import { adminAPI, categoryAPI, uploadAPI } from '../../services/api';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

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
    available: true
  });

  useEffect(() => {
    fetchMenu();
    fetchCategories();
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

  // 🔥 IMAGE UPLOAD
  const handleImageUpload = async (file) => {
    try {
      setUploading(true);
      const { data } = await uploadAPI.uploadImage(file);

      setFormData(prev => ({
        ...prev,
        image_url: data.url
      }));

      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // 🔥 SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) return toast.error("Enter name");
    if (!formData.price) return toast.error("Enter price");
    if (!formData.category_id) return toast.error("Select category");
    if (!formData.image_url) return toast.error("Upload image first");

    try {
      const payload = {
        ...formData,
        price: Number(formData.price) // ✅ FIX
      };

      if (editingItem) {
        await adminAPI.updateMenu(editingItem.id, payload);
        toast.success('Item updated');
      } else {
        await adminAPI.createMenu(payload);
        toast.success('Item added');
      }

      fetchMenu();
      setShowModal(false);
      resetForm();
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this item?')) {
      try {
        await adminAPI.deleteMenu(id);
        toast.success('Deleted');
        fetchMenu();
      } catch {
        toast.error('Delete failed');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      image_url: '',
      category_id: '',
      available: true
    });
    setEditingItem(null);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      image_url: item.image_url || '',
      category_id: item.category_id || '',
      available: item.available ?? true
    });
    setShowModal(true);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Menu Management</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Add Item
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <motion.div key={item.id} className="glass-card rounded-xl overflow-hidden shadow-md">
            
            <img
              src={item.image_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400"}
              className="h-40 w-full object-cover"
            />

            <div className="p-4">
              <h3 className="font-bold text-lg">{item.name}</h3>

              {/* ✅ PRICE FIX */}
              <p className="text-blue-600 font-bold">
                ₹{Number(item.price).toFixed(2)}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {item.description}
              </p>

              <p className="text-xs text-gray-400 mt-2">
                {categories.find(c => c.id === item.category_id)?.name}
              </p>

              <div className="flex gap-3 mt-3">
                <button onClick={() => openEdit(item)}>
                  <Edit size={18} />
                </button>

                <button onClick={() => handleDelete(item.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96">

            <form onSubmit={handleSubmit} className="space-y-3">

              <input
                placeholder="Name"
                className="w-full border p-2 rounded"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />

              {/* 🔥 PRICE FIXED */}
              <input
                placeholder="Price (₹)"
                type="number"
                step="0.01"
                min="0"
                className="w-full border p-2 rounded"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
              />

              <textarea
                placeholder="Description"
                className="w-full border p-2 rounded"
                value={formData.description}
                onChange={(e) =>
                  setFormData({...formData, description: e.target.value})
                }
              />

              {/* IMAGE */}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files[0])}
                className="w-full"
              />

              {uploading && <p>Uploading...</p>}

              {formData.image_url && (
                <img src={formData.image_url} className="h-20 rounded" />
              )}

              {/* CATEGORY */}
              <select
                value={formData.category_id}
                onChange={e => setFormData({...formData, category_id: e.target.value})}
                className="w-full border p-2 rounded"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <button className="btn-primary w-full">
                Save
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminMenu;