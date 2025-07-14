import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging for development
if (import.meta.env.DEV) {
  console.log('Supabase Configuration (Debug):', {
    url: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'Not set',
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length || 0
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  console.error('Required variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'); 
  console.error('Current values:', {
    VITE_SUPABASE_URL: supabaseUrl || 'Not set',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Set (length: ' + supabaseAnonKey.length + ')' : 'Not set'
  }); 
}

// Create the Supabase client with proper error handling
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', // Fallback URL to prevent crashes
  supabaseAnonKey || 'placeholder-key', // Fallback key to prevent crashes
  {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Test the connection to help with debugging
if (import.meta.env.DEV) {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('Supabase connection test successful');
    }
  });
}