import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { useRestaurantData } from './hooks/useRestaurantData';
import { AuthPage } from './components/auth/AuthPage';
import { SubscriptionPlans } from './components/subscription/SubscriptionPlans';
import { SubscriptionSuccess } from './components/subscription/SubscriptionSuccess';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { CustomerBooking } from './components/CustomerBooking';
import { RestaurantSetup } from './components/RestaurantSetup';
import { CustomerOrderingInterface } from './components/qr-ordering/CustomerOrderingInterface';
import { LoyaltyManagement } from './components/LoyaltyManagement';
import { Settings, Users, Crown, LogOut, User, Building } from 'lucide-react';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { subscription, loading: subscriptionLoading, getCurrentPlan, isPremium } = useSubscription();
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurantData();
  const [viewMode, setViewMode] = useState<'dashboard' | 'subscription' | 'subscription-success' | 'setup'>('dashboard');
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);

  // Check URL for restaurant booking page
  useEffect(() => {
    const path = window.location.pathname;
    const pathSegments = path.split('/').filter(segment => segment);
    
    // If URL contains a restaurant slug (not admin paths and not order paths)
    if (pathSegments.length === 1 && pathSegments[0] && 
        !['admin', 'dashboard', 'subscription', 'order'].includes(pathSegments[0])) {
      setRestaurantSlug(pathSegments[0]);
    }
    
    // Check for success parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setViewMode('subscription-success');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auto-redirect to setup if user is logged in but has no restaurant
  useEffect(() => {
    if (user && !restaurantLoading && !restaurant && !restaurantError?.includes('Restaurant not found')) {
      setViewMode('setup');
    }
  }, [user, restaurant, restaurantLoading, restaurantError]);
  // If accessing a restaurant booking page, show customer interface
  if (restaurantSlug && !window.location.pathname.startsWith('/order/')) {
    return <CustomerBooking restaurantSlug={restaurantSlug} />;
  }

  // Only show loading for admin interface, not for QR ordering
  if ((authLoading || (user && restaurantLoading)) && !window.location.pathname.startsWith('/order/')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            {authLoading ? 'Loading...' : 'Loading restaurant data...'}
          </p>
          
          {/* Debug info for production */}
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-left">
            <p className="font-medium text-gray-700 mb-1">Environment Status:</p>
            <p className="text-gray-600">
              Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✓ Configured' : '✗ Missing'}
            </p>
            <p className="text-gray-600">
              Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Configured' : '✗ Missing'}
            </p>
          </div>
        </div>
      </div>
    );
  }


  const currentPlan = getCurrentPlan();

  return (
    <Router>
      <Routes>
        {/* QR Ordering Route */}
        <Route path="/order/:token" element={<CustomerOrderingInterface />} />
        
        {/* Main App Routes */}
        <Route path="/*" element={
          !user ? (
            <AuthPage onAuthSuccess={() => window.location.reload()} />
          ) : (
          <div className="min-h-screen bg-gray-50">
            {/* Staff Navigation */}
            <div className="fixed top-4 right-4 z-50">
              <div className="bg-white rounded-lg shadow-lg p-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'dashboard'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Dashboard
                </button>
                
                <button
                  onClick={() => setViewMode('setup')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'setup'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Building className="w-4 h-4 mr-2" />
                  Setup
                </button>
                
                <button
                  onClick={() => setViewMode('loyalty')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'loyalty'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Loyalty
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
                    {currentPlan.name} Plan Active - Full restaurant management features enabled!
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            {viewMode === 'dashboard' && <RestaurantDashboard />}
            {viewMode === 'setup' && <RestaurantSetup />}
            {viewMode === 'loyalty' && restaurant && <LoyaltyManagement restaurant={restaurant} />}
            {viewMode === 'subscription' && (
              <div className="py-12 px-4">
                <SubscriptionPlans currentPriceId={subscription?.price_id || undefined} />
              </div>
            )}
            {viewMode === 'subscription-success' && (
              <SubscriptionSuccess onContinue={() => setViewMode('dashboard')} />
            )}
          </div>
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;