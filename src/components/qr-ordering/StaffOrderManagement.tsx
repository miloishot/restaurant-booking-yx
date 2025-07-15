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
  Eye, 
  Users,
  MapPin,
  Tag,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface StaffOrderManagementProps {
  restaurant: Restaurant;
  onOrderCountChange?: (count: number) => void;
}

export function StaffOrderManagement({ restaurant, onOrderCountChange }: StaffOrderManagementProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  // Notify parent component of order count changes
  useEffect(() => {
    const newOrderCount = orders.filter(o => o.status === 'pending').length;
    onOrderCountChange?.(newOrderCount);
  }, [orders, onOrderCountChange]);

  useEffect(() => {
    fetchOrders();
    fetchCompletedOrders();
    subscribeToOrders();
  }, [restaurant.id]);

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
        .order('created_at', { ascending: false });

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
        .in('status', ['completed', 'paid'])
        .gte('created_at', today)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setCompletedOrders(data || []);
    } catch (err) {
      console.error('Error fetching completed orders:', err);
    }
  };

  const subscribeToOrders = () => {
    const channel = supabase
      .channel('orders_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`
      }, () => {
        console.log('Order changed, refreshing...');
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

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
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `Order ${status === 'confirmed' ? 'accepted' : status === 'served' ? 'marked as served' : 'updated'}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

      await fetchOrders();
      if (status === 'completed' || status === 'paid') {
        await fetchCompletedOrders();
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
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
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Order declined';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

      await fetchOrders();
    } catch (err) {
      console.error('Error declining order:', err);
      alert('Failed to decline order. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  const formatPrice = (price: number) => {
    return `S$${price.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'preparing':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'served':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'confirmed':
        return <AlertCircle className="w-4 h-4" />;
      case 'preparing':
        return <ChefHat className="w-4 h-4" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4" />;
      case 'served':
        return <Utensils className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return 'confirmed';
      case 'confirmed':
        return 'completed';
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return 'Accept Order';
      case 'confirmed':
        return 'Mark as Completed';
      default:
        return null;
    }
  };

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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <ChefHat className="w-5 h-5 mr-2" />
              Order Management
            </h2>
            <p className="text-gray-600">Manage incoming orders and track preparation status</p>
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <div className="mt-2 flex items-center text-red-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span className="font-medium">{orders.filter(o => o.status === 'pending').length} new orders awaiting acceptance</span>
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

      {/* New Orders Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          New Orders ({orders.filter(o => o.status === 'pending').length})
        </h3>
        
        {orders.filter(o => o.status === 'pending').length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-600">No new orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.filter(o => o.status === 'pending').map((order) => (
              <div key={order.id} className="border-2 border-yellow-200 rounded-xl p-6 bg-yellow-50">
                {/* Order card content */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" />
                      Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    New Order
                  </span>
                </div>
                
                {/* Order items */}
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
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineOrder(order.id)}
                    disabled={processingOrder === order.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In Progress Orders Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          In Progress ({orders.filter(o => o.status === 'confirmed').length})
        </h3>
        
        {orders.filter(o => o.status === 'confirmed').length === 0 ? (
          <div className="text-center py-8">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders in progress</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.filter(o => o.status === 'confirmed').map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                {/* Existing order card content with updated actions */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg">#{order.order_number}</h4>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="w-3 h-3 mr-1" />
                      Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                
                {/* Order items */}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-sm">{item.quantity}x {item.menu_item?.name}</span>
                      <span className="text-sm font-medium">{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                </div>
                
                {getNextStatus(order.status) && (
                  <button
                    onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                    disabled={processingOrder === order.id}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {getNextStatusLabel(order.status)}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
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
                      <MapPin className="w-3 h-3 mr-1" />
                      Table {order.session?.table?.table_number}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Served
                  </span>
                </div>
                
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-90vh overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800">Order #{selectedOrder.order_number}</h2>
                  <div className="flex items-center text-gray-600 mt-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    Table {selectedOrder.session?.table?.table_number}
                    <span className="mx-2">•</span>
                    <Clock className="w-4 h-4 mr-1" />
                    {format(new Date(selectedOrder.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-3xl font-light"
                >
                  ×
                </button>
              </div>
              
              {/* Order Items */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Order Items</h3>
                <div className="space-y-4">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-lg text-gray-800">{item.menu_item?.name}</span>
                          <span className="font-bold text-xl text-green-600">{formatPrice(item.total_price_sgd)}</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                            {item.quantity} × {formatPrice(item.unit_price_sgd)}
                          </span>
                        </div>
                        {item.special_instructions && (
                          <div className="text-sm text-orange-700 mt-2 bg-orange-50 p-2 rounded-lg border border-orange-200">
                            <strong>Special Instructions:</strong> {item.special_instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Loyalty Information */}
              {selectedOrder.discount_applied && (
                <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                  <div className="flex items-center text-green-800 mb-3">
                    <Tag className="w-4 h-4 mr-2" />
                    <span className="font-bold text-lg">Loyalty Discount Applied</span>
                  </div>
                  <div className="text-green-700">
                    <p>Triggering User ID: {selectedOrder.triggering_user_id}</p>
                    <p>Discount Amount: {formatPrice(selectedOrder.discount_sgd)}</p>
                  </div>
                </div>
              )}
              
              {/* Order Total */}
              <div className="border-t-2 border-gray-200 pt-6 mb-8">
                <div className="space-y-3 bg-gray-50 p-6 rounded-xl">
                  <div className="flex justify-between">
                    <span className="text-lg font-medium">Subtotal</span>
                    <span className="text-lg font-semibold">{formatPrice(selectedOrder.subtotal_sgd)}</span>
                  </div>
                  {selectedOrder.discount_sgd > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-lg font-medium">Loyalty Discount</span>
                      <span className="text-lg font-semibold">-{formatPrice(selectedOrder.discount_sgd)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-2xl font-bold border-t-2 border-gray-300 pt-3">
                    <span className="text-gray-800">Total</span>
                    <span className="text-green-600">{formatPrice(selectedOrder.total_sgd)}</span>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex space-x-6">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                >
                  Close
                </button>
                
                {getNextStatus(selectedOrder.status) && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!);
                      setSelectedOrder(null);
                    }}
                    disabled={processingOrder === selectedOrder.id}
                    className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 ${
                      selectedOrder.status === 'pending'
                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {getNextStatusLabel(selectedOrder.status)}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}