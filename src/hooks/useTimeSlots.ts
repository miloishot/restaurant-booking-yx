import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantOperatingHours, BookingWithDetails, TimeSlot } from '../types/database';

export function useTimeSlots(
  restaurant: Restaurant | null,
  operatingHours: RestaurantOperatingHours[],
  bookings: BookingWithDetails[],
  selectedDate: string,
  restaurantSlug?: string
) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    if (!restaurant || !selectedDate) {
      setTimeSlots([]);
      return;
    }

    generateTimeSlots(restaurantSlug);
  }, [restaurant, operatingHours, bookings, selectedDate, restaurantSlug]);

  const generateTimeSlots = async (slug?: string) => {
    if (!restaurant || !selectedDate) return;

    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Find operating hours for this day
    const todayHours = operatingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!todayHours || todayHours.is_closed) {
      setTimeSlots([]);
      return;
    }

    const slots: TimeSlot[] = [];
    const slotDuration = restaurant.time_slot_duration_minutes || 15;
    
    // Parse opening and closing times
    const [openHour, openMinute] = todayHours.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = todayHours.closing_time.split(':').map(Number);
    
    const openingMinutes = openHour * 60 + openMinute;
    const closingMinutes = closeHour * 60 + closeMinute;
    
    // Generate time slots and check availability for each
    for (let minutes = openingMinutes; minutes < closingMinutes; minutes += slotDuration) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      try {
        // Get real-time availability for this time slot
        const { data: availability } = await supabase
          .rpc('get_time_slot_availability', {
            p_restaurant_id: restaurant.id,
            p_date: selectedDate,
            p_time: timeString
          });

        if (availability && availability.length > 0) {
          const avail = availability[0];
          
          slots.push({
            time: timeString,
            available: avail.available_capacity > 0,
            totalCapacity: avail.total_capacity,
            bookedCapacity: avail.booked_capacity,
            availableCapacity: avail.available_capacity,
            waitingCount: avail.waiting_count
          });
        } else {
          // Fallback if RPC fails
          slots.push({
            time: timeString,
            available: false,
            totalCapacity: 0,
            bookedCapacity: 0,
            availableCapacity: 0,
            waitingCount: 0
          });
        }
      } catch (error) {
        console.error('Error checking availability for time slot:', timeString, error);
        // Fallback for error cases
        slots.push({
          time: timeString,
          available: false,
          totalCapacity: 0,
          bookedCapacity: 0,
          availableCapacity: 0,
          waitingCount: 0
        });
      }
    }
    
    setTimeSlots(slots);
  };

  const formatTimeSlot = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return {
    timeSlots,
    formatTimeSlot
  };
}