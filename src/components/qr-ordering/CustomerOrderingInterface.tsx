import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MenuCategory, MenuItem, CartItem, OrderSession, LoyaltyDiscount } from '../../types/database';
import { MenuDisplay } from './MenuDisplay';
import { CartSidebar } from './CartSidebar';
import { LoyaltyInput } from './LoyaltyInput';
import { OrderConfirmation } from './OrderConfirmation';
import { CustomerAuth } from './CustomerAuth';
import { ShoppingCart, ArrowLeft, Users, Clock, MapPin, User, LogOut } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeToken) {
      console.log('Fetching session and menu for token:', activeToken);
      fetchSessionAndMenu();
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
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) {
        console.error('No session data found for token:', activeToken);
        throw new Error('Invalid or expired session');
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
    return calculateSubtotal() - calculateDiscount();
  };

  const submitOrder = async () => {
    if (!session || cart.length === 0) return;

    try {
      setLoading(true);

      // Generate order number
      const { data: orderNumber } = await supabase.rpc('generate_order_number');

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
      setCart([]);
      setShowCart(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

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
    return <OrderConfirmation onContinue={() => setOrderConfirmed(false)} />;
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
          onAddToCart={addToCart}
        />
      </div>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        onUpdateItem={updateCartItem}
        onRemoveItem={removeFromCart}
        subtotal={calculateSubtotal()}
        discount={calculateDiscount()}
        total={calculateTotal()}
        loyaltyDiscount={loyaltyDiscount}
        onSubmitOrder={submitOrder}
        loading={loading}
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