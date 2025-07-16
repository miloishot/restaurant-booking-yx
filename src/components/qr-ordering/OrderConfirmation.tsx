import React from 'react';
import { CheckCircle, Clock, ChefHat, CreditCard } from 'lucide-react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';

interface OrderConfirmationProps {
  onContinue: () => void;
  isPaymentSuccess?: boolean;
}

export function OrderConfirmation({ onContinue, isPaymentSuccess }: OrderConfirmationProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const paymentSuccess = searchParams.get('payment_success');
  const isSuccess = isPaymentSuccess || location.pathname.includes('/success') || paymentSuccess === 'true';
  
  const handleContinue = () => {
    if (token) {
      // Redirect back to the ordering page with the token
      navigate(`/order/${token}`);
    } else {
      // If no token, use the provided onContinue function
      onContinue();
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          
          {isSuccess ? (
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Payment Successful!
            </h1>
          ) : (
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Order Sent!
            </h1>
          )}
          
          {isSuccess ? (
            <p className="text-gray-600 mb-8">
              Your payment has been processed successfully. Your order has been sent to the kitchen.
              Thank you for your order!
            </p>
          ) : (
            <p className="text-gray-600 mb-8">
              Your order has been successfully sent to the kitchen. You can continue browsing 
              the menu or wait for your delicious food to arrive!
            </p>
          )}
          
          <div className="space-y-4 mb-8">
            {isSuccess ? (
              <>
                <div className="flex items-center justify-center text-blue-600">
                  <CreditCard className="w-5 h-5 mr-2" />
                  <span className="text-sm">Payment completed</span>
                </div>
                <div className="flex items-center justify-center text-green-600">
                  <ChefHat className="w-5 h-5 mr-2" />
                  <span className="text-sm">Kitchen has been notified</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center text-blue-600">
                  <ChefHat className="w-5 h-5 mr-2" />
                  <span className="text-sm">Kitchen has been notified</span>
                </div>
                <div className="flex items-center justify-center text-orange-600">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="text-sm">Estimated preparation time: 15-25 minutes</span>
                </div>
              </>
            )}
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleContinue}
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