import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Employee } from '../types/database';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      // If user exists, fetch their profile
      if (session?.user) {
        fetchEmployeeProfile(session.user.id).catch(err => {
          console.error('Error fetching employee profile:', err);
          // Don't set loading to false here, as we still want to show the user as logged in
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      // If user exists, fetch their employee profile
      if (session?.user) {
        fetchEmployeeProfile(session.user.id).catch(err => {
          console.error('Error fetching employee profile:', err);
          // Continue with the user being logged in even if profile fetch fails
          setLoading(false);
        });
      } else {
        setEmployeeProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEmployeeProfile = async (id: string) => {
    try {
      console.log('Fetching employee profile for user ID:', id);

      // Check if Supabase is properly initialized
      if (!supabase) {
        console.error('Supabase client is not initialized');
        setLoading(false);
        return;
      }
      
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Supabase configuration is missing. Please check your .env file.');
        setLoading(false);
        return;
      }
      
      try {
        // Use a more resilient approach with error handling and timeout
        const fetchWithTimeout = async () => {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out')), 5000)
          );
          
          try {
            const result = await Promise.race([
              supabase
                .from('employees')
                .select('id, restaurant_id, role, name, is_active')
                .eq('id', id)
                .maybeSingle(),
              timeoutPromise
            ]);
            return result;
          } catch (error) {
            console.warn('Fetch timed out, using fallback approach');
            // If timeout occurs, try a simpler query
            return await supabase
              .from('employees')
              .select('id')
              .eq('id', id)
              .maybeSingle();
          }
        };
        
        const { data, error } = await fetchWithTimeout();
        
        if (error) {
          console.error('Error fetching employee profile:', error);
          if (error.code === 'PGRST116') {
            console.log('No employee profile found for this user');
          }
        } else if (data) {
          // If we only got the ID in the fallback query, fetch the full profile
          if (Object.keys(data).length === 1 && data.id) {
            try {
              const { data: fullProfile } = await supabase
                .from('employees')
                .select('id, restaurant_id, role, name, is_active')
                .eq('id', id)
                .maybeSingle();
                
              setEmployeeProfile(fullProfile || { 
                id, 
                restaurant_id: null,
                role: 'staff',
                name: 'Unknown Employee',
                is_active: true
              });
            } catch (err) {
              console.error('Error fetching full profile:', err);
              // Use minimal profile as fallback
              setEmployeeProfile({ 
                id, 
                restaurant_id: null,
                role: 'staff',
                name: 'Unknown Employee',
                is_active: true
              });
            }
          } else {
            setEmployeeProfile(data);
          }
        } else {
          // No data found, set a minimal profile
          setEmployeeProfile(null);
        }
      } catch (fetchError) {
        console.error('Fetch error in fetchEmployeeProfile:', fetchError);
        // Set a minimal profile as fallback
        setEmployeeProfile({ 
          id, 
          restaurant_id: null,
          role: 'staff',
          name: 'Unknown Employee',
          is_active: true
        });
      }
    } catch (err) {
      console.error('Error in fetchEmployeeProfile:', err);
      // Don't rethrow the error, handle it gracefully
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setEmployeeProfile(null);
  };

  return {
    user,
    employeeProfile, // Export employeeProfile
    restaurantId: employeeProfile?.restaurant_id,
    loading,
    signOut,
  };
}