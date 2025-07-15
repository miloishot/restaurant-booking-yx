import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { DollarSign, Save, Percent, ToggleLeft, ToggleRight } from 'lucide-react';

interface TaxSettingsProps {
  restaurant: Restaurant;
  onUpdate: () => void;
}

interface TaxSettings {
  id?: string;
  restaurant_id: string;
  gst_rate: number;
  service_charge_rate: number;
  gst_enabled: boolean;
  service_charge_enabled: boolean;
}

export function TaxSettings({ restaurant, onUpdate }: TaxSettingsProps) {
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    restaurant_id: restaurant.id,
    gst_rate: 9,
    service_charge_rate: 10,
    gst_enabled: true,
    service_charge_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchTaxSettings();
  }, [restaurant.id]);

  const fetchTaxSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('restaurant_tax_settings')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setTaxSettings({
          ...data,
          // Default to true if the columns don't exist yet
          gst_enabled: data.gst_enabled !== undefined ? data.gst_enabled : true,
          service_charge_enabled: data.service_charge_enabled !== undefined ? data.service_charge_enabled : true
        });
      }
    } catch (err) {
      console.error('Error fetching tax settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tax settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const { error } = await supabase
        .from('restaurant_tax_settings')
        .upsert({
          restaurant_id: restaurant.id,
          gst_rate: taxSettings.gst_rate,
          service_charge_rate: taxSettings.service_charge_rate,
          gst_enabled: taxSettings.gst_enabled,
          service_charge_enabled: taxSettings.service_charge_enabled
        }, {
          onConflict: 'restaurant_id'
        });

      if (error) throw error;
      
      setSuccess(true);
      onUpdate();
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Tax settings saved successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    } catch (err) {
      console.error('Error saving tax settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save tax settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Tax Settings
          </h2>
          <p className="text-gray-600">Configure GST and service charge for your restaurant</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm">Tax settings saved successfully!</p>
        </div>
      )}

      <div className="space-y-6">
        {/* GST Settings */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Percent className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="font-semibold text-gray-800">GST (Goods & Services Tax)</h3>
            </div>
            <button
              onClick={() => setTaxSettings(prev => ({ ...prev, gst_enabled: !prev.gst_enabled }))}
              className="flex items-center text-blue-600"
            >
              {taxSettings.gst_enabled ? (
                <>
                  <ToggleRight className="w-6 h-6 mr-1" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-6 h-6 mr-1" />
                  <span>Disabled</span>
                </>
              )}
            </button>
          </div>
          
          <div className={`transition-opacity duration-200 ${taxSettings.gst_enabled ? 'opacity-100' : 'opacity-50'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GST Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxSettings.gst_rate}
              onChange={(e) => setTaxSettings(prev => ({ ...prev, gst_rate: parseFloat(e.target.value) || 0 }))}
              disabled={!taxSettings.gst_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Standard GST rate in Singapore is 9%
            </p>
          </div>
        </div>

        {/* Service Charge Settings */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="font-semibold text-gray-800">Service Charge</h3>
            </div>
            <button
              onClick={() => setTaxSettings(prev => ({ ...prev, service_charge_enabled: !prev.service_charge_enabled }))}
              className="flex items-center text-green-600"
            >
              {taxSettings.service_charge_enabled ? (
                <>
                  <ToggleRight className="w-6 h-6 mr-1" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-6 h-6 mr-1" />
                  <span>Disabled</span>
                </>
              )}
            </button>
          </div>
          
          <div className={`transition-opacity duration-200 ${taxSettings.service_charge_enabled ? 'opacity-100' : 'opacity-50'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Charge Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxSettings.service_charge_rate}
              onChange={(e) => setTaxSettings(prev => ({ ...prev, service_charge_rate: parseFloat(e.target.value) || 0 }))}
              disabled={!taxSettings.service_charge_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Standard service charge in Singapore is 10%
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">Tax Settings Information</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• GST and service charge are applied to all orders placed through QR ordering</li>
            <li>• GST is calculated on the subtotal plus service charge</li>
            <li>• Service charge is calculated on the subtotal</li>
            <li>• Disabling either tax will remove it from calculations and display</li>
            <li>• Changes to tax settings take effect immediately for new orders</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}