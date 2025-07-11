import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantOperatingHours } from '../types/database';
import { Clock, Save, RotateCcw, Calendar, X, Plus } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

interface OperatingHoursManagerProps {
  restaurant: Restaurant;
  operatingHours: RestaurantOperatingHours[];
  onUpdate: () => void;
}

const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export function OperatingHoursManager({ restaurant, operatingHours, onUpdate }: OperatingHoursManagerProps) {
  const [hours, setHours] = useState<Record<number, { opening_time: string; closing_time: string; is_closed: boolean }>>(
    () => {
      const initialHours: Record<number, { opening_time: string; closing_time: string; is_closed: boolean }> = {};
      daysOfWeek.forEach(day => {
        const existingHours = operatingHours.find(h => h.day_of_week === day.value);
        initialHours[day.value] = {
          opening_time: existingHours?.opening_time || '11:00',
          closing_time: existingHours?.closing_time || '22:00',
          is_closed: existingHours?.is_closed || false
        };
      });
      return initialHours;
    }
  );
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customHours, setCustomHours] = useState<Record<string, { opening_time: string; closing_time: string; is_closed: boolean }>>({});

  useEffect(() => {
    fetchClosedDates();
    fetchCustomHours();
  }, [restaurant.id]);

  const fetchClosedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_closed_dates')
        .select('closed_date')
        .eq('restaurant_id', restaurant.id);

      if (error && error.code !== 'PGRST116') throw error;
      setClosedDates(data?.map(d => d.closed_date) || []);
    } catch (err) {
      console.error('Error fetching closed dates:', err);
    }
  };

  const fetchCustomHours = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_custom_hours')
        .select('*')
        .eq('restaurant_id', restaurant.id);

      if (error && error.code !== 'PGRST116') throw error;
      
      const customHoursMap: Record<string, { opening_time: string; closing_time: string; is_closed: boolean }> = {};
      data?.forEach(hour => {
        customHoursMap[hour.date] = {
          opening_time: hour.opening_time,
          closing_time: hour.closing_time,
          is_closed: hour.is_closed
        };
      });
      setCustomHours(customHoursMap);
    } catch (err) {
      console.error('Error fetching custom hours:', err);
    }
  };

  const handleTimeChange = (dayOfWeek: number, field: 'opening_time' | 'closing_time', value: string) => {
    setHours(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value
      }
    }));
  };

  const handleClosedToggle = (dayOfWeek: number, isClosed: boolean) => {
    setHours(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        is_closed: isClosed
      }
    }));
  };

  const copyToAllDays = (dayOfWeek: number) => {
    const sourceHours = hours[dayOfWeek];
    const newHours = { ...hours };
    
    daysOfWeek.forEach(day => {
      newHours[day.value] = { ...sourceHours };
    });
    
    setHours(newHours);
  };

  const addClosedDate = async () => {
    if (!selectedDate) return;

    try {
      const { error } = await supabase
        .from('restaurant_closed_dates')
        .insert({
          restaurant_id: restaurant.id,
          closed_date: selectedDate,
          reason: 'Manually closed'
        });

      if (error) throw error;
      
      setClosedDates([...closedDates, selectedDate]);
      setSelectedDate('');
      
      showNotification('Date marked as closed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add closed date');
    }
  };

  const removeClosedDate = async (date: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_closed_dates')
        .delete()
        .eq('restaurant_id', restaurant.id)
        .eq('closed_date', date);

      if (error) throw error;
      
      setClosedDates(closedDates.filter(d => d !== date));
      showNotification('Closed date removed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove closed date');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Update or insert operating hours for each day
      for (const day of daysOfWeek) {
        const dayHours = hours[day.value];
        
        const { error: upsertError } = await supabase
          .from('restaurant_operating_hours')
          .upsert({
            restaurant_id: restaurant.id,
            day_of_week: day.value,
            opening_time: dayHours.opening_time,
            closing_time: dayHours.closing_time,
            is_closed: dayHours.is_closed
          }, {
            onConflict: 'restaurant_id,day_of_week'
          });

        if (upsertError) throw upsertError;
      }

      // Show success message
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Operating hours updated successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update operating hours');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Operating Hours
        </h2>
        <p className="text-gray-600">
          Set your restaurant's opening and closing times for each day of the week.
        </p>
        
        <div className="mt-4 flex space-x-4">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Manage Closed Days
          </button>
        </div>
      </div>

      {/* Calendar Section */}
      {showCalendar && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Closed Days Management</h3>
          
          {/* Add Closed Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Closed Date
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={addClosedDate}
                disabled={!selectedDate}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Mark as Closed
              </button>
            </div>
          </div>

          {/* Closed Dates List */}
          {closedDates.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">Currently Closed Dates</h4>
              <div className="space-y-2">
                {closedDates.map(date => (
                  <div key={date} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                    <span className="text-red-800 font-medium">
                      {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                    </span>
                    <button
                      onClick={() => removeClosedDate(date)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {daysOfWeek.map(day => (
          <div key={day.value} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
            <div className="w-24">
              <label className="font-medium text-gray-700">{day.label}</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={hours[day.value].is_closed}
                onChange={(e) => handleClosedToggle(day.value, e.target.checked)}
                className="rounded"
              />
              <label className="text-sm text-gray-600">Closed</label>
            </div>

            {!hours[day.value].is_closed && (
              <>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Open:</label>
                  <input
                    type="time"
                    value={hours[day.value].opening_time}
                    onChange={(e) => handleTimeChange(day.value, 'opening_time', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Close:</label>
                  <input
                    type="time"
                    value={hours[day.value].closing_time}
                    onChange={(e) => handleTimeChange(day.value, 'closing_time', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={() => copyToAllDays(day.value)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  title="Copy to all days"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Copy to all
                </button>
              </>
            )}

            {hours[day.value].is_closed && (
              <div className="text-gray-500 italic">Restaurant is closed</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <p className="mb-1">Current time slot duration: {restaurant.time_slot_duration_minutes} minutes</p>
            <p>Time slots will be generated based on these operating hours.</p>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Hours'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Hours Preview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {daysOfWeek.map(day => (
            <div key={day.value} className="p-3 bg-gray-50 rounded">
              <div className="font-medium text-gray-800">{day.label}</div>
              <div className="text-sm text-gray-600">
                {hours[day.value].is_closed ? (
                  'Closed'
                ) : (
                  `${formatTime(hours[day.value].opening_time)} - ${formatTime(hours[day.value].closing_time)}`
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}