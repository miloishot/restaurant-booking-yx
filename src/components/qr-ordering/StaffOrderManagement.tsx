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
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'paid':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'paid':
        return <CreditCard className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl shadow-lg p-12 text-center border border-blue-200">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ChefHat className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">No Active Orders</h3>
          <p className="text-gray-600 text-lg mb-4">Your kitchen is all caught up!</p>
          <p className="text-sm text-blue-600">New orders will appear here when customers place them via QR code</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-xl text-gray-800">#{order.order_number}</h3>
                    <div className="flex items-center text-sm text-gray-500 mt-2">
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
                  
                  <div className={`px-3 py-2 rounded-full text-sm font-semibold border-2 ${getStatusColor(order.status)}`}>
                    <div className="flex items-center">
                      {getStatusIcon(order.status)}
                      <span className="ml-2 capitalize">{order.status}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center text-xs text-gray-400 mt-3">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>Ordered at {format(new Date(order.created_at), 'h:mm a')}</span>
                </div>
              </div>
              
              <div className="p-6">
                {/* Order Items */}
                <div className="space-y-3 mb-6">
                  {order.items?.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-b-0">
                      <div className="flex items-center">
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full mr-3">
                          {item.quantity}
                        </span>
                        <span className="font-medium text-gray-800">{item.menu_item?.name}</span>
                      </div>
                      <span className="font-semibold text-green-600">{formatPrice(item.total_price_sgd)}</span>
                    </div>
                  ))}
                  {order.items && order.items.length > 3 && (
                    <div className="text-center py-2">
                      <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        +{order.items.length - 3} more items
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Loyalty Discount */}
                {order.discount_applied && (
                  <div className="flex items-center text-sm text-green-600 mb-4 bg-green-50 p-3 rounded-lg">
                    <Tag className="w-3 h-3 mr-1" />
                    <span className="font-medium">10% Loyalty Discount Applied</span>
                  </div>
                )}
                
                {/* Total */}
                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-700">Total</span>
                    <span className="text-2xl font-bold text-green-600">{formatPrice(order.total_sgd)}</span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                  
                  {getNextStatus(order.status) && (
                    <button
                      onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                      disabled={processingOrder === order.id}
                      className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 ${
                        order.status === 'pending' 
                          ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {processingOrder === order.id ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        getStatusIcon(getNextStatus(order.status)!)
                      )}
                      <span className="ml-2 font-bold">{getNextStatusLabel(order.status)}</span>
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