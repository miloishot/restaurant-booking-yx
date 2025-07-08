import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RestaurantTable, Restaurant, OrderWithDetails } from '../types/database';
import { Users, MapPin, ShoppingCart, Clock, DollarSign, Eye, QrCode, ExternalLink } from 'lucide-react';

interface TableGridWithOrdersProps {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  onTableClick?: (table: RestaurantTable) => void;
  onMarkOccupied?: (table: RestaurantTable) => void;
  selectedTable?: RestaurantTable | null;
  showOccupiedButton?: boolean;
}

interface TableWithOrders extends RestaurantTable {
  activeOrders?: OrderWithDetails[];
  totalOrderValue?: number;
  orderCount?: number;
  sessionToken?: string;
}

const statusColors = {
  available: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200',
  occupied: 'bg-red-100 border-red-300 text-red-800',
  reserved: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  maintenance: 'bg-gray-100 border-gray-300 text-gray-800'
};

const statusIcons = {
  available: '✓',
  occupied: '●',
  reserved: '○',
  maintenance: '🔧'
};

export function TableGridWithOrders({ 
  restaurant,
  tables, 
  onTableClick, 
  onMarkOccupied,
  selectedTable, 
  showOccupiedButton = false 
}: TableGridWithOrdersProps) {
  const [tablesWithOrders, setTablesWithOrders] = useState<TableWithOrders[]>([]);
  const [selectedTableDetails, setSelectedTableDetails] = useState<TableWithOrders | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTablesWithOrders();
    const interval = setInterval(fetchTablesWithOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [tables, restaurant.id]);

  const fetchTablesWithOrders = async () => {
    try {
      setLoading(true);
      
      // Get all active order sessions for this restaurant
      const { data: sessions, error: sessionsError } = await supabase
        .from('order_sessions')
        .select(`
          *,
          orders:orders(
            *,
            items:order_items(
              *,
              menu_item:menu_items(*)
            )
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true);

      if (sessionsError) throw sessionsError;

      // Map tables with their order information
      const enhancedTables: TableWithOrders[] = tables.map(table => {
        const tableSession = sessions?.find(session => session.table_id === table.id);
        const activeOrders = tableSession?.orders?.filter(order => order.status !== 'paid') || [];
        
        const totalOrderValue = activeOrders.reduce((sum, order) => sum + order.total_sgd, 0);
        const orderCount = activeOrders.length;

        return {
          ...table,
          activeOrders,
          totalOrderValue,
          orderCount,
          sessionToken: tableSession?.session_token
        };
      });

      setTablesWithOrders(enhancedTables);
    } catch (error) {
      console.error('Error fetching tables with orders:', error);
      setTablesWithOrders(tables.map(table => ({ ...table })));
    } finally {
      setLoading(false);
    }
  };

  const handleTableAction = (table: TableWithOrders) => {
    if (showOccupiedButton && table.status === 'available' && onMarkOccupied) {
      onMarkOccupied(table);
    } else if (onTableClick) {
      onTableClick(table);
    }
  };

  const openQROrderingPage = (sessionToken: string) => {
    const url = `${window.location.origin}/order/${sessionToken}`;
    window.open(url, '_blank');
  };

  const formatPrice = (price: number) => {
    return `S$${price.toFixed(2)}`;
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'served':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((table) => (
          <div key={table.id} className="bg-gray-100 rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-1"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tablesWithOrders.map((table) => (
          <div
            key={table.id}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer
              ${statusColors[table.status]}
              ${selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : ''}
              ${(onTableClick || onMarkOccupied) ? 'hover:shadow-lg transform hover:scale-105' : ''}
            `}
            onClick={() => handleTableAction(table)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">{table.table_number}</h3>
              <div className="flex items-center space-x-1">
                {table.sessionToken && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openQROrderingPage(table.sessionToken!);
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Open QR Ordering"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                )}
                <span className="text-xl">{statusIcons[table.status]}</span>
              </div>
            </div>
            
            <div className="text-sm opacity-75 mb-3">
              <div className="flex items-center mb-1">
                <Users className="w-3 h-3 mr-1" />
                <span>Capacity: {table.capacity}</span>
              </div>
              <p className="capitalize font-medium">{table.status}</p>
              {table.location_notes && (
                <div className="flex items-center mt-1">
                  <MapPin className="w-3 h-3 mr-1" />
                  <p className="text-xs">{table.location_notes}</p>
                </div>
              )}
            </div>

            {/* Order Information */}
            {table.status === 'occupied' && table.orderCount! > 0 && (
              <div className="mt-3 p-2 bg-white bg-opacity-50 rounded border">
                <div className="flex items-center text-xs">
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  <span>{table.orderCount} order{table.orderCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center text-xs font-semibold">
                  <DollarSign className="w-3 h-3 mr-1" />
                  <span>{formatPrice(table.totalOrderValue!)}</span>
                </div>
              </div>
            )}

            {/* Latest order status */}
            {table.activeOrders && table.activeOrders.length > 0 && (
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full ${getOrderStatusColor(table.activeOrders[0].status)}`}>
                  {table.activeOrders[0].status}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTableDetails(table);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Details
                </button>
              </div>
            )}

            {/* Action Button for Walk-ins */}
            {showOccupiedButton && table.status === 'available' && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkOccupied?.(table);
                  }}
                  className="w-full px-3 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  Mark Occupied
                </button>
              </div>
            )}

            {/* Status indicator for occupied tables */}
            {table.status === 'occupied' && (
              <div className="mt-2 text-xs font-medium">
                {table.sessionToken ? (
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">QR Active</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openQROrderingPage(table.sessionToken!);
                      }}
                      className="text-blue-600 hover:text-blue-800 flex items-center text-xs"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Order
                    </button>
                  </div>
                ) : (
                  <span className="text-red-700">Walk-in Active</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Table Details Modal */}
      {selectedTableDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-90vh overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Table {selectedTableDetails.table_number} - Order Details
                  </h2>
                  <div className="flex items-center text-gray-600 mt-1">
                    <Users className="w-4 h-4 mr-1" />
                    Capacity: {selectedTableDetails.capacity}
                    {selectedTableDetails.location_notes && (
                      <>
                        <span className="mx-2">•</span>
                        <MapPin className="w-4 h-4 mr-1" />
                        {selectedTableDetails.location_notes}
                      </>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedTableDetails(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
                >
                  ×
                </button>
              </div>

              {/* QR Code Access */}
              {selectedTableDetails.sessionToken && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-blue-800">QR Ordering Active</h3>
                      <p className="text-sm text-blue-700">Customers can scan QR code to place orders</p>
                    </div>
                    <button
                      onClick={() => openQROrderingPage(selectedTableDetails.sessionToken!)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Ordering Page
                    </button>
                  </div>
                </div>
              )}

              {/* Active Orders */}
              {selectedTableDetails.activeOrders && selectedTableDetails.activeOrders.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Active Orders</h3>
                  
                  {selectedTableDetails.activeOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">Order #{order.order_number}</h4>
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <Clock className="w-4 h-4 mr-1" />
                            {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-2 mb-3">
                        {order.items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.menu_item?.name}</span>
                            <span>{formatPrice(item.total_price_sgd)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Order Total */}
                      <div className="border-t pt-2">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>{formatPrice(order.subtotal_sgd)}</span>
                        </div>
                        {order.discount_sgd > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Loyalty Discount</span>
                            <span>-{formatPrice(order.discount_sgd)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>{formatPrice(order.total_sgd)}</span>
                        </div>
                      </div>

                      {order.notes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <strong>Notes:</strong> {order.notes}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Table Bill</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatPrice(selectedTableDetails.totalOrderValue!)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No active orders for this table</p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedTableDetails(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}