import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Info, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState('');
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
      // Sign in with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      if (signInError) {
        console.error('Auth error:', signInError);
        throw signInError;
      }

      // Fetch employee data for the authenticated user
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, restaurant_id, employee_id, name, is_active')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .single();
      
      if (employeeError || !employee) {
        // If no employee record found or not active, sign out
        await supabase.auth.signOut();
        throw new Error('Employee account not found or inactive');
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
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
            <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium">Demo Credentials:</p>
                  <p>Email: <code className="bg-blue-100 px-1 py-0.5 rounded">kahweng@example.com</code> Password: <code className="bg-blue-100 px-1 py-0.5 rounded">Eisgrade1!</code></p>
                  <p>Email: <code className="bg-blue-100 px-1 py-0.5 rounded">yongxuan@example.com</code> Password: <code className="bg-blue-100 px-1 py-0.5 rounded">Qwerasdf1@3$</code></p>
                  <p>Email: <code className="bg-blue-100 px-1 py-0.5 rounded">test@example.com</code> Password: <code className="bg-blue-100 px-1 py-0.5 rounded">password123</code></p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email address"
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
                onClick={() => {
                  setEmail('test@example.com');
                  setPassword('password123');
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="mt-2 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign up
              </button>
            </p>
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