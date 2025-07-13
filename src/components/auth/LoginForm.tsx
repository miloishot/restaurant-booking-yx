import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, Info, Loader2 } from 'lucide-react';

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
      // First, get the employee record
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, restaurant_id, employee_id, name, password, is_active')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .single();
      
      if (employeeError) {
        console.error('Employee lookup error:', employeeError);
        if (employeeError.code === 'PGRST116') {
          throw new Error('Invalid employee ID or password');
        }
        throw new Error('Error looking up employee credentials');
      }

      if (!employee) {
        throw new Error('Invalid employee ID or password');
      }

      // Verify password using the database function
      const { data: passwordValid, error: verifyError } = await supabase
        .rpc('verify_password', {
          password: password,
          hashed_password: employee.password
        });

      if (verifyError) {
        console.error('Password verification error:', verifyError);
        throw new Error('Invalid employee ID or password');
      }

      if (!passwordValid) {
        throw new Error('Invalid employee ID or password');
      }

      console.log('Employee found and password verified:', employee.name);

      // Get restaurant owner for authentication
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('owner_id')
        .eq('id', employee.restaurant_id)
        .single();

      if (restaurantError || !restaurant) {
        throw new Error('Restaurant not found');
      }

      // Sign in with demo account (in production, implement proper employee sessions)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'demo@example.com',
        password: 'password123',
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
      setError(err instanceof Error ? err.message : 'Invalid employee ID or password');
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
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
            <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium">Demo Credentials:</p>
                  <p>Employee ID: <code className="bg-blue-100 px-1 py-0.5 rounded">kahweng</code> Password: <code className="bg-blue-100 px-1 py-0.5 rounded">Eisgrade1!</code></p>
                  <p>Employee ID: <code className="bg-blue-100 px-1 py-0.5 rounded">yongxuan</code> Password: <code className="bg-blue-100 px-1 py-0.5 rounded">Qwerasdf1@3$</code></p>
                  <p>Employee ID: <code className="bg-blue-100 px-1 py-0.5 rounded">test</code> Password: <code className="bg-blue-100 px-1 py-0.5 rounded">password123</code></p>
                </div>
              </div>
            </div>
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
                autoComplete="off"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your employee ID"
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
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
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
              <Loader2 className="w-5 h-5 animate-spin" />
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
            <button
              onClick={() => {
                setEmployeeId('test');
                setPassword('password123');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Use Demo Credentials
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}