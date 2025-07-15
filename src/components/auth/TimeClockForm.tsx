import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, User, Lock, LogIn, LogOut, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface TimeClockFormProps {}

export function TimeClockForm({}: TimeClockFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [action, setAction] = useState<'in' | 'out'>('in');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [employeeData, setEmployeeData] = useState<any | null>(null);

  // Check for lockout on component mount
  useEffect(() => {
    const lockoutData = localStorage.getItem('timeclock_lockout');
    if (lockoutData) {
      const { until } = JSON.parse(lockoutData);
      const lockoutTime = new Date(until);
      
      if (lockoutTime > new Date()) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem('timeclock_lockout');
      }
    }
  }, []);

  // Timer to update lockout countdown
  useEffect(() => {
    if (!lockoutUntil) return;
    
    const interval = setInterval(() => {
      if (lockoutUntil <= new Date()) {
        setLockoutUntil(null);
        localStorage.removeItem('timeclock_lockout');
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const resetForm = () => {
    setIdentifier('');
    setPassword('');
    setError(null);
    setEmployeeData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (lockoutUntil && lockoutUntil > new Date()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // First, validate the credentials without creating a session
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: identifier.includes('@') ? identifier : `${identifier}@example.com`,
        password,
      });

      if (authError) {
        // Try to find user by display name if email login fails
        if (!identifier.includes('@')) {
          const { data: userByName, error: userError } = await supabase
            .from('auth.users')
            .select('id, email')
            .ilike('raw_user_meta_data->>name', identifier)
            .single();

          if (userError || !userByName) {
            throw new Error('Invalid credentials');
          }

          // Try again with the found email
          const { data: retryAuth, error: retryError } = await supabase.auth.signInWithPassword({
            email: userByName.email,
            password,
          });

          if (retryError) {
            throw new Error('Invalid credentials');
          }
        } else {
          throw authError;
        }
      }

      // Get employee data
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, name, restaurant_id, role, employee_id')
        .eq('employee_id', authData.user?.id) // Query by employee_id (which is the UID)
        .single();

      if (employeeError || !employee) {
        throw new Error('Employee record not found');
      }

      setEmployeeData(employee);

      // Handle clock in/out
      if (action === 'in') {
        await handleClockIn(employee);
      } else {
        await handleClockOut(employee);
      }

      // Reset failed attempts
      setFailedAttempts(0);
      
      // Sign out immediately to not maintain a session
      await supabase.auth.signOut();
      
    } catch (err) {
      console.error('Time clock error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      
      // Increment failed attempts
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      
      // Implement lockout after 5 failed attempts
      if (newFailedAttempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        setLockoutUntil(lockoutTime);
        localStorage.setItem('timeclock_lockout', JSON.stringify({ until: lockoutTime.toISOString() }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async (employee: any) => {
    try {
      // Check if already punched in today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingEntry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('restaurant_id', employee.restaurant_id)
        .eq('temp_employee_id', employee.id)
        .eq('date', today)
        .is('punch_out_time', null)
        .maybeSingle();

      if (existingEntry) {
        throw new Error('You are already clocked in');
      }

      const { error } = await supabase
        .from('time_entries')
        .insert({
          restaurant_id: employee.restaurant_id,
          temp_employee_id: employee.employee_id, // Use employee_id (UID)
          punch_in_time: new Date().toISOString(),
          date: today
        });

      if (error) throw error;

      setSuccess(`${employee.name} clocked in successfully at ${new Date().toLocaleTimeString()}`);
      setTimeout(resetForm, 3000);
    } catch (err) {
      throw err;
    }
  };

  const handleClockOut = async (employee: any) => {
    try {
      // Find today's punch in entry
      const today = new Date().toISOString().split('T')[0];
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('restaurant_id', employee.restaurant_id) // Use restaurant_id
        .eq('temp_employee_id', employee.id)
        .eq('date', today)
        .is('punch_out_time', null)
        .maybeSingle();

      if (entryError || !entry) {
        throw new Error('No active clock-in found for today');
      }

      const { error } = await supabase
        .from('time_entries')
        .update({
          punch_out_time: new Date().toISOString()
        })
        .eq('id', entry.id);

      if (error) throw error;

      setSuccess(`${employee.name} clocked out successfully at ${new Date().toLocaleTimeString()}`);
      setTimeout(resetForm, 3000);
    } catch (err) {
      throw err;
    }
  };

  const getLockoutTimeRemaining = () => {
    if (!lockoutUntil) return '';
    
    const now = new Date();
    const diff = Math.max(0, Math.floor((lockoutUntil.getTime() - now.getTime()) / 1000));
    
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Staff Time Clock</h2>
        <p className="text-gray-600 mt-2">Clock in or out for your shift</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-700 text-sm font-medium">{success}</p>
          </div>
        </div>
      )}

      {lockoutUntil && lockoutUntil > new Date() ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Temporarily Locked</h3>
          <p className="text-gray-600 mb-4">
            Too many failed attempts. Please try again in {getLockoutTimeRemaining()}.
          </p>
          <button
            onClick={() => {
              setLockoutUntil(null);
              localStorage.removeItem('timeclock_lockout');
              setFailedAttempts(0);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Reset
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Toggle for Clock In/Out */}
          <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => setAction('in')}
              className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center ${
                action === 'in'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Clock In
            </button>
            <button
              type="button"
              onClick={() => setAction('out')}
              className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center ${
                action === 'out'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Clock Out
            </button>
          </div>

          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID or Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="identifier"
                type="text"
                required
                autoComplete="off"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your employee ID or name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="password"
                type="password"
                required
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-white font-medium transition-colors ${
              action === 'in'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-orange-600 hover:bg-orange-700'
            } disabled:opacity-50`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : action === 'in' ? (
              <LogIn className="w-5 h-5 mr-2" />
            ) : (
              <LogOut className="w-5 h-5 mr-2" />
            )}
            {loading ? 'Processing...' : action === 'in' ? 'Clock In' : 'Clock Out'}
          </button>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Current time: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}