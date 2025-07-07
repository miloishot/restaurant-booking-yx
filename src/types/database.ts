export type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type BookingStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  time_slot_duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  status: TableStatus;
  location_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  restaurant_id: string;
  table_id: string | null; // Now nullable for auto-assignment
  customer_id: string;
  booking_date: string;
  booking_time: string;
  party_size: number;
  status: BookingStatus;
  notes: string | null;
  is_walk_in: boolean;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  restaurant_table?: RestaurantTable;
}

export interface BookingWithDetails extends Booking {
  customer: Customer;
  restaurant_table?: RestaurantTable; // Optional since table might not be assigned yet
}

export interface RestaurantOperatingHours {
  id: string;
  restaurant_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  opening_time: string;
  closing_time: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  totalCapacity: number;
  bookedCapacity: number;
}