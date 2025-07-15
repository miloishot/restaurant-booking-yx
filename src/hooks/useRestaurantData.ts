import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantTable, BookingWithDetails, RestaurantOperatingHours, WaitingListWithDetails } from '../types/database';
import { useAuth } from './useAuth';

export function useRestaurantData(restaurantSlug?: string) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListWithDetails[]>([]);
  const [operatingHours, setOperatingHours] = useState<RestaurantOperatingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, employeeProfile, restaurantId, loading: authLoading } = useAuth(); // Get the authenticated user and restaurant ID
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurantData = useCallback(async (slug?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase configuration is missing. Please check your .env file.');
        setError('Supabase configuration is missing. Please check your .env file.');
        setLoading(false);
        return;
      }
      
      // Fetch restaurant
      let restaurantQuery = supabase.from('restaurants').select('*');
      let isRestaurantQueryFiltered = false;
      let restaurantData: Restaurant | null = null;

      // If we already have a restaurantId from the auth hook, use it directly
      if (restaurantId && !slug) {
        console.log('Using restaurantId from auth hook:', restaurantId);
        try {
          const { data: directRestaurant, error: directError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single();
            
          if (!directError && directRestaurant) {
            restaurantData = directRestaurant;
            console.log('Successfully fetched restaurant using restaurantId from auth hook:', restaurantData.name);
          } else {
            console.error('Error fetching restaurant with ID from auth hook:', directError);
          }
        } catch (directFetchError) {
          console.error('Direct restaurant fetch failed using restaurantId from auth hook:', directFetchError);
        }
      }
      
      // If we don't have restaurant data yet and a slug is provided, fetch by slug
      if (!restaurantData && slug) {
        // Public booking page - fetch by slug
        restaurantQuery = restaurantQuery.eq('slug', slug);
        isRestaurantQueryFiltered = true;
      } 
      // If we don't have restaurant data yet and no slug, but we have a user, try to find their restaurant
      else if (!restaurantData && !slug && user && !authLoading) {
        // Staff dashboard - fetch user's restaurant based on their employee record or if they are an owner
        // If we have an employee profile with a restaurant_id, use that
        if (employeeProfile?.restaurant_id) {
          console.log('Using restaurant_id from employee profile:', employeeProfile.restaurant_id);
          restaurantQuery = restaurantQuery.eq('id', employeeProfile.restaurant_id);
          isRestaurantQueryFiltered = true;
        } else {
          console.log('No employee profile with restaurant_id, checking if user is restaurant owner');
          // If no employee record or no restaurant_id, check if they are an owner directly
          restaurantQuery = restaurantQuery.eq('owner_id', user.id); 
          isRestaurantQueryFiltered = true;
        }
      }
      // If no user and no slug, or if the user is not associated with a restaurant,
      // Only proceed with the query if we don't already have restaurant data
      if (!restaurantData) {
        if (!user && !slug && !authLoading) {
          // For demo purposes, fetch first restaurant if no user and no slug
          restaurantQuery = restaurantQuery.limit(1); 
          isRestaurantQueryFiltered = true;
        } else if (user && !slug && !isRestaurantQueryFiltered && !authLoading) { 
          // If user is logged in but no specific restaurant was found,
          // and no slug was provided, it means the user is not linked to a restaurant yet.
          restaurantQuery = restaurantQuery.limit(1); 
          isRestaurantQueryFiltered = true;
        }

        // Only execute the query if we don't already have restaurant data
        if (!restaurantData) {
          try {
            const { data: queryResult, error: restaurantError } = await restaurantQuery.maybeSingle();
            
            if (restaurantError) {
              if (restaurantError.code === 'PGRST116' || restaurantError.message?.includes('Results contain 0 rows')) {
                setError('Restaurant not found or you do not have access. Please check your account settings.');
              } else {
                throw restaurantError;
              }
              return;
            }
            
            restaurantData = queryResult;
          } catch (queryError) {
            console.error('Restaurant query failed:', queryError);
            setError('Failed to fetch restaurant data. Please try again later.');
            return;
          }
        }
      }

      // Set the restaurant data we found
      setRestaurant(restaurantData);

      if (!restaurantData && !slug) {
        console.warn('No restaurant data found for user:', user?.id);
        setError('No restaurant found. Please create a restaurant or contact support.');
        return;
      }
      
      // If we're on a public booking page and no restaurant was found, that's an error
      if (!restaurantData && slug) {
        setError(`Restaurant with slug "${slug}" not found.`);
        return;
      }
      
      // If we don't have a restaurant (which is valid for public booking pages), skip fetching related data
      if (!restaurantData) {
        setLoading(false);
        return;
      }

      // Fetch all related data in parallel for better performance
      try {
        const [tablesResult, hoursResult, bookingsResult, waitingResult] = await Promise.all([
          // Fetch tables
          supabase.from('restaurant_tables')
            .select('id, restaurant_id, table_number, capacity, status, location_notes, created_at, updated_at')
            .eq('restaurant_id', restaurantData.id) // This should be restaurantData.id
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
            .select(`id, restaurant_id, table_id, customer_id, booking_date, booking_time, party_size, status, notes, is_walk_in, assignment_method, was_on_waitlist, created_at, updated_at,
              *,
              customer:customers(*),
              restaurant_table:restaurant_tables(*)
            `)
            .eq('restaurant_id', restaurantData.id)
            .in('status', ['pending', 'confirmed', 'seated'])
            .order('booking_time'),

          // Fetch waiting list
          supabase
            .from('waiting_list')
            .select(`id, restaurant_id, customer_id, requested_date, requested_time, party_size, status, priority_order, notes, created_at, updated_at,
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
      } catch (dataFetchError) {
        console.error('Error fetching related data:', dataFetchError);
        // Don't set error here, as we already have the restaurant data
        // Just set empty arrays for the related data
        setTables([]);
        setOperatingHours([]);
        setBookings([]);
        setWaitingList([]);
      }
      
    } catch (err) {
      console.error('Error fetching restaurant data:', err instanceof Error ? err.message : err);
      setError(err instanceof Error ? err.message : 'An error occurred while loading restaurant data');
    } finally {
      setLoading(false);
    }
  }, [user, employeeProfile, restaurantId, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchRestaurantData(restaurantSlug);
    }
  }, [fetchRestaurantData, restaurantSlug, authLoading]);

  useEffect(() => {
    // Helper to check if only updated_at has changed
    const hasSignificantChange = (oldRecord: any, newRecord: any) => {
      if (!oldRecord || !newRecord) return true; // Always refetch if old record is missing
      for (const key in newRecord) {
        if (key !== 'updated_at' && oldRecord[key] !== newRecord[key]) {
          return true;
        }
      }
      return false;
    };

    const tablesChannel = supabase
      .channel('restaurant_tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && !hasSignificantChange(payload.old, payload.new)) {
            console.log('Table updated_at changed, but no significant data change. Skipping refetch.');
            return;
          }
          console.log('Table data changed, refreshing data...');
          fetchRestaurantData(restaurantSlug); // Refetch all data for consistency
        })
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && !hasSignificantChange(payload.old, payload.new)) {
            console.log('Booking updated_at changed, but no significant data change. Skipping refetch.');
            return;
          }
          console.log('Booking data changed, refreshing data...');
          fetchRestaurantData(restaurantSlug); // Refetch all data for consistency
        })
      .subscribe();

    const waitingChannel = supabase
      .channel('waiting_list_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_list' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && !hasSignificantChange(payload.old, payload.new)) {
            console.log('Waiting list updated_at changed, but no significant data change. Skipping refetch.');
            return;
          }
          console.log('Waiting list data changed, refreshing data...');
          fetchRestaurantData(restaurantSlug); // Refetch all data for consistency
        })
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(waitingChannel);
    };
  }, [restaurant?.id, fetchRestaurantData, restaurantSlug]);

  const updateTableStatus = async (tableId: string, status: RestaurantTable['status']) => {
    try {
      // If marking table as available, also complete any active walk-in bookings
      if (status === 'available') {
        await deactivateTableQRSession(tableId);

        const { error: completeBookingError } = await supabase
          .from('bookings')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('table_id', tableId)
          .in('status', ['seated', 'confirmed'])
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

  const deactivateTableQRSession = async (tableId: string) => {
    try {
      // Deactivate any QR sessions for this table
      const { error: sessionError } = await supabase
        .from('order_sessions')
        .update({ is_active: false })
        .eq('table_id', tableId)
        .eq('is_active', true);

      if (sessionError) {
        console.warn('Could not deactivate QR session:', sessionError);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deactivating QR session:', error);
      throw error;
    }
  };

  const updateBookingStatus = async (bookingId: string, status: BookingWithDetails['status']) => {
    try {
      // Start a transaction-like operation by getting current booking state
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');

      // If marking as seated, create order session for QR ordering
      if (status === 'seated' && booking.table_id) {
        try {
          await createOrderSession(booking.table_id, bookingId);
          console.log('Order session created for seated booking');
        } catch (sessionError) {
          console.warn('Could not create order session for seated booking:', sessionError);
          // Don't fail the booking update if session creation fails
        }
      }

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

      // Handle order status updates that affect table status
      if (booking.table_id) {
        // If this is a walk-in booking, check if all orders are paid
        if (booking.is_walk_in && status === 'completed') {
          // Check if there are any unpaid orders for this table
          const { data: unpaidOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('session_id', booking.table_id)
            .neq('status', 'paid');

          // If no unpaid orders, we can mark table as available
          if (!unpaidOrders || unpaidOrders.length === 0) {
            await updateTableStatus(booking.table_id, 'available');
          }
        }
        
        // If completing a booking, deactivate any order sessions
        if (status === 'completed') {
          try {
            const { error: sessionError } = await supabase
              .from('order_sessions')
              .update({ is_active: false })
              .eq('table_id', booking.table_id)
              .eq('is_active', true);
            
            if (sessionError) {
              console.warn('Could not deactivate order session:', sessionError);
            }
          } catch (sessionError) {
            console.warn('Error deactivating order session:', sessionError);
          }
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

  const markTableOccupiedWithSession = async (
    table: RestaurantTable, 
    partySize?: number,
    generateQRCodeHtmlCallback?: (tableNumber: string, qrCodeUrl: string) => string,
    showNotificationCallback?: (message: string, type?: 'success' | 'error' | 'info') => void
  ) => {
    try {
      console.log('markTableOccupiedWithSession called for table:', table.table_number);
      // Create order session first
      const { session: orderSession } = await createOrderSession(table.id, null);
      console.log('Order session created:', orderSession);
      
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

      const { data: newBooking, error: bookingError } = await supabase
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
        })
        .select('id')
        .single();

      if (bookingError) throw bookingError;
      console.log('Anonymous booking created for walk-in');

      // Update the order session with the booking ID
      if (orderSession) {
        const { error: sessionUpdateError } = await supabase
          .from('order_sessions')
          .update({ 
            booking_id: newBooking.id 
          })
          .eq('id', orderSession.id);

        if (sessionUpdateError) {
          console.warn('Could not update session with booking ID:', sessionUpdateError);
        }
      }

      // Check if we should attempt to print the QR code
      if (orderSession && generateQRCodeHtmlCallback) {
        try {
          console.log('Checking for printers to auto-print QR code...');
          // Find the default printer or first available printer
          const { data: printerConfigs, error: printerError } = await supabase
            .from('printer_configs')
            .select('id, printer_name, device_id, printer_id, is_default')
            .eq('restaurant_id', restaurant!.id)
            .eq('is_active', true)
            .not('device_id', 'is', null)
            .not('printer_id', 'is', null);
          
          console.log('Available printer configs:', printerConfigs);
          
          if (printerError) {
            console.error('Error fetching printer configs:', printerError);
          }
          
          if (printerConfigs && printerConfigs.length > 0) {
            // Find default printer or use first one
            const defaultPrinter = printerConfigs.find(p => p.is_default) || printerConfigs[0];
            console.log('Selected printer for auto-print:', defaultPrinter);
            
            // Generate QR code URL and HTML
            const qrCodeUrl = `${window.location.origin}/order/${orderSession.session_token}`;
            const qrCodeHtml = generateQRCodeHtmlCallback(table.table_number, qrCodeUrl);
            const base64Content = btoa(qrCodeHtml);
            
            console.log('Preparing to send print job to printer:', defaultPrinter.printer_name);
            console.log('QR code URL:', qrCodeUrl);
            
            // Print the QR code
            console.log('Sending print request to Edge Function...');
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-proxy/print`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                restaurantId: restaurant!.id,
                deviceId: defaultPrinter.device_id,
                printerId: defaultPrinter.printer_id,
                content: base64Content,
                options: {
                  mimeType: 'text/html',
                  copies: 1
                },
                jobName: `QR Code - Table ${table.table_number}`
              }),
            });
            
            console.log('Print response status:', response.status);
            const responseText = await response.text();
            console.log('Print response body:', responseText);
            
            if (response.ok) {
              if (showNotificationCallback) {
                showNotificationCallback(`QR code for Table ${table.table_number} sent to printer!`, 'success');
              }
            } else {
              console.error('Failed to print QR code:', responseText);
              if (showNotificationCallback) {
                showNotificationCallback(`Failed to print QR code: ${responseText}`, 'error');
              }
            }
          } else {
            console.log('No suitable printers found for auto-printing QR code');
            if (showNotificationCallback) {
              showNotificationCallback(
                `Table ${table.table_number} marked as occupied, but no printer configured for auto-printing QR code. You can print it manually from the QR Code Management section.`, 
                'info'
              );
            }
          }
        } catch (printError) {
          console.error('Error during QR code printing:', printError);
          if (showNotificationCallback) {
            showNotificationCallback(`Error printing QR code: ${printError instanceof Error ? printError.message : 'Unknown error'}`, 'error');
          }
        }
      }

      // Force immediate refresh to ensure UI consistency
      await fetchRestaurantData(restaurantSlug);
      
      return { success: true, session: orderSession };
    } catch (error) {
      console.error('Error marking table occupied with session:', error);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // If order is marked as paid, check if we should update table status
      if (status === 'paid') {
        // Force refresh to get updated data
        await fetchRestaurantData(restaurantSlug);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating order status:', error);
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
    deactivateTableQRSession,
    updateBookingStatus,
    assignTableToBooking,
    promoteFromWaitingList,
    cancelWaitingListEntry,
    createOrderSession,
    markTableOccupiedWithSession,
    updateOrderStatus,
    refetch: () => fetchRestaurantData(restaurantSlug)
  };
}