export type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type BookingStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type WaitingListStatus = 'waiting' | 'notified' | 'confirmed' | 'expired' | 'cancelled';
export type AssignmentMethod = 'auto' | 'manual' | 'waitlist';

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
  table_id: string | null;
  customer_id: string;
  booking_date: string;
  booking_time: string;
  party_size: number;
  status: BookingStatus;
  notes: string | null;
  is_walk_in: boolean;
  assignment_method: AssignmentMethod;
  was_on_waitlist: boolean;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  restaurant_table?: RestaurantTable;
}

export interface BookingWithDetails extends Booking {
  customer: Customer;
  restaurant_table?: RestaurantTable;
}

export interface WaitingListEntry {
  id: string;
  restaurant_id: string;
  customer_id: string;
  requested_date: string;
  requested_time: string;
  party_size: number;
  status: WaitingListStatus;
  priority_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface WaitingListWithDetails extends WaitingListEntry {
  customer: Customer;
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
  availableCapacity: number;
  waitingCount: number;
}

export interface AvailableTable {
  table_id: string;
  table_number: string;
  capacity: number;
}