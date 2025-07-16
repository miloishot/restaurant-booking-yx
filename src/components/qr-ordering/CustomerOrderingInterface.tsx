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
  const [loading, setLoading] = useState(true);
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
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCustomerUser(session.user);
        setLoyaltyUserIds([session.user.id]);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCustomerUser(session.user);
        setLoyaltyUserIds([session.user.id]);
      } else {
        setCustomerUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Invalid session token');
      return;
    }

    fetchSessionData();
  }, [token]);

  useEffect(() => {
    if (restaurant?.id) {
      fetchMenuData();
      fetchOrderHistory();
    }
  }, [restaurant?.id, customerUser]);

  useEffect(() => {
    if (restaurant?.id && loyaltyUserIds.length > 0) {
      checkLoyaltyDiscount();
    } else {
      setLoyaltyDiscount(null);
    }
  }, [restaurant?.id, loyaltyUserIds, cart]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      
      // Get session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('order_sessions')
        .select(`
          *,
          table:restaurant_tables(*),
          restaurant:restaurants(*)
        `)
        .eq('session_token', token)
        .eq('is_active', true)
        .single();

      if (sessionError) throw sessionError;
      
      if (!sessionData) {
        throw new Error('Session not found or expired');
      }
      
      setSession(sessionData);
      setRestaurant(sessionData.restaurant);
      
      // Fetch tax settings
      if (sessionData.restaurant?.id) {
        const { data: taxSettings } = await supabase
          .from('restaurant_tax_settings')
          .select('*')
          .eq('restaurant_id', sessionData.restaurant.id)
          .maybeSingle();
          
        if (taxSettings) {
          console.log('Tax settings:', taxSettings);
        }
      }
    } catch (err) {
      console.error('Error fetching session data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('display_order');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch menu items
      const { data: menuItemsData, error: menuItemsError } = await supabase
        .from('menu_items')
        .select(`
          *,
          category:menu_categories(*)
        `)
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .order('display_order');

      if (menuItemsError) throw menuItemsError;
      setMenuItems(menuItemsData || []);
    } catch (err) {
      console.error('Error fetching menu data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load menu data');
    }
  };

  const fetchOrderHistory = async () => {
    if (!restaurant?.id || !session?.id) return;
    
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
        .order('status', { ascending: false }) // Show active orders first
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrderHistory(data || []);
    } catch (err) {
      console.error('Error fetching order history:', err);
    }
  };

  const checkLoyaltyDiscount = async () => {
    if (!restaurant?.id || loyaltyUserIds.length === 0 || cart.length === 0) {
      setLoyaltyDiscount(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('check_loyalty_discount', {
          p_restaurant_id: restaurant.id,
          p_user_ids: loyaltyUserIds
        });

      if (error) throw error;
      
      setLoyaltyDiscount(data || null);
      
      // Calculate tax breakdown
      if (data?.discount_eligible) {
        calculateTaxBreakdown();
      }
    } catch (err) {
      console.error('Error checking loyalty discount:', err);
      setLoyaltyDiscount(null);
    }
  };

  const calculateTaxBreakdown = async () => {
    if (!restaurant?.id || cart.length === 0) {
      setTaxBreakdown(null);
      return;
    }

    try {
      const subtotal = cart.reduce((sum, item) => sum + (item.menu_item.price_sgd * item.quantity), 0);
      
      // Get tax settings
      const { data: taxSettings, error: taxError } = await supabase
        .from('restaurant_tax_settings')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();
        
      if (taxError) throw taxError;
      
      if (!taxSettings) {
        setTaxBreakdown(null);
        return;
      }
      
      // Calculate discount if applicable
      const discount = loyaltyDiscount?.discount_eligible ? subtotal * 0.1 : 0; // 10% discount
      const netSubtotal = subtotal - discount;
      
      // Calculate service charge
      const serviceChargeEnabled = taxSettings.service_charge_enabled !== false; // Default to true if not set
      const serviceChargeRate = taxSettings.service_charge_rate || 10; // Default to 10%
      const serviceCharge = serviceChargeEnabled ? netSubtotal * (serviceChargeRate / 100) : 0;
      
      // Calculate GST
      const gstEnabled = taxSettings.gst_enabled !== false; // Default to true if not set
      const gstRate = taxSettings.gst_rate || 9; // Default to 9%
      const gstBase = netSubtotal + (serviceChargeEnabled ? serviceCharge : 0);
      const gst = gstEnabled ? gstBase * (gstRate / 100) : 0;
      
      // Calculate total
      const total = netSubtotal + serviceCharge + gst;
      
      setTaxBreakdown({
        subtotal,
        service_charge: serviceCharge,
        service_charge_rate: serviceChargeRate,
        service_charge_enabled: serviceChargeEnabled,
        gst,
        gst_rate: gstRate,
        gst_enabled: gstEnabled,
        total
      });
    } catch (err) {
      console.error('Error calculating tax breakdown:', err);
      setTaxBreakdown(null);
    }
  };

  const handleAddToCart = (item: MenuItem, quantity: number, specialInstructions?: string) => {
    const existingItemIndex = cart.findIndex(
      cartItem => cartItem.menu_item.id === item.id && 
                 (cartItem.special_instructions || '') === (specialInstructions || '')
    );

    if (existingItemIndex !== -1) {
      // Update existing item
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += quantity;
      setCart(updatedCart);
    } else {
      // Add new item
      setCart([...cart, { menu_item: item, quantity, special_instructions: specialInstructions }]);
    }
  };

  const handleUpdateCartItem = (index: number, quantity: number) => {
    const updatedCart = [...cart];
    updatedCart[index].quantity = quantity;
    setCart(updatedCart);
  };

  const handleRemoveCartItem = (index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    setCart(updatedCart);
  };

  const handleUpdateCartItemById = (itemId: string, quantity: number) => {
    const updatedCart = [...cart];
    const allIndices = [];
    
    // Find all instances of this item in the cart
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].menu_item.id === itemId) {
        allIndices.push(i);
      }
    }
    
    if (allIndices.length === 0) return;
    
    // If there's only one instance, update it
    if (allIndices.length === 1) {
      const index = allIndices[0];
      if (quantity <= 0) {
        updatedCart.splice(index, 1);
      } else {
        updatedCart[index].quantity = quantity;
      }
    } else {
      // If there are multiple instances, update the first one and remove the rest
      const firstIndex = allIndices[0];
      if (quantity <= 0) {
        // Remove all instances
        for (let i = allIndices.length - 1; i >= 0; i--) {
          updatedCart.splice(allIndices[i], 1);
        }
      } else {
        // Update first instance and remove the rest
        updatedCart[firstIndex].quantity = quantity;
        for (let i = allIndices.length - 1; i > 0; i--) {
          updatedCart.splice(allIndices[i], 1);
        }
      }
    }
    
    setCart(updatedCart);
  };

  const handleRemoveCartItemById = (itemId: string) => {
    const updatedCart = cart.filter(item => item.menu_item.id !== itemId);
    setCart(updatedCart);
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

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    
    try {
      setLoading(true);
      
      // Generate order number
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
      
      if (orderNumberError) throw orderNumberError;
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurant.id,
          session_id: session.id,
          order_number: orderNumber,
          loyalty_user_ids: loyaltyUserIds.length > 0 ? loyaltyUserIds : null,
          subtotal_sgd: calculateSubtotal(),
          discount_sgd: calculateDiscount(),
          total_sgd: calculateTotal(),
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
      
      // Clear cart
      setCart([]);
      
      // Show success message
      navigate('/order/success?token=' + token);
      
      // Refresh order history
      fetchOrderHistory();
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
      setLoading(true);
      
      if (!restaurant?.id || !session?.id) {
        throw new Error('Missing restaurant or session data');
      }
      
      await createCheckoutSession({
        priceId: 'price_placeholder', // Not used for cart checkout
        mode: 'payment',
        restaurantId: restaurant.id,
        success_url: `${window.location.origin}/order/success?token=${token}&payment_success=true`,
        cancel_url: `${window.location.origin}/order/${token}`,
        cart_items: cart,
        table_id: session.table_id,
        session_id: session.id,
        loyalty_user_ids: loyaltyUserIds.length > 0 ? loyaltyUserIds : undefined,
        discount_applied: loyaltyDiscount?.discount_eligible || false,
        triggering_user_id: loyaltyDiscount?.triggering_user_id || null,
        discount_amount: calculateDiscount()
      });
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
      setLoading(false);
    }
  };

  if (loading && !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Loading Menu</h2>
          <p className="text-gray-600">Please wait while we prepare your dining experience...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Session Error</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <p className="text-gray-600 mb-6">
            This QR code session may have expired or is no longer valid. Please ask your server for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Session Not Found</h2>
          <p className="text-gray-600">
            This QR code session may have expired or is no longer valid. Please ask your server for assistance.
          </p>
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = calculateTotal();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              {showOrderHistory ? (
                <button
                  onClick={() => setShowOrderHistory(false)}
                  className="mr-4 text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              ) : null}
              <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
              <div className="ml-4 px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-sm">
                Table {session.table?.table_number}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowOrderHistory(!showOrderHistory)}
                className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors" 
              >
                <Receipt className="w-5 h-5 mr-2" />
                {showOrderHistory ? 'View Menu' : 'View Bill'}
              </button>
              
              <button
                onClick={() => customerUser ? setShowCustomerAuth(false) : setShowCustomerAuth(true)}
                className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                <User className="w-5 h-5 mr-2" />
                {customerUser ? 'Signed In' : 'Sign In'}
              </button>
              
              <button
                onClick={() => setShowCart(true)}
                className="relative flex items-center px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                <span>Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showOrderHistory ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Bill</h2>
            
            {orderHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Orders Yet</h3>
                <p className="text-gray-600">
                  Your order history will appear here after you place your first order.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {orderHistory.map((order) => (
                  <div 
                    key={order.id} 
                    className={`border rounded-lg p-6 ${
                      order.status === 'cancelled' || order.status === 'declined'
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Order #{order.order_number} 
                          {(order.status === 'cancelled' || order.status === 'declined') && (
                            <span className="text-red-600 ml-1">(Cancelled)</span>
                          )}
                          {order.status === 'paid' && (
                            <span className="text-green-600 ml-1">(Paid)</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      {order.items?.map((item) => (
                        <div 
                          key={item.id} 
                          className={`flex justify-between ${
                            order.status === 'cancelled' || order.status === 'declined' ? 'text-gray-400 line-through opacity-70' : ''
                          }`}
                        >
                          <span>
                            {item.quantity}x {item.menu_item?.name}
                            {item.special_instructions && (
                              <span className="block text-xs text-gray-500 ml-6">
                                Note: {item.special_instructions}
                              </span>
                            )}
                          </span>
                          <span className="font-medium">
                            {order.status === 'cancelled' || order.status === 'declined'
                              ? '$0.00' 
                              : formatPrice(item.total_price_sgd)
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span className="font-medium">
                          {(order.status === 'cancelled' || order.status === 'declined')
                            ? '$0.00'
                            : formatPrice(order.subtotal_sgd)}
                        </span>
                      </div>
                      {order.discount_sgd > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Loyalty Discount</span>
                          <span className="font-medium">
                            {(order.status === 'cancelled' || order.status === 'declined')
                              ? '$0.00'
                              : `-${formatPrice(order.discount_sgd)}`}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold mt-2">
                        <span>Total</span>
                        <span className={(order.status === 'cancelled' || order.status === 'declined') ? 'text-gray-400' : 'text-green-600'}>
                          {(order.status === 'cancelled' || order.status === 'declined')
                            ? '$0.00'
                            : formatPrice(order.total_sgd)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Bill Summary */}
                <div className="border-t-2 border-gray-300 pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Total Bill</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Subtotal</span>
                        <span className="font-medium">{formatPrice(
                          orderHistory
                          .filter(order => !['cancelled', 'declined'].includes(order.status))
                          .reduce((sum, order) => sum + order.subtotal_sgd, 0)
                        )}</span>
                      </div>
                      
                      {orderHistory.some(order => order.discount_sgd > 0) && (
                        <div className="flex justify-between text-green-600">
                          <span>Loyalty Discount</span>
                          <span className="font-medium">-{formatPrice(
                            orderHistory
                            .filter(order => !['cancelled', 'declined'].includes(order.status))
                            .reduce((sum, order) => sum + order.discount_sgd, 0)
                          )}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-xl font-bold border-t border-gray-300 pt-3 mt-3">
                        <span>Total</span>
                        <span className="text-green-600">{formatPrice(
                          orderHistory
                          .filter(order => !['cancelled', 'declined'].includes(order.status))
                          .reduce((sum, order) => sum + order.total_sgd, 0)
                        )}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Loyalty Section */}
            <LoyaltyInput 
              loyaltyUserIds={loyaltyUserIds}
              onLoyaltyUserIdsChange={setLoyaltyUserIds}
              loyaltyDiscount={loyaltyDiscount}
              customerUser={customerUser}
            />
            
            {/* Menu Display */}
            <MenuDisplay 
              categories={categories}
              menuItems={menuItems}
              cart={cart}
              onAddToCart={handleAddToCart}
              onUpdateCartItem={handleUpdateCartItemById}
              onRemoveCartItem={handleRemoveCartItemById}
            />
          </>
        )}
      </main>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        onUpdateItem={handleUpdateCartItem}
        onRemoveItem={handleRemoveCartItem}
        subtotal={subtotal}
        discount={discount}
        total={total}
        taxBreakdown={taxBreakdown}
        loyaltyDiscount={loyaltyDiscount}
        onSubmitOrder={handleSubmitOrder}
        loading={loading}
        onCheckout={handleCheckout}
        showPayAtCounter={true}
      />

      {/* Customer Auth Modal */}
      {showCustomerAuth && (
        <CustomerAuth
          onSuccess={(user) => {
            setCustomerUser(user);
            setShowCustomerAuth(false);
            if (user?.id) {
              setLoyaltyUserIds([user.id]);
            }
          }}
          onClose={() => setShowCustomerAuth(false)}
          restaurantId={restaurant?.id}
        />
      )}

      {/* Fixed Cart Button */}
      {!showCart && !showOrderHistory && cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-20">
          <button
            onClick={() => setShowCart(true)}
            className="flex items-center px-6 py-3 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-colors"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            <span className="font-semibold">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
            <span className="mx-2">|</span>
            <span className="font-bold">{formatPrice(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Helper function to format price
const formatPrice = (price: number) => {
  return `$${price.toFixed(2)}`;
};