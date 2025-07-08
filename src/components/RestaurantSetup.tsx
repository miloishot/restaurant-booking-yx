import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Restaurant } from '../types/database';
import { Building, Globe, Copy, Check, ExternalLink, QrCode, Share2, Settings } from 'lucide-react';

export function RestaurantSetup() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
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
        .from('user_restaurant_view')
        .select('*')
        .single();

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
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
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
            time_slot_duration_minutes: formData.time_slot_duration_minutes
          })
          .select()
          .single();

        if (error) throw error;
        
        // Create user profile linking user to restaurant
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: user?.id,
            restaurant_id: data.id,
            role: 'owner'
          });

        if (profileError) throw profileError;
        setRestaurant(data);
      }

      // Show success message
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Restaurant settings saved successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);

    } catch (error) {
      console.error('Error saving restaurant:', error);
      alert('Failed to save restaurant settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };
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
      }

      // Show success message
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Restaurant settings saved successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);

    } catch (error) {
      console.error('Error saving restaurant:', error);
      alert('Failed to save restaurant settings. Please try again.');
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

  const bookingUrl = `${window.location.origin}/${formData.slug}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Restaurant Setup</h1>
          <p className="text-gray-600">
            Configure your restaurant details and get your unique booking URL
          </p>
        </div>

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

            {/* Integration Guide */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                <Share2 className="w-5 h-5 mr-2" />
                Integration Guide
              </h2>

              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Website Integration</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Add a "Book Now" button that links to your booking URL:
                  </p>
                  <code className="block p-2 bg-gray-100 text-xs rounded">
                    &lt;a href="{bookingUrl}" target="_blank"&gt;Book Now&lt;/a&gt;
                  </code>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Social Media</h4>
                  <p className="text-sm text-gray-600">
                    Add your booking URL to your Instagram bio, Facebook page info, and Twitter profile.
                  </p>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Google Business</h4>
                  <p className="text-sm text-gray-600">
                    Add your booking URL as a "Reservations" link in your Google Business Profile.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}