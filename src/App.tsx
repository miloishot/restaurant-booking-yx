import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { AuthPage } from './components/auth/AuthPage';
import { SubscriptionPlans } from './components/subscription/SubscriptionPlans';
import { SubscriptionSuccess } from './components/subscription/SubscriptionSuccess';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { CustomerBooking } from './components/CustomerBooking';
import { Settings, Users, SplitSquareHorizontal, Crown, LogOut, User } from 'lucide-react';

type ViewMode = 'customer' | 'staff' | 'split' | 'subscription' | 'subscription-success';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { subscription, loading: subscriptionLoading, getCurrentPlan, isPremium } = useSubscription();
  const [viewMode, setViewMode] = useState<ViewMode>('customer');

  // Check for success parameter in URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setViewMode('subscription-success');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={() => window.location.reload()} />;
  }

  const currentPlan = getCurrentPlan();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* View Mode Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-2 flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('customer')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'customer'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Customer
          </button>
          <button
            onClick={() => setViewMode('staff')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'staff'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Staff
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'split'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <SplitSquareHorizontal className="w-4 h-4 mr-2" />
            Split View
          </button>
          <button
            onClick={() => setViewMode('subscription')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'subscription'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Crown className="w-4 h-4 mr-2" />
            {isPremium() ? 'Premium' : 'Upgrade'}
          </button>
          
          {/* User Menu */}
          <div className="flex items-center space-x-2 border-l border-gray-200 pl-2">
            <div className="flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-1" />
              {user.email}
            </div>
            <button
              onClick={signOut}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Status Banner */}
      {!subscriptionLoading && currentPlan && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <Crown className="w-5 h-5 mr-2" />
            <span className="font-medium">
              {currentPlan.name} Plan Active - Enjoy premium features!
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === 'customer' && <CustomerBooking />}
      {viewMode === 'staff' && <RestaurantDashboard />}
      {viewMode === 'subscription' && (
        <div className="py-12 px-4">
          <SubscriptionPlans currentPriceId={subscription?.price_id || undefined} />
        </div>
      )}
      {viewMode === 'subscription-success' && (
        <SubscriptionSuccess onContinue={() => setViewMode('staff')} />
      )}
      {viewMode === 'split' && (
        <div className="flex h-screen">
          {/* Customer View - Left Side */}
          <div className="w-1/2 border-r border-gray-300 overflow-y-auto">
            <div className="bg-blue-50 p-2 text-center border-b border-blue-200">
              <h2 className="text-sm font-semibold text-blue-800">Customer View</h2>
            </div>
            <div className="transform scale-75 origin-top-left" style={{ width: '133.33%', height: '133.33%' }}>
              <CustomerBooking />
            </div>
          </div>
          
          {/* Staff View - Right Side */}
          <div className="w-1/2 overflow-y-auto">
            <div className="bg-green-50 p-2 text-center border-b border-green-200">
              <h2 className="text-sm font-semibold text-green-800">Staff Dashboard</h2>
            </div>
            <div className="transform scale-75 origin-top-left" style={{ width: '133.33%', height: '133.33%' }}>
              <RestaurantDashboard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;