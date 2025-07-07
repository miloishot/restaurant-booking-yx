import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Phone, Mail, User } from 'lucide-react';

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

      // Create booking without table assignment (will be assigned by staff)
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          restaurant_id: restaurant.id,
          table_id: null, // No table assignment for customer bookings
          customer_id: customerId,
          booking_date: selectedDate,
          booking_time: selectedTime,
          party_size: partySize,
          notes: formData.notes || null,
          is_walk_in: false,
          status: 'pending'
        });

      if (bookingError) throw bookingError;

      // Show success message
      alert('Booking request submitted successfully! We will confirm your reservation shortly.');
      
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
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
                <strong>Note:</strong> Your table will be automatically assigned by our staff based on availability and your party size. We'll confirm your reservation shortly.
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
                {loading ? 'Submitting...' : 'Submit Reservation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}