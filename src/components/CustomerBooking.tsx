import React, { useState } from 'react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { TableGrid } from './TableGrid';
import { BookingForm } from './BookingForm';
import { RestaurantTable } from '../types/database';
import { Calendar, Clock, Users, Phone, MapPin } from 'lucide-react';

export function CustomerBooking() {
  const { restaurant, tables, bookings, loading, error } = useRestaurantData();
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurant information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Unable to Load Restaurant</h2>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Restaurant Not Found</h2>
          <p className="text-gray-600">Please check back later.</p>
        </div>
      </div>
    );
  }

  // Get today's bookings for each table
  const today = new Date().toISOString().split('T')[0];
  const todaysBookings = bookings.filter(booking => booking.booking_date === today);

  // Create table data with booking information
  const tablesWithBookings = tables.map(table => {
    const tableBookings = todaysBookings.filter(booking => booking.table_id === table.id);
    const activeBooking = tableBookings.find(booking => 
      ['confirmed', 'seated'].includes(booking.status)
    );
    
    return {
      ...table,
      bookings: tableBookings,
      activeBooking,
      isBookable: table.status === 'available' && !activeBooking
    };
  });

  const availableTables = tablesWithBookings.filter(table => table.isBookable);

  const handleTableSelect = (table: RestaurantTable) => {
    const tableWithBooking = tablesWithBookings.find(t => t.id === table.id);
    if (tableWithBooking?.isBookable) {
      setSelectedTable(table);
      setShowBookingForm(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{restaurant.name}</h1>
            <p className="text-lg text-gray-600 mb-6">Reserve your table for an unforgettable dining experience</p>
            
            <div className="flex justify-center items-center space-x-8 text-sm text-gray-600">
              {restaurant.address && (
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  {restaurant.address}
                </div>
              )}
              {restaurant.phone && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  {restaurant.phone}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Booking Instructions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">How to Book</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">1. Choose Your Table</h3>
              <p className="text-sm text-gray-600">Select an available table that suits your party size</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">2. Pick Date & Time</h3>
              <p className="text-sm text-gray-600">Choose your preferred date and time slot</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">3. Confirm Booking</h3>
              <p className="text-sm text-gray-600">Provide your details and confirm your reservation</p>
            </div>
          </div>
        </div>

        {/* Table Selection */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Table Availability</h2>
            <p className="text-gray-600">
              {availableTables.length} of {tables.length} tables available for booking today • Click on any available table to book
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tablesWithBookings.map((table) => (
              <div
                key={table.id}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200
                  ${table.isBookable 
                    ? 'bg-green-100 border-green-300 text-green-800 cursor-pointer hover:shadow-lg transform hover:scale-105' 
                    : table.status === 'occupied' 
                      ? 'bg-red-100 border-red-300 text-red-800'
                      : table.status === 'reserved' || table.activeBooking
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                        : 'bg-gray-100 border-gray-300 text-gray-800'
                  }
                  ${selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : ''}
                `}
                onClick={() => table.isBookable && handleTableSelect(table)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{table.table_number}</h3>
                  <span className="text-xl">
                    {table.isBookable ? '✓' : 
                     table.status === 'occupied' ? '●' : 
                     table.status === 'reserved' || table.activeBooking ? '○' : 
                     '🔧'}
                  </span>
                </div>
                
                <div className="text-sm opacity-75 mb-2">
                  <p>Capacity: {table.capacity}</p>
                  <p className="capitalize">
                    {table.isBookable ? 'Available' : 
                     table.status === 'occupied' ? 'Occupied' :
                     table.status === 'reserved' || table.activeBooking ? 'Reserved' :
                     table.status}
                  </p>
                </div>

                {/* Show booking information if table is booked */}
                {table.activeBooking && (
                  <div className="text-xs mt-2 p-2 bg-white bg-opacity-50 rounded">
                    <p className="font-medium">Booked for {table.activeBooking.booking_time}</p>
                    <p>Party of {table.activeBooking.party_size}</p>
                    {table.activeBooking.status === 'confirmed' && (
                      <p className="text-yellow-700">Awaiting arrival</p>
                    )}
                    {table.activeBooking.status === 'seated' && (
                      <p className="text-red-700">Currently dining</p>
                    )}
                  </div>
                )}

                {table.location_notes && (
                  <p className="text-xs mt-2 opacity-60">{table.location_notes}</p>
                )}

                {!table.isBookable && table.status !== 'maintenance' && (
                  <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-medium bg-white px-2 py-1 rounded shadow">
                      {table.activeBooking ? 'Booked' : 'Unavailable'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {availableTables.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Tables Available</h3>
              <p className="text-gray-600">
                All tables are currently occupied or reserved for today. Please try selecting a different date or call us at {restaurant.phone}
              </p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Table Status Legend</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-2"></div>
              <span className="text-sm text-gray-600">Available for booking</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded mr-2"></div>
              <span className="text-sm text-gray-600">Reserved (booked for today)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded mr-2"></div>
              <span className="text-sm text-gray-600">Occupied (currently dining)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded mr-2"></div>
              <span className="text-sm text-gray-600">Maintenance</span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && selectedTable && (
        <BookingForm
          restaurant={restaurant}
          selectedTable={selectedTable}
          onSuccess={() => {
            setShowBookingForm(false);
            setSelectedTable(null);
          }}
          onCancel={() => {
            setShowBookingForm(false);
            setSelectedTable(null);
          }}
        />
      )}
    </div>
  );
}