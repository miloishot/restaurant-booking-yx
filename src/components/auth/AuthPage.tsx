import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ChefHat } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <ChefHat className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Restaurant Booking</h1>
          <p className="text-gray-600 mt-2">Manage your restaurant reservations</p>
          
          {/* Test User Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Demo Access</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>Email:</strong> test@restaurant.com</p>
              <p><strong>Password:</strong> testpass123</p>
              <p><strong>Restaurant URL:</strong> <a href="/test-restaurant" className="underline hover:text-blue-900">/test-restaurant</a></p>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              This test account has full premium access and sample data for demonstration.
            </p>
          </div>
        </div>

        {/* Auth Forms */}
        {isLogin ? (
          <LoginForm
            onSuccess={onAuthSuccess}
            onSwitchToSignup={() => setIsLogin(false)}
          />
        ) : (
          <SignupForm
            onSuccess={onAuthSuccess}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  );
}