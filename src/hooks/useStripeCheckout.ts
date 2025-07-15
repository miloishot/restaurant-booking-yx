import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface StripeCheckoutResponse {
  sessionId: string;
  url: string;
}

interface BaseCheckoutParams {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
  restaurantId: string;
}

interface SubscriptionCheckoutParams extends BaseCheckoutParams {
  mode: 'subscription';
}

interface PaymentCheckoutParams extends BaseCheckoutParams {
  mode: 'payment';
  cart_items?: any[];
  table_id?: string; // This is actually the table_id from restaurant_tables
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
      // Check if we have a valid Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please check your environment variables.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to make a purchase');
      }

      const apiUrl = `${supabaseUrl}/functions/v1/stripe-checkout`;
      
      console.log('Calling Stripe checkout at:', apiUrl);
      console.log('Calling Stripe checkout API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST', 
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        let errorMessage = 'Failed to create checkout session';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`;
          }
        } catch (e) {
          // If the response isn't valid JSON, use the raw text
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      const { url } = responseData;
      console.log('Stripe checkout response:', data);
      
      if (data.url) {
        console.log('Redirecting to Stripe checkout:', url);
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
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
    error
  };
}