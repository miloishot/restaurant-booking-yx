# Restaurant Booking System

A comprehensive restaurant booking and management system built with React, TypeScript, and Supabase.

## Features

- **Customer Booking Interface**: Public booking pages for each restaurant
- **Staff Management Dashboard**: Complete booking and table management
- **Real-time Updates**: Live booking status and table availability
- **Analytics Dashboard**: Booking insights and operational analytics
- **Waiting List Management**: Automatic waitlist handling when fully booked
- **Stripe Integration**: Subscription-based payment system
- **Multi-tenant Architecture**: Each restaurant has its own data and booking URL

## Demo

Visit the live demo: [Restaurant Booking System](https://lambent-mandazi-ba8ec1.netlify.app)

**Demo Credentials:**
- Email: `test@restaurant.com`
- Password: `testpass123`
- Restaurant URL: `/test-restaurant`

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Run the database migrations in the `supabase/migrations` folder
4. Set up the Stripe webhook endpoint (optional, for payments)

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation

```bash
npm install
npm run dev
```

### 4. Database Setup

The migrations will create:
- Restaurant management tables
- Booking and customer tables
- Waiting list functionality
- Operating hours management
- Stripe integration tables
- Sample data for testing

### 5. Stripe Setup (Optional)

1. Create a Stripe account
2. Get your API keys from the Stripe dashboard
3. Deploy the Supabase Edge Functions for Stripe integration
4. Configure webhook endpoints

## Architecture

### Customer Flow
1. Visit restaurant's unique booking URL (e.g., `/restaurant-name`)
2. Select date, time, and party size
3. Complete booking form
4. Receive confirmation or waitlist notification

### Staff Flow
1. Sign in to management dashboard
2. View and manage today's bookings
3. Handle walk-ins and table assignments
4. Monitor waiting list and analytics
5. Configure restaurant settings

### Subscription Model
- Restaurants pay monthly subscription for access
- Customers book for free
- Each restaurant gets unique booking URL
- Full analytics and management features included

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Payments**: Stripe
- **Deployment**: Netlify
- **Icons**: Lucide React

## Key Components

- `CustomerBooking`: Public booking interface
- `RestaurantDashboard`: Staff management interface
- `BookingAnalytics`: Operational insights and reporting
- `TimeSlotBookingForm`: Smart booking with availability checking
- `WaitingListManager`: Automatic waitlist handling

## Database Schema

The system uses a multi-tenant architecture where:
- Each user is linked to a specific restaurant
- Customers can book at any restaurant via public URLs
- Staff can only access their restaurant's data
- Real-time updates across all interfaces

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.