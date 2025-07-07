import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, AvailableTable } from '../types/database';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Phone, Mail, User, AlertCircle, CheckCircle } from 'lucide-react';

interface TimeSlotBookingFormProps {
  restaurant: Restaurant;
  selectedDate: string;
  selectedTime: string;
  partySize: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TimeSlotBookingForm({ 
  restaurant, 
  selectedDate, 
  selectedTime, 
  partySize, 
  onSuccess, 
  onCancel 
}: TimeSlotBookingFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<'confirmed' | 'waitlist' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create or get customer
      let customerId;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', formData.phone)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Update customer info if provided
        if (formData.name || formData.email) {
          await supabase
            .from('customers')
            .update({
              ...(formData.name && { name: formData.name }),
              ...(formData.email && { email: formData.email })
            })
            .eq('id', customerId);
        }
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Check for available tables using the RPC function
      const { data: availableTables, error: tablesError } = await supabase
        .rpc('get_available_tables', {
          p_restaurant_id: restaurant.id,
          p_date: selectedDate,
          p_time: selectedTime,
          p_party_size: partySize
        }) as { data: AvailableTable[] | null, error: any };

      if (tablesError) throw tablesError;

      if (availableTables && availableTables.length > 0) {
        // Table available - create confirmed booking with auto-assigned table
        const assignedTable = availableTables[0]; // Get the smallest suitable table

        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            restaurant_id: restaurant.id,
            table_id: assignedTable.table_id,
            customer_id: customerId,
            booking_date: selectedDate,
            booking_time: selectedTime,
            party_size: partySize,
            notes: formData.notes || null,
            is_walk_in: false,
            status: 'confirmed',
            assignment_method: 'auto',
            was_on_waitlist: false
          });

        if (bookingError) throw bookingError;

        // Update table status to reserved
        const { error: tableError } = await supabase
          .from('restaurant_tables')
          .update({ status: 'reserved' })
          .eq('id', assignedTable.table_id);

        if (tableError) throw tableError;

        setBookingResult('confirmed');
      } else {
        // No tables available - add to waiting list
        // Get next priority order
        const { data: lastPriority } = await supabase
          .from('waiting_list')
          .select('priority_order')
          .eq('restaurant_id', restaurant.id)
          .eq('requested_date', selectedDate)
          .eq('requested_time', selectedTime)
          .eq('status', 'waiting')
          .order('priority_order', { ascending: false })
          .limit(1)
          .single();

        const nextPriority = (lastPriority?.priority_order || 0) + 1;

        const { error: waitingError } = await supabase
          .from('waiting_list')
          .insert({
            restaurant_id: restaurant.id,
            customer_id: customerId,
            requested_date: selectedDate,
            requested_time: selectedTime,
            party_size: partySize,
            notes: formData.notes || null,
            status: 'waiting',
            priority_order: nextPriority
          });

        if (waitingError) throw waitingError;

        setBookingResult('waitlist');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process booking');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'EEEE, MMMM d, yyyy');
  };

  if (bookingResult) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6 text-center">
            {bookingResult === 'confirmed' ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Booking Confirmed!</h2>
                <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
                  <div className="space-y-2 text-sm text-green-800">
                    <div className="flex items-center justify-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(selectedDate)}
                    </div>
                    <div className="flex items-center justify-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(selectedTime)}
                    </div>
                    <div className="flex items-center justify-center">
                      <Users className="w-4 h-4 mr-2" />
                      {partySize} {partySize === 1 ? 'Guest' : 'Guests'}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Your table has been automatically assigned. We look forward to seeing you!
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Added to Waiting List</h2>
                <div className="bg-orange-50 rounded-lg p-4 mb-6 border border-orange-200">
                  <div className="space-y-2 text-sm text-orange-800">
                    <div className="flex items-center justify-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(selectedDate)}
                    </div>
                    <div className="flex items-center justify-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(selectedTime)}
                    </div>
                    <div className="flex items-center justify-center">
                      <Users className="w-4 h-4 mr-2" />
                      {partySize} {partySize === 1 ? 'Guest' : 'Guests'}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  All tables are currently booked for this time. You've been added to our waiting list and we'll call you if a table becomes available.
                </p>
              </>
            )}
            
            <button
              onClick={onSuccess}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-90vh overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Complete Your Reservation</h2>
          
          {/* Booking Summary */}
          <div className="bg-amber-50 rounded-lg p-4 mb-6 border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-3">Reservation Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-amber-700">
                <Calendar className="w-4 h-4 mr-2" />
                {formatDate(selectedDate)}
              </div>
              <div className="flex items-center text-amber-700">
                <Clock className="w-4 h-4 mr-2" />
                {formatTime(selectedTime)}
              </div>
              <div className="flex items-center text-amber-700">
                <Users className="w-4 h-4 mr-2" />
                {partySize} {partySize === 1 ? 'Guest' : 'Guests'}
              </div>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Enter your email (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Allergies, celebrations, seating preferences..."
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Automatic Assignment:</strong> If tables are available, we'll confirm your booking immediately and assign the best table for your party. If fully booked, you'll be added to our waiting list and notified if a table becomes available.
              </p>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}