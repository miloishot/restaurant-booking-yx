import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface BaseCheckoutParams {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
}

interface SubscriptionCheckoutParams extends BaseCheckoutParams {
  mode: 'subscription';
}

interface PaymentCheckoutParams extends BaseCheckoutParams {
  mode: 'payment';
  cart_items?: any[];
  table_id?: string;
  session_id?: string;
}

type CheckoutParams = SubscriptionCheckoutParams | PaymentCheckoutParams;

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = async (params: CheckoutParams) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to make a purchase');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      
      const response = await fetch(apiUrl, {
        method: 'POST', 
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create checkout session';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If the response isn't valid JSON, use the raw text
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createCheckoutSession,
    loading,
    error,
  };
}