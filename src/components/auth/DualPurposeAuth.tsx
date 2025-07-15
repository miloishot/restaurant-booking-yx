import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LoginForm } from './LoginForm';
import { TimeClockForm } from './TimeClockForm';
import { ChefHat, Clock } from 'lucide-react';

interface DualPurposeAuthProps {
  onAuthSuccess: () => void;
}

export function DualPurposeAuth({ onAuthSuccess }: DualPurposeAuthProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeclock'>('dashboard');
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [showResetPrompt, setShowResetPrompt] = useState(false);

  // Reset to dashboard login after inactivity (5 minutes)
  useEffect(() => {
    const inactivityTimeout = 5 * 60 * 1000; // 5 minutes
    
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > inactivityTimeout && activeTab === 'timeclock') {
        setShowResetPrompt(true);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [lastActivity, activeTab]);

  // Update last activity timestamp on user interaction
  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
      if (showResetPrompt) {
        setShowResetPrompt(false);
      }
    };
    
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [showResetPrompt]);

  const handleReset = () => {
    setActiveTab('dashboard');
    setShowResetPrompt(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <ChefHat className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Restaurant Management</h1>
          <p className="text-gray-600 mt-2">Login to access your dashboard or clock in/out</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } transition-colors`}
            >
              <ChefHat className="w-5 h-5 mr-2" />
              Dashboard Login
            </button>
            <button
              onClick={() => setActiveTab('timeclock')}
              className={`flex-1 py-3 px-4 rounded-lg ml-2 flex items-center justify-center ${
                activeTab === 'timeclock'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } transition-colors`}
            >
              <Clock className="w-5 h-5 mr-2" />
              Time Clock
            </button>
          </div>
        </div>

        {/* Auth Forms */}
        {activeTab === 'dashboard' ? (
          <LoginForm
            onSuccess={onAuthSuccess}
            onSwitchToSignup={() => {}}
          />
        ) : (
          <TimeClockForm />
        )}

        {/* Inactivity Reset Prompt */}
        {showResetPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
              <h3 className="text-xl font-semibold mb-4">Session Timeout</h3>
              <p className="mb-6">The time clock has been inactive for a while. Would you like to continue or reset?</p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowResetPrompt(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Continue
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}