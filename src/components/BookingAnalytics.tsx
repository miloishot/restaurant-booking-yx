import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { BarChart3, TrendingUp, Clock, Users, Calendar, AlertTriangle, Download, Filter } from 'lucide-react';

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

export function BookingAnalytics({ restaurant }: BookingAnalyticsProps) {
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotAnalytics[]>([]);
  const [dayAnalytics, setDayAnalytics] = useState<DayAnalytics[]>([]);
  const [bookingTrends, setBookingTrends] = useState<BookingTrends[]>([]);
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

      // Fetch time slot analytics
      const { data: timeSlotAnalytics } = await supabase
        .rpc('get_time_slot_analytics', {
          p_restaurant_id: restaurant.id,
          p_start_date: format(startDate, 'yyyy-MM-dd'),
          p_end_date: format(endDate, 'yyyy-MM-dd')
        });

      // Fetch day of week analytics
      const { data: dayOfWeekAnalytics } = await supabase
        .rpc('get_day_analytics', {
          p_restaurant_id: restaurant.id,
          p_start_date: format(startDate, 'yyyy-MM-dd'),
          p_end_date: format(endDate, 'yyyy-MM-dd')
        });

      // Fetch booking trends
      const { data: trendsData } = await supabase
        .rpc('get_booking_trends', {
          p_restaurant_id: restaurant.id,
          p_start_date: format(startDate, 'yyyy-MM-dd'),
          p_end_date: format(endDate, 'yyyy-MM-dd')
        });

      setTimeSlotData(timeSlotAnalytics || []);
      setDayAnalytics(dayOfWeekAnalytics || []);
      setBookingTrends(trendsData || []);
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
    const csvData = [
      ['Time Slot', 'Total Bookings', 'Avg Party Size', 'Waitlist Triggered'],
      ...timeSlotData.map(slot => [
        formatTime(slot.time_slot),
        slot.total_bookings,
        slot.avg_party_size.toFixed(1),
        slot.waitlist_triggered
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
              Booking Analytics Dashboard
            </h2>
            <p className="text-gray-600">Peak time insights and booking patterns</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Bookings</p>
                <p className="text-2xl font-bold text-blue-800">{totalBookings}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Waitlist Events</p>
                <p className="text-2xl font-bold text-orange-800">{totalWaitlist}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Avg Lead Time</p>
                <p className="text-2xl font-bold text-green-800">{avgLeadTime.toFixed(1)} days</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Avg Party Size</p>
                <p className="text-2xl font-bold text-purple-800">
                  {(timeSlotData.reduce((sum, slot) => sum + slot.avg_party_size, 0) / timeSlotData.length || 0).toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Slot Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800">Bookings by Time Slot (15-Minute Intervals)</h3>
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
        
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Chart */}
            <div className="mb-6 h-64 flex items-end space-x-1">
              {timeSlotData.map((slot, index) => {
                const value = getMetricValue(slot);
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const isWaitlistTriggered = slot.waitlist_triggered > 0;
                
                return (
                  <div key={slot.time_slot} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        isWaitlistTriggered 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : slot.peak_indicator 
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-blue-400 hover:bg-blue-500'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${formatTime(slot.time_slot)}: ${value} ${selectedMetric === 'party_size' ? 'avg' : ''}`}
                    />
                    <div className="text-xs text-gray-600 mt-1 transform -rotate-45 origin-top-left">
                      {formatTime(slot.time_slot)}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-400 rounded mr-2"></div>
                <span>Regular</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                <span>Peak Hours</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                <span>Waitlist Triggered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="mt-8">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Detailed Time Slot Data</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Slot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Bookings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Party Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Waitlist Triggered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timeSlotData.map((slot) => (
                  <tr key={slot.time_slot} className={slot.peak_indicator ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatTime(slot.time_slot)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {slot.total_bookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {slot.avg_party_size.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {slot.waitlist_triggered > 0 ? (
                        <span className="text-red-600 font-semibold">{slot.waitlist_triggered}</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {slot.peak_indicator && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Peak Hour
                        </span>
                      )}
                      {slot.waitlist_triggered > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 ml-2">
                          High Demand
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Peak Hours Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-orange-600" />
          Peak Booking Hours
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {peakHours.map((slot, index) => (
            <div key={slot.time_slot} className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-orange-800">#{index + 1}</span>
                <span className="text-2xl font-bold text-orange-600">{slot.total_bookings}</span>
              </div>
              <div className="text-orange-800">
                <p className="font-semibold">{formatTime(slot.time_slot)}</p>
                <p className="text-sm">Avg party: {slot.avg_party_size.toFixed(1)}</p>
                {slot.waitlist_triggered > 0 && (
                  <p className="text-sm text-red-600 font-medium">
                    Waitlist: {slot.waitlist_triggered} times
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day of Week Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Bookings by Day of Week</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Day
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Bookings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peak Time Slot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Party Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waitlist Frequency
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dayAnalytics.map((day) => (
                <tr key={day.day_of_week}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {day.day_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.total_bookings}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.peak_time_slot ? formatTime(day.peak_time_slot) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.avg_party_size.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.waitlist_frequency > 0 ? (
                      <span className="text-orange-600 font-semibold">{day.waitlist_frequency}%</span>
                    ) : (
                      <span className="text-green-600">0%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Operational Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">Peak Time Management</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Increase staff during {peakHours[0] ? formatTime(peakHours[0].time_slot) : 'peak hours'}</li>
              <li>• Consider pre-seating preparation 30 minutes before peak</li>
              <li>• Optimize table turnover during high-demand periods</li>
            </ul>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h4 className="font-semibold text-orange-800 mb-2">Waitlist Optimization</h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• {totalWaitlist > 0 ? 'High waitlist activity detected' : 'Low waitlist activity'}</li>
              <li>• Consider dynamic pricing during peak hours</li>
              <li>• Offer incentives for off-peak dining</li>
            </ul>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">Capacity Utilization</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Average lead time: {avgLeadTime.toFixed(1)} days</li>
              <li>• Promote advance bookings for better planning</li>
              <li>• Consider table size optimization</li>
            </ul>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-2">Revenue Opportunities</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• Target marketing during slow periods</li>
              <li>• Implement happy hour specials</li>
              <li>• Consider group booking promotions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}