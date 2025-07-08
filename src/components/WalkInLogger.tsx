import React, { useState } from 'react';
import { RestaurantTable, Restaurant } from '../types/database';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';

interface WalkInLoggerProps {
  restaurant: Restaurant;
  table: RestaurantTable;
  onSuccess: () => void;
  onCancel: () => void;
}

export function WalkInLogger({ restaurant, table, onSuccess, onCancel }: WalkInLoggerProps) {
  const [partySize, setPartySize] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { markTableOccupiedWithSession } = useRestaurantData();

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await markTableOccupiedWithSession(table, partySize);

      showNotification(`Table ${table.table_number} marked as occupied for walk-in party of ${partySize}`, 'success');
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log walk-in';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Walk-in for Table {table.table_number}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 flex items-center">
              <XCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Privacy-First Walk-in Logging</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• No personal customer data is collected or stored</li>
              <li>• Only operational metrics are recorded for analytics</li>
              <li>• Table status is updated for real-time availability</li>
              <li>• Anonymous booking record created for reporting</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Party Size (Optional)
              </label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {Array.from({ length: table.capacity }, (_, i) => i + 1).map(size => (
                  <option key={size} value={size}>
                    {size} {size === 1 ? 'person' : 'people'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Used for capacity analytics only
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center text-orange-800 mb-2">
                <Clock className="w-4 h-4 mr-2" />
                <span className="font-medium">Instant Table Update + QR Ordering</span>
              </div>
              <p className="text-sm text-orange-700">
                Table {table.table_number} will be marked as occupied, excluded from auto-assignment, 
                and enabled for QR code ordering. Customers can scan the QR code to order food and drinks.
              </p>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Processing...' : 'Mark Occupied'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}