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
      
      // Fetch restaurant
      let restaurantQuery = supabase.from('restaurants').select('*');
      
      if (slug) {
        // Public booking page - fetch by slug
        restaurantQuery = restaurantQuery.eq('slug', slug);
      } else {
        // Staff dashboard - fetch user's restaurant
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          restaurantQuery = restaurantQuery.eq('owner_id', user.id);
        } else {
          // For demo purposes, fetch first restaurant
          restaurantQuery = restaurantQuery.limit(1);
        }
      }
      
      const { data: restaurantData, error: restaurantError } = await restaurantQuery.single();

      if (restaurantError) {
        if (restaurantError.code === 'PGRST116') {
          setError('Restaurant not found');
        } else {
          throw restaurantError;
        }
        return;
      }

      setRestaurant(restaurantData);

      // Fetch all related data in parallel for better performance
      const [tablesResult, hoursResult, bookingsResult, waitingResult] = await Promise.all([
        // Fetch tables
        supabase
          .from('restaurant_tables')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .order('table_number'),

        // Fetch operating hours
        supabase
          .from('restaurant_operating_hours')
          .select('*')
          .eq('restaurant_id', restaurantData.id)
          .order('day_of_week'),

        // Fetch today's bookings with customer and table details
        supabase
          .from('bookings')
          .select(`
            *,
            customer:customers(*),
            restaurant_table:restaurant_tables(*)
          `)
          .eq('restaurant_id', restaurantData.id)
          .eq('booking_date', new Date().toISOString().split('T')[0])
          .order('booking_time'),

        // Fetch waiting list
        supabase
          .from('waiting_list')
          .select(`
            *,
            customer:customers(*)
          `)
          .eq('restaurant_id', restaurantData.id)
          .eq('requested_date', new Date().toISOString().split('T')[0])
          .eq('status', 'waiting')
          .order('priority_order', { ascending: true })
      ]);

      // Check for errors and set data
      if (tablesResult.error) throw tablesResult.error;
      if (hoursResult.error) throw hoursResult.error;
      if (bookingsResult.error) throw bookingsResult.error;
      if (waitingResult.error) throw waitingResult.error;

      setTables(tablesResult.data || []);
      setOperatingHours(hoursResult.data || []);
      setBookings(bookingsResult.data || []);
      setWaitingList(waitingResult.data || []);
      
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
          fetchRestaurantData(restaurantSlug);
        })
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
        () => {
          console.log('Booking changed, refreshing data...');
          fetchRestaurantData(restaurantSlug);
        })
      .subscribe();

    const waitingChannel = supabase
      .channel('waiting_list_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_list' }, 
        () => {
          console.log('Waiting list changed, refreshing data...');
          fetchRestaurantData(restaurantSlug);
        })
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(waitingChannel);
    };
  };

  const updateTableStatus = async (tableId: string, status: RestaurantTable['status']) => {
    try {
      // If marking table as available, also complete any active walk-in bookings
      if (status === 'available') {
        const { error: completeBookingError } = await supabase
          .from('bookings')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('table_id', tableId)
          .eq('status', 'seated')
          .eq('is_walk_in', true);

        if (completeBookingError) {
          console.warn('Could not complete walk-in booking:', completeBookingError);
          // Don't throw here as table status update is more important
        }
      }

      const { error } = await supabase
        .from('restaurant_tables')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', tableId);

      if (error) throw error;
      
      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating table status:', error);
      throw error;
    }
  };

  const updateBookingStatus = async (bookingId: string, status: BookingWithDetails['status']) => {
    try {
      // Start a transaction-like operation by getting current booking state
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');

      // Update booking status with timestamp
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Update related table status if table is assigned
      if (booking.table_id) {
        let tableStatus: RestaurantTable['status'] = 'available';
        
        switch (status) {
          case 'confirmed':
            tableStatus = 'reserved';
            break;
          case 'seated':
            tableStatus = 'occupied';
            break;
          case 'completed':
          case 'cancelled':
          case 'no_show':
            tableStatus = 'available';
            break;
        }

        const { error: tableError } = await supabase
          .from('restaurant_tables')
          .update({ 
            status: tableStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.table_id);

        if (tableError) throw tableError;

        // If table becomes available, process waiting list
        if (tableStatus === 'available') {
          await processWaitingList(booking.restaurant_id, booking.booking_date, booking.booking_time);
        }
        
        // For walk-ins being completed, also update table to available
        if (status === 'completed' && booking.is_walk_in) {
          await updateTableStatus(booking.table_id, 'available');
        }
      }

      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true };
      
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
          assignment_method: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Update table status to reserved
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ 
          status: 'reserved',
          updated_at: new Date().toISOString()
        })
        .eq('id', tableId);

      if (tableError) throw tableError;

      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true };
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
      
      if (!nextWaitingData || nextWaitingData.length === 0) {
        return; // No customers waiting
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
          .update({ 
            status: 'notified',
            updated_at: new Date().toISOString()
          })
          .eq('id', nextWaiting.id);

        if (waitingUpdateError) throw waitingUpdateError;

        // Update table status
        const { error: tableError } = await supabase
          .from('restaurant_tables')
          .update({ 
            status: 'reserved',
            updated_at: new Date().toISOString()
          })
          .eq('id', assignedTable.table_id);

        if (tableError) throw tableError;

        console.log('Waiting list customer automatically promoted and table assigned');
      }
    } catch (error) {
      console.error('Error processing waiting list:', error);
      // Don't throw here as this is a background process
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
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', waitingListId);

      if (waitingUpdateError) throw waitingUpdateError;

      // Update table status
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ 
          status: 'reserved',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignedTable.table_id);

      if (tableError) throw tableError;

      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true };
    } catch (error) {
      console.error('Error promoting from waiting list:', error);
      throw error;
    }
  };

  const cancelWaitingListEntry = async (waitingListId: string) => {
    try {
      const { error } = await supabase
        .from('waiting_list')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', waitingListId);

      if (error) throw error;

      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true };
    } catch (error) {
      console.error('Error cancelling waiting list entry:', error);
      throw error;
    }
  };

  const createOrderSession = async (tableId: string, bookingId?: string | null) => {
    try {
      if (!restaurant) throw new Error('Restaurant not found');

      const sessionToken = crypto.randomUUID();

      const { data, error } = await supabase
        .from('order_sessions')
        .insert({
          restaurant_id: restaurant.id,
          table_id: tableId,
          booking_id: bookingId || null,
          session_token: sessionToken,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, session: data };
    } catch (error) {
      console.error('Error creating order session:', error);
      throw error;
    }
  };

  const markTableOccupiedWithSession = async (table: RestaurantTable, partySize?: number) => {
    try {
      // Create order session first
      const sessionResult = await createOrderSession(table.id, null);
      
      // Update table status to occupied
      const { error: tableError } = await supabase
        .from('restaurant_tables')
        .update({ 
          status: 'occupied',
          updated_at: new Date().toISOString()
        })
        .eq('id', table.id);

      if (tableError) throw tableError;

      // Create anonymous walk-in booking for analytics
      const { data: anonymousCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: 'Walk-in Customer',
          phone: `walkin-${Date.now()}`, // Unique identifier for analytics
        })
        .select()
        .single();

      if (customerError) throw customerError;

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          restaurant_id: restaurant!.id,
          table_id: table.id,
          customer_id: anonymousCustomer.id,
          booking_date: new Date().toISOString().split('T')[0],
          booking_time: new Date().toTimeString().split(' ')[0],
          party_size: partySize || 2,
          status: 'seated',
          is_walk_in: true,
          assignment_method: 'manual',
          was_on_waitlist: false
        });

      if (bookingError) throw bookingError;

      // Update the order session with the booking ID
      if (sessionResult.session) {
        const { error: sessionUpdateError } = await supabase
          .from('order_sessions')
          .update({ booking_id: anonymousCustomer.id })
          .eq('id', sessionResult.session.id);

        if (sessionUpdateError) {
          console.warn('Could not update session with booking ID:', sessionUpdateError);
        }
      }

      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true, session: sessionResult.session };
    } catch (error) {
      console.error('Error marking table occupied with session:', error);
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
    cancelWaitingListEntry,
    createOrderSession,
    markTableOccupiedWithSession,
    refetch: () => fetchRestaurantData(restaurantSlug)
  };
}