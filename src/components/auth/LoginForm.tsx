import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Attempting login with employee ID:', employeeId);
      
      // First, verify employee credentials
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('password', password)
        .eq('is_active', true)
        .maybeSingle();

      if (employeeError) {
        console.error('Employee lookup error:', employeeError);
        throw new Error('Error looking up employee credentials');
      }
      
      if (!employee) {
        console.log('No employee found with ID:', employeeId);
        throw new Error('Invalid employee ID or password');
      }

      console.log('Employee found:', employee.name);

      // Create a session using the employee's restaurant owner account
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('owner_id')
        .eq('id', employee.restaurant_id)
        .single();

      if (restaurantError || !restaurant) {
        throw new Error('Restaurant not found');
      }

      // For simplicity, we'll use the restaurant owner's account
      // In a real system, you'd have proper employee authentication
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'demo@example.com', // This is just for demo purposes
        password: 'password123',    // In production, use proper employee authentication
      });
      
      if (signInError) {
        console.error('Auth error:', signInError);
        throw signInError;
      }

      // Store employee info in local storage for reference
      localStorage.setItem('currentEmployee', JSON.stringify({
        id: employee.id,
        name: employee.name,
        employee_id: employee.employee_id,
        restaurant_id: employee.restaurant_id
      }));

      onSuccess();
    } catch (err) {
      console.error('Login error details:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Employee Login</h2>
          <p className="text-gray-600 mt-2">Enter your employee credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            {error.includes('Invalid login credentials') && (
              <p className="text-xs text-red-600 mt-2">
                For demo purposes, try using one of these employee IDs: "kahweng", "yongxuan", or "test" with password "password123"
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="employeeId"
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your employee ID (e.g., kahweng, yongxuan, test)"
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
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="For demo: password123"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToSignup}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Contact Administrator
            </button>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Demo credentials: Employee ID "kahweng", "yongxuan", or "test" with password "password123"
          </p>
        </div>
      </div>
    </div>
  );
}