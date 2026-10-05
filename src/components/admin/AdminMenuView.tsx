/**
 * Admin Menu Items Management Component
 * Modern Luxury Card-Based Grid UI with Local Image Upload & Quick Controls
 */
import React, { useState, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Leaf,
  Flame,
  CheckCircle2,
  XCircle,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Eye,
  Clock,
  Upload,
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Check,
  X,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { MenuItem, MenuCategory, SpiceLevel } from '../../types/index.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { Modal } from '../common/Footer.tsx';
import { RestaurantImage } from '../common/RestaurantImage.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface AdminMenuViewProps {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  onCreateItem: (data: any) => Promise<void>;
  onUpdateItem: (id: string, data: any) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onToggleAvailability: (id: string) => Promise<void>;
}

// Client-side image optimizer: keeps base64 uploads crisp, high-res yet lightweight (approx 100-250KB)
function optimizeUploadedImage(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const AdminMenuView: React.FC<AdminMenuViewProps> = ({
  menuItems,
  categories,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onToggleAvailability
}) => {
  const { success, error } = useToast();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [availFilter, setAvailFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // View Modal State
  const [viewingItem, setViewingItem] = useState<MenuItem | null>(null);

  // Quick Price Change Modal State
  const [priceChangeItem, setPriceChangeItem] = useState<MenuItem | null>(null);
  const [quickPrice, setQuickPrice] = useState<number>(0);
  const [priceSubmitting, setPriceSubmitting] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(300);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSourceMode, setImageSourceMode] = useState<'LOCAL' | 'URL'>('LOCAL');
  const [vegetarian, setVegetarian] = useState(true);
  const [spicy, setSpicy] = useState(false);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('Mild');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(20);
  const [available, setAvailable] = useState(true);
  const [isChefSpecial, setIsChefSpecial] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Hidden file input refs
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);
  const [cardUploadTargetId, setCardUploadTargetId] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingItem(null);
    setName('');
    setCategoryId(categories[0]?.id || 'cat-001');
    setDescription('');
    setPrice(280);
    setImageUrl('https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=80');
    setImageSourceMode('LOCAL');
    setVegetarian(true);
    setSpicy(false);
    setSpiceLevel('Mild');
    setPrepTimeMinutes(20);
    setAvailable(true);
    setIsChefSpecial(false);
    setModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategoryId(item.categoryId);
    setDescription(item.description);
    setPrice(item.price);
    setImageUrl(item.imageUrl);
    setImageSourceMode(item.imageUrl.startsWith('data:image/') ? 'LOCAL' : 'URL');
    setVegetarian(item.vegetarian);
    setSpicy(item.spicy);
    setSpiceLevel(item.spiceLevel);
    setPrepTimeMinutes(item.prepTimeMinutes);
    setAvailable(item.available);
    setIsChefSpecial(!!item.isChefSpecial);
    setModalOpen(true);
  };

  const openPriceModal = (item: MenuItem) => {
    setPriceChangeItem(item);
    setQuickPrice(item.price);
  };

  const handlePriceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceChangeItem) return;
    setPriceSubmitting(true);
    try {
      await onUpdateItem(priceChangeItem.id, { price: Number(quickPrice) });
      success(`Price for "${priceChangeItem.name}" updated to ₹${quickPrice}`);
      setPriceChangeItem(null);
    } catch (err: any) {
      error(err.message || 'Failed to update price');
    } finally {
      setPriceSubmitting(false);
    }
  };

  // Local File Upload Handler for Modal Form
  const handleModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error('Please select an image file (PNG, JPG, WebP, etc.)');
      return;
    }

    setUploadingImage(true);
    try {
      const optimized = await optimizeUploadedImage(file);
      setImageUrl(optimized);
      setImageSourceMode('LOCAL');
      success(`Image "${file.name}" uploaded successfully`);
    } catch (err) {
      error('Failed to process image file');
    } finally {
      setUploadingImage(false);
    }
  };

  // Quick 1-Click Local Image Upload directly from Card
  const handleCardQuickUploadClick = (itemId: string) => {
    setCardUploadTargetId(itemId);
    if (cardFileInputRef.current) {
      cardFileInputRef.current.value = '';
      cardFileInputRef.current.click();
    }
  };

  const handleCardFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cardUploadTargetId) return;

    if (!file.type.startsWith('image/')) {
      error('Please choose a valid image file');
      return;
    }

    try {
      const optimized = await optimizeUploadedImage(file);
      await onUpdateItem(cardUploadTargetId, { imageUrl: optimized });
      success('Dish photo updated from your computer!');
    } catch (err: any) {
      error(err.message || 'Failed to update dish photo');
    } finally {
      setCardUploadTargetId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      error('Please provide or upload a dish photo');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        categoryId,
        description,
        price: Number(price),
        imageUrl,
        vegetarian,
        spicy,
        spiceLevel,
        prepTimeMinutes: Number(prepTimeMinutes),
        available,
        isChefSpecial
      };

      if (editingItem) {
        await onUpdateItem(editingItem.id, payload);
        success(`"${name}" updated successfully`);
      } else {
        await onCreateItem(payload);
        success(`New dish "${name}" created`);
      }
      setModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Failed to save menu dish');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Dishes
  const filteredItems = menuItems.filter((item) => {
    if (selectedCategory !== 'ALL' && item.categoryId !== selectedCategory) return false;
    if (vegFilter === 'VEG' && !item.vegetarian) return false;
    if (vegFilter === 'NON_VEG' && item.vegetarian) return false;
    if (availFilter === 'AVAILABLE' && !item.available) return false;
    if (availFilter === 'UNAVAILABLE' && item.available) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchSku = item.sku?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchSku) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 font-['Poppins',sans-serif]">
      {/* Hidden file input for quick card photo replacement */}
      <input
        type="file"
        ref={cardFileInputRef}
        accept="image/*"
        onChange={handleCardFileSelected}
        className="hidden"
      />

      {/* Header & Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg sm:text-xl font-bold text-stone-900">
                Menu Catalog
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                {filteredItems.length} {filteredItems.length === 1 ? 'Dish' : 'Dishes'}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Card catalog view with inline pricing, local image upload, and instant availability toggles.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dish</span>
          </button>
        </div>

        {/* Filter and Search Bar (Standard 8px gaps) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-stone-100">
          {/* Search Input (sm:col-span-5) */}
          <div className="sm:col-span-5 flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="Search dish by name, SKU, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-stone-400 hover:text-stone-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown (sm:col-span-3) */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-amber-700"
            >
              <option value="ALL">All Categories ({menuItems.length})</option>
              {categories.map((c) => {
                const count = menuItems.filter((m) => m.categoryId === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Veg / Non-Veg Dropdown (sm:col-span-2) */}
          <div className="sm:col-span-2">
            <select
              value={vegFilter}
              onChange={(e) => setVegFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-amber-700"
            >
              <option value="ALL">All Types</option>
              <option value="VEG">Vegetarian Only</option>
              <option value="NON_VEG">Non-Vegetarian</option>
            </select>
          </div>

          {/* Availability Dropdown (sm:col-span-2) */}
          <div className="sm:col-span-2">
            <select
              value={availFilter}
              onChange={(e) => setAvailFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-amber-700"
            >
              <option value="ALL">All Availability</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="UNAVAILABLE">Unavailable / Out</option>
            </select>
          </div>
        </div>
      </div>

      {/* Menu Cards Catalog */}
      <div>
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-base text-stone-900">
                No Menu Items Found
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                No dishes match your active category, dietary, or search criteria.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setVegFilter('ALL');
                  setAvailFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Top: Card Image with Overlays */}
                    <div className="aspect-4/3 relative overflow-hidden bg-stone-100">
                      <RestaurantImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Image Top Badges */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                        {/* Veg / Non-Veg Indicator */}
                        {item.vegetarian ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-emerald-800 border border-emerald-300 shadow-2xs backdrop-blur-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Veg
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-rose-800 border border-rose-300 shadow-2xs backdrop-blur-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Non-Veg
                          </span>
                        )}

                        <div className="flex items-center gap-1 pointer-events-auto">
                          {item.isChefSpecial && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-200" /> Special
                            </span>
                          )}

                          {/* Quick 1-Click Local Photo Upload Button */}
                          <button
                            type="button"
                            onClick={() => handleCardQuickUploadClick(item.id)}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-amber-800 text-white shadow-xs backdrop-blur-xs transition-colors cursor-pointer"
                            title="Upload new photo from computer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Image Bottom Overlay Info */}
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px] pointer-events-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          {item.categoryName || 'General'}
                        </span>

                        <span className="text-[10px] font-medium bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.prepTimeMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Middle: Dish Details */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif font-bold text-stone-900 text-sm leading-snug line-clamp-1 group-hover:text-amber-900 transition-colors">
                          {item.name}
                        </h3>
                        {item.sku && (
                          <span className="font-mono text-[9px] text-stone-400 bg-stone-100 px-1 py-0.2 rounded shrink-0">
                            {item.sku}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed min-h-[2rem]">
                        {item.description}
                      </p>

                      {/* Spice Level & Attributes */}
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Flame className={`w-3.5 h-3.5 ${item.spicy ? 'text-rose-500' : 'text-stone-300'}`} />
                          <span>{item.spiceLevel}</span>
                        </span>
                        <span className="text-stone-300">·</span>
                        <span className="text-[10px] text-stone-400">
                          {item.calories ? `${item.calories} kcal` : 'Chef Recipe'}
                        </span>
                      </div>

                      {/* Price & Availability Bar */}
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                        {/* Price with edit button */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-base text-amber-950">
                            {formatCurrency(item.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openPriceModal(item)}
                            className="p-1 text-stone-400 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                            title="Edit price"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Availability Toggle */}
                        <button
                          type="button"
                          onClick={() => onToggleAvailability(item.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                            item.available
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                          }`}
                        >
                          {item.available ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Available</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-stone-400" />
                              <span>Disabled</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="p-2.5 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingItem(item)}
                        className="p-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs transition-colors cursor-pointer"
                        title="View Full Dish Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1.5 bg-white hover:bg-amber-50 hover:text-amber-900 hover:border-amber-200 text-stone-700 border border-stone-200 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Edit Dish & Photo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 bg-white hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-stone-200 hover:border-rose-200 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Remove Dish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* ===================================================================== */}
      {/* MODALS: VIEW DETAILS, PRICE QUICK EDIT, ADD/EDIT DISH, DELETE         */}
      {/* ===================================================================== */}

      {/* View Dish Details Modal */}
      {viewingItem && (
        <Modal
          isOpen={!!viewingItem}
          onClose={() => setViewingItem(null)}
          title={`Dish Preview: ${viewingItem.name}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs text-stone-700">
            <div className="aspect-16/9 rounded-2xl overflow-hidden shadow-inner border border-stone-200 relative">
              <RestaurantImage
                src={viewingItem.imageUrl}
                alt={viewingItem.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3">
                {viewingItem.vegetarian ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-emerald-800 border border-emerald-300 shadow-2xs backdrop-blur-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Veg
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-rose-800 border border-rose-300 shadow-2xs backdrop-blur-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Non-Veg
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900">{viewingItem.name}</h3>
                <span className="text-[11px] text-stone-500 font-mono">
                  Category: {viewingItem.categoryName || 'General'} · SKU: {viewingItem.sku || 'N/A'}
                </span>
              </div>
              <span className="font-mono text-xl font-bold text-amber-950">
                {formatCurrency(viewingItem.price)}
              </span>
            </div>

            <p className="text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
              {viewingItem.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Spice Level</span>
                <span className="font-bold text-stone-800 text-xs mt-0.5 flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-700" />
                  {viewingItem.spiceLevel}
                </span>
              </div>

              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Prep Time</span>
                <span className="font-bold text-stone-800 text-xs mt-0.5 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  {viewingItem.prepTimeMinutes} Mins
                </span>
              </div>

              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Availability</span>
                <span className={`font-bold text-xs mt-0.5 block ${viewingItem.available ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {viewingItem.available ? 'Available' : 'Disabled'}
                </span>
              </div>

              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Special</span>
                <span className="font-bold text-stone-800 text-xs mt-0.5 block">
                  {viewingItem.isChefSpecial ? "Chef's Special" : 'Regular Menu'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setViewingItem(null);
                  openEditModal(viewingItem);
                }}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Edit This Dish
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Price Change Modal */}
      {priceChangeItem && (
        <Modal
          isOpen={!!priceChangeItem}
          onClose={() => setPriceChangeItem(null)}
          title={`Change Price — ${priceChangeItem.name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handlePriceSave} className="space-y-4 text-xs text-stone-700">
            <p className="text-stone-500">
              Update the default dining menu and order price for <strong>{priceChangeItem.name}</strong>.
            </p>
            <div className="space-y-1.5">
              <label className="font-bold text-stone-700 block">Menu Price (INR ₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-stone-500">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quickPrice}
                  onChange={(e) => setQuickPrice(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold font-mono text-stone-900 focus:outline-hidden focus:border-amber-700"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPriceChangeItem(null)}
                className="px-4 py-2 font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={priceSubmitting}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer"
              >
                {priceSubmitting ? 'Updating...' : 'Save Price'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit Dish Modal with Local Image Upload */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingItem ? `Edit Menu Dish — ${editingItem.name}` : 'Add New Gourmet Dish'}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs text-stone-700">
            {/* Hidden file input for modal */}
            <input
              type="file"
              ref={modalFileInputRef}
              accept="image/*"
              onChange={handleModalFileUpload}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Food Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Truffle Malai Paneer Tikka"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Gourmet description of ingredients, flavor profile and presentation..."
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Price (₹ INR)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min="0"
                  step="1"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:border-amber-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Prep Time (Mins)</label>
                <input
                  type="number"
                  value={prepTimeMinutes}
                  onChange={(e) => setPrepTimeMinutes(Number(e.target.value))}
                  min="1"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Spice Level</label>
                <select
                  value={spiceLevel}
                  onChange={(e) => setSpiceLevel(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700"
                >
                  <option value="None">None</option>
                  <option value="Mild">Mild</option>
                  <option value="Medium">Medium</option>
                  <option value="Hot">Hot</option>
                  <option value="Extra Hot">Extra Hot</option>
                </select>
              </div>
            </div>

            {/* =============================================================== */}
            {/* DISH PHOTO UPLOAD SECTION (LOCAL UPLOAD & WEB URL OPTIONS)        */}
            {/* =============================================================== */}
            <div className="space-y-2 p-3 bg-stone-50/90 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                  Dish Photo
                </label>

                {/* Switch between Local Upload and Web URL */}
                <div className="flex items-center bg-stone-200/70 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setImageSourceMode('LOCAL')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      imageSourceMode === 'LOCAL'
                        ? 'bg-white text-stone-900 font-bold shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <UploadCloud className="w-3 h-3" />
                    <span>Upload from Computer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageSourceMode('URL')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      imageSourceMode === 'URL'
                        ? 'bg-white text-stone-900 font-bold shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <span>Web Image URL</span>
                  </button>
                </div>
              </div>

              {/* Option A: Upload from Local Device */}
              {imageSourceMode === 'LOCAL' && (
                <div className="space-y-2">
                  <div
                    onClick={() => modalFileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-amber-600 rounded-xl p-4 text-center cursor-pointer transition-colors bg-white hover:bg-amber-50/30 flex flex-col items-center justify-center gap-1.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-800 flex items-center justify-center transition-colors">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 text-xs">
                        {uploadingImage ? 'Processing image...' : 'Click to browse image from your computer'}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        Supports PNG, JPG, WebP, GIF (auto-optimized)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Option B: Direct Image URL */}
              {imageSourceMode === 'URL' && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700"
                  />
                  <p className="text-[10px] text-stone-400">
                    Paste any public image URL or Unsplash image link.
                  </p>
                </div>
              )}

              {/* Live Preview of Selected / Uploaded Image */}
              {imageUrl && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-stone-200">
                  <div className="w-16 h-12 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                    <RestaurantImage
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-800 truncate">
                      {imageUrl.startsWith('data:image/') ? 'Uploaded Local Image File' : imageUrl}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ready for dish
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Change Photo
                  </button>
                </div>
              )}
            </div>

            {/* Checkbox Toggles (Standard 8px gap) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-stone-50 rounded-xl border border-stone-200/80">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-stone-800">
                <input
                  type="checkbox"
                  checked={vegetarian}
                  onChange={(e) => setVegetarian(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span>Vegetarian Dish</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-stone-800">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span>Available Now</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-stone-800">
                <input
                  type="checkbox"
                  checked={isChefSpecial}
                  onChange={(e) => setIsChefSpecial(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span>Chef's Special</span>
              </label>
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
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {submitting ? 'Saving...' : editingItem ? 'Update Dish' : 'Add Food Item'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Remove Menu Dish"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs text-stone-600">
            <p>
              Are you sure you want to permanently remove <strong>"{deleteTarget.name}"</strong> from the restaurant menu?
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
                  try {
                    await onDeleteItem(deleteTarget.id);
                    success(`"${deleteTarget.name}" removed from menu`);
                  } catch (err: any) {
                    error(err.message || 'Failed to remove dish');
                  } finally {
                    setDeleteTarget(null);
                  }
                }}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
