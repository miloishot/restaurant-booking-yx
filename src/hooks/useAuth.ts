import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Employee } from '../types/database'; // Use Employee interface

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null); // Renamed to employeeProfile
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

  const fetchEmployeeProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('employees') // Fetch from employees table
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
      }

      setEmployeeProfile(data);
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
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
    loading,
    signOut,
  };
}