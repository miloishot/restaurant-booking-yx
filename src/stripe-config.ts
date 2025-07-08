export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: string;
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_S4hPJplssOZcn7',
    priceId: 'price_1RAY0MB1E07AY4srgFYhfB26',
    name: 'Premium',
    description: '',
    mode: 'subscription',
    price: '$99.99'
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};

export const getProductById = (id: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.id === id);
};