Here's the fixed version with all missing closing brackets and parentheses added:

```javascript
                <button
                  onClick={() => setShowCustomerAuth(true)}
                </div>
                  className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <User className="w-4 h-4 mr-2" />
                  Sign In for Rewards
                </button>
              )}

              {/* Order History Button */}
              <button
                onClick={() => {
                  fetchOrderHistory();
                  setShowOrderHistory(true);
                }}
                className="flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Receipt className="w-4 h-4 mr-2" />
                View Bill
              </button>

              {/* Cart Button */}
              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Loyalty Input */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <LoyaltyInput
          loyaltyUserIds={loyaltyUserIds}
          onLoyaltyUserIdsChange={setLoyaltyUserIds}
          loyaltyDiscount={loyaltyDiscount}
          customerUser={customerUser}
        />
      </div>

      {/* Menu Display */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <MenuDisplay
          categories={categories}
          menuItems={menuItems}
          cart={cart}
          onAddToCart={addToCart}
          onUpdateCartItem={updateCartItemById}
          onRemoveCartItem={removeCartItemById}
        />
      </div>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        cart={cart.filter(item => item.quantity > 0)}
        onUpdateItem={updateCartItem}
        onRemoveItem={removeFromCart}
        subtotal={calculateSubtotal()}
        taxBreakdown={taxBreakdown}
        discount={calculateDiscount()}
        total={calculateTotal()}
        loyaltyDiscount={loyaltyDiscount}
        onSubmitOrder={submitOrder}
        loading={loading || checkoutLoading}
        onCheckout={cart.length > 0 ? handleCheckout : undefined}
        showPayAtCounter={true}
      />
      
      {/* Order History Modal */}
      {showOrderHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Receipt className="w-5 h-5 mr-2" />
                  Your Bill
                </h2>
                <button
                  onClick={() => setShowOrderHistory(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order History Items */}
              <div className="flex-1 overflow-y-auto p-4">
                {orderHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400">Your order history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orderHistory.map((order) => (
                      <div key={order.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h3 className="font-bold text-gray-800">Order #{order.order_number}</h3>
                            <p className="text-xs text-gray-500">
                              {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          {order.items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center">
                              <span className="text-sm">{item.quantity}x {item.menu_item?.name}</span>
                              <span className="text-sm font-medium">{formatPrice(item.total_price_sgd)}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span>{formatPrice(order.subtotal_sgd)}</span>
                          </div>
                          
                          {order.discount_sgd > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Discount</span>
                              <span>-{formatPrice(order.discount_sgd)}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between font-bold text-gray-800 mt-1">
                            <span>Total</span>
                            <span>{formatPrice(order.total_sgd)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Bill Summary */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                      <h3 className="font-bold text-gray-800 mb-3">Total Bill</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal</span>
                          <span>{formatPrice(orderHistory.reduce((sum, order) => sum + order.subtotal_sgd, 0))}</span>
                        </div>
                        
                        {orderHistory.some(order => order.discount_sgd > 0) && (
                          <div className="flex justify-between text-green-600">
                            <span>Total Discounts</span>
                            <span>-{formatPrice(orderHistory.reduce((sum, order) => sum + order.discount_sgd, 0))}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between font-bold text-lg border-t border-blue-200 pt-2 mt-2">
                          <span>Total</span>
                          <span>{formatPrice(orderHistory.reduce((sum, order) => sum + order.total_sgd, 0))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="border-t p-4 bg-white">
                <button
                  onClick={() => setShowOrderHistory(false)}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue Ordering
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Customer Auth Modal */}
      {showCustomerAuth && (
        <CustomerAuth
          onSuccess={handleCustomerSignIn}
          onClose={() => setShowCustomerAuth(false)}
          restaurantId={session?.restaurant_id}
        />
      )}
    </div>
  );
}
```