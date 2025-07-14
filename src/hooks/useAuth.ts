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
        fetchEmployeeProfile(session.user.id); // Call fetchEmployeeProfile
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
        fetchEmployeeProfile(session.user.id);
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
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error('Error fetching employee profile:', error);
        if (error.code === 'PGRST116') {
          console.log('No employee profile found for this user');
        }
      }

      setEmployeeProfile(data);
    } catch (err) {
      console.error('Error in fetchEmployeeProfile:', err);
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