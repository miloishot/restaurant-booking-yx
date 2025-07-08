import React, { useState } from 'react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { TableGrid } from './TableGrid';
import { WalkInLogger } from './WalkInLogger';
import { BookingList } from './BookingList';
import { WaitingListManager } from './WaitingListManager';
import { OperatingHoursManager } from './OperatingHoursManager';
import { BookingAnalytics } from './BookingAnalytics';
import { StaffOrderManagement } from './qr-ordering/StaffOrderManagement';
import { RestaurantTable } from '../types/database';
import { Settings, Users, Calendar, Clock, RefreshCw, Building, AlertCircle, BarChart3, ChefHat } from 'lucide-react';

export function RestaurantDashboard() {
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
    refetch 
  } = useRestaurantData();
  
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showWalkInLogger, setShowWalkInLogger] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'tables' | 'waiting' | 'hours' | 'analytics' | 'orders'>('bookings');
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePromoteFromWaitingList = async (waitingListId: string) => {
    try {
      return await promoteFromWaitingList(waitingListId);
    } catch (error) {
      console.error('Error promoting customer:', error);
      throw error;
    }
  };

  const handleCancelWaiting = async (waitingListId: string) => {
    try {
      return await cancelWaitingListEntry(waitingListId);
    } catch (error) {
      console.error('Error cancelling waiting list entry:', error);
      throw error;
    }
  };

  if (loading) {
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
        <div className="text-center">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-red-600 text-sm mt-2">
              Please make sure your Supabase connection is configured properly.
            </p>
            <button
              onClick={handleManualRefresh}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

  const handleMarkOccupied = (table: RestaurantTable) => {
    setSelectedTable(table);
    setShowWalkInLogger(true);
  };

  const handleTableStatusUpdate = async (table: RestaurantTable, status: RestaurantTable['status']) => {
    try {
      await updateTableStatus(table.id, status);
    } catch (err) {
      console.error('Failed to update table status:', err);
      alert('Failed to update table status. Please try again.');
    }
  };

  const handleBookingStatusUpdate = async (bookingId: string, status: any) => {
    try {
      return await updateBookingStatus(bookingId, status);
    } catch (err) {
      console.error('Failed to update booking status:', err);
      throw err;
    }
  };

  const handleTableAssignment = async (bookingId: string, tableId: string) => {
    try {
      return await assignTableToBooking(bookingId, tableId);
    } catch (err) {
      console.error('Failed to assign table:', err);
      throw err;
    }
  };

  const todaysBookings = bookings.filter(booking => {
    const today = new Date().toISOString().split('T')[0];
    return booking.booking_date === today;
  });

  const pendingBookings = todaysBookings.filter(b => b.status === 'pending');
  const unassignedBookings = todaysBookings.filter(b => !b.table_id && ['pending', 'confirmed'].includes(b.status));
  const waitlistBookings = todaysBookings.filter(b => b.was_on_waitlist);

  const stats = {
    totalTables: tables.length,
    availableTables: tables.filter(t => t.status === 'available').length,
    occupiedTables: tables.filter(t => t.status === 'occupied').length,
    pendingBookings: pendingBookings.length,
    unassignedBookings: unassignedBookings.length,
    waitingCustomers: waitingList.length,
    waitlistBookings: waitlistBookings.length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{restaurant.name}</h1>
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
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">!</span>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">Unassigned</p>
                <p className="text-xl font-bold text-orange-600">{stats.unassignedBookings}</p>
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

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Today's Bookings ({todaysBookings.length})
            </button>
            <button
              onClick={() => setActiveTab('waiting')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'waiting'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Waiting List ({waitingList.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChefHat className="w-4 h-4 inline mr-1" />
              Orders
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tables'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Table Management
            </button>
            <button
              onClick={() => setActiveTab('hours')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'hours'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Operating Hours
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'bookings' && (
          <BookingList 
            bookings={todaysBookings} 
            tables={tables}
            onUpdateBooking={handleBookingStatusUpdate}
            onAssignTable={handleTableAssignment}
          />
        )}

        {activeTab === 'waiting' && (
          <WaitingListManager
            waitingList={waitingList}
            onPromoteCustomer={handlePromoteFromWaitingList}
            onCancelWaiting={handleCancelWaiting}
          />
        )}

        {activeTab === 'orders' && (
          <StaffOrderManagement restaurant={restaurant} />
        )}

        {activeTab === 'analytics' && (
          <BookingAnalytics restaurant={restaurant} />
        )}
        
        {activeTab === 'tables' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Table Layout & Walk-In Management</h2>
              <p className="text-gray-600">
                Click "Mark Occupied" on available tables to instantly log walk-ins without collecting personal data
              </p>
            </div>
            <TableGrid 
              tables={tables} 
              onMarkOccupied={handleMarkOccupied}
              showOccupiedButton={true}
            />
            
            {/* Walk-in Instructions */}
            <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2">Walk-In Management</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Click "Mark Occupied" on available tables for walk-in customers</li>
                <li>• No personal customer data is collected or stored</li>
                <li>• Tables are instantly marked as occupied and excluded from auto-assignment</li>
                <li>• Anonymous analytics data is logged for operational insights</li>
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
      </div>

      {/* Walk-In Logger Modal */}
      {showWalkInLogger && selectedTable && (
        <WalkInLogger
          restaurant={restaurant}
          table={selectedTable}
          onSuccess={() => {
            setShowWalkInLogger(false);
            setSelectedTable(null);
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