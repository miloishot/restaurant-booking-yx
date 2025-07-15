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
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      // If there's an error or invalid session, clear it
      if (sessionError || (session && !session.access_token)) {
        console.warn('Invalid session detected, signing out:', sessionError);
        supabase.auth.signOut();
        setUser(null);
        setEmployeeProfile(null);
        setRestaurantId(null);
        setLoading(false);
        return;
      }
      
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
    }).catch(error => {
      // Handle any errors during session retrieval
      console.warn('Error getting session, signing out:', error);
      supabase.auth.signOut();
      setUser(null);
      setEmployeeProfile(null);
      setRestaurantId(null);
      setLoading(false);
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
        // Direct query to get the employee profile
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('*')
          .eq('employee_id', id) // Query by employee_id which matches the UID
          .maybeSingle();

        if (employeeError) {
          console.error('Error fetching employee profile:', employeeError);
          try {
            // Try to get restaurant directly if employee profile fails
            const { data: restaurant } = await supabase
              .from('restaurants')
              .select('id')
              .eq('owner_id', id)
              .maybeSingle();
              
            if (restaurant) {
              // If user is a restaurant owner, create an employee profile
              setEmployeeProfile({
                employee_id: id,
                restaurant_id: restaurant.id,
                role: 'owner',
                name: 'Restaurant Owner',
                is_active: true,
                email: user?.email // Add email from the authenticated user
              });
              setRestaurantId(restaurant.id);
              
              // Also create the employee record in the database
              await supabase.from('employees').upsert({
                employee_id: id,
                restaurant_id: restaurant.id,
                role: 'owner',
                name: 'Restaurant Owner',
                is_active: true
              });
            } else {
              setEmployeeProfile(null);
            }
          } catch (restaurantError) {
            console.error('Error checking if user is restaurant owner:', restaurantError);
            setEmployeeProfile(null);
          }
        } else {
          // We have the employee data, now add the email from the authenticated user
          setEmployeeProfile({
            ...employeeData,
            email: user?.email // Add email from the authenticated user
          });
          setRestaurantId(employeeData.restaurant_id);
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