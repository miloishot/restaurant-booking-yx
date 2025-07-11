import React, { useState } from 'react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { useTimeSlots } from '../hooks/useTimeSlots';
import { TimeSlotBookingForm } from './TimeSlotBookingForm';
import { Calendar, Clock, Users, Phone, MapPin, ChefHat } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface CustomerBookingProps {
  restaurantSlug?: string;
}

export function CustomerBooking({ restaurantSlug }: CustomerBookingProps) {
  const { restaurant, bookings, operatingHours, loading, error } = useRestaurantData();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [showBookingForm, setShowBookingForm] = useState(false);

  const { timeSlots, formatTimeSlot } = useTimeSlots(restaurant, operatingHours, bookings, selectedDate, restaurantSlug);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurant information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Unable to Load Restaurant</h2>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Restaurant Not Found</h2>
          <p className="text-gray-600">Please check back later.</p>
        </div>
      </div>
    );
  }

  const selectedDateObj = new Date(selectedDate);
  const dayOfWeek = selectedDateObj.getDay();
  const todayHours = operatingHours.find(h => h.day_of_week === dayOfWeek);
  const isRestaurantClosed = !todayHours || todayHours.is_closed;

  const availableTimeSlots = timeSlots.filter(slot => slot.available);
  const nextSevenDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      display: format(date, i === 0 ? "'Today'" : i === 1 ? "'Tomorrow'" : 'EEE, MMM d'),
      dayOfWeek: date.getDay()
    };
  });

  const handleTimeSlotSelect = (time: string) => {
    setSelectedTime(time);
    setShowBookingForm(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {restaurantSlug && (
            <div className="text-center mb-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Online Booking
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{restaurant.name}</h1>
            <p className="text-lg text-gray-600 mb-6">
              {restaurantSlug 
                ? 'Reserve your table for an unforgettable dining experience' 
                : 'Customer booking interface preview'
              }
            </p>
            
            <div className="flex justify-center items-center space-x-8 text-sm text-gray-600">
              {restaurant.address && (
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  {restaurant.address}
                </div>
              )}
              {restaurant.phone && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  {restaurant.phone}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Booking Process */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Make a Reservation</h2>
          
          {/* Step 1: Party Size */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              1. Party Size
            </h3>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(size => (
                <button
                  key={size}
                  onClick={() => setPartySize(size)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    partySize === size
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {size} {size === 1 ? 'Guest' : 'Guests'}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Date Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-green-600" />
              2. Select Date
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {nextSevenDays.map(day => {
                const dayHours = operatingHours.find(h => h.day_of_week === day.dayOfWeek);
                const isClosed = !dayHours || dayHours.is_closed;
                
                return (
                  <button
                    key={day.date}
                    onClick={() => !isClosed && setSelectedDate(day.date)}
                    disabled={isClosed}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      selectedDate === day.date
                        ? 'bg-green-600 text-white border-green-600'
                        : isClosed
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-300'
                    }`}
                  >
                    <div className="font-medium text-sm leading-tight">{day.display}</div>
                    {isClosed ? (
                      <div className="text-xs mt-1 text-red-500 font-medium">Closed</div>
                    ) : dayHours ? (
                      <div className="text-xs mt-1 leading-tight">
                        {dayHours.opening_time.slice(0, 5)} - {dayHours.closing_time.slice(0, 5)}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Time Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-purple-600" />
              3. Select Time
            </h3>
            
            {isRestaurantClosed ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Restaurant Closed</h4>
                <p className="text-gray-600">We're closed on this day. Please select another date.</p>
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">No Time Slots Available</h4>
                <p className="text-gray-600">Please select a different date.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {timeSlots.map(slot => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && handleTimeSlotSelect(slot.time)}
                    disabled={!slot.available}
                    className={`p-4 rounded-lg border-2 text-center transition-all min-h-[70px] flex flex-col justify-center ${
                      slot.available
                        ? 'bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-medium text-sm">{formatTimeSlot(slot.time)}</div>
                    <div className="text-xs mt-1 text-gray-500">
                      {slot.available ? 'Available' : 'Booked'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {availableTimeSlots.length > 0 && (
              <div className="mt-4 text-sm text-gray-600 text-center">
                {availableTimeSlots.length} time slots available for {partySize} {partySize === 1 ? 'guest' : 'guests'}
              </div>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">1. Choose Party Size</h4>
              <p className="text-sm text-gray-600">Select how many guests will be dining</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">2. Pick Date & Time</h4>
              <p className="text-sm text-gray-600">Choose from available time slots</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">3. Confirm Booking</h4>
              <p className="text-sm text-gray-600">We'll assign your table automatically</p>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && selectedTime && (
        <TimeSlotBookingForm
          restaurant={restaurant}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          partySize={partySize}
          isPublicBooking={!!restaurantSlug}
          onSuccess={() => {
            setShowBookingForm(false);
            setSelectedTime(null);
          }}
          onCancel={() => {
            setShowBookingForm(false);
            setSelectedTime(null);
          }}
        />
      )}
    </div>
  );
}