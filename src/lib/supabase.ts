import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Debug logging for production
console.log('Supabase Configuration:', {
  url: supabaseUrl?.substring(0, 30) + '...',
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length
});

if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co' || !supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
  console.error('Supabase environment variables not properly configured:', {
    url: supabaseUrl,
    hasValidKey: supabaseAnonKey && supabaseAnonKey !== 'your-anon-key'
  });
  throw new Error('Missing or invalid Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);