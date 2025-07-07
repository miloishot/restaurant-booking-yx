import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantTable, BookingWithDetails, RestaurantOperatingHours } from '../types/database';

export function useRestaurantData() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [operatingHours, setOperatingHours] = useState<RestaurantOperatingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurantData();
    subscribeToRealtime();
  }, []);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);
      
      // Fetch restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .limit(1)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Fetch tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('table_number');

      if (tablesError) throw tablesError;
      setTables(tablesData);

      // Fetch operating hours
      const { data: hoursData, error: hoursError } = await supabase
        .from('restaurant_operating_hours')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('day_of_week');

      if (hoursError) throw hoursError;
      setOperatingHours(hoursData);

      // Fetch today's bookings with customer and table details
      const today = new Date().toISOString().split('T')[0];
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(*),
          restaurant_table:restaurant_tables(*)
        `)
        .eq('restaurant_id', restaurantData.id)
        .eq('booking_date', today)
        .order('booking_time');

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRealtime = () => {
    const tablesChannel = supabase
      .channel('restaurant_tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, 
        () => {
          console.log('Table status changed, refreshing data...');
          fetchRestaurantData();
        })
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
        () => {
          console.log('Booking changed, refreshing data...');
          fetchRestaurantData();
        })
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(bookingsChannel);
    };
  };

  const updateTableStatus = async (tableId: string, status: RestaurantTable['status']) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ status })
      .eq('id', tableId);

    if (error) throw error;
    
    // Force refresh after update
    await fetchRestaurantData();
  };

  const updateBookingStatus = async (bookingId: string, status: BookingWithDetails['status']) => {
    try {
      // Get the booking details first to update table status accordingly
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');

      // Update booking status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Update table status based on booking status (only if table is assigned)
      if (booking.table_id) {
        let tableStatus: RestaurantTable['status'] = 'available';
        
        if (status === 'confirmed') {
          tableStatus = 'reserved';
        } else if (status === 'seated') {
          tableStatus = 'occupied';
        } else if (status === 'completed' || status === 'cancelled' || status === 'no_show') {
          tableStatus = 'available';
        }

        // Update the table status
        const { error: tableError } = await supabase
          .from('restaurant_tables')
          .update({ status: tableStatus })
          .eq('id', booking.table_id);

        if (tableError) throw tableError;
      }

      // Force refresh after updates
      await fetchRestaurantData();
      
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  };

  const assignTableToBooking = async (bookingId: string, tableId: string) => {
    try {
      // Update booking with table assignment
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ table_id: tableId })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Update table status to reserved
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'reserved' })
        .eq('id', tableId);

      if (tableError) throw tableError;

      await fetchRestaurantData();
    } catch (error) {
      console.error('Error assigning table:', error);
      throw error;
    }
  };

  return {
    restaurant,
    tables,
    bookings,
    operatingHours,
    loading,
    error,
    updateTableStatus,
    updateBookingStatus,
    assignTableToBooking,
    refetch: fetchRestaurantData
  };
}