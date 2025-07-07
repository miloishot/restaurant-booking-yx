import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { RestaurantTable, Restaurant } from '../types/database';
import { format } from 'date-fns';

interface BookingFormProps {
  restaurant: Restaurant;
  selectedTable: RestaurantTable;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BookingForm({ restaurant, selectedTable, onSuccess, onCancel }: BookingFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    partySize: selectedTable.capacity,
    notes: '',
    isWalkIn: false
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

      // Create booking
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          restaurant_id: restaurant.id,
          table_id: selectedTable.id,
          customer_id: customerId,
          booking_date: formData.date,
          booking_time: formData.time,
          party_size: formData.partySize,
          notes: formData.notes || null,
          is_walk_in: formData.isWalkIn,
          status: formData.isWalkIn ? 'seated' : 'pending'
        });

      if (bookingError) throw bookingError;

      // Update table status based on booking type
      let tableStatus: RestaurantTable['status'];
      if (formData.isWalkIn) {
        tableStatus = 'occupied'; // Walk-ins are seated immediately
      } else {
        tableStatus = 'reserved'; // Regular bookings are reserved until seated
      }

      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: tableStatus })
        .eq('id', selectedTable.id);

      if (tableError) throw tableError;

      // Show success message
      alert(formData.isWalkIn ? 'Walk-in customer seated successfully!' : 'Booking created successfully!');
      
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-90vh overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            {formData.isWalkIn ? 'Walk-in Registration' : 'Book Table'} {selectedTable.table_number}
          </h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Party Size *
              </label>
              <select
                value={formData.partySize}
                onChange={(e) => setFormData({ ...formData, partySize: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: selectedTable.capacity }, (_, i) => i + 1).map(size => (
                  <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Allergies, celebrations, preferences..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="walkIn"
                checked={formData.isWalkIn}
                onChange={(e) => setFormData({ ...formData, isWalkIn: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="walkIn" className="text-sm text-gray-700">
                This is a walk-in (seat immediately)
              </label>
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : formData.isWalkIn ? 'Seat Now' : 'Book Table'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}