import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { useAuth } from '../hooks/useAuth';
import { TableGridWithOrders } from './TableGridWithOrders';
import { WalkInLogger } from './WalkInLogger';
import { BookingList } from './BookingList';
import { WaitingListManager } from './WaitingListManager';
import { OperatingHoursManager } from './OperatingHoursManager';
import { BookingAnalytics } from './BookingAnalytics';
import { StaffOrderManagement } from './qr-ordering/StaffOrderManagement';
import { MenuManagement } from './MenuManagement';
import { QRCodeGenerator } from './QRCodeGenerator';
import { LoyaltyManagement } from './LoyaltyManagement';
import { RestaurantSetup } from './RestaurantSetup';
import { StaffTimeTracking } from './StaffTimeTracking';
import { RestaurantTable } from '../types/database';
import { Settings, Users, Calendar, Clock, RefreshCw, Building, AlertCircle, BarChart3, ChefHat, QrCode, Crown, Lock, ChevronLeft } from 'lucide-react';
import { StaffManagement } from './StaffManagement';

export function RestaurantDashboard() {
  const { employeeProfile, loading: authLoading } = useAuth();
  const { 
    restaurant, 
    tables, 
    bookings, 
    waitingList, 
    operatingHours, 
    loading, 
    error, 
    updateTableStatus, 
    updateBookingStatus, 
    assignTableToBooking, 
    promoteFromWaitingList,
    cancelWaitingListEntry,
    markTableOccupiedWithSession,
    refetch 
  } = useRestaurantData();
  
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showWalkInLogger, setShowWalkInLogger] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'tables' | 'waiting' | 'hours' | 'analytics' | 'orders' | 'menu' | 'loyalty' | 'setup' | 'staff' | 'staffManagement'>('bookings');
  const [refreshing, setRefreshing] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ table: RestaurantTable; action: 'occupied' | 'available' } | null>(null);

  // PIN modal state
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState<string | null>(null);

  // Fetch owner PIN from Supabase for PIN modal
  useEffect(() => {
    async function fetchOwnerPin() {
      if (restaurant && restaurant.id) {
        const { data, error } = await supabase
          .from('restaurants')
          .select('owner_pin')
          .eq('id', restaurant.id)
          .single();
        if (data?.owner_pin !== undefined) setOwnerPin(data.owner_pin);
      }
    }
    fetchOwnerPin();
  }, [restaurant]);

  // Real-time order updates
  useEffect(() => {
    if (!restaurant) return;
    const channel = supabase
      .channel('orders_count')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id} AND status=eq.pending`
      }, () => {
        setNewOrderCount(prev => prev + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  // Manual refresh for all dashboard data
  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch(); 
    } finally {
      setRefreshing(false);
    }
  };

  // Waiting list actions
  const handlePromoteFromWaitingList = async (waitingListId: string) => {
    try {
      return await promoteFromWaitingList(waitingListId);
    } catch (error) {
      throw error;
    }
  };

  const handleCancelWaiting = async (waitingListId: string) => {
    try {
      return await cancelWaitingListEntry(waitingListId);
    } catch (error) {
      throw error;
    }
  };

  // Table occupancy status change with confirmation dialog
  const handleTableStatusToggle = (table: RestaurantTable, newStatus: 'occupied' | 'available') => {
    setShowConfirmDialog({ table, action: newStatus });
  };

  const confirmTableStatusChange = async () => {
    if (!showConfirmDialog) return;
    const { table, action } = showConfirmDialog;
    try {
      if (action === 'occupied') {
        await markTableOccupiedWithSession(
          table, 
          2, 
          generateQRCodeHtml, 
          showNotification
        );
      } else {
        await updateTableStatus(table.id, 'available');
      }
      await refetch();
    } finally {
      setShowConfirmDialog(null);
    }
  };

  // PIN access for Setup tab
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ownerPin) {
      setShowPinPrompt(false);
      setPinError(null);
      setPin('');
      setActiveTab('setup');
    } else {
      setPinError('Incorrect PIN. Please try again.');
    }
  };

  // Table marking & payment
  const handleMarkOccupied = async (table: RestaurantTable) => {
    try {
      await markTableOccupiedWithSession(table, 2, generateQRCodeHtml, showNotification);
      await refetch();
    } catch {
      alert('Failed to mark table occupied. Please try again.');
    }
  };

  // Function to generate QR code HTML for printing
  const generateQRCodeHtml = (tableNumber: string, qrCodeUrl: string) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - Table ${tableNumber}</title>
        <style>
          body { font-family: monospace; text-align: center; margin: 0; padding: 0; width: 100%; }
          .receipt { width: 100%; max-width: 300px; margin: 0 auto; padding: 10px 0; }
          .header { font-size: 14px; font-weight: bold; margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
          .table-info { font-size: 18px; font-weight: bold; margin: 10px 0; }
          .qr-code { margin: 15px 0; }
          .instructions { font-size: 12px; margin: 10px 0; }
          .timestamp { font-size: 10px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            ${restaurant?.name || 'Restaurant'}
          </div>
          <div class="table-info">TABLE ${tableNumber}</div>
          <div class="qr-code">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code for Table ${tableNumber}" width="200" height="200" />
          </div>
          <div class="instructions">SCAN THIS CODE TO ORDER FOOD & DRINKS DIRECTLY FROM YOUR PHONE</div>
          <div class="divider"></div>
          <div class="instructions">No app download required Just scan and browse our menu</div>
          <div class="timestamp">Printed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
        </div>
      </body>
      </html>
    `;
  };

  // Show notifications
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 
      type === 'error' ? 'bg-red-500 text-white' : 
      'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  const handleMarkPaid = async (table: RestaurantTable) => {
    try {
      await deactivateTableQRSession(table.id);
      await updateTableStatus(table.id, 'available');
      await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('table_id', table.id)
        .in('status', ['seated', 'confirmed']);
      await refetch();
    } catch {
      alert('Failed to mark table as paid. Please try again.');
    }
  };

  // End an active QR order session for a table
  const deactivateTableQRSession = async (tableId: string) => {
    const { data: sessions } = await supabase
      .from('order_sessions')
      .select('id')
      .eq('table_id', tableId)
      .eq('is_active', true);
    if (sessions && sessions.length > 0) {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('session_id', sessions[0].id)
        .neq('payment_status', 'paid');
    }
    await supabase
      .from('order_sessions')
      .update({ is_active: false })
      .eq('table_id', tableId);
  };

  // Status update for tables
  const handleTableStatusUpdate = async (table: RestaurantTable, status: RestaurantTable['status']) => {
    try {
      if (status === 'available') {
        await deactivateTableQRSession(table.id);
      }
      await updateTableStatus(table.id, status);
    } catch {
      alert('Failed to update table status. Please try again.');
    }
  };

  // Booking status change
  const handleBookingStatusUpdate = async (bookingId: string, status: any) => {
    try {
      return await updateBookingStatus(bookingId, status);
    } catch (err) {
      throw err;
    }
  };

  // Assign table to booking
  const handleTableAssignment = async (bookingId: string, tableId: string) => {
    try {
      return await assignTableToBooking(bookingId, tableId);
    } catch (err) {
      throw err;
    }
  };

  // Filter active bookings
  const activeBookings = bookings.filter(booking => 
    ['pending', 'confirmed', 'seated'].includes(booking.status) && !booking.is_walk_in
  );
  
  const todaysBookings = bookings.filter(booking => 
    booking.booking_date === new Date().toISOString().split('T')[0] && !booking.is_walk_in
  );

  const pendingBookings = todaysBookings.filter(b => b.status === 'pending');
  const waitlistBookings = todaysBookings.filter(b => b.was_on_waitlist);

  const stats = {
    totalTables: tables.length,
    availableTables: tables.filter(t => t.status === 'available').length,
    occupiedTables: tables.filter(t => t.status === 'occupied').length,
    pendingBookings: pendingBookings.length,
    waitingCustomers: waitingList.length,
    waitlistBookings: waitlistBookings.length
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurant data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={handleManualRefresh}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Restaurant Found</h2>
          <p className="text-gray-600">Please ensure your database is properly set up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" key={restaurant?.id || 'no-restaurant'}>
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{restaurant?.name || 'Loading...'}</h1>
              <p className="text-sm text-gray-600">Restaurant Management Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString()}
              </span>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
          {/* ...stat cards as in original... */}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {/* All navigation tabs except Setup */}
            <button onClick={() => setActiveTab('bookings')} className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>Bookings ({activeBookings.length})</button>
            <button onClick={() => setActiveTab('waiting')} className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'waiting'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>Waiting List ({waitingList.length})</button>
            <button onClick={() => setActiveTab('orders')} className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}><ChefHat className="w-4 h-4 inline mr-1" />Orders ({newOrderCount})</button>
            <button onClick={() => setActiveTab('menu')} className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'menu'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>Menu & QR Codes</button>
            <button onClick={() => setActiveTab('loyalty')} className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'loyalty'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}><Crown className="w-4 h-4 inline mr-1" />Loyalty</button>
            <button
              onClick={() => {
                if (employeeProfile?.role === 'owner') {
                  setShowPinPrompt(true);
                }
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'setup'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } ${
                employeeProfile?.role !== 'owner'
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={employeeProfile?.role !== 'owner'}
            >
              <Building className="w-4 h-4 inline mr-1" />Setup
            </button>
            {/* ...other navigation buttons... */}
          </nav>
        </div>

        {/* Page Content */}
        {activeTab === 'bookings' && (
          <BookingList 
            bookings={activeBookings} 
            tables={tables}
            onUpdateBooking={handleBookingStatusUpdate}
            onAssignTable={handleTableAssignment}
          />
        )}
        {/* ...other tab content as in original... */}
        {activeTab === 'setup' && employeeProfile?.role === 'owner' && (
          <RestaurantSetup />
        )}
      </div>

      {/* PIN Prompt Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <button
              onClick={() => setShowPinPrompt(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Setup Access</h2>
              <p className="text-gray-600 mt-2">Enter your 6-digit PIN to access setup</p>
            </div>
            {pinError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-sm text-red-700">{pinError}</p>
              </div>
            )}
            <form onSubmit={handlePinSubmit}>
              <div className="mb-6">
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  maxLength={6}
                  pattern="\d{6}"
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="******"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-3">
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Access Setup
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinPrompt(false)}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Confirm Table Status Change
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to mark Table {showConfirmDialog.table.table_number} as{' '}
                <strong>{showConfirmDialog.action}</strong>?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmDialog(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmTableStatusChange}
                  className={`flex-1 px-4 py-2 rounded-md text-white transition-colors ${
                    showConfirmDialog.action === 'occupied'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walk-In Logger Modal */}
      {showWalkInLogger && selectedTable && (
        <WalkInLogger
          restaurant={restaurant}
          table={selectedTable}
          onSuccess={async () => {
            setShowWalkInLogger(false);
            setSelectedTable(null);
            await refetch();
          }}
          onCancel={() => {
            setShowWalkInLogger(false);
            setSelectedTable(null);
          }}
        />
      )}
    </div>
  );
}
