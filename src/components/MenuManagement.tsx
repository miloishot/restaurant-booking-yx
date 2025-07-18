import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Restaurant, MenuCategory, MenuItem } from '../types/database';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, ChefHat, Tag, CreditCard, RefreshCw, ChevronRight
} from 'lucide-react';

interface MenuManagementProps {
  restaurant: Restaurant;
}

export function MenuManagement({ restaurant }: MenuManagementProps) {
  const { employeeProfile } = useAuth();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'items'>('categories');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(true); // Collapsible dropdown state

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    display_order: 0
  });

  const [itemForm, setItemForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price_sgd: 0,
    image_url: '',
    allergens: [] as string[],
    dietary_info: [] as string[],
    display_order: 0,
    image_file: null as File | null
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchMenuData();
  }, [restaurant.id]);

  useEffect(() => {
    if (activeTab === 'items' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [activeTab]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      const [categoriesResult, itemsResult] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('display_order'),
        supabase
          .from('menu_items')
          .select('*,category:menu_categories(*)')
          .eq('restaurant_id', restaurant.id)
          .order('display_order'),
      ]);
      if (categoriesResult.error) throw categoriesResult.error;
      if (itemsResult.error) throw itemsResult.error;
      setCategories(categoriesResult.data || []);
      setMenuItems(itemsResult.data || []);
    } catch (error) {
      console.error('Error fetching menu data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('menu_categories')
          .update({
            name: categoryForm.name,
            description: categoryForm.description,
            display_order: categoryForm.display_order
          })
          .eq('id', editingCategory.id);
        if (error) throw error;
        showNotification('Category updated successfully!');
      } else {
        const { error } = await supabase
          .from('menu_categories')
          .insert({
            restaurant_id: restaurant.id,
            name: categoryForm.name,
            description: categoryForm.description,
            display_order: categoryForm.display_order,
            is_active: true
          });
        if (error) throw error;
        showNotification('Category created successfully!');
      }
      resetCategoryForm();
      fetchMenuData();
    } catch (error) {
      console.error('Error saving category:', error);
      showNotification('Failed to save category', 'error');
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('menu_items')
          .update({
            category_id: itemForm.category_id,
            name: itemForm.name,
            description: itemForm.description,
            price_sgd: itemForm.price_sgd,
            image_url: itemForm.image_url || null,
            allergens: itemForm.allergens.length > 0 ? itemForm.allergens : null,
            dietary_info: itemForm.dietary_info.length > 0 ? itemForm.dietary_info : null,
            display_order: itemForm.display_order
          })
          .eq('id', editingItem.id);
        if (error) throw error;
        showNotification('Menu item updated successfully!');
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert({
            restaurant_id: restaurant.id,
            category_id: itemForm.category_id,
            name: itemForm.name,
            description: itemForm.description,
            price_sgd: itemForm.price_sgd,
            image_url: itemForm.image_url || null,
            allergens: itemForm.allergens.length > 0 ? itemForm.allergens : null,
            dietary_info: itemForm.dietary_info.length > 0 ? itemForm.dietary_info : null,
            display_order: itemForm.display_order,
            is_available: true
          });
        if (error) throw error;
        showNotification('Menu item created successfully!');
      }
      resetItemForm();
      fetchMenuData();
    } catch (error) {
      console.error('Error saving menu item:', error);
      showNotification('Failed to save menu item', 'error');
    }
  };

  const handleSyncMenuToStripe = async () => {
    if (!restaurant.id) return;
    try {
      setSyncingMenu(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Supabase URL not configured.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to sync menu items to Stripe');
      let syncedCount = 0;
      for (const item of menuItems) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/sync-menu-item-to-stripe`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              menu_item_id: item.id,
              restaurant_id: restaurant.id,
              name: item.name,
              description: item.description || '',
              price_sgd: item.price_sgd,
              stripe_product_id: item.stripe_product_id,
              stripe_price_id: item.stripe_price_id
            }),
          });
          if (!response.ok) continue;
          syncedCount++;
        } catch {
          continue;
        }
      }
      await fetchMenuData();
      showNotification(`Successfully synced ${syncedCount} of ${menuItems.length} menu items to Stripe`);
    } catch (error) {
      console.error('Error syncing menu to Stripe:', error);
      showNotification('Failed to sync menu items to Stripe.', 'error');
    } finally {
      setSyncingMenu(false);
    }
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !item.is_available })
        .eq('id', item.id);
      if (error) throw error;
      showNotification(`${item.name} ${!item.is_available ? 'enabled' : 'disabled'}`);
      fetchMenuData();
    } catch (error) {
      console.error('Error toggling item availability:', error);
      showNotification('Failed to update item availability', 'error');
    }
  };

  const deleteCategory = async (category: MenuCategory) => {
    if (!confirm(`Delete category "${category.name}"? This will also delete all items in this category.`)) return;
    try {
      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', category.id);
      if (error) throw error;
      showNotification('Category deleted successfully!');
      fetchMenuData();
    } catch (error) {
      console.error('Error deleting category:', error);
      showNotification('Failed to delete category', 'error');
    }
  };

  const deleteItem = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      showNotification('Menu item deleted successfully!');
      fetchMenuData();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      showNotification('Failed to delete menu item', 'error');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', display_order: 0 });
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  const resetItemForm = () => {
    setItemForm({
      category_id: '',
      name: '',
      description: '',
      price_sgd: 0,
      image_url: '',
      allergens: [],
      dietary_info: [],
      display_order: 0,
      image_file: null
    });
    setEditingItem(null);
    setShowItemForm(false);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop&crop=center`;
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const imageUrl = await handleImageUpload(file);
      setItemForm(prev => ({ ...prev, image_url: imageUrl, image_file: file }));
      showNotification('Image uploaded successfully!');
    } catch (error) {
      showNotification('Failed to upload image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const editCategory = (category: MenuCategory) => {
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      display_order: category.display_order
    });
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const editItem = (item: MenuItem) => {
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description || '',
      price_sgd: item.price_sgd,
      image_url: item.image_url || '',
      allergens: item.allergens || [],
      dietary_info: item.dietary_info || [],
      display_order: item.display_order,
      image_file: null
    });
    setEditingItem(item);
    setShowItemForm(true);
  };

  const canManageMenu = employeeProfile?.role === 'owner' || employeeProfile?.role === 'manager';
  const formatPrice = (price: number) => `S$${price.toFixed(2)}`;
  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(itemSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!canManageMenu) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <ChefHat className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Restricted</h3>
          <p className="text-gray-600">
            Only restaurant owners and managers can access menu management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-white rounded-lg shadow-md">
      {/* Dropdown Toggle Header */}
      <button
        className="flex items-center justify-between w-full px-6 py-4 bg-gray-100 rounded-t-lg font-semibold text-lg text-gray-800 focus:outline-none"
        onClick={() => setIsMenuOpen(open => !open)}
        aria-expanded={isMenuOpen}
      >
        <span className="flex items-center">
          <ChefHat className="w-6 h-6 mr-2" />
          Menu Management
        </span>
        <ChevronRight
          className={`w-6 h-6 text-gray-600 transform transition-transform duration-200 ${isMenuOpen ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isMenuOpen && (
        <div className="p-6">
          {/* Tabs and controls */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
            <div>
              <p className="text-gray-600">Manage your restaurant's menu categories and items</p>
            </div>
            {canManageMenu && (
              <button
                onClick={handleSyncMenuToStripe}
                disabled={syncingMenu || menuItems.length === 0}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                title="Sync menu items to Stripe"
              >
                {syncingMenu ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                {syncingMenu ? 'Syncing...' : 'Sync Menu to Stripe'}
              </button>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-md mb-6 sticky top-0 z-10">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('categories')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'categories' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Categories ({categories.length})
              </button>
              <button
                onClick={() => setActiveTab('items')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'items' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Menu Items ({menuItems.length})
              </button>
            </nav>
          </div>
          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Menu Categories</h3>
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </button>
              </div>
              {categories.length === 0 ? (
                <div className="text-center py-8">
                  <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No categories yet. Create your first category to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800">{category.name}</h4>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => editCategory(category)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCategory(category)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                      )}
                      <div className="text-xs text-gray-500">
                        Order: {category.display_order} •
                        {menuItems.filter(item => item.category_id === category.id).length} items
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Menu Items Tab */}
          {activeTab === 'items' && (
            <div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 space-y-2 md:space-y-0">
                <h3 className="text-lg font-medium">Menu Items</h3>
                <div className="flex items-center space-x-3">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    placeholder="Search menu items…"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    aria-label="Search menu items"
                  />
                  <button
                    onClick={() => setShowItemForm(true)}
                    disabled={categories.length === 0}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Menu Item
                  </button>
                </div>
              </div>
              {categories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Create categories first before adding menu items.</p>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="text-center py-8">
                  <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No menu items found{itemSearch ? ` for "${itemSearch}"` : ''}.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => {
                    const categoryItems = filteredMenuItems.filter(item => item.category_id === category.id);
                    if (categoryItems.length === 0) return null;
                    return (
                      <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-gray-800 mb-0">{category.name}</h4>
                          <span className="text-xs text-gray-400">
                            {categoryItems.length} item{categoryItems.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {categoryItems.map((item) => (
                            <div key={item.id} className="border border-gray-100 rounded p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-gray-800 truncate">{item.name}</h5>
                                  <p className="text-lg font-bold text-green-600">{formatPrice(item.price_sgd)}</p>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => toggleItemAvailability(item)}
                                    className={`p-1 rounded ${item.is_available ? 'text-green-600' : 'text-gray-400'}`}
                                    title={item.is_available ? 'Available' : 'Unavailable'}
                                  >
                                    {item.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => editItem(item)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit menu item"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Delete menu item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {item.description && (
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {item.dietary_info?.map((info) => (
                                  <span key={info} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{info}</span>
                                ))}
                                {item.allergens?.map((allergen) => (
                                  <span key={allergen} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">{allergen}</span>
                                ))}
                              </div>
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="mt-2 w-32 h-24 object-cover rounded-lg border border-gray-200"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* Category Form Modal */}
          {showCategoryForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </h3>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                      <input
                        type="text"
                        required
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Appetizers, Main Courses"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Brief description of this category"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={categoryForm.display_order}
                        onChange={(e) => setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex space-x-4 pt-4">
                      <button
                        type="button"
                        onClick={resetCategoryForm}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingCategory ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          {/* Menu Item Form Modal */}
          {showItemForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-90vh overflow-y-auto">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                  </h3>
                  <form onSubmit={handleItemSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <select
                          required
                          value={itemForm.category_id}
                          onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select a category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price (SGD) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={itemForm.price_sgd}
                          onChange={(e) => setItemForm({ ...itemForm, price_sgd: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                      <input
                        type="text"
                        required
                        value={itemForm.name}
                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Grilled Salmon"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={itemForm.description}
                        onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe the dish..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                      {itemForm.image_url && (
                        <div className="mb-3">
                          <img
                            src={itemForm.image_url}
                            alt="Preview"
                            className="w-32 h-24 object-cover rounded-lg border border-gray-300"
                          />
                        </div>
                      )}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Upload Image File
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            disabled={uploadingImage}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          {uploadingImage && (
                            <div className="flex items-center mt-2 text-sm text-blue-600">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                              Uploading image...
                            </div>
                          )}
                        </div>
                        <div className="text-center text-gray-500 text-sm">or</div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                          <input
                            type="url"
                            value={itemForm.image_url}
                            onChange={(e) => setItemForm({ ...itemForm, image_url: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Information</label>
                        <input
                          type="text"
                          value={itemForm.dietary_info.join(', ')}
                          onChange={(e) => setItemForm({
                            ...itemForm,
                            dietary_info: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="vegetarian, vegan, gluten-free"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Allergens</label>
                        <input
                          type="text"
                          value={itemForm.allergens.join(', ')}
                          onChange={(e) => setItemForm({
                            ...itemForm,
                            allergens: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="nuts, dairy, shellfish"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={itemForm.display_order}
                        onChange={(e) => setItemForm({ ...itemForm, display_order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex space-x-4 pt-4">
                      <button
                        type="button"
                        onClick={resetItemForm}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        {editingItem ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
