import { useState, useEffect } from 'react';
import { Restaurant, RestaurantOperatingHours, BookingWithDetails, TimeSlot } from '../types/database';

export function useTimeSlots(
  restaurant: Restaurant | null,
  operatingHours: RestaurantOperatingHours[],
  bookings: BookingWithDetails[],
  selectedDate: string
) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    if (!restaurant || !selectedDate) {
      setTimeSlots([]);
      return;
    }

    generateTimeSlots();
  }, [restaurant, operatingHours, bookings, selectedDate]);

  const generateTimeSlots = () => {
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
    
    // Generate time slots
    for (let minutes = openingMinutes; minutes < closingMinutes; minutes += slotDuration) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Count bookings for this time slot
      const slotBookings = bookings.filter(booking => 
        booking.booking_date === selectedDate && 
        booking.booking_time === timeString &&
        ['pending', 'confirmed', 'seated'].includes(booking.status)
      );
      
      const bookedCapacity = slotBookings.reduce((sum, booking) => sum + booking.party_size, 0);
      
      // For simplicity, assume total restaurant capacity is sum of all table capacities
      // In a real system, you might want to be more sophisticated about this
      const totalCapacity = 50; // This could be calculated from tables or set as a restaurant property
      
      slots.push({
        time: timeString,
        available: bookedCapacity < totalCapacity,
        totalCapacity,
        bookedCapacity
      });
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