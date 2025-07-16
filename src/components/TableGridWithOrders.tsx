import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  RestaurantTable,
  Restaurant,
  OrderWithDetails,
} from '../types/database';
import {
  Users,
  MapPin,
  ShoppingCart,
  Clock,
  DollarSign,
  Eye,
  QrCode,
  ExternalLink,
  Utensils,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TableGridWithOrdersProps {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  bookings?: BookingWithDetails[];
  onTableClick?: (table: RestaurantTable) => void;
  onMarkOccupied?: (table: RestaurantTable) => Promise<void>;
  onMarkAvailable?: (table: RestaurantTable) => Promise<void>;
  selectedTable?: RestaurantTable | null;
  showOccupiedButton?: boolean;
  onMarkPaid?: (table: RestaurantTable) => Promise<void>;
}

interface TableWithOrders extends RestaurantTable {
  activeOrders?: OrderWithDetails[];
  totalOrderValue?: number;
  orderCount?: number;
  sessionToken?: string;
  associatedBooking?: BookingWithDetails;
}

// ------------ Helper Components ------------

function StatusPill({ status }) {
  let color = '', label = '';
  switch (status) {
    case 'pending': color = 'bg-yellow-100 text-yellow-700'; label = 'Pending'; break;
    case 'confirmed': color = 'bg-blue-100 text-blue-700'; label = 'Confirmed'; break;
    case 'completed': color = 'bg-green-100 text-green-700'; label = 'Completed'; break;
    default: color = 'bg-gray-100 text-gray-600'; label = status;
  }
  return <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mr-2 ${color}`}>{label}</span>;
}
function PaymentStatusPill({ payment_status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
      ${payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
      <CreditCard className="w-3 h-3 mr-1" />
      {payment_status === "paid" ? "Paid" : "Unpaid"}
    </span>
  );
}
function Timeline({ status }) {
  const steps = ['pending', 'confirmed', 'completed'];
  return (
    <div className="text-xs text-gray-500 flex items-center space-x-4">
      {steps.map((s, idx) => (
        <React.Fragment key={s}>
          <span className={`
            px-3 py-1 rounded-full
            ${status === s
              ? s === "pending" ? "bg-yellow-100 text-yellow-800"
                : s === "confirmed" ? "bg-blue-100 text-blue-800"
                : "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
            }
          `}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          {idx < steps.length - 1 && <span>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
function formatPrice(price) {
  return `S$${price?.toFixed(2)}`;
}
function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 mb-3 transition-all duration-150">
      <div className="flex justify-between items-center">
        <div>
          <span className="font-bold">#{order.order_number}</span>
          <StatusPill status={order.status} />
          <PaymentStatusPill payment_status={order.payment_status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-green-600 text-lg">{formatPrice(order.total_sgd)}</span>
          <button
            onClick={() => setExpanded(x => !x)}
            className="ml-2 text-blue-900 border border-blue-200 rounded-full px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100"
            aria-label={expanded ? "Minimize" : "Expand"}
            type="button"
          >
            {expanded ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 animate-fade-in">
          <div className="space-y-3 mb-4">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="font-medium">{item.quantity}x {item.menu_item?.name}</span>
                <span className="font-semibold text-green-600">{formatPrice(item.total_price_sgd)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-300 pt-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-medium">{formatPrice(order.subtotal_sgd)}</span>
            </div>
            {order.discount_sgd > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Loyalty Discount</span>
                <span className="font-medium">-{formatPrice(order.discount_sgd)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg mt-2">
              <span>Total</span>
              <span className="text-green-600">{formatPrice(order.total_sgd)}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200">
            <Timeline status={order.status} />
            <div className="mt-2">
              <PaymentStatusPill payment_status={order.payment_status} />
            </div>
          </div>
          {order.notes && (
            <div className="mt-2 text-sm text-gray-600">
              <strong>Notes:</strong> {order.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------ Main Component ------------
export function TableGridWithOrders({
  restaurant,
  tables,
  bookings = [],
  onTableClick,
  onMarkOccupied,
  onMarkAvailable,
  selectedTable,
  showOccupiedButton = false,
  onMarkPaid,
}) {
  const [tablesWithOrders, setTablesWithOrders] = useState([]);
  const [selectedTableDetails, setSelectedTableDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTablesWithOrders();
    const interval = setInterval(fetchTablesWithOrders, 30000);
    return () => clearInterval(interval);
  }, [tables, restaurant.id]);

  const fetchTablesWithOrders = async () => {
    try {
      setLoading(true);
      const { data: sessions, error: sessionsError } = await supabase
        .from('order_sessions')
        .select(`
          *,
          orders:orders!inner(
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
      const enhancedTables = tables.map(table => {
        const tableSession = sessions?.find(session => session.table_id === table.id);
        const activeOrders = tableSession?.orders || [];
        const associatedBooking = bookings.find(booking =>
          booking.table_id === table.id && ['confirmed', 'seated'].includes(booking.status));
        const totalOrderValue = activeOrders.reduce((sum, order) => sum + order.total_sgd, 0);
        const orderCount = activeOrders.length;
        return {
          ...table,
          activeOrders,
          totalOrderValue,
          orderCount,
          sessionToken: tableSession?.session_token,
          associatedBooking,
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

  const handleTableAction = (table) => {
    if (showOccupiedButton && table.status === 'available' && onMarkOccupied) {
      onMarkOccupied(table);
    } else if (onTableClick) {
      onTableClick(table);
    }
  };
  const openQROrderingPage = (sessionToken) => {
    const url = `${window.location.origin}/order/${sessionToken}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tables.map((table) => (
          <div key={table.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tablesWithOrders.map((table) => (
          <div
            key={table.id}
            className={`
              relative p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer shadow-sm
              ${table.status === 'available' ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                : table.status === 'occupied' ? 'bg-orange-50 border-orange-200'
                  : table.status === 'reserved' ? 'bg-blue-50 border-blue-200'
                    : table.status === 'maintenance' ? 'bg-gray-50 border-gray-300'
                      : 'bg-white border-gray-200'}
              ${selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : ''}
              ${(onTableClick || onMarkOccupied) ? 'hover:shadow-lg transform hover:-translate-y-1' : ''}
            `}
            onClick={() => handleTableAction(table)}
          >
            {/* Table Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-gray-600" />
                </div>
                <h3 className="font-bold text-lg text-gray-900">Table {table.table_number}</h3>
              </div>
              <div className="flex items-center space-x-1">
                {table.sessionToken && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openQROrderingPage(table.sessionToken!);
                    }}
                    className="p-1.5 text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 rounded-lg hover:bg-blue-100"
                    title="Open QR Ordering"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Status Badge */}
            <div className="mb-4">
              <span className={`
                inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                ${table.status === 'available' ? 'bg-green-100 text-green-700'
                  : table.status === 'occupied' ? 'bg-orange-100 text-orange-700'
                    : table.status === 'reserved' ? 'bg-blue-100 text-blue-700'
                      : table.status === 'maintenance' ? 'bg-gray-100 text-gray-700'
                        : 'bg-gray-100 text-gray-700'}
              `}>
                {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
              </span>
            </div>
            {/* Table Info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                <span>Capacity: {table.capacity} guests</span>
              </div>
              {table.location_notes && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="text-xs">{table.location_notes}</span>
                </div>
              )}
            </div>
            {/* Order Information */}
            {table.orderCount > 0 && (
              <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    <span>{table.orderCount} order{table.orderCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center text-sm font-semibold text-green-600">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span>{formatPrice(table.totalOrderValue || 0)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {table.activeOrders && table.activeOrders
                    .filter(order => ['pending', 'confirmed', 'completed'].includes(order.status))
                    .slice(0, 2)
                    .map(order => (
                      <span key={order.id} className={`
                        text-xs px-2 py-1 rounded-full 
                        ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800'
                          : order.status === 'confirmed' ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'}
                      `}>
                        #{order.order_number}
                      </span>
                    ))}
                  {table.activeOrders && table.activeOrders.length > 2 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      +{table.activeOrders.length - 2}
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Action Buttons */}
            {table.activeOrders && table.activeOrders.length > 0 ? (
              <div className="flex justify-center">
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTableDetails(table);
                    }}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkPaid?.(table);
                    }}
                    className="flex items-center px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Mark Paid
                  </button>
                </div>
              </div>
            ) : null}

            {/* Action Button for Walk-ins */}
            {showOccupiedButton && (
              <div className="mt-4">
                {table.status === 'available' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkOccupied?.(table);
                    }}
                    className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    Mark Occupied
                  </button>
                ) : table.status === 'occupied' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAvailable?.(table);
                    }}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    Mark Available
                  </button>
                ) : null}
              </div>
            )}

            {/* Status indicator for occupied tables */}
            {table.status === 'occupied' && (
              <div className="mt-4 text-sm">
                {table.sessionToken ? (
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 font-medium">
                      {table.associatedBooking
                        ? (table.associatedBooking.is_walk_in ? 'Walk-in + QR' : 'Booking + QR')
                        : 'QR Active'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openQROrderingPage(table.sessionToken!);
                      }}
                      className="flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Order
                    </button>
                  </div>
                ) : (
                  <span className="text-red-600 font-medium">
                    {table.associatedBooking
                      ? (table.associatedBooking.is_walk_in ? 'Walk-in Active' : 'Booking Active')
                      : 'Occupied'}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Order Details Modal */}
      {selectedTableDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-90vh overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Table {selectedTableDetails.table_number} - Order Details
                  </h2>
                  <div className="flex items-center text-gray-600 mt-2">
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
                  className="text-gray-400 hover:text-gray-600 transition-colors text-3xl font-light"
                >
                  ×
                </button>
              </div>
              {selectedTableDetails.sessionToken && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-blue-900">QR Ordering Active</h3>
                      <p className="text-sm text-blue-700">Customers can scan QR code to place orders</p>
                    </div>
                    <button
                      onClick={() => openQROrderingPage(selectedTableDetails.sessionToken!)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Ordering Page
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900">Order History</h3>
                {(() => {
                  const ordersToShow = (selectedTableDetails.activeOrders ?? [])
                    .filter(order => ['pending', 'confirmed', 'completed'].includes(order.status));
                  if (ordersToShow.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-400">
                        No orders to display for this table.
                      </div>
                    );
                  }
                  return ordersToShow.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ));
                })()}
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setSelectedTableDetails(null)}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
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
