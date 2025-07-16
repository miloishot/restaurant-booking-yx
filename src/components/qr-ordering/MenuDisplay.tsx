import React, { useState, useEffect } from 'react';
import { MenuCategory, MenuItem } from '../../types/database';
import { Plus, Minus, Info, Leaf, AlertTriangle, ShoppingCart, Star } from 'lucide-react';

interface MenuDisplayProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  cart: CartItem[];
  onAddToCart: (item: MenuItem, quantity: number, specialInstructions?: string) => void;
  onUpdateCartItem: (itemId: string, quantity: number) => void;
  onRemoveCartItem: (itemId: string) => void;
}

interface CartItem {
  menu_item: MenuItem;
  quantity: number;
  special_instructions?: string;
}

export function MenuDisplay({ categories, menuItems, cart, onAddToCart, onUpdateCartItem, onRemoveCartItem }: MenuDisplayProps) {
  // Always set the first category as active when categories change
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Set the first category as active when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  const getItemsByCategory = (categoryId: string) => {
    return menuItems.filter(item => item.category_id === categoryId);
  };

  const formatPrice = (price: number) => {
    return `S$${price.toFixed(2)}`;
  };

  const handleAddToCart = () => {
    if (selectedItem) {
      onAddToCart(selectedItem, quantity, specialInstructions || undefined);
      setSelectedItem(null);
      setQuantity(1);
      setSpecialInstructions('');
    }
  };

  const getDietaryBadges = (item: MenuItem) => {
    const badges = [];
    
    if (item.dietary_info?.includes('vegetarian')) {
      badges.push(
        <span key="veg" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
          <Leaf className="w-3 h-3 mr-1" />
          Vegetarian
        </span>
      );
    }
    
    if (item.dietary_info?.includes('vegan')) {
      badges.push(
        <span key="vegan" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
          <Leaf className="w-3 h-3 mr-1" />
          Vegan
        </span>
      );
    }
    
    if (item.allergens && item.allergens.length > 0) {
      badges.push(
        <span key="allergens" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Contains allergens
        </span>
      );
    }
    
    return badges;
  };

  const getItemQuantityInCart = (itemId: string) => {
    return cart.reduce((total, cartItem) => {
      if (cartItem.menu_item.id === itemId) {
        return total + cartItem.quantity;
      }
      return total;
    }, 0);
  };

  const handleQuantityChange = (item: MenuItem, newQuantity: number) => {
    if (newQuantity <= 0) {
      onRemoveCartItem(item.id);
    } else {
      const currentQuantity = getItemQuantityInCart(item.id);
      if (currentQuantity === 0) {
        onAddToCart(item, newQuantity);
      } else {
        onUpdateCartItem(item.id, newQuantity);
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Category Sidebar */}
      <div className="lg:w-64 flex-shrink-0 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
          <h3 className="font-bold text-lg text-gray-900 mb-6">Categories</h3>
          <nav className="space-y-3">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeCategory === category.id
                    ? 'bg-orange-50 text-orange-700 font-semibold border-l-4 border-orange-500 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="block">{category.name}</span>
                <span className="text-xs text-gray-500 block mt-1">
                  {getItemsByCategory(category.id).length} items
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1">
        {categories.map(category => (
          <div
            key={category.id}
            className={`${activeCategory === category.id ? 'block' : 'hidden'} space-y-6 mb-8`}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">{category.name}</h2>
              {category.description && (
                <p className="text-lg text-gray-600">{category.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {getItemsByCategory(category.id).map(item => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl">🍽️</span>
                        </div>
                        <p className="text-gray-600 text-sm font-medium">{item.name}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                      <span className="text-xl font-bold text-orange-500 ml-3">
                        {formatPrice(item.price_sgd)}
                      </span>
                    </div>
                    
                    {item.description && (
                      <p className="text-gray-600 text-sm mb-3 leading-relaxed">{item.description}</p>
                    )}
                    
                    {/* Dietary badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {getDietaryBadges(item)}
                    </div>
                    
                    {getItemQuantityInCart(item.id) > 0 ? (
                      <div className="flex items-center justify-center space-x-0">
                        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                          <button
                            onClick={() => handleQuantityChange(item, getItemQuantityInCart(item.id) - 1)}
                            className="w-12 h-12 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors rounded-l-lg"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <div className="w-12 h-12 flex items-center justify-center bg-white border-l border-r border-gray-200 font-semibold text-gray-900">
                            {getItemQuantityInCart(item.id)}
                          </div>
                          <button
                            onClick={() => handleQuantityChange(item, getItemQuantityInCart(item.id) + 1)}
                            className="w-12 h-12 flex items-center justify-center bg-orange-500 text-white hover:bg-orange-600 transition-colors rounded-r-lg"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <button
                          onClick={() => onAddToCart(item, 1)}
                          className="w-full flex items-center justify-center px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                        >
                          <Plus className="w-5 h-5 mr-2" />
                          Add to Cart
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-90vh overflow-y-auto">
            <div className="p-8">
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-full h-64 object-cover rounded-xl mb-6"
                />
              )}
              
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedItem.name}</h2>
                <span className="text-2xl font-bold text-orange-500">
                  {formatPrice(selectedItem.price_sgd)}
                </span>
              </div>
              
              {selectedItem.description && (
                <p className="text-gray-600 mb-6 leading-relaxed">{selectedItem.description}</p>
              )}
              
              {/* Dietary information */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {getDietaryBadges(selectedItem)}
                </div>
                
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                    <strong>Allergens:</strong> {selectedItem.allergens.join(', ')}
                  </div>
                )}
              </div>
              
              {/* Quantity selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Quantity
                </label>
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="w-16 h-12 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 font-bold text-lg">
                    {quantity}
                  </div>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Special instructions */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Any special requests or modifications..."
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center font-semibold"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add to Cart - {formatPrice(selectedItem.price_sgd * quantity)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}