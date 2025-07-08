import React, { useState } from 'react';
import { stripeProducts } from '../../stripe-config';
import { useStripeCheckout } from '../../hooks/useStripeCheckout';
import { Check, Crown, Loader2 } from 'lucide-react';

interface SubscriptionPlansProps {
  currentPriceId?: string;
}

export function SubscriptionPlans({ currentPriceId }: SubscriptionPlansProps) {
  const { createCheckoutSession, loading } = useStripeCheckout();
  const [processingPriceId, setProcessingPriceId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    setProcessingPriceId(priceId);
    try {
      await createCheckoutSession({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription`,
      });
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setProcessingPriceId(null);
    }
  };

  const subscriptionProducts = stripeProducts.filter(product => product.mode === 'subscription');

  if (subscriptionProducts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No subscription plans available at this time.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Choose Your Plan</h2>
        <p className="text-lg text-gray-600">
          Upgrade your restaurant management experience with our premium features
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {subscriptionProducts.map((product) => {
          const isCurrentPlan = currentPriceId === product.priceId;
          const isProcessing = processingPriceId === product.priceId;

          return (
            <div
              key={product.id}
              className={`relative bg-white rounded-lg shadow-lg border-2 transition-all duration-200 ${
                isCurrentPlan
                  ? 'border-green-500 ring-2 ring-green-200'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-xl'
              }`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Crown className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{product.name}</h3>
                  {product.description && (
                    <p className="text-gray-600 mb-4">{product.description}</p>
                  )}
                  <div className="text-4xl font-bold text-gray-800 mb-2">
                    {product.price}
                    <span className="text-lg font-normal text-gray-600">/month</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Advanced booking analytics</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Priority customer support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Custom reporting features</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Unlimited table management</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Advanced waitlist features</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSubscribe(product.priceId)}
                  disabled={loading || isCurrentPlan || isProcessing}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </div>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    'Subscribe Now'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}