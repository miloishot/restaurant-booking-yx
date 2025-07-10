import React, { useState } from 'react';
import { MenuCategory, MenuItem } from '../../types/database';
import { Plus, Info, Leaf, AlertTriangle } from 'lucide-react';

interface MenuDisplayProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  cart: CartItem[];
  onAddToCart: (item: MenuItem, quantity: number, specialInstructions?: string) => void;
  onUpdateCartItem: (itemId: string, quantity: number) => void;
  onRemoveCartItem: (itemId: string) => void;
}

export function MenuDisplay({ categories, menuItems, cart, onAddToCart, onUpdateCartItem, onRemoveCartItem }: MenuDisplayProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories.length > 0 ? categories[0].id : null
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');

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
        <span key="veg" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
          <Leaf className="w-3 h-3 mr-1" />
          Vegetarian
        </span>
      );
    }
    
    if (item.dietary_info?.includes('vegan')) {
      badges.push(
        <span key="vegan" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
          <Leaf className="w-3 h-3 mr-1" />
          Vegan
        </span>
      );
    }
    
    if (item.allergens && item.allergens.length > 0) {
      badges.push(
        <span key="allergens" className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
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
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Category Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <div className="bg-white rounded-lg shadow-md p-4 sticky top-24">
          <h3 className="font-semibold text-gray-800 mb-4">Categories</h3>
          <nav className="space-y-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  activeCategory === category.id
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {category.name}
                <span className="text-xs text-gray-500 block">
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
            className={`${activeCategory === category.id ? 'block' : 'hidden'}`}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{category.name}</h2>
              {category.description && (
                <p className="text-gray-600">{category.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {getItemsByCategory(category.id).map(item => (
                <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
                          <span className="text-2xl">🍽️</span>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{item.name}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      <span className="text-lg font-bold text-blue-600">
                        {formatPrice(item.price_sgd)}
                      </span>
                    </div>
                    
                    {item.description && (
                      <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                    )}
                    
                    {/* Dietary badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getDietaryBadges(item)}
                    </div>
                    
                    {/* Quantity in cart display */}
                    {getItemQuantityInCart(item.id) > 0 ? (
                      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-800 font-semibold text-sm">
                            {getItemQuantityInCart(item.id)} in cart
                          </span>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleQuantityChange(item, getItemQuantityInCart(item.id) - 1)}
                              className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                              <Plus className="w-4 h-4 rotate-45" />
                            </button>
                            <span className="font-bold text-blue-900 min-w-[2rem] text-center text-lg">
                              {getItemQuantityInCart(item.id)}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item, getItemQuantityInCart(item.id) + 1)}
                              className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center transition-colors"
                      >
                        <Info className="w-4 h-4 mr-1" />
                        Details
                      </button>
                      
                      {getItemQuantityInCart(item.id) === 0 ? (
                        <button
                          onClick={() => onAddToCart(item, 1)}
                          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add to Cart
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-90vh overflow-y-auto">
            <div className="p-6">
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">{selectedItem.name}</h2>
                <span className="text-xl font-bold text-blue-600">
                  {formatPrice(selectedItem.price_sgd)}
                </span>
              </div>
              
              {selectedItem.description && (
                <p className="text-gray-600 mb-4">{selectedItem.description}</p>
              )}
              
              {/* Dietary information */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  {getDietaryBadges(selectedItem)}
                </div>
                
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div className="text-sm text-orange-600">
                    <strong>Allergens:</strong> {selectedItem.allergens.join(', ')}
                  </div>
                )}
              </div>
              
              {/* Quantity selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                  >
                    -
                  </button>
                  <span className="text-lg font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              
              {/* Special instructions */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any special requests or modifications..."
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                >
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