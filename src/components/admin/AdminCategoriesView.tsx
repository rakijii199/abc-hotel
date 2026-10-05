/**
 * Admin Menu Categories Management Component
 */
import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  FolderOpen
} from 'lucide-react';
import { MenuCategory, MenuItem } from '../../types/index.ts';
import { Modal } from '../common/Footer.tsx';

interface AdminCategoriesViewProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  onCreateCategory: (data: any) => Promise<void>;
  onUpdateCategory: (id: string, data: any) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export const AdminCategoriesView: React.FC<AdminCategoriesViewProps> = ({
  categories,
  menuItems,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategory | null>(null);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setDisplayOrder(categories.length + 1);
    setStatus('ACTIVE');
    setModalOpen(true);
  };

  const openEditModal = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setDisplayOrder(cat.displayOrder);
    setStatus(cat.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        description,
        displayOrder: Number(displayOrder),
        status
      };

      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, payload);
      } else {
        await onCreateCategory(payload);
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Menu Management
          </span>
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            Cuisine Categories ({categories.length})
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Organize the menu into gourmet classifications like Starters, Main Course, Breads, and Desserts
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Category</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const itemCount = menuItems.filter((m) => m.categoryId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-stone-900">{cat.name}</h3>
                      <span className="text-[11px] font-mono text-stone-400">Order: #{cat.displayOrder}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      cat.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border-stone-200'
                    }`}
                  >
                    {cat.status}
                  </span>
                </div>

                <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                  {cat.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500 font-mono">
                  {itemCount} {itemCount === 1 ? 'Dish' : 'Dishes'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title="Edit Category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Category Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingCategory ? `Edit Category — ${editingCategory.name}` : 'Add New Category'}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs text-stone-700">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Category Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Desserts & Artisan Sweets"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Exquisite royal confections..."
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Display Order</label>
                <input
                  type="number"
                  min="0"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                >
                  <option value="ACTIVE">Active (Visible)</option>
                  <option value="INACTIVE">Inactive (Hidden)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Category Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Category"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs text-stone-600">
            <p>
              Are you sure you want to delete category <strong>"{deleteTarget.name}"</strong>? Dishes in this category will remain available.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteCategory(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
