import React from 'react';
import { CheckCircle, Clock, ChefHat } from 'lucide-react';

interface OrderConfirmationProps {
  onContinue: () => void;
}

export function OrderConfirmation({ onContinue }: OrderConfirmationProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Order Sent!
          </h1>
          
          <p className="text-gray-600 mb-8">
            Your order has been successfully sent to the kitchen. You can continue browsing 
            the menu or wait for your delicious food to arrive!
          </p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center text-blue-600">
              <ChefHat className="w-5 h-5 mr-2" />
              <span className="text-sm">Kitchen has been notified</span>
            </div>
            <div className="flex items-center justify-center text-orange-600">
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-sm">Estimated preparation time: 15-25 minutes</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue Ordering
            </button>
            
            <p className="text-xs text-gray-500">
              You can place additional orders anytime during your dining experience
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}