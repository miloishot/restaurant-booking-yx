import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../types/database';
import { X, Lock, AlertCircle, CheckCircle } from 'lucide-react';

interface PasswordPromptModalProps {
  employee: Employee;
  action: 'in' | 'out';
  onVerified: (employee: Employee, action: 'in' | 'out') => Promise<void>;
  onCancel: () => void;
}

export function PasswordPromptModal({ employee, action, onVerified, onCancel }: PasswordPromptModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Attempt to sign in with the provided credentials
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: `${employee.employee_id}@example.com`, // Use employee_id as email
        password,
      });

      if (authError) {
        throw new Error('Invalid password. Please try again.');
      }

      // Verify that the authenticated user ID matches the employee ID
      if (authData.user?.id !== employee.id) {
        throw new Error('Authentication failed. User ID mismatch.');
      }

      // Show success message briefly
      setSuccess(true);
      
      // Wait a moment to show success message
      setTimeout(async () => {
        try {
          // Call the onVerified callback
          await onVerified(employee, action);
          
          // Sign out immediately to not maintain a session
          await supabase.auth.signOut();
        } catch (callbackError) {
          console.error('Error in verification callback:', callbackError);
        }
      }, 1000);
      
    } catch (err) {
      console.error('Password verification error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {action === 'in' ? 'Clock In Verification' : 'Clock Out Verification'}
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success ? (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                <p className="text-green-700 text-sm">
                  Verification successful! Processing {action === 'in' ? 'clock in' : 'clock out'}...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Employee:</strong> {employee.name}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Action:</strong> {action === 'in' ? 'Clock In' : 'Clock Out'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Verification
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your password"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Please enter your password to verify your identity
                </p>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                    action === 'in'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  } disabled:opacity-50`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Verifying...
                    </div>
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}