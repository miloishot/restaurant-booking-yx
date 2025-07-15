import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Restaurant } from '../types/database';
import { CreditCard, Save, X, DollarSign, ShoppingCart, AlertCircle, Info, CheckCircle, Lock } from 'lucide-react';

interface StripeApiConfigurationProps {
  restaurant: Restaurant;
  onUpdate: () => void;
}

export function StripeApiConfiguration({ restaurant, onUpdate }: StripeApiConfigurationProps) {
  const { employeeProfile } = useAuth();
  const [apiConfig, setApiConfig] = useState({
    publishableKey: restaurant.stripe_publishable_key || '',
    secretKey: restaurant.stripe_secret_key || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const { error } = await supabase
        .from('restaurants')
        .update({
          stripe_publishable_key: apiConfig.publishableKey || null,
          stripe_secret_key: apiConfig.secretKey || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', restaurant.id);

      if (error) throw error;
      
      setSuccess(true);
      onUpdate();
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Stripe API configuration saved successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    } catch (err) {
      console.error('Error saving Stripe API configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to save Stripe API configuration');
    } finally {
      setSaving(false);
    }
  };

  // Check if user has permission to configure Stripe API
  const canConfigureStripe = employeeProfile?.role === 'owner';

  if (!canConfigureStripe) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Restricted</h3>
        <p className="text-gray-600 mb-4">
          Only restaurant owners can access the Stripe API configuration.
        </p>
        <p className="text-sm text-gray-500">
          Please contact the restaurant owner for any changes to the Stripe API settings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Stripe API Configuration
          </h2>
          <p className="text-gray-600">Configure your Stripe API keys for payment processing</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
            <p className="text-green-700 text-sm">Stripe API configuration saved successfully!</p>
          </div>
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-blue-700 text-sm">
            <p className="font-medium mb-2">Stripe API Keys</p>
            <p className="mb-2">These keys are used to process payments through Stripe. You can find your API keys in your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Stripe Dashboard</a>.</p>
            <p>For security reasons, we recommend using environment variables for your secret key in production.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Publishable Key
          </label>
          <input
            type="text"
            value={apiConfig.publishableKey}
            onChange={(e) => setApiConfig(prev => ({ ...prev, publishableKey: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="pk_test_..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Your Stripe publishable key (starts with pk_test_ or pk_live_)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Secret Key
          </label>
          <div className="relative">
            <input
              type={showSecretKey ? "text" : "password"}
              value={apiConfig.secretKey}
              onChange={(e) => setApiConfig(prev => ({ ...prev, secretKey: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="sk_test_..."
            />
            <button
              type="button"
              onClick={() => setShowSecretKey(!showSecretKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecretKey ? <X className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Your Stripe secret key (starts with sk_test_ or sk_live_)
          </p>
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            <strong>Warning:</strong> Store your secret key securely. In production, consider using environment variables instead of storing in the database.
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3">Stripe Integration Features</h3>
          <div className="space-y-2">
            <div className="flex items-start">
              <ShoppingCart className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
              <p className="text-sm text-gray-700">Process payments for QR code orders</p>
            </div>
            <div className="flex items-start">
              <DollarSign className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
              <p className="text-sm text-gray-700">Track revenue and payment history</p>
            </div>
            <div className="flex items-start">
              <CreditCard className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
              <p className="text-sm text-gray-700">Secure payment processing with Stripe Checkout</p>
            </div>
          </div>
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
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}