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
  RefreshCw
} from 'lucide-react';

interface StaffOrderManagementProps {
  restaurant: Restaurant;
}

export function StaffOrderManagement({ restaurant }: StaffOrderManagementProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
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
        .neq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
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
      notification.textContent = `Order status updated to ${status}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

      await fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status. Please try again.');
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
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'preparing':
        return <ChefHat className="w-4 h-4" />;
      case 'ready':
        return <Utensils className="w-4 h-4" />;
      case 'served':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return 'confirmed';
      case 'confirmed':
        return 'preparing';
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'served';
      case 'served':
        return 'paid';
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return 'Confirm Order';
      case 'confirmed':
        return 'Start Preparing';
      case 'preparing':
        return 'Mark Ready';
      case 'ready':
        return 'Mark Served';
      case 'served':
        return 'Mark Paid';
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

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Orders</h3>
          <p className="text-gray-600">New orders will appear here when customers place them</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">Order #{order.order_number}</h3>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      Table {order.session?.table?.table_number}
                      {order.session?.booking && (
                        <>
                          <span className="mx-2">•</span>
                          <Users className="w-3 h-3 mr-1" />
                          {order.session.booking.party_size} guests
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                    <div className="flex items-center">
                      {getStatusIcon(order.status)}
                      <span className="ml-1 capitalize">{order.status}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  Ordered: {format(new Date(order.created_at), 'h:mm a')}
                </div>
              </div>
              
              <div className="p-4">
                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.menu_item?.name}</span>
                      <span>{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                  {order.items && order.items.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{order.items.length - 3} more items
                    </div>
                  )}
                </div>
                
                {/* Loyalty Discount */}
                {order.discount_applied && (
                  <div className="flex items-center text-sm text-green-600 mb-2">
                    <Tag className="w-3 h-3 mr-1" />
                    <span>10% Loyalty Discount Applied</span>
                  </div>
                )}
                
                {/* Total */}
                <div className="border-t pt-2 mb-4">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(order.total_sgd)}</span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                  
                  {getNextStatus(order.status) && (
                    <button
                      onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                      disabled={processingOrder === order.id}
                      className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {processingOrder === order.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        getStatusIcon(getNextStatus(order.status)!)
                      )}
                      <span className="ml-2">{getNextStatusLabel(order.status)}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-90vh overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Order #{selectedOrder.order_number}</h2>
                  <div className="flex items-center text-gray-600 mt-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    Table {selectedOrder.session?.table?.table_number}
                    <span className="mx-2">•</span>
                    <Clock className="w-4 h-4 mr-1" />
                    {format(new Date(selectedOrder.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
              
              {/* Order Items */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">{item.menu_item?.name}</span>
                          <span className="font-semibold">{formatPrice(item.total_price_sgd)}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Quantity: {item.quantity} × {formatPrice(item.unit_price_sgd)}
                        </div>
                        {item.special_instructions && (
                          <div className="text-sm text-orange-600 mt-1">
                            <strong>Special:</strong> {item.special_instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Loyalty Information */}
              {selectedOrder.discount_applied && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center text-green-800 mb-2">
                    <Tag className="w-4 h-4 mr-2" />
                    <span className="font-medium">Loyalty Discount Applied</span>
                  </div>
                  <div className="text-sm text-green-700">
                    <p>Triggering User ID: {selectedOrder.triggering_user_id}</p>
                    <p>Discount Amount: {formatPrice(selectedOrder.discount_sgd)}</p>
                  </div>
                </div>
              )}
              
              {/* Order Total */}
              <div className="border-t pt-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal_sgd)}</span>
                  </div>
                  {selectedOrder.discount_sgd > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Loyalty Discount</span>
                      <span>-{formatPrice(selectedOrder.discount_sgd)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold border-t pt-2">
                    <span>Total</span>
                    <span>{formatPrice(selectedOrder.total_sgd)}</span>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex space-x-4">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
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