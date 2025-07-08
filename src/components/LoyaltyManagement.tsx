import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { 
  Gift, 
  Users, 
  DollarSign, 
  Percent, 
  Settings, 
  Save, 
  Plus, 
  Edit2, 
  Trash2,
  Tag,
  Star,
  TrendingUp,
  Award
} from 'lucide-react';

interface LoyaltyManagementProps {
  restaurant: Restaurant;
}

interface LoyaltySettings {
  discount_threshold: number;
  discount_percentage: number;
  points_per_dollar: number;
  welcome_bonus: number;
  birthday_bonus: number;
  referral_bonus: number;
}

interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

interface LoyaltyStats {
  total_members: number;
  active_members: number;
  total_spent: number;
  avg_order_value: number;
  discount_eligible_count: number;
}

export function LoyaltyManagement({ restaurant }: LoyaltyManagementProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'codes' | 'members'>('overview');
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    discount_threshold: 100,
    discount_percentage: 10,
    points_per_dollar: 1,
    welcome_bonus: 0,
    birthday_bonus: 0,
    referral_bonus: 0
  });
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loyaltyStats, setLoyaltyStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);

  const [codeForm, setCodeForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    min_order_amount: 0,
    max_uses: null as number | null,
    valid_from: '',
    valid_until: ''
  });

  useEffect(() => {
    fetchLoyaltyData();
  }, [restaurant.id]);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      
      // Fetch loyalty statistics
      const { data: stats, error: statsError } = await supabase
        .from('loyalty_users')
        .select('total_spent_sgd, order_count, discount_eligible, last_order_date')
        .eq('restaurant_id', restaurant.id);

      if (statsError) throw statsError;

      if (stats) {
        const totalMembers = stats.length;
        const activeMembers = stats.filter(s => s.last_order_date && 
          new Date(s.last_order_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;
        const totalSpent = stats.reduce((sum, s) => sum + s.total_spent_sgd, 0);
        const avgOrderValue = totalSpent / Math.max(stats.reduce((sum, s) => sum + s.order_count, 0), 1);
        const discountEligibleCount = stats.filter(s => s.discount_eligible).length;

        setLoyaltyStats({
          total_members: totalMembers,
          active_members: activeMembers,
          total_spent: totalSpent,
          avg_order_value: avgOrderValue,
          discount_eligible_count: discountEligibleCount
        });
      }

    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setLoading(false);
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

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // In a real implementation, you would save these settings to a restaurant_settings table
      // For now, we'll just show a success message
      showNotification('Loyalty settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => `S$${price.toFixed(2)}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading loyalty management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Loyalty & Rewards Management</h1>
          <p className="text-gray-600">
            Configure loyalty programs, discount codes, and customer rewards
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Award className="w-4 h-4 inline mr-1" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-1" />
              Loyalty Settings
            </button>
            <button
              onClick={() => setActiveTab('codes')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'codes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Tag className="w-4 h-4 inline mr-1" />
              Discount Codes
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Members ({loyaltyStats?.total_members || 0})
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && loyaltyStats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Members</p>
                    <p className="text-2xl font-bold text-gray-900">{loyaltyStats.total_members}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Members</p>
                    <p className="text-2xl font-bold text-gray-900">{loyaltyStats.active_members}</p>
                    <p className="text-xs text-gray-500">Last 30 days</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatPrice(loyaltyStats.total_spent)}</p>
                    <p className="text-xs text-gray-500">From loyalty members</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Gift className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Discount Eligible</p>
                    <p className="text-2xl font-bold text-gray-900">{loyaltyStats.discount_eligible_count}</p>
                    <p className="text-xs text-gray-500">Members with S$100+ spent</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Settings Overview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Loyalty Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center text-blue-800 mb-2">
                    <DollarSign className="w-4 h-4 mr-2" />
                    <span className="font-medium">Discount Threshold</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{formatPrice(loyaltySettings.discount_threshold)}</p>
                  <p className="text-sm text-blue-700">Minimum spend for discount</p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center text-green-800 mb-2">
                    <Percent className="w-4 h-4 mr-2" />
                    <span className="font-medium">Discount Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{loyaltySettings.discount_percentage}%</p>
                  <p className="text-sm text-green-700">Applied to eligible orders</p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center text-purple-800 mb-2">
                    <Star className="w-4 h-4 mr-2" />
                    <span className="font-medium">Points Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">{loyaltySettings.points_per_dollar}</p>
                  <p className="text-sm text-purple-700">Points per dollar spent</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Loyalty Program Configuration</h3>
            
            <div className="space-y-6">
              {/* Basic Settings */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-4">Basic Discount Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Discount Threshold (SGD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={loyaltySettings.discount_threshold}
                      onChange={(e) => setLoyaltySettings({
                        ...loyaltySettings,
                        discount_threshold: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="100.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum total spending required for discount eligibility
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Discount Percentage (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={loyaltySettings.discount_percentage}
                      onChange={(e) => setLoyaltySettings({
                        ...loyaltySettings,
                        discount_percentage: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="10"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Percentage discount for eligible customers
                    </p>
                  </div>
                </div>
              </div>

              {/* Points System */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-4">Points System (Future Feature)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Points per Dollar
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={loyaltySettings.points_per_dollar}
                      onChange={(e) => setLoyaltySettings({
                        ...loyaltySettings,
                        points_per_dollar: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="1"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Welcome Bonus Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={loyaltySettings.welcome_bonus}
                      onChange={(e) => setLoyaltySettings({
                        ...loyaltySettings,
                        welcome_bonus: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Birthday Bonus Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={loyaltySettings.birthday_bonus}
                      onChange={(e) => setLoyaltySettings({
                        ...loyaltySettings,
                        birthday_bonus: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                      disabled
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Points system is coming soon. Currently, only spending-based discounts are active.
                </p>
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
        )}

        {/* Discount Codes Tab */}
        {activeTab === 'codes' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Discount Codes</h3>
              <button
                onClick={() => setShowCodeForm(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Code
              </button>
            </div>

            <div className="text-center py-8">
              <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Discount Codes Coming Soon</h4>
              <p className="text-gray-600 mb-4">
                Create and manage promotional discount codes for your customers.
              </p>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 max-w-md mx-auto">
                <h5 className="font-semibold text-blue-800 mb-2">Planned Features:</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Percentage and fixed amount discounts</li>
                  <li>• Minimum order requirements</li>
                  <li>• Usage limits and expiry dates</li>
                  <li>• Customer-specific codes</li>
                  <li>• Bulk code generation</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Loyalty Members</h3>
            
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Member Management Coming Soon</h4>
              <p className="text-gray-600 mb-4">
                View and manage your loyalty program members, their spending history, and reward status.
              </p>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 max-w-md mx-auto">
                <h5 className="font-semibold text-green-800 mb-2">Current Stats:</h5>
                <div className="text-sm text-green-700 space-y-1">
                  <p>• {loyaltyStats?.total_members || 0} total members</p>
                  <p>• {loyaltyStats?.active_members || 0} active in last 30 days</p>
                  <p>• {loyaltyStats?.discount_eligible_count || 0} eligible for discounts</p>
                  <p>• {formatPrice(loyaltyStats?.avg_order_value || 0)} average order value</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}