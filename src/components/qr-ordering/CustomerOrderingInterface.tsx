import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MenuCategory, MenuItem, CartItem, OrderSession, LoyaltyDiscount } from '../../types/database';
import { MenuDisplay } from './MenuDisplay';
import { CartSidebar } from './CartSidebar';
import { LoyaltyInput } from './LoyaltyInput';
import { OrderConfirmation } from './OrderConfirmation';
import { CustomerAuth } from './CustomerAuth';
import { ShoppingCart, ArrowLeft, Users, Clock, MapPin, User, LogOut, Receipt } from 'lucide-react';
import { useStripeCheckout } from '../../hooks/useStripeCheckout';

interface OrderHistoryItem {
  id: string;
  order_number: string;
  items: any[];
  subtotal_sgd: number;
  discount_sgd: number;
  total_sgd: number;
  status: string;
  created_at: string;
}

interface CustomerOrderingInterfaceProps {
  sessionToken?: string;
}

export function CustomerOrderingInterface({ sessionToken }: CustomerOrderingInterfaceProps) {
  const { token } = useParams<{ token: string }>();
  const activeToken = sessionToken || token;

  // Debug logging for production
  console.log('CustomerOrderingInterface loaded with token:', activeToken);
  console.log('URL params:', { token, sessionToken });
  console.log('Current pathname:', window.location.pathname);

  const [session, setSession] = useState<OrderSession | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loyaltyUserIds, setLoyaltyUserIds] = useState<string[]>([]);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<LoyaltyDiscount | null>(null);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [showCustomerAuth, setShowCustomerAuth] = useState(false);
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [taxBreakdown, setTaxBreakdown] = useState<any>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createCheckoutSession } = useStripeCheckout();

  useEffect(() => {
    if (activeToken) {
      console.log('Fetching session and menu for token:', activeToken);
      fetchSessionAndMenu();
      fetchOrderHistory();
    } else {
      console.error('No token provided to CustomerOrderingInterface');
      setError('Invalid ordering session. Please scan the QR code again.');
      setLoading(false);
    }
  }, [activeToken]);

  useEffect(() => {
    // Check if customer is already logged in
    checkCustomerAuth();
  }, []);
  useEffect(() => {
    if (loyaltyUserIds.length > 0 && session) {
      checkLoyaltyDiscount();
    } else {
      setLoyaltyDiscount(null);
    }
  }, [loyaltyUserIds, session]);

  // Calculate tax breakdown when cart changes
  useEffect(() => {
    if (session && cart.length > 0) {
      calculateTaxBreakdown();
    }
  }, [cart, session]);

  const checkCustomerAuth = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.user) {
        setCustomerUser(authSession.user);
        // Auto-add customer to loyalty if they have a profile
        const { data: loyaltyProfile } = await supabase
          .from('loyalty_users')
          .select('user_id')
          .eq('user_id', authSession.user.id)
          .maybeSingle();
        
        if (loyaltyProfile) {
          setLoyaltyUserIds([authSession.user.id]);
        }
      }
    } catch (error) {
      console.error('Error checking customer auth:', error);
    }
  };
  const fetchSessionAndMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching order session with token:', activeToken);

      // Fetch order session
      const { data: sessionData, error: sessionError } = await supabase
        .from('order_sessions')
        .select(`
          *,
          table:restaurant_tables(*),
          booking:bookings(*)
        `)
        .eq('session_token', activeToken)
        .eq('is_active', true)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!sessionData) {
        setError('Invalid or expired session. Please scan the QR code again.');
        return;
      }
      
      console.log('Session data found:', sessionData);

      setSession(sessionData);

      // Fetch menu categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', sessionData.restaurant_id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch menu items
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select(` 
          *,
          category:menu_categories(*)
        `)
        .eq('restaurant_id', sessionData.restaurant_id)
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;
      setMenuItems(itemsData || []);

      console.log('Menu data loaded successfully');
    } catch (err) {
      console.error('Error in fetchSessionAndMenu:', err);
      setError(err instanceof Error ? err.message : 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderHistory = async () => {
    if (!activeToken) return;
    
    try {
      // First get the session to get the session ID
      const { data: sessionData } = await supabase
        .from('order_sessions')
        .select('id')
        .eq('session_token', activeToken)
        .eq('is_active', true)
        .single();
        
      if (!sessionData) return;
      
      // Then fetch all orders for this session
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          subtotal_sgd,
          discount_sgd,
          total_sgd,
          status,
          created_at,
          items:order_items(
            *,
            menu_item:menu_items(*)
          )
        `)
        .eq('session_id', sessionData.id)
        .order('created_at', { ascending: false });
        
      if (ordersError) throw ordersError;
      setOrderHistory(ordersData || []);
    } catch (err) {
      console.error('Error fetching order history:', err);
    }
  };

  const checkLoyaltyDiscount = async () => {
    if (!session || loyaltyUserIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .rpc('check_loyalty_discount', {
          p_restaurant_id: session.restaurant_id,
          p_loyalty_user_ids: loyaltyUserIds
        });

      if (error) throw error;
      if (data && data.length > 0) {
        setLoyaltyDiscount(data[0]);
      }
    } catch (err) {
      console.error('Error checking loyalty discount:', err);
    }
  };

  const calculateTaxBreakdown = async () => {
    if (!session) return;
    
    try {
      const subtotal = calculateSubtotal();
      // Apply discount before tax calculation
      const discountedSubtotal = subtotal - calculateDiscount();
      
      const { data, error } = await supabase
        .rpc('calculate_order_taxes', {
          p_subtotal: discountedSubtotal,
          p_restaurant_id: session.restaurant_id
        });

      if (error) throw error;
      setTaxBreakdown(data);
    } catch (err) {
      console.error('Error calculating tax breakdown:', err);
      // Don't set error state as this is not critical
    }
  };

  const handleCustomerSignIn = (user: any) => {
    setCustomerUser(user);
    setShowCustomerAuth(false);
    // Auto-add to loyalty if they have a profile
    checkCustomerAuth();
  };

  const handleCustomerSignOut = async () => {
    await supabase.auth.signOut();
    setCustomerUser(null);
    setLoyaltyUserIds([]);
    setLoyaltyDiscount(null);
  };
  const addToCart = (menuItem: MenuItem, quantity: number = 1, specialInstructions?: string) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => 
        item.menu_item.id === menuItem.id && 
        item.special_instructions === specialInstructions
      );

      if (existingItem) {
        return prevCart.map(item =>
          item === existingItem
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prevCart, {
          menu_item: menuItem,
          quantity,
          special_instructions: specialInstructions
        }];
      }
    });
  };

  const updateCartItem = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }

    setCart(prevCart =>
      prevCart.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    );
  };

  const updateCartItemById = (itemId: string, newQuantity: number) => {
    setCart(prevCart => {
      return prevCart.map(cartItem => {
        if (cartItem.menu_item.id === itemId) {
          return { ...cartItem, quantity: newQuantity };
        }
        return cartItem;
      });
    });
  };

  const removeCartItemById = (itemId: string) => {
    setCart(prevCart => prevCart.filter(cartItem => cartItem.menu_item.id !== itemId));
  };
  const removeFromCart = (index: number) => {
    setCart(prevCart => prevCart.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => 
      total + (item.menu_item.price_sgd * item.quantity), 0
    );
  };

  const calculateDiscount = () => {
    if (!loyaltyDiscount?.discount_eligible) return 0;
    return calculateSubtotal() * loyaltyDiscount.discount_amount;
  };

  const calculateTotal = () => {
    // If we have tax breakdown, use it for the total
    if (taxBreakdown) {
      return taxBreakdown.total;
    } else {
      // Fallback to simple calculation if tax breakdown isn't available yet
      return calculateSubtotal() - calculateDiscount();
    }
  };

  const submitOrder = async () => {
    if (!session || cart.length === 0) return;

    try {
      setLoading(true);

      // Generate order number
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
      
      if (orderNumberError) throw orderNumberError;

      // Create order
      const subtotal = calculateSubtotal();
      const discount = calculateDiscount();
      const total = calculateTotal();

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: session.restaurant_id,
          session_id: session.id,
          order_number: orderNumber,
          loyalty_user_ids: loyaltyUserIds.length > 0 ? loyaltyUserIds : null,
          subtotal_sgd: subtotal,
          discount_sgd: discount,
          total_sgd: total,
          discount_applied: loyaltyDiscount?.discount_eligible || false,
          triggering_user_id: loyaltyDiscount?.triggering_user_id || null,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
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
      if (loyaltyDiscount?.triggering_user_id) {
        await supabase.rpc('update_loyalty_spending', {
          p_restaurant_id: session.restaurant_id,
          p_user_id: loyaltyDiscount.triggering_user_id,
          p_amount: total
        });
      }

      setOrderConfirmed(true);
      setCart([]); // Clear the cart after successful order
      setShowCart(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      setLoading(false);
    }
    await fetchOrderHistory(); // Refresh order history after submitting an order
  };

  const handleCheckout = async () => {
    if (!session || cart.length === 0) return;
    
    console.log('Starting checkout process');
    setError(null);
    try {
      setCheckoutLoading(true);
      
      console.log('Creating Stripe checkout session');
      try {
        await createCheckoutSession({
          priceId: '', // Not needed for cart items
          restaurantId: session.restaurant_id,
          mode: 'payment',
          success_url: `${window.location.origin}/order/success?payment_success=true&token=${activeToken}`,
          cancel_url: `${window.location.origin}/order/${activeToken}`,
          cart_items: cart,
          table_id: session.table_id,
          session_id: session.id,
          loyalty_user_ids: loyaltyUserIds,
          discount_applied: loyaltyDiscount?.discount_eligible || false,
          triggering_user_id: loyaltyDiscount?.triggering_user_id || null,
          discount_amount: calculateDiscount()
        });
      } catch (stripeError) {
        console.error('Stripe checkout error details:', stripeError);
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';
        throw new Error(`Stripe checkout failed: ${errorMessage}`);
      }
      
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Payment processing failed. Please try again or pay at the counter.');
      setShowCart(false); // Close cart on error
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Check URL parameters for payment success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    
    if (paymentSuccess === 'true') {
      // Payment was successful, clear cart
      setCart([]);
      setOrderConfirmed(true);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Unable to Load Menu</h2>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-left">
              <p className="font-medium text-gray-700 mb-1">Debug Info:</p>
              <p className="text-gray-600">Token: {activeToken || 'Not provided'}</p>
              <p className="text-gray-600">URL: {window.location.pathname}</p>
              <p className="text-gray-600">
                Supabase: {import.meta.env.VITE_SUPABASE_URL ? '✓ Connected' : '✗ Not configured'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orderConfirmed) {
    return (
      <OrderConfirmation 
        onContinue={() => {
          setOrderConfirmed(false);
          // Don't clear the cart here, keep it until payment
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Order Menu</h1>
                {session?.table && (
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    Table {session.table.table_number}
                    {session.booking && (
                      <>
                        <span className="mx-2">•</span>
                        <Users className="w-4 h-4 mr-1" />
                        {session.booking.party_size} guests
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Customer Auth Button */}
              {customerUser ? (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <User className="w-4 h-4 mr-1" />
                    {customerUser.email}
                  </div>
                  <button
                    onClick={handleCustomerSignOut}
                    className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
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
      />
      
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