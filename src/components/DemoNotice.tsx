import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export function DemoNotice() {
  const isDemo = import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' || 
                 !import.meta.env.VITE_SUPABASE_URL;

  if (!isDemo) return null;

  return (
    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-orange-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-orange-700">
            <strong>Demo Mode:</strong> This is a demonstration of the Restaurant Booking System. 
            To use this application with real data, you need to:
          </p>
          <ul className="mt-2 text-sm text-orange-600 list-disc list-inside space-y-1">
            <li>Set up a Supabase project</li>
            <li>Configure environment variables</li>
            <li>Run the database migrations</li>
          </ul>
          <div className="mt-3">
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-orange-700 hover:text-orange-900 underline"
            >
              Get started with Supabase
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}