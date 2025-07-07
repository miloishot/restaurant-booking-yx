import React from 'react';
import { BookingWithDetails } from '../types/database';
import { format } from 'date-fns';
import { Clock, User, Phone, Mail } from 'lucide-react';

interface BookingListProps {
  bookings: BookingWithDetails[];
  onUpdateBooking: (bookingId: string, status: BookingWithDetails['status']) => void;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  seated: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  no_show: 'bg-orange-100 text-orange-800 border-orange-300'
};

export function BookingList({ bookings, onUpdateBooking }: BookingListProps) {
  const groupedBookings = bookings.reduce((acc, booking) => {
    const status = booking.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(booking);
    return acc;
  }, {} as Record<string, BookingWithDetails[]>);

  const handleStatusUpdate = async (bookingId: string, status: BookingWithDetails['status']) => {
    try {
      await onUpdateBooking(bookingId, status);
      
      // Show success message based on action
      let message = '';
      switch (status) {
        case 'confirmed':
          message = 'Booking confirmed! Table is now reserved.';
          break;
        case 'seated':
          message = 'Customer seated! Table is now occupied.';
          break;
        case 'completed':
          message = 'Booking completed! Table is now available.';
          break;
        case 'cancelled':
          message = 'Booking cancelled! Table is now available.';
          break;
        case 'no_show':
          message = 'Marked as no-show! Table is now available.';
          break;
      }
      
      if (message) {
        // Create a temporary success notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedBookings).map(([status, statusBookings]) => (
        <div key={status} className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 capitalize text-gray-800">
            {status.replace('_', ' ')} ({statusBookings.length})
          </h3>
          
          <div className="space-y-4">
            {statusBookings.map((booking) => (
              <div
                key={booking.id}
                className={`p-4 rounded-lg border-2 ${statusColors[booking.status]}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg">{booking.customer.name}</h4>
                    <p className="text-sm opacity-75">
                      Table {booking.restaurant_table.table_number} • {booking.party_size} people
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-sm mb-1">
                      <Clock className="w-4 h-4 mr-1" />
                      {format(new Date(`${booking.booking_date}T${booking.booking_time}`), 'h:mm a')}
                    </div>
                    {booking.is_walk_in && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Walk-in
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm mb-3">
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    {booking.customer.phone}
                  </div>
                  {booking.customer.email && (
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {booking.customer.email}
                    </div>
                  )}
                </div>

                {booking.notes && (
                  <p className="text-sm italic mb-3 text-gray-600">
                    Note: {booking.notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  
                  {booking.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'seated')}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        Seat
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'no_show')}
                        className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                      >
                        No Show
                      </button>
                    </>
                  )}
                  
                  {booking.status === 'seated' && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'completed')}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}