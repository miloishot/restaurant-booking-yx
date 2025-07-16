import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { OrderWithDetails, Restaurant } from '../../types/database';
import { format } from 'date-fns';
import { 
  Clock, 
  CheckCircle, 
  ChefHat, 
  Utensils, 
  CreditCard, 
  MapPin,
  Tag,
  RefreshCw,
  AlertCircle,
  XCircle
} from 'lucide-react';

interface StaffOrderManagementProps {
  restaurant: Restaurant;
  onOrderCountChange?: (count: number) => void;
}

export function StaffOrderManagement({ restaurant, onOrderCountChange }: StaffOrderManagementProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  // For completed/cancelled
  const [completedOrders, setCompletedOrders] = useState<OrderWithDetails[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<OrderWithDetails[]>([]);

  // Notify parent component of order count changes
  useEffect(() => {
    const newOrderCount = orders.filter(o => o.status === 'pending').length;
    onOrderCountChange?.(newOrderCount);
  }, [orders, onOrderCountChange]);

  useEffect(() => {
    fetchOrders();
    fetchCompletedOrders();
    fetchCancelledOrders();
    const unsub = subscribeToOrders();
    return () => { typeof unsub === "function" && unsub(); };
  }, [restaurant.id]);

  // Fetch only "live" orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          session:order_sessions(
            *,
            table:restaurant_tables(*),
            booking:bookings(*)
          ),
          items:order_items(
            *,
            menu_item:menu_items(*)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedOrders = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          session:order_sessions(
            *,
            table:restaurant_tables(*),
            booking:bookings(*)
          ),
          items:order_items(
            *,
            menu_item:menu_items(*)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'completed')
        .gte('created_at', today)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setCompletedOrders(data || []);
    } catch (err) {
      console.error('Error fetching completed orders:', err);
    }
  };

  const fetchCancelledOrders = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          session:order_sessions(
            *,
            table:restaurant_tables(*),
            booking:bookings(*)
          ),
          items:order_items(
            *,
            menu_item:menu_items(*)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .in('status', ['cancelled', 'declined'])
        .gte('created_at', today)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setCancelledOrders(data || []);
    } catch (err) {
      console.error('Error fetching cancelled orders:', err);
    }
  };

  // Real-time updates
  const subscribeToOrders = () => {
    const channel = supabase
      .channel('orders_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`
      }, () => {
        fetchOrders();
        fetchCompletedOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    await fetchCompletedOrders();
    await fetchCancelledOrders();
    setRefreshing(false);
  };

  // Status/Payment status logic
  const updateOrderStatus = async (orderId: string, status: string) => {
    setProcessingOrder(orderId);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      showNotification(`Order marked as ${status}`);
      await fetchOrders();
      if (status === 'completed') await fetchCompletedOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  // Only updates payment_status
  const updateOrderPaymentStatus = async (orderId: string, payment_status: 'paid' | 'unpaid') => {
    setProcessingOrder(orderId);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      showNotification(payment_status === 'paid' ? 'Order marked as paid' : 'Marked as unpaid');
      await fetchOrders();
    } catch (err) {
      console.error('Error updating payment status:', err);
      alert('Failed to update payment status. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  const declineOrder = async (orderId: string) => {
    setProcessingOrder(orderId);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
         status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      showNotification('Order declined', 'red');
      await fetchOrders();
      await fetchCancelledOrders();
    } catch (err) {
      console.error('Error declining order:', err);
      alert('Failed to decline order. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  // Helpers
  function formatPrice(price: number) {
    return `S$${price.toFixed(2)}`;
  }
  function showNotification(message: string, color: 'green' | 'red' = 'green') {
    const notification = document.createElement('div');
    notification.className =
      `fixed top-4 right-4 ${color === 'green' ? 'bg-green-500' : 'bg-red-500'} text-white px-4 py-2 rounded-lg shadow-lg z-50`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }
  function getPaymentStatusLabel(payment_status: string) {
    return payment_status === 'paid'
      ? (<span className="inline-flex items-center text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold ml-2"><CreditCard className="w-3 h-3 mr-1" /> Paid</span>)
      : (<span className="inline-flex items-center text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-semibold ml-2"><Clock className="w-3 h-3 mr-1" /> Unpaid</span>);
  }

  // List breakdowns for rendering logic based on new structure
  const newOrders = orders.filter(o => o.status === 'pending');
  const inProgress = orders.filter(o => o.status === 'confirmed' && o.payment_status !== 'paid');
  const paidInProgress = orders.filter(o => o.status === 'confirmed' && o.payment_status === 'paid');

  // --- UI ---
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <ChefHat className="w-5 h-5 mr-2" /> Order Management
            </h2>
            <p className="text-gray-600">Manage incoming orders and track preparation/payment status</p>
            {newOrders.length > 0 && (
              <div className="mt-2 flex items-center text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" /> <span className="font-medium">{newOrders.length} new orders awaiting acceptance</span>
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* New Orders */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">New Orders ({newOrders.length})</h3>
        {newOrders.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-600">No new orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {newOrders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" /> Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    New
                  </span>
                </div>
                {/* Show payment status */}
                {getPaymentStatusLabel(order.payment_status)}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-sm">{item.quantity}x {item.menu_item?.name}</span>
                      <span className="text-sm font-medium">{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateOrderStatus(order.id, 'confirmed')}
                    disabled={processingOrder === order.id}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >Accept</button>
                  <button
                    onClick={() => declineOrder(order.id)}
                    disabled={processingOrder === order.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In Progress (UNPAID) */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <ChefHat className="w-5 h-5 mr-2 text-blue-600" />
          In Progress ({inProgress.length})
        </h3>
        {inProgress.length === 0 ? (
          <div className="text-center py-8">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders in progress</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {inProgress.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" /> Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Confirmed
                  </span>
                </div>
                {getPaymentStatusLabel(order.payment_status)}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-sm">{item.quantity}x {item.menu_item?.name}</span>
                      <span className="text-sm font-medium">{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateOrderPaymentStatus(order.id, 'paid')}
                    disabled={processingOrder === order.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >Mark Paid</button>
                  <button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    disabled={processingOrder === order.id}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >Complete Order</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paid - In Progress (CONFIRMED + PAID) */}
      <div className="bg-white rounded-xl shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-green-600" />
          Paid - In Progress ({paidInProgress.length})
        </h3>
        {paidInProgress.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No paid orders in progress</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {paidInProgress.map((order) => (
              <div key={order.id} className="border-2 border-green-200 rounded-xl p-6 bg-green-50 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" /> Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Confirmed
                  </span>
                </div>
                {getPaymentStatusLabel(order.payment_status)}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-sm">{item.quantity}x {item.menu_item?.name}</span>
                      <span className="text-sm font-medium">{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    disabled={processingOrder === order.id}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >Complete Order</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
          Completed Today ({completedOrders.length})
        </h3>
        {completedOrders.length === 0 ? (
          <div className="text-center py-8">
            <Utensils className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No completed orders today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {completedOrders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" /> Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    Completed
                  </span>
                </div>
                {getPaymentStatusLabel(order.payment_status)}
                <div className="text-sm text-gray-600">
                  Completed: {format(new Date(order.updated_at), 'MMM d, h:mm a')}
                </div>
                <div className="mt-2 font-semibold text-green-600">
                  {formatPrice(order.total_sgd)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancelled Orders */}
      <div className="bg-white rounded-xl shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Cancelled Orders ({cancelledOrders.length})</h3>
        {cancelledOrders.length === 0 ? (
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No cancelled orders today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {cancelledOrders.map((order) => (
              <div key={order.id} className="border border-red-200 rounded-xl p-6 bg-red-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" /> Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    {order.status === 'cancelled' ? 'Cancelled' : 'Declined'}
                  </span>
                </div>
                {getPaymentStatusLabel(order.payment_status)}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-sm">{item.quantity}x {item.menu_item?.name}</span>
                      <span className="text-sm font-medium">{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                  {order.items && order.items.length > 3 && (
                    <div className="text-sm text-gray-500">
                      +{order.items.length - 3} more items
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Cancelled: {format(new Date(order.updated_at), 'MMM d, h:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ...Order Detail Modal can go here as in your original if desired... */}
    </div>
  );
}
