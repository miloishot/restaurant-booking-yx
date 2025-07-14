export type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type BookingStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type WaitingListStatus = 'waiting' | 'notified' | 'confirmed' | 'expired' | 'cancelled';
export type AssignmentMethod = 'auto' | 'manual' | 'waitlist';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  owner_id: string;
  time_slot_duration_minutes: number;
  print_api_url: string | null;
  print_api_key: string | null;
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

export interface PrinterConfig {
  id: string;
  restaurant_id: string;
  printer_name: string;
  printer_type: 'network' | 'usb' | 'bluetooth';
  ip_address: string | null;
  port: number | null;
  device_id: string | null;
  printer_id: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  restaurant_id: string;
  employee_id: string;
  name: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  restaurant_id: string;
  employee_id: string;
  punch_in_time: string;
  punch_out_time: string | null;
  total_hours: number | null;
  date: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
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

// QR Ordering System Types
export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_sgd: number;
  image_url: string | null;
  is_available: boolean;
  display_order: number;
  allergens: string[] | null;
  dietary_info: string[] | null;
  created_at: string;
  updated_at: string;
  category?: MenuCategory;
}

export interface LoyaltyUser {
  id: string;
  restaurant_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  total_spent_sgd: number;
  order_count: number;
  discount_eligible: boolean;
  last_order_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderSession {
  id: string;
  restaurant_id: string;
  table_id: string;
  booking_id: string | null;
  session_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  table?: RestaurantTable;
  booking?: Booking;
}

export interface Order {
  id: string;
  restaurant_id: string;
  session_id: string;
  order_number: string;
  loyalty_user_ids: string[] | null;
  subtotal_sgd: number;
  discount_sgd: number;
  total_sgd: number;
  discount_applied: boolean;
  triggering_user_id: string | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed';
  notes: string | null;
  created_at: string;
  updated_at: string;
  session?: OrderSession;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price_sgd: number;
  total_price_sgd: number;
  special_instructions: string | null;
  created_at: string;
  menu_item?: MenuItem;
}

export interface OrderWithDetails extends Order {
  session: OrderSession;
  items: (OrderItem & { menu_item: MenuItem })[];
}

export interface CartItem {
  menu_item: MenuItem;
  quantity: number;
  special_instructions?: string;
}

export interface LoyaltyDiscount {
  discount_eligible: boolean;
  discount_amount: number;
  triggering_user_id: string | null;
}