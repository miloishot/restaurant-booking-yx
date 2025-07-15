import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Restaurant, RestaurantTable } from '../types/database';
import { TableManager } from './TableManager';
import { Building, Globe, Copy, Check, ExternalLink, Settings, Users, Printer } from 'lucide-react';
import { PrinterConfiguration } from './PrinterConfiguration';

export function RestaurantSetup() {
  const { user, employeeProfile } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'tables' | 'printers'>('details');
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: '',
    phone: '',
    email: '',
    time_slot_duration_minutes: 15
  });

  useEffect(() => {
    fetchRestaurant();
  }, [user]);

  const fetchRestaurant = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setRestaurant(data);
        setFormData({
          name: data.name,
          slug: data.slug || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          time_slot_duration_minutes: data.time_slot_duration_minutes
        });
        
        // Fetch tables for this restaurant
        await fetchTables(data.id);
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async (restaurantId: string) => {
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('table_number');

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (restaurant) {
        // Update existing restaurant
        const { error } = await supabase
          .from('restaurants')
          .update({
            name: formData.name,
            slug: formData.slug,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            time_slot_duration_minutes: formData.time_slot_duration_minutes
          })
          .eq('id', restaurant.id);

        if (error) throw error;
      } else {
        // Create new restaurant
        const { data, error } = await supabase
          .from('restaurants')
          .insert({
            name: formData.name,
            slug: formData.slug,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            time_slot_duration_minutes: formData.time_slot_duration_minutes,
            owner_id: user?.id
          })
          .select()
          .single();

        if (error) throw error;
        setRestaurant(data);
        
        // Also create employee record for the owner in the consolidated employees table
        const { error: employeeError } = await supabase
          .from('employees') // Use the consolidated employees table
          .upsert({
            id: user?.id,
            restaurant_id: data.id,
            role: 'owner'
          });
        
        if (employeeError) {
          console.warn('Could not create employee record for owner:', employeeError);
          // Don't throw here as restaurant creation succeeded
        }
      }

      // Show success message
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Restaurant settings saved successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (error) {
      console.error('Error saving restaurant:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to save restaurant settings. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('row-level security policy')) {
          errorMessage = 'Permission denied. Please ensure you have the correct permissions to create a restaurant. Contact support if this issue persists.';
        } else if (error.message.includes('duplicate key')) {
          errorMessage = 'A restaurant with this URL slug already exists. Please choose a different slug.';
        }
      }
      
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const copyBookingUrl = async () => {
    const url = `${window.location.origin}/${formData.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const openBookingPage = () => {
    const url = `${window.location.origin}/${formData.slug}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading restaurant settings...</p>
        </div>
      </div>
    );
  }

  // Check if user has permission to configure restaurant setup
  const canConfigureSetup = employeeProfile?.role === 'owner';

  if (!canConfigureSetup) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Restricted</h3>
        <p className="text-gray-600 mb-4">
          Only restaurant owners can access the restaurant setup configuration.
        </p>
        <p className="text-sm text-gray-500">
          Please contact the restaurant owner for any changes to the restaurant setup.
        </p>
      </div>
    );
  }

  const bookingUrl = `${window.location.origin}/${formData.slug}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Restaurant Setup</h1>
          <p className="text-gray-600">
            Configure your restaurant details and manage your tables
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building className="w-4 h-4 inline mr-1" />
              Restaurant Details
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tables'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Table Management ({tables.length})
            </button>
            <button
              onClick={() => setActiveTab('printers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'printers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Printer className="w-4 h-4 inline mr-1" />
              Printer Setup
            </button>
          </nav>
        </div>

        {activeTab === 'details' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Restaurant Details Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Restaurant Details
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Restaurant Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter restaurant name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Booking URL Slug *
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-md">
                      {window.location.origin}/
                    </span>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="restaurant-name"
                      pattern="[a-z0-9-]+"
                      title="Only lowercase letters, numbers, and hyphens allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This will be your unique booking URL that customers use to make reservations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Restaurant address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Restaurant email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Slot Duration (minutes)
                  </label>
                  <select
                    value={formData.time_slot_duration_minutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, time_slot_duration_minutes: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </form>
            </div>

            {/* Booking URL & Sharing */}
            <div className="space-y-6">
              {/* Booking URL */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                  <Globe className="w-5 h-5 mr-2" />
                  Customer Booking URL
                </h2>

                {formData.slug ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2">Your booking URL:</p>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded text-sm font-mono">
                          {bookingUrl}
                        </code>
                        <button
                          onClick={copyBookingUrl}
                          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title="Copy URL"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={openBookingPage}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Preview Booking Page
                      </button>
                    </div>

                    <div className="text-sm text-gray-600">
                      <h4 className="font-medium mb-2">How to use:</h4>
                      <ul className="space-y-1">
                        <li>• Share this URL on your website</li>
                        <li>• Add it to your Google Business listing</li>
                        <li>• Include it in social media profiles</li>
                        <li>• Print it on business cards and menus</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Enter a restaurant name and slug to generate your booking URL
                    </p>
                  </div>
                )}
              </div>

              {/* Setup Progress */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Setup Progress</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                      restaurant ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {restaurant ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <span className={restaurant ? 'text-green-700 font-medium' : 'text-gray-600'}>
                      Restaurant Details
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                      tables.length > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {tables.length > 0 ? <Check className="w-4 h-4" /> : '2'}
                    </div>
                    <span className={tables.length > 0 ? 'text-green-700 font-medium' : 'text-gray-600'}>
                      Table Setup ({tables.length} tables)
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mr-3 bg-gray-300 text-gray-600">
                      3
                    </div>
                    <span className="text-gray-600">Operating Hours (Optional)</span>
                  </div>
                </div>

                {restaurant && tables.length > 0 && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">🎉 Setup Complete!</p>
                    <p className="text-green-700 text-sm mt-1">
                      Your restaurant is ready to accept bookings. Share your booking URL to start receiving reservations.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'printers' ? (
          <div>
            {restaurant ? (
              <PrinterConfiguration restaurant={restaurant} />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Restaurant Details Required</h3>
                <p className="text-gray-600 mb-4">
                  Please complete your restaurant details first before configuring printers.
                </p>
                <button
                  onClick={() => setActiveTab('details')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Complete Restaurant Details
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {restaurant ? (
              <TableManager 
                restaurant={restaurant} 
                tables={tables} 
                onUpdate={() => fetchTables(restaurant.id)} 
              />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Restaurant Details Required</h3>
                <p className="text-gray-600 mb-4">
                  Please complete your restaurant details first before managing tables.
                </p>
                <button
                  onClick={() => setActiveTab('details')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Complete Restaurant Details
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}