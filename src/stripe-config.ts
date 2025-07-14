export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: string; 
  currency: string;
  interval?: string;
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_S4hPJplssOZcn7',
    priceId: 'price_1RAY0MB1E07AY4srgFYhfB26',
    name: 'Premium',
    description: 'Complete restaurant management solution with advanced features',
    mode: 'subscription',
    price: '$99.99',
    currency: 'usd',
    interval: 'month'
  },
  {
    id: 'prod_S4hPJplssOZcn8',
    priceId: 'price_1RAY0MB1E07AY4srgFYhfB27',
    name: 'Basic',
    description: 'Essential restaurant management features',
    mode: 'subscription',
    price: '$49.99',
    currency: 'usd',
    interval: 'month'
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};

export const getProductById = (id: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.id === id);
};

// Format price for display
export const formatStripePrice = (amount: number, currency: string = 'usd'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  });
  
  return formatter.format(amount / 100);
};