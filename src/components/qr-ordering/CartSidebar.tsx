import React from 'react';
import { CartItem, LoyaltyDiscount } from '../../types/database';
import { X, Plus, Minus, ShoppingCart, CreditCard, Tag } from 'lucide-react';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateItem: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  subtotal: number;
  discount: number;
  total: number;
  loyaltyDiscount: LoyaltyDiscount | null;
  onSubmitOrder: () => void;
  loading: boolean;
}

export function CartSidebar({
  isOpen,
  onClose,
  cart,
  onUpdateItem,
  onRemoveItem,
  subtotal,
  discount,
  total,
  loyaltyDiscount,
  onSubmitOrder,
  loading
}: CartSidebarProps) {
  const formatPrice = (price: number) => {
    return `S$${price.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Your Order ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Your cart is empty</p>
                <p className="text-sm text-gray-400">Add items from the menu to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={`${item.menu_item.id}-${index}`} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-800">{item.menu_item.name}</h3>
                      <button
                        onClick={() => onRemoveItem(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onUpdateItem(index, item.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-medium">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateItem(index, item.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <span className="font-semibold text-blue-600">
                        {formatPrice(item.menu_item.price_sgd * item.quantity)}
                      </span>
                    </div>
                    
                    {item.special_instructions && (
                      <div className="mt-2 text-sm text-gray-600">
                        <strong>Note:</strong> {item.special_instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          {cart.length > 0 && (
            <div className="border-t p-4 space-y-4">
              {/* Loyalty Discount Display */}
              {loyaltyDiscount?.discount_eligible && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center text-green-800 mb-1">
                    <Tag className="w-4 h-4 mr-2" />
                    <span className="font-medium">Loyalty Discount Applied!</span>
                  </div>
                  <p className="text-sm text-green-700">
                    10% discount from User ID: {loyaltyDiscount.triggering_user_id}
                  </p>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Loyalty Discount (10%)</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-semibold text-gray-800">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              {/* Submit Order Button */}
              <button
                onClick={onSubmitOrder}
                disabled={loading || cart.length === 0}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-5 h-5 mr-2" />
                )}
                {loading ? 'Sending Order...' : 'Send Order to Kitchen'}
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                Your order will be sent to the kitchen for preparation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}