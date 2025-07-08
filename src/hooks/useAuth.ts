import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('Auth session error:', sessionError);
          setError('Authentication service unavailable');
        } else {
          setUser(session?.user ?? null);
        }

        // Listen for auth changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          setError(null);
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } catch (err) {
        console.warn('Auth initialization error:', err);
        setError('Authentication service unavailable');
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
  };

  return {
    user,
    loading,
    error,
    signOut,
  };
}