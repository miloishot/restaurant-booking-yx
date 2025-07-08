import React, { useState } from 'react';
import { LoyaltyDiscount } from '../../types/database';
import { Plus, X, Tag, CheckCircle, Users } from 'lucide-react';

interface LoyaltyInputProps {
  loyaltyUserIds: string[];
  onLoyaltyUserIdsChange: (ids: string[]) => void;
  loyaltyDiscount: LoyaltyDiscount | null;
}

export function LoyaltyInput({ loyaltyUserIds, onLoyaltyUserIdsChange, loyaltyDiscount }: LoyaltyInputProps) {
  const [newUserId, setNewUserId] = useState('');
  const [showInput, setShowInput] = useState(false);

  const addUserId = () => {
    if (newUserId.trim() && !loyaltyUserIds.includes(newUserId.trim())) {
      onLoyaltyUserIdsChange([...loyaltyUserIds, newUserId.trim()]);
      setNewUserId('');
      setShowInput(false);
    }
  };

  const removeUserId = (index: number) => {
    onLoyaltyUserIdsChange(loyaltyUserIds.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addUserId();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Tag className="w-5 h-5 text-purple-600 mr-2" />
          <h3 className="font-semibold text-gray-800">Loyalty Program</h3>
        </div>
        
        {loyaltyDiscount?.discount_eligible && (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">10% Discount Applied!</span>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Enter User IDs to check for loyalty discounts. If any member has spent S$100+, 
        a 10% discount will be applied to your entire order.
      </p>

      {/* Current User IDs */}
      {loyaltyUserIds.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {loyaltyUserIds.map((userId, index) => (
              <div
                key={index}
                className={`flex items-center px-3 py-1 rounded-full text-sm ${
                  loyaltyDiscount?.triggering_user_id === userId
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Users className="w-3 h-3 mr-1" />
                {userId}
                {loyaltyDiscount?.triggering_user_id === userId && (
                  <CheckCircle className="w-3 h-3 ml-1" />
                )}
                <button
                  onClick={() => removeUserId(index)}
                  className="ml-2 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User ID Input */}
      {showInput ? (
        <div className="flex space-x-2">
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter User ID"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
          />
          <button
            onClick={addUserId}
            disabled={!newUserId.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => {
              setShowInput(false);
              setNewUserId('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center px-4 py-2 border border-purple-300 text-purple-600 rounded-md hover:bg-purple-50 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User ID
        </button>
      )}

      {/* Discount Status */}
      {loyaltyUserIds.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border">
          {loyaltyDiscount?.discount_eligible ? (
            <div className="text-green-700 bg-green-50 border-green-200">
              <div className="flex items-center mb-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="font-medium">Discount Eligible!</span>
              </div>
              <p className="text-sm">
                User ID "{loyaltyDiscount.triggering_user_id}" qualifies for a 10% discount.
              </p>
            </div>
          ) : (
            <div className="text-gray-600 bg-gray-50 border-gray-200">
              <p className="text-sm">
                No qualifying loyalty members found. Spend S$100+ to become eligible for discounts.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}