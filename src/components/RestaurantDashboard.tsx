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
import { Settings, Users, Clock, RefreshCw, Building, AlertCircle, BarChart3, ChefHat, Crown, Lock, ChevronLeft, Menu as MenuIcon, X as CloseIcon } from 'lucide-react';
import { StaffManagement } from './StaffManagement';

export function RestaurantDashboard() {
  const { user, employeeProfile, loading: authLoading } = useAuth();
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

  // PIN Modal State
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState<string | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch owner PIN from database
  useEffect(() => {
    if (!restaurant?.id) return;
    const fetchOwnerPin = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('owner_pin')
        .eq('id', restaurant.id)
        .single();
      setOwnerPin(data?.owner_pin || null);
    };
    fetchOwnerPin();
  }, [restaurant?.id]);

  // Subscribe to real-time order updates
  useEffect(() => {
    if (!restaurant) return;
    const channel = supabase
      .channel('orders_count')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id} AND status=eq.pending`
      }, () => setNewOrderCount(prev => prev + 1))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [restaurant?.id]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  };

  const handlePromoteFromWaitingList = async (waitingListId: string) => {
    try { return await promoteFromWaitingList(waitingListId); }
    catch (error) { throw error; }
  };

  const handleCancelWaiting = async (waitingListId: string) => {
    try { return await cancelWaitingListEntry(waitingListId); }
    catch (error) { throw error; }
  };

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

  // PIN Submission - checks PIN against ownerPin from DB
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

  const handleMarkOccupied = async (table: RestaurantTable) => {
    try {
      await markTableOccupiedWithSession(table, 2, generateQRCodeHtml, showNotification);
      await refetch();
    } catch { alert('Failed to mark table occupied. Please try again.'); }
  };

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
    } catch { alert('Failed to mark table as paid. Please try again.'); }
  };

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

  const handleTableStatusUpdate = async (table: RestaurantTable, status: RestaurantTable['status']) => {
    try {
      if (status === 'available') await deactivateTableQRSession(table.id);
      await updateTableStatus(table.id, status);
    } catch { alert('Failed to update table status. Please try again.'); }
  };

  const handleBookingStatusUpdate = async (bookingId: string, status: any) => {
    try { return await updateBookingStatus(bookingId, status); }
    catch (err) { throw err; }
  };

  const handleTableAssignment = async (bookingId: string, tableId: string) => {
    try { return await assignTableToBooking(bookingId, tableId); }
    catch (err) { throw err; }
  };

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

  // Sidebar navigation items
  const navItems = [
    { label: `Bookings (${activeBookings.length})`, tab: 'bookings', icon: Users, show: true },
    { label: `Orders (${newOrderCount})`, tab: 'orders', icon: ChefHat, show: true },
    { label: 'Table Management', tab: 'tables', icon: Users, show: true },
    { label: 'Menu & QR Codes', tab: 'menu', icon: ChefHat, show: true },
    // { label: 'Loyalty', tab: 'loyalty', icon: Crown, show: true },
    { label: 'Setup', tab: 'setup', icon: Building, show: true, ownerOnly: true },
    { label: 'Staff', tab: 'staff', icon: Clock, show: true },
    { label: 'Analytics', tab: 'analytics', icon: BarChart3, show: true, staffNot: true },
    { label: 'Operating Hours', tab: 'hours', icon: Settings, show: true },
  ];

  return (
    <div className="bg-gray-50 min-h-screen flex">
      {/* Sidebar! */}
      <aside
        className={`
          fixed z-40 inset-y-0 left-0 w-64 bg-white border-r flex flex-col transition-transform
          transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:inset-0
        `}
        style={{ transitionProperty: 'transform' }}
      >
        <div className="flex items-center h-16 px-6 border-b">
          <span className="font-bold text-xl text-blue-600">{restaurant?.name}</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden p-2 text-gray-500 hover:text-blue-600"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 flex flex-col py-4 px-2 space-y-2">
          {navItems.filter(item => !item.ownerOnly || employeeProfile?.role === 'owner')
                   .filter(item => !item.staffNot || employeeProfile?.role !== 'staff')
                   .map(({ label, tab, icon: Icon, ...rest }) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'setup') {
                  if (employeeProfile?.role === 'owner') setShowPinPrompt(true);
                  return;
                }
                setActiveTab(tab);
                setSidebarOpen(false); // close sidebar on mobile
              }}
              className={`flex items-center px-4 py-2 rounded-lg text-left font-medium text-sm transition 
                ${activeTab === tab 
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'} 
                ${rest.ownerOnly && employeeProfile?.role !== 'owner' ? 'opacity-50 cursor-not-allowed' : ''}
                ${rest.staffNot && employeeProfile?.role === 'staff' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={rest.ownerOnly && employeeProfile?.role !== 'owner'}
            >
              <Icon className="w-5 h-5 mr-3" />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-4 pb-4 mt-auto">
          <span className="text-xs text-gray-400">{new Date().toLocaleDateString()}</span>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm border-b h-16 flex items-center pl-4 pr-8">
          {/* Hamburger */}
          <button
            className="md:hidden p-2 mr-4"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon className="w-6 h-6 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{restaurant?.name || 'Loading...'}</h1>
            <p className="text-sm text-gray-600">Restaurant Management Dashboard</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Settings className="w-5 h-5 text-gray-400" />
          </div>
        </header>

        <main className="flex-1 overflow-x-auto py-8 px-2 md:px-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Users className="w-6 h-6 text-blue-600" />
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Total Tables</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalTables}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">✓</span>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Available</p>
                  <p className="text-xl font-bold text-green-600">{stats.availableTables}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-sm">●</span>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Occupied</p>
                  <p className="text-xl font-bold text-red-600">{stats.occupiedTables}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Clock className="w-6 h-6 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.pendingBookings}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Waiting</p>
                  <p className="text-xl font-bold text-purple-600">{stats.waitingCustomers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-sm">W</span>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">From Waitlist</p>
                  <p className="text-xl font-bold text-indigo-600">{stats.waitlistBookings}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'bookings' && (
            <BookingList bookings={activeBookings} tables={tables} onUpdateBooking={handleBookingStatusUpdate} onAssignTable={handleTableAssignment} />
          )}
          {activeTab === 'waiting' && (
            <WaitingListManager waitingList={waitingList} onPromoteCustomer={handlePromoteFromWaitingList} onCancelWaiting={handleCancelWaiting} />
          )}
          {activeTab === 'orders' && (
            <StaffOrderManagement restaurant={restaurant} onOrderCountChange={setNewOrderCount} />
          )}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              {employeeProfile?.role === 'staff' ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ChefHat className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Restricted</h3>
                  <p className="text-gray-600">
                    Only restaurant owners and managers can access menu management and QR code settings.
                  </p>
                </div>
              ) : (
                <>
                  <MenuManagement restaurant={restaurant} />
                  <QRCodeGenerator restaurant={restaurant} tables={tables} />
                </>
              )}
            </div>
          )}
          {activeTab === 'loyalty' && (
            <>
              {employeeProfile?.role === 'staff' ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Restricted</h3>
                  <p className="text-gray-600">
                    Only restaurant owners and managers can access loyalty program settings and discount codes.
                  </p>
                </div>
              ) : (
                <LoyaltyManagement restaurant={restaurant} />
              )}
            </>
          )}
          {activeTab === 'setup' && employeeProfile?.role === 'owner' && (
            <RestaurantSetup />
          )}
          {activeTab === 'staff' && (
            <StaffTimeTracking restaurant={restaurant} />
          )}
          {activeTab === 'staffManagement' && (
            <StaffManagement restaurant={restaurant} />
          )}
          {activeTab === 'analytics' && (
            <BookingAnalytics restaurant={restaurant} />
          )}
          {activeTab === 'tables' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Table Layout, Walk-In Management & QR Ordering</h2>
                <p className="text-gray-600">
                  Click "Mark Occupied" on available tables to instantly log walk-ins and enable QR ordering. View active orders and manage table sessions.
                </p>
              </div>
              <TableGridWithOrders
                restaurant={restaurant}
                tables={tables}
                bookings={bookings}
                onMarkOccupied={table => handleTableStatusToggle(table, 'occupied')}
                onMarkAvailable={table => handleTableStatusToggle(table, 'available')}
                onMarkPaid={handleMarkPaid}
                showOccupiedButton={true}
              />
              <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-semibold text-orange-800 mb-2">Walk-In Management & QR Ordering</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Click "Mark Occupied" on available tables for walk-in customers</li>
                  <li>• QR ordering is automatically enabled for occupied tables</li>
                  <li>• View real-time order information directly on table cards</li>
                  <li>• Click QR icon or "Details" to access ordering interface</li>
                  <li>• Tables are excluded from auto-assignment when occupied</li>
                  <li>• Use "Complete" action in bookings to free up tables when customers leave</li>
                </ul>
              </div>
            </div>
          )}
          {activeTab === 'hours' && (
            <OperatingHoursManager
              restaurant={restaurant}
              operatingHours={operatingHours}
              onUpdate={refetch}
            />
          )}
        </main>
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
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  pattern="\d{6}"
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="******"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  PIN is set in the restaurant settings.
                </p>
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
