import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Employee, Restaurant } from '../types/database';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
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
      if (!session?.user) {
        setEmployeeProfile(null);
        setRestaurantId(null);
        setLoading(false);
      } else {
        fetchEmployeeProfile(session.user.id).catch(err => {
          console.error('Error fetching employee profile:', err);
          // Continue with the user being logged in even if profile fetch fails
          setLoading(false);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEmployeeProfile = async (id: string) => {
    try {
      console.log('Fetching employee profile for user ID:', id);
      setLoading(true);
      
      try {
        // Direct query with no timeout to get the employee profile
        const { data, error } = await supabase
          .from('employees')
          .select('id, restaurant_id, role, name, is_active')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('Error fetching employee profile:', error);
          throw error;
        }
        
        setEmployeeProfile(data);
        setRestaurantId(data.restaurant_id);
      } catch (fetchError) {
        console.error('Error fetching employee profile:', fetchError);
        
        // Try to get restaurant directly if employee profile fails
        try {
          const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', id)
            .single();
            
          if (restaurant) {
            // If user is a restaurant owner, create an employee profile
            setEmployeeProfile({
              id,
              restaurant_id: restaurant.id,
              role: 'owner',
              name: 'Restaurant Owner',
              is_active: true
            } as Employee);
            setRestaurantId(restaurant.id);
            
            // Also create the employee record in the database
            await supabase.from('employees').upsert({
              id,
              restaurant_id: restaurant.id,
              role: 'owner',
              name: 'Restaurant Owner',
              is_active: true
            });
          }
        } catch (restaurantError) {
          console.error('Error checking if user is restaurant owner:', restaurantError);
          setEmployeeProfile(null);
        }
      }
    } catch (err) {
      console.error('Error in fetchEmployeeProfile:', err);
      setEmployeeProfile(null);
      setRestaurantId(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setEmployeeProfile(null);
    setRestaurantId(null);
  };

  return {
    user,
    employeeProfile, // Export employeeProfile
    restaurantId,
    loading,
    signOut,
  };
}