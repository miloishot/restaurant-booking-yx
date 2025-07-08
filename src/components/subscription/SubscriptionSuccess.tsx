import React from 'react';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';

interface SubscriptionSuccessProps {
  onContinue: () => void;
}

export function SubscriptionSuccess({ onContinue }: SubscriptionSuccessProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Welcome to Premium!
          </h1>
          
          <p className="text-gray-600 mb-8">
            Your subscription has been successfully activated. You now have access to all premium features including advanced analytics, priority support, and unlimited table management.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Home className="w-5 h-5 mr-2" />
              Continue to Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">What's Next?</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Explore the new analytics dashboard</li>
              <li>• Set up advanced booking rules</li>
              <li>• Customize your reporting preferences</li>
              <li>• Contact support for personalized setup</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}