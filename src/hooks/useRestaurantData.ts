import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantTable, BookingWithDetails, RestaurantOperatingHours, WaitingListWithDetails } from '../types/database';

export function useRestaurantData(restaurantSlug?: string) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListWithDetails[]>([]);
  const [operatingHours, setOperatingHours] = useState<RestaurantOperatingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurantData(restaurantSlug);
    subscribeToRealtime();
  }, [restaurantSlug]);

  const fetchRestaurantData = async (slug?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
        setError('Database not configured. This is a demo version.');
        setLoading(false);
        return;
      }
      
      let restaurantData: Restaurant | null = null;

      if (slug) {
        // Public booking page - fetch by slug
        const { data, error: restaurantError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('slug', slug)
          .single();
        
        if (restaurantError) {
          if (restaurantError.code === 'PGRST116') {
            setError('Restaurant not found');
          } else {
            throw restaurantError;
          }
          return;
        }
        restaurantData = data;
      } else {
        // Staff dashboard - fetch user's assigned restaurant
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // For development, allow unauthenticated access to test restaurant
          const { data, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('slug', 'test-restaurant')
            .single();
          
          if (restaurantError || !data) {
            setError('Please sign in to access the dashboard');
            return;
          }
          
          restaurantData = data;
        } else {
          const { data, error: restaurantError } = await supabase
            .from('user_restaurant_view')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (restaurantError) {
            if (restaurantError.code === 'PGRST116') {
              // User doesn't have a restaurant yet
              setRestaurant(null);
              setTables([]);
              setBookings([]);
              setWaitingList([]);
              setOperatingHours([]);
              setLoading(false);
              return;
            } else {
              throw restaurantError;
            }
          }
          
          if (!data) {
            setRestaurant(null);
            setTables([]);
            setBookings([]);
            setWaitingList([]);
            setOperatingHours([]);
            setLoading(false);
            return;
          }
          
          // Convert user_restaurant_view data to Restaurant format
          restaurantData = {
            id: data.id,
            name: data.name,
            slug: data.slug,
            address: data.address,
            phone: data.phone,
            email: data.email,
            owner_id: data.owner_id,
            time_slot_duration_minutes: data.time_slot_duration_minutes,
            created_at: data.created_at,
            updated_at: data.updated_at
          };
        }
      }

      if (!restaurantData) {
        setError('Restaurant not found');
        return;
      }

      setRestaurant(restaurantData);

      // Fetch tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('table_number');

      if (tablesError) throw tablesError;
      setTables(tablesData || []);

      // Fetch operating hours
      const { data: hoursData, error: hoursError } = await supabase
        .from('restaurant_operating_hours')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('day_of_week');

      if (hoursError) throw hoursError;
      setOperatingHours(hoursData || []);

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
      setBookings(bookingsData || []);

      // Fetch waiting list
      const { data: waitingData, error: waitingError } = await supabase
        .from('waiting_list')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('restaurant_id', restaurantData.id)
        .eq('requested_date', today)
        .eq('status', 'waiting')
        .order('priority_order', { ascending: true });

      if (waitingError) throw waitingError;
      setWaitingList(waitingData || []);
      
    } catch (err) {
      console.error('Error fetching restaurant data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while loading restaurant data');
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

    const waitingChannel = supabase
      .channel('waiting_list_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_list' }, 
        () => {
          console.log('Waiting list changed, refreshing data...');
          fetchRestaurantData();
        })
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(waitingChannel);
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
          
          // When a table becomes available, check waiting list
          await processWaitingList(booking.restaurant_id, booking.booking_date, booking.booking_time);
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
        .update({ 
          table_id: tableId,
          assignment_method: 'manual'
        })
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

  const processWaitingList = async (restaurantId: string, date: string, time: string) => {
    try {
      // Get next person on waiting list for this time slot
      const { data: nextWaitingData, error: waitingError } = await supabase
        .from('waiting_list')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('requested_date', date)
        .eq('requested_time', time)
        .eq('status', 'waiting')
        .order('priority_order', { ascending: true })
        .limit(1);

      if (waitingError) throw waitingError;
      
      // Check if there are any customers on the waiting list
      if (!nextWaitingData || nextWaitingData.length === 0) {
        return; // No customers waiting, exit early
      }

      const nextWaiting = nextWaitingData[0];

      // Check if there's an available table for their party size
      const { data: availableTables } = await supabase
        .rpc('get_available_tables', {
          p_restaurant_id: restaurantId,
          p_date: date,
          p_time: time,
          p_party_size: nextWaiting.party_size
        });

      if (availableTables && availableTables.length > 0) {
        // Assign the first available table
        const assignedTable = availableTables[0];

        // Create booking from waiting list
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            restaurant_id: restaurantId,
            table_id: assignedTable.table_id,
            customer_id: nextWaiting.customer_id,
            booking_date: date,
            booking_time: time,
            party_size: nextWaiting.party_size,
            notes: nextWaiting.notes,
            status: 'confirmed',
            assignment_method: 'waitlist',
            was_on_waitlist: true,
            is_walk_in: false
          });

        if (bookingError) throw bookingError;

        // Update waiting list status
        const { error: waitingUpdateError } = await supabase
          .from('waiting_list')
          .update({ status: 'notified' })
          .eq('id', nextWaiting.id);

        if (waitingUpdateError) throw waitingUpdateError;

        // Update table status
        const { error: tableError } = await supabase
          .from('restaurant_tables')
          .update({ status: 'reserved' })
          .eq('id', assignedTable.table_id);

        if (tableError) throw tableError;

        console.log('Waiting list customer notified and table assigned');
      }
    } catch (error) {
      console.error('Error processing waiting list:', error);
    }
  };

  const promoteFromWaitingList = async (waitingListId: string) => {
    try {
      const waitingEntry = waitingList.find(w => w.id === waitingListId);
      if (!waitingEntry) throw new Error('Waiting list entry not found');

      // Get available tables
      const { data: availableTables } = await supabase
        .rpc('get_available_tables', {
          p_restaurant_id: waitingEntry.restaurant_id,
          p_date: waitingEntry.requested_date,
          p_time: waitingEntry.requested_time,
          p_party_size: waitingEntry.party_size
        });

      if (!availableTables || availableTables.length === 0) {
        throw new Error('No available tables for this party size');
      }

      const assignedTable = availableTables[0];

      // Create booking
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          restaurant_id: waitingEntry.restaurant_id,
          table_id: assignedTable.table_id,
          customer_id: waitingEntry.customer_id,
          booking_date: waitingEntry.requested_date,
          booking_time: waitingEntry.requested_time,
          party_size: waitingEntry.party_size,
          notes: waitingEntry.notes,
          status: 'confirmed',
          assignment_method: 'waitlist',
          was_on_waitlist: true,
          is_walk_in: false
        });

      if (bookingError) throw bookingError;

      // Update waiting list status
      const { error: waitingUpdateError } = await supabase
        .from('waiting_list')
        .update({ status: 'confirmed' })
        .eq('id', waitingListId);

      if (waitingUpdateError) throw waitingUpdateError;

      // Update table status
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ status: 'reserved' })
        .eq('id', assignedTable.table_id);

      if (tableError) throw tableError;

      await fetchRestaurantData();
    } catch (error) {
      console.error('Error promoting from waiting list:', error);
      throw error;
    }
  };

  return {
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
    refetch: () => fetchRestaurantData(restaurantSlug)
  };
}