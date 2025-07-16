import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MenuCategory, MenuItem, CartItem, LoyaltyDiscount, TaxBreakdown } from '../../types/database';
import { MenuDisplay } from './MenuDisplay';
import { CartSidebar } from './CartSidebar';
import { CustomerAuth } from './CustomerAuth';
import { LoyaltyInput } from './LoyaltyInput';
import { ShoppingCart, User, ChevronLeft, Receipt, X } from 'lucide-react';
import { useStripeCheckout } from '../../hooks/useStripeCheckout';

interface CustomerOrderingInterfaceProps {}

export function CustomerOrderingInterface({}: CustomerOrderingInterfaceProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any | null>(null);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loyaltyUserIds, setLoyaltyUserIds] = useState<string[]>([]);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<LoyaltyDiscount | null>(null);
  const [showCustomerAuth, setShowCustomerAuth] = useState(false);
  const [customerUser, setCustomerUser] = useState<any | null>(null);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdown | null>(null);
  const { createCheckoutSession, loading: checkoutLoading, error: checkoutError } = useStripeCheckout();

  useEffect(() => {
    if (token) {
      fetchSession();
    }
  }, [token]);

  useEffect(() => {
    if (session) {
      fetchRestaurant();
      fetchMenu();
      fetchTaxSettings();
    }
  }, [session]);

  useEffect(() => {
    // Check for customer user in localStorage
    const storedUser = localStorage.getItem('customerUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCustomerUser(user);
        // Add user ID to loyalty IDs if not already present
        if (user.id && !loyaltyUserIds.includes(user.id)) {
          setLoyaltyUserIds(prev => [...prev, user.id]);
        }
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (loyaltyUserIds.length > 0) {
      checkLoyaltyDiscount();
    } else {
      setLoyaltyDiscount(null);
    }
  }, [loyaltyUserIds]);

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('order_sessions')
        .select(`
          *,
          restaurant:restaurants(*),
          table:restaurant_tables(*)
        `)
        .eq('session_token', token)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      
      if (!data) {
        throw new Error('Session not found or expired');
      }
      
      setSession(data);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  };

  const fetchRestaurant = async () => {
    if (!session?.restaurant_id) return;
    
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', session.restaurant_id)
        .single();

      if (error) throw error;
      setRestaurant(data);
    } catch (err) {
      console.error('Error fetching restaurant:', err);
    }
  };

  const fetchMenu = async () => {
    if (!session?.restaurant_id) return;
    
    try {
      const [categoriesResult, itemsResult] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*')
          .eq('restaurant_id', session.restaurant_id)
          .eq('is_active', true)
          .order('display_order'),
        
        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', session.restaurant_id)
          .eq('is_available', true)
          .order('display_order')
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setCategories(categoriesResult.data || []);
      setMenuItems(itemsResult.data || []);
    } catch (err) {
      console.error('Error fetching menu:', err);
    }
  };

  const fetchTaxSettings = async () => {
    if (!session?.restaurant_id) return;
    
    try {
      const { data, error } = await supabase
        .from('restaurant_tax_settings')
        .select('*')
        .eq('restaurant_id', session.restaurant_id)
        .single();

      if (error) {
        console.warn('Error fetching tax settings:', error);
        return;
      }
      
      // Default values if not found
      const gstRate = data?.gst_rate || 9;
      const serviceChargeRate = data?.service_charge_rate || 10;
      const gstEnabled = data?.gst_enabled !== false; // Default to true if not found
      const serviceChargeEnabled = data?.service_charge_enabled !== false; // Default to true if not found
      
      console.log('Tax settings:', { gstRate, serviceChargeRate, gstEnabled, serviceChargeEnabled });
    } catch (err) {
      console.error('Error fetching tax settings:', err);
    }
  };

  const fetchOrderHistory = async () => {
    if (!session?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            menu_item:menu_items(*)
          )
        `)
        .eq('session_id', session.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrderHistory(data || []);
    } catch (err) {
      console.error('Error fetching order history:', err);
    }
  };

  const checkLoyaltyDiscount = async () => {
    if (!session?.restaurant_id || loyaltyUserIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .rpc('check_loyalty_discount', {
          p_restaurant_id: session.restaurant_id,
          p_user_ids: loyaltyUserIds
        });

      if (error) throw error;
      
      setLoyaltyDiscount(data);
    } catch (err) {
      console.error('Error checking loyalty discount:', err);
    }
  };

  const addToCart = (item: MenuItem, quantity: number, specialInstructions?: string) => {
    setCart(prev => [
      ...prev,
      {
        menu_item: item,
        quantity,
        special_instructions: specialInstructions
      }
    ]);
  };

  const updateCartItem = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    
    setCart(prev => {
      const newCart = [...prev];
      newCart[index].quantity = quantity;
      return newCart;
    });
  };

  const updateCartItemById = (itemId: string, quantity: number) => {
    setCart(prev => {
      const newCart = [...prev];
      const index = newCart.findIndex(item => item.menu_item.id === itemId);
      
      if (index !== -1) {
        if (quantity <= 0) {
          newCart.splice(index, 1);
        } else {
          newCart[index].quantity = quantity;
        }
      }
      
      return newCart;
    });
  };

  const removeCartItemById = (itemId: string) => {
    setCart(prev => prev.filter(item => item.menu_item.id !== itemId));
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.menu_item.price_sgd * item.quantity), 0);
  };

  const calculateDiscount = () => {
    if (loyaltyDiscount?.discount_eligible) {
      return calculateSubtotal() * 0.1; // 10% discount
    }
    return 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const calculateTaxBreakdown = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    const netSubtotal = subtotal - discount;
    
    // Get tax settings from restaurant
    const gstRate = 9; // Default 9%
    const serviceChargeRate = 10; // Default 10%
    const gstEnabled = true;
    const serviceChargeEnabled = true;
    
    // Calculate service charge
    const serviceCharge = serviceChargeEnabled ? netSubtotal * (serviceChargeRate / 100) : 0;
    
    // Calculate GST (applied to subtotal + service charge)
    const gst = gstEnabled ? (netSubtotal + serviceCharge) * (gstRate / 100) : 0;
    
    // Calculate total
    const total = netSubtotal + serviceCharge + gst;
    
    return {
      subtotal,
      service_charge: serviceCharge,
      service_charge_rate: serviceChargeRate,
      service_charge_enabled: serviceChargeEnabled,
      gst,
      gst_rate: gstRate,
      gst_enabled: gstEnabled,
      total
    };
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);
    setError(null);

    try {
      // Generate order number
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
      
      if (orderNumberError) throw orderNumberError;
      
      // Calculate tax breakdown
      const taxes = calculateTaxBreakdown();
      setTaxBreakdown(taxes);
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: session.restaurant_id,
          session_id: session.id,
          order_number: orderNumber,
          loyalty_user_ids: loyaltyUserIds.length > 0 ? loyaltyUserIds : null,
          subtotal_sgd: taxes.subtotal,
          discount_sgd: calculateDiscount(),
          total_sgd: taxes.total,
          discount_applied: loyaltyDiscount?.discount_eligible || false,
          triggering_user_id: loyaltyDiscount?.triggering_user_id || null,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;
      
      // Create order items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item.id,
        quantity: item.quantity,
        unit_price_sgd: item.menu_item.price_sgd,
        total_price_sgd: item.menu_item.price_sgd * item.quantity,
        special_instructions: item.special_instructions || null
      }));
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;
      
      // Update loyalty user spending if discount was applied
      if (loyaltyDiscount?.discount_eligible && loyaltyDiscount.triggering_user_id) {
        await supabase.rpc('update_loyalty_spending', {
          p_restaurant_id: session.restaurant_id,
          p_user_id: loyaltyDiscount.triggering_user_id,
          p_amount: taxes.total
        });
      }
      
      // Fetch updated order history
      await fetchOrderHistory();
      
      // Clear cart
      setCart([]);
      
      // Close cart sidebar
      setShowCart(false);
      
      // Fetch updated order history
      await fetchOrderHistory();
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Order placed successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    } catch (err) {
      console.error('Error submitting order:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    try {
      // Calculate tax breakdown
      const taxes = calculateTaxBreakdown();
      setTaxBreakdown(taxes);
      
      if (!restaurant?.id) {
        throw new Error('Restaurant ID is required for checkout');
      }
      
      await createCheckoutSession({
        priceId: 'price_placeholder', // Not used for cart checkout
        mode: 'payment',
        success_url: `${window.location.origin}/order/success?payment_success=true&token=${token}`,
        cancel_url: `${window.location.origin}/order/${token}`,
        restaurantId: restaurant.id,
        cart_items: cart,
        table_id: session.table_id,
        session_id: session.id,
        loyalty_user_ids: loyaltyUserIds.length > 0 ? loyaltyUserIds : undefined,
        discount_applied: loyaltyDiscount?.discount_eligible || false,
        triggering_user_id: loyaltyDiscount?.triggering_user_id || null,
        discount_amount: calculateDiscount()
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
    }
  };

  const handleCustomerSignIn = (user: any) => {
    setCustomerUser(user);
    localStorage.setItem('customerUser', JSON.stringify(user));
    
    // Add user ID to loyalty IDs if not already present
    if (user.id && !loyaltyUserIds.includes(user.id)) {
      setLoyaltyUserIds(prev => [...prev, user.id]);
    }
    
    setShowCustomerAuth(false);
  };

  const formatPrice = (price: number) => {
    return `S$${price.toFixed(2)}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!session || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading Menu</h1>
          <p className="text-gray-600">Please wait while we prepare your ordering experience</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-lg sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
                <p className="text-sm text-gray-600">Table {session.table?.table_number}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Sign In Button */}
              {!customerUser && (
                <button
                  onClick={() => setShowCustomerAuth(true)}
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
                className="relative p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="ml-2">Cart</span>
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
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <LoyaltyInput
          loyaltyUserIds={loyaltyUserIds}
          onLoyaltyUserIdsChange={setLoyaltyUserIds}
          loyaltyDiscount={loyaltyDiscount}
          customerUser={customerUser}
        />
      </div>

      {/* Menu Display */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
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
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Payment Status:</span>
                            <span className={order.status === 'paid' ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                              {order.status === 'paid' ? 'Paid' : 'Not Paid'}
                            </span>
                          </div>
                          
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
                        
                        <div className="flex justify-between text-gray-600 mt-2">
                          <span>Payment Status:</span>
                          <span className={orderHistory.every(order => order.status === 'paid') ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                            {orderHistory.every(order => order.status === 'paid') ? 'All Paid' : 'Some Not Paid'}
                          </span>
                        </div>
                        
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
                  onClick={() => {
                    setShowOrderHistory(false);
                    if (cart.length === 0) {
                      // If cart is empty, fetch menu to ensure categories are loaded
                      fetchMenu();
                    }
                  }}
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