import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  Calendar, 
  AlertTriangle, 
  Download, 
  Filter, 
  Activity, 
  Target, 
  Zap,
  ChefHat,
  DollarSign,
  Award,
  PieChart
} from 'lucide-react';

interface BookingAnalyticsProps {
  restaurant: Restaurant;
}

interface TimeSlotAnalytics {
  time_slot: string;
  total_bookings: number;
  total_party_size: number;
  avg_party_size: number;
  waitlist_triggered: number;
  peak_indicator: boolean;
}

interface DayAnalytics {
  day_name: string;
  day_of_week: number;
  total_bookings: number;
  peak_time_slot: string;
  avg_party_size: number;
  waitlist_frequency: number;
}

interface BookingTrends {
  booking_date: string;
  total_bookings: number;
  avg_lead_time: number;
  waitlist_count: number;
}

interface PopularDish {
  dish_name: string;
  category_name: string;
  total_orders: number;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  popularity_rank: number;
}

interface RevenueAnalytics {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  total_discounts: number;
  loyalty_orders: number;
  top_revenue_day: string;
  top_revenue_amount: number;
}

interface CategoryPerformance {
  category_name: string;
  total_orders: number;
  total_revenue: number;
  avg_items_per_order: number;
  category_percentage: number;
}

export function BookingAnalytics({ restaurant }: BookingAnalyticsProps) {
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotAnalytics[]>([]);
  const [dayAnalytics, setDayAnalytics] = useState<DayAnalytics[]>([]);
  const [bookingTrends, setBookingTrends] = useState<BookingTrends[]>([]);
  const [popularDishes, setPopularDishes] = useState<PopularDish[]>([]);
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics | null>(null);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedMetric, setSelectedMetric] = useState<'bookings' | 'waitlist' | 'party_size'>('bookings');

  useEffect(() => {
    fetchAnalyticsData();
  }, [restaurant.id, dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case 'week':
          startDate = subDays(endDate, 7);
          break;
        case 'month':
          startDate = subDays(endDate, 30);
          break;
        case 'quarter':
          startDate = subDays(endDate, 90);
          break;
      }

      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      // Fetch all analytics data in parallel
      const [
        timeSlotResult,
        dayAnalyticsResult,
        trendsResult,
        popularDishesResult,
        revenueResult,
        categoryResult
      ] = await Promise.all([
        supabase.rpc('get_booking_analytics', {
          p_restaurant_id: restaurant.id,
          p_start_date: startDateStr,
          p_end_date: endDateStr
        }),
        supabase.rpc('get_daily_analytics', {
          p_restaurant_id: restaurant.id,
          p_start_date: startDateStr,
          p_end_date: endDateStr
        }),
        supabase.rpc('get_booking_trends', {
          p_end_date: endDateStr,
          p_restaurant_id: restaurant.id,
          p_start_date: startDateStr
        }),
        supabase.rpc('get_popular_dishes', {
          p_restaurant_id: restaurant.id,
          p_start_date: startDateStr,
          p_end_date: endDateStr,
          p_limit: 10
        }),
        supabase.rpc('get_revenue_analytics', {
          p_restaurant_id: restaurant.id,
          p_start_date: startDateStr,
          p_end_date: endDateStr
        }),
        supabase.rpc('get_category_performance', {
          p_restaurant_id: restaurant.id,
          p_start_date: startDateStr,
          p_end_date: endDateStr
        })
      ]);

      // Handle errors and set data
      if (timeSlotResult.error) {
        console.error('Error fetching time slot analytics:', timeSlotResult.error);
        setTimeSlotData([]);
      } else {
        setTimeSlotData(timeSlotResult.data || []);
      }

      if (dayAnalyticsResult.error) {
        console.error('Error fetching day analytics:', dayAnalyticsResult.error);
        setDayAnalytics([]);
      } else {
        setDayAnalytics(dayAnalyticsResult.data || []);
      }

      if (trendsResult.error) {
        console.error('Error fetching trends:', trendsResult.error);
        setBookingTrends([]);
      } else {
        setBookingTrends(trendsResult.data || []);
      }

      if (popularDishesResult.error) {
        console.error('Error fetching popular dishes:', popularDishesResult.error);
        setPopularDishes([]);
      } else {
        setPopularDishes(popularDishesResult.data || []);
      }

      if (revenueResult.error) {
        console.error('Error fetching revenue analytics:', revenueResult.error);
        setRevenueAnalytics(null);
      } else {
        setRevenueAnalytics(revenueResult.data?.[0] || null);
      }

      if (categoryResult.error) {
        console.error('Error fetching category performance:', categoryResult.error);
        setCategoryPerformance([]);
      } else {
        setCategoryPerformance(categoryResult.data || []);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const formatPrice = (price: number) => {
    return `S$${price.toFixed(2)}`;
  };

  const getPeakHours = () => {
    const sortedSlots = [...timeSlotData].sort((a, b) => b.total_bookings - a.total_bookings);
    return sortedSlots.slice(0, 3);
  };

  const getMaxValue = () => {
    switch (selectedMetric) {
      case 'bookings':
        return Math.max(...timeSlotData.map(slot => slot.total_bookings));
      case 'waitlist':
        return Math.max(...timeSlotData.map(slot => slot.waitlist_triggered));
      case 'party_size':
        return Math.max(...timeSlotData.map(slot => slot.avg_party_size));
      default:
        return 0;
    }
  };

  const getMetricValue = (slot: TimeSlotAnalytics) => {
    switch (selectedMetric) {
      case 'bookings':
        return slot.total_bookings;
      case 'waitlist':
        return slot.waitlist_triggered;
      case 'party_size':
        return slot.avg_party_size;
      default:
        return 0;
    }
  };

  const exportData = () => {
    // Prepare comprehensive analytics data for export
    const csvData = [];
    
    // Header section
    csvData.push(['Restaurant Analytics Report']);
    csvData.push([`Restaurant: ${restaurant.name}`]);
    csvData.push([`Date Range: ${dateRange}`]);
    csvData.push([`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`]);
    csvData.push(['']); // Empty row
    
    // Key Metrics Summary
    csvData.push(['KEY METRICS SUMMARY']);
    csvData.push(['Metric', 'Value']);
    csvData.push(['Total Bookings', totalBookings]);
    csvData.push(['Total Waitlist Entries', totalWaitlist]);
    csvData.push(['Average Lead Time (days)', avgLeadTime.toFixed(1)]);
    if (revenueAnalytics) {
      csvData.push(['Total Revenue', formatPrice(revenueAnalytics.total_revenue)]);
      csvData.push(['Total Orders', revenueAnalytics.total_orders]);
      csvData.push(['Average Order Value', formatPrice(revenueAnalytics.avg_order_value)]);
      csvData.push(['Total Discounts', formatPrice(revenueAnalytics.total_discounts)]);
      csvData.push(['Loyalty Orders', revenueAnalytics.loyalty_orders]);
    }
    csvData.push(['']); // Empty row
    
    // Time Slot Analysis
    csvData.push(['TIME SLOT ANALYSIS']);
    csvData.push(['Time Slot', 'Total Bookings', 'Avg Party Size', 'Waitlist Triggered', 'Peak Hour']);
    timeSlotData.forEach(slot => {
      csvData.push([
        formatTime(slot.time_slot),
        slot.total_bookings,
        slot.avg_party_size.toFixed(1),
        slot.waitlist_triggered,
        slot.peak_indicator ? 'Yes' : 'No'
      ]);
    });
    csvData.push(['']); // Empty row
    
    // Daily Analytics
    if (dayAnalytics.length > 0) {
      csvData.push(['DAILY ANALYTICS']);
      csvData.push(['Day', 'Total Bookings', 'Peak Time', 'Avg Party Size', 'Waitlist Frequency']);
      dayAnalytics.forEach(day => {
        csvData.push([
          day.day_name.trim(),
          day.total_bookings,
          formatTime(day.peak_time_slot),
          day.avg_party_size.toFixed(1),
          day.waitlist_frequency
        ]);
      });
      csvData.push(['']); // Empty row
    }
    
    // Booking Trends
    if (bookingTrends.length > 0) {
      csvData.push(['BOOKING TRENDS']);
      csvData.push(['Date', 'Total Bookings', 'Avg Lead Time', 'Waitlist Count']);
      bookingTrends.forEach(trend => {
        csvData.push([
          format(new Date(trend.booking_date), 'yyyy-MM-dd'),
          trend.total_bookings,
          trend.avg_lead_time.toFixed(1),
          trend.waitlist_count
        ]);
      });
      csvData.push(['']); // Empty row
    }
    
    // Popular Dishes
    if (popularDishes.length > 0) {
      csvData.push(['POPULAR DISHES']);
      csvData.push(['Rank', 'Dish Name', 'Category', 'Total Orders', 'Quantity Sold', 'Revenue', 'Avg Price']);
      popularDishes.forEach((dish, index) => {
        csvData.push([
          index + 1,
          dish.dish_name,
          dish.category_name,
          dish.total_orders,
          dish.total_quantity,
          formatPrice(dish.total_revenue),
          formatPrice(dish.avg_price)
        ]);
      });
      csvData.push(['']); // Empty row
    }
    
    // Category Performance
    if (categoryPerformance.length > 0) {
      csvData.push(['CATEGORY PERFORMANCE']);
      csvData.push(['Category', 'Total Orders', 'Revenue', 'Avg Items per Order', 'Percentage of Total']);
      categoryPerformance.forEach(category => {
        csvData.push([
          category.category_name,
          category.total_orders,
          formatPrice(category.total_revenue),
          category.avg_items_per_order.toFixed(1),
          `${category.category_percentage}%`
        ]);
      });
    }

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restaurant-analytics-${restaurant.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const peakHours = getPeakHours();
  const maxValue = getMaxValue();
  const totalBookings = timeSlotData.reduce((sum, slot) => sum + slot.total_bookings, 0);
  const totalWaitlist = timeSlotData.reduce((sum, slot) => sum + slot.waitlist_triggered, 0);
  const avgLeadTime = bookingTrends.reduce((sum, trend) => sum + trend.avg_lead_time, 0) / bookingTrends.length || 0;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <BarChart3 className="w-6 h-6 mr-2 text-blue-600" />
              Restaurant Analytics Dashboard
            </h2>
            <p className="text-gray-600">Comprehensive insights into bookings, orders, and revenue</p>
          </div>
          
          <div className="flex space-x-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'quarter')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
            </select>
            
            <button
              onClick={exportData}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Bookings</p>
                <p className="text-2xl font-bold text-blue-800">{totalBookings}</p>
                <p className="text-xs text-blue-600">Reservation system</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-800">
                  {revenueAnalytics ? formatPrice(revenueAnalytics.total_revenue) : 'S$0.00'}
                </p>
                <p className="text-xs text-green-600">QR ordering system</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-orange-600">Total Orders</p>
                <p className="text-2xl font-bold text-orange-800">
                  {revenueAnalytics ? revenueAnalytics.total_orders : 0}
                </p>
                <p className="text-xs text-orange-600">Food & beverage orders</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-purple-800">
                  {revenueAnalytics ? formatPrice(revenueAnalytics.avg_order_value) : 'S$0.00'}
                </p>
                <p className="text-xs text-purple-600">Per order average</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Dishes Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
          <Award className="w-5 h-5 mr-2 text-yellow-600" />
          Most Popular Dishes
        </h3>
        
        {popularDishes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Dishes List */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Top Performers</h4>
              <div className="space-y-3">
                {popularDishes.slice(0, 5).map((dish, index) => (
                  <div key={dish.dish_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3 ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-400' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800">{dish.dish_name}</p>
                        <p className="text-xs text-gray-600">{dish.category_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">{dish.total_quantity} sold</p>
                      <p className="text-xs text-green-600">{formatPrice(dish.total_revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Performance Chart */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Category Performance</h4>
              <div className="space-y-3">
                {categoryPerformance.slice(0, 5).map((category, index) => {
                  const maxRevenue = Math.max(...categoryPerformance.map(c => c.total_revenue));
                  const width = (category.total_revenue / maxRevenue) * 100;
                  
                  return (
                    <div key={category.category_name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{category.category_name}</span>
                        <span className="text-sm text-gray-600">{formatPrice(category.total_revenue)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{category.total_orders} orders</span>
                        <span>{category.category_percentage}% of total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No order data available yet</p>
            <p className="text-sm text-gray-500">Popular dishes will appear here once customers start ordering</p>
          </div>
        )}
      </div>

      {/* Revenue Analytics */}
      {revenueAnalytics && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Revenue Analytics
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-3">Revenue Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-green-700">Total Revenue:</span>
                  <span className="font-bold text-green-800">{formatPrice(revenueAnalytics.total_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-green-700">Total Discounts:</span>
                  <span className="font-bold text-red-600">-{formatPrice(revenueAnalytics.total_discounts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-green-700">Net Revenue:</span>
                  <span className="font-bold text-green-800">
                    {formatPrice(revenueAnalytics.total_revenue - revenueAnalytics.total_discounts)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-3">Order Metrics</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-blue-700">Total Orders:</span>
                  <span className="font-bold text-blue-800">{revenueAnalytics.total_orders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-blue-700">Avg Order Value:</span>
                  <span className="font-bold text-blue-800">{formatPrice(revenueAnalytics.avg_order_value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-blue-700">Loyalty Orders:</span>
                  <span className="font-bold text-purple-600">{revenueAnalytics.loyalty_orders}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-3">Best Performance</h4>
              <div className="space-y-2">
                <div className="text-center">
                  <p className="text-sm text-yellow-700">Top Revenue Day</p>
                  <p className="font-bold text-yellow-800">
                    {format(new Date(revenueAnalytics.top_revenue_day), 'MMM d, yyyy')}
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    {formatPrice(revenueAnalytics.top_revenue_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Trends Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-green-600" />
          Daily Booking Trends
        </h3>
        
        {bookingTrends.length > 0 ? (
          <div className="h-64 flex items-end justify-between space-x-2 mb-4">
            {bookingTrends.map((trend, index) => {
              const maxTrendValue = Math.max(...bookingTrends.map(t => t.total_bookings));
              const height = maxTrendValue > 0 ? (trend.total_bookings / maxTrendValue) * 100 : 0;
              
              return (
                <div key={trend.booking_date} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all duration-500 hover:from-green-600 hover:to-green-500"
                      style={{ height: `${height}%` }}
                      title={`${format(new Date(trend.booking_date), 'MMM d')}: ${trend.total_bookings} bookings`}
                    />
                    <div className="text-xs text-gray-600 mt-2 text-center">
                      {format(new Date(trend.booking_date), 'MMM d')}
                    </div>
                    <div className="text-xs font-semibold text-gray-800">
                      {trend.total_bookings}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No booking trend data available</p>
          </div>
        )}
      </div>

      {/* Time Slot Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800">Bookings by Time Slot</h3>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as 'bookings' | 'waitlist' | 'party_size')}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bookings">Total Bookings</option>
              <option value="waitlist">Waitlist Triggered</option>
              <option value="party_size">Avg Party Size</option>
            </select>
          </div>
        </div>
        
        {timeSlotData.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="mb-6 h-80 flex items-end space-x-1 bg-gradient-to-t from-gray-50 to-white p-4 rounded-lg border">
                {timeSlotData.slice(0, 24).map((slot, index) => {
                  const value = getMetricValue(slot);
                  const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  const isWaitlistTriggered = slot.waitlist_triggered > 0;
                  
                  return (
                    <div key={slot.time_slot} className="flex-1 flex flex-col items-center group">
                      <div className="relative w-full">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            isWaitlistTriggered 
                              ? 'bg-gradient-to-t from-red-500 to-red-400 hover:from-red-600 hover:to-red-500' 
                              : slot.peak_indicator 
                                ? 'bg-gradient-to-t from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                                : 'bg-gradient-to-t from-blue-400 to-blue-300 hover:from-blue-500 hover:to-blue-400'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                          <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                            <div className="font-semibold">{formatTime(slot.time_slot)}</div>
                            <div>Bookings: {slot.total_bookings}</div>
                            <div>Avg Party: {slot.avg_party_size.toFixed(1)}</div>
                            {slot.waitlist_triggered > 0 && (
                              <div className="text-red-300">Waitlist: {slot.waitlist_triggered}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600 mt-1 transform -rotate-45 origin-top-left w-8">
                        {formatTime(slot.time_slot).split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No time slot data available</p>
          </div>
        )}
      </div>

      {/* Peak Hours Summary */}
      {peakHours.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-600" />
            Top Peak Hours
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {peakHours.map((slot, index) => (
              <div key={slot.time_slot} className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <span className="bg-yellow-500 text-white text-sm font-bold px-2 py-1 rounded-full mr-2">
                      #{index + 1}
                    </span>
                    <span className="text-lg font-bold text-yellow-800">{slot.total_bookings}</span>
                  </div>
                  <Target className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="text-yellow-800">
                  <p className="font-semibold text-lg">{formatTime(slot.time_slot)}</p>
                  <p className="text-sm">Avg party: {slot.avg_party_size.toFixed(1)} guests</p>
                  {slot.waitlist_triggered > 0 && (
                    <p className="text-sm text-red-600 font-medium mt-1">
                      ⚠️ Waitlist: {slot.waitlist_triggered} times
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">📊 Operational Insights & Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Peak Time Management
            </h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• Increase staff during {peakHours[0] ? formatTime(peakHours[0].time_slot) : 'peak hours'}</li>
              <li>• Consider pre-seating preparation 30 minutes before peak</li>
              <li>• Optimize table turnover during high-demand periods</li>
              <li>• Implement express service options during rush hours</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
            <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Menu Optimization
            </h4>
            <ul className="text-sm text-orange-700 space-y-2">
              <li>• Promote top-performing dishes during slow periods</li>
              <li>• Consider seasonal variations of popular items</li>
              <li>• Optimize inventory based on dish popularity</li>
              <li>• Train staff on upselling popular categories</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Revenue Growth
            </h4>
            <ul className="text-sm text-green-700 space-y-2">
              <li>• Average lead time: {avgLeadTime.toFixed(1)} days</li>
              <li>• Promote advance bookings for better planning</li>
              <li>• Implement dynamic pricing during peak hours</li>
              <li>• Focus on high-margin menu items</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Customer Experience
            </h4>
            <ul className="text-sm text-purple-700 space-y-2">
              <li>• Develop loyalty programs for frequent diners</li>
              <li>• Offer incentives for off-peak dining</li>
              <li>• Implement feedback collection for popular dishes</li>
              <li>• Consider combo deals with top-performing items</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}