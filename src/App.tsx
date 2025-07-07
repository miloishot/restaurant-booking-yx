import React, { useState } from 'react';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { CustomerBooking } from './components/CustomerBooking';
import { Settings, Users, SplitSquareHorizontal } from 'lucide-react';

type ViewMode = 'customer' | 'staff' | 'split';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('customer');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* View Mode Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-2 flex">
          <button
            onClick={() => setViewMode('customer')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'customer'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Customer
          </button>
          <button
            onClick={() => setViewMode('staff')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'staff'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Staff
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'split'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <SplitSquareHorizontal className="w-4 h-4 mr-2" />
            Split View
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'customer' && <CustomerBooking />}
      {viewMode === 'staff' && <RestaurantDashboard />}
      {viewMode === 'split' && (
        <div className="flex h-screen">
          {/* Customer View - Left Side */}
          <div className="w-1/2 border-r border-gray-300 overflow-y-auto">
            <div className="bg-blue-50 p-2 text-center border-b border-blue-200">
              <h2 className="text-sm font-semibold text-blue-800">Customer View</h2>
            </div>
            <div className="transform scale-75 origin-top-left" style={{ width: '133.33%', height: '133.33%' }}>
              <CustomerBooking />
            </div>
          </div>
          
          {/* Staff View - Right Side */}
          <div className="w-1/2 overflow-y-auto">
            <div className="bg-green-50 p-2 text-center border-b border-green-200">
              <h2 className="text-sm font-semibold text-green-800">Staff Dashboard</h2>
            </div>
            <div className="transform scale-75 origin-top-left" style={{ width: '133.33%', height: '133.33%' }}>
              <RestaurantDashboard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;