import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3dmenVnd3FlY2thcmFlanhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMzkxOTQsImV4cCI6MjA2NzcxNTE5NH0.zXMPN3T47oQKbz9ZeDE2IDu_n3nVh2lS3utwgCMq7Vo';

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
    VITE_SUPABASE_URL: supabaseUrl || 'Using fallback URL',
    VITE_SUPABASE_ANON_KEY: 'Using fallback key'
  });
}

// Create the Supabase client with proper error handling
export const supabase = createClient(
  supabaseUrl || 'https://jskwfzugwqeckaraejxs.supabase.co', // Fallback URL to prevent crashes
  supabaseAnonKey, // Using the fallback key defined above
  {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Test the connection to help with debugging
if (import.meta.env.DEV) {
  setTimeout(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Supabase connection test failed:', error.message);
      } else {
        console.log('Supabase connection test successful');
      }
    }).catch(err => {
      console.error('Supabase connection test exception:', err);
    });
  }, 1000); // Delay the test to ensure it doesn't block initial rendering
}