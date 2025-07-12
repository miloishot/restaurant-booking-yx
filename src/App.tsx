import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { useRestaurantData } from './hooks/useRestaurantData';
import { AuthPage } from './components/auth/AuthPage';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { CustomerBooking } from './components/CustomerBooking';
import { CustomerOrderingInterface } from './components/qr-ordering/CustomerOrderingInterface';
import { LogOut, User } from 'lucide-react';

// Add success route for Stripe payments
import { OrderConfirmation } from './components/qr-ordering/OrderConfirmation';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurantData();
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
  }, []);

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



  return (
    <Router>
      <Routes>
        {/* QR Ordering Route */}
        <Route path="/order/:token" element={<CustomerOrderingInterface />} />
        <Route path="/order/success" element={<OrderConfirmation onContinue={() => window.location.href = '/'} isPaymentSuccess={true} />} />
        
        {/* Main App Routes */}
        <Route path="/*" element={
          !user ? (
            <AuthPage onAuthSuccess={() => window.location.reload()} />
          ) : (
          <div className="min-h-screen bg-gray-50">
            {/* Staff Navigation */}
            <div className="fixed top-4 right-4 z-50">
              <div className="bg-white rounded-lg shadow-lg p-2 flex flex-wrap gap-2">
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


            {/* Content */}
            <RestaurantDashboard />
          </div>
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;