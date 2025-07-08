import React, { useState } from 'react';
import { WaitingListWithDetails } from '../types/database';
import { format } from 'date-fns';
import { Clock, User, Phone, Mail, Users, ArrowUp, X, CheckCircle, XCircle } from 'lucide-react';

interface WaitingListManagerProps {
  waitingList: WaitingListWithDetails[];
  onPromoteCustomer: (waitingListId: string) => Promise<{ success: boolean }>;
  onCancelWaiting: (waitingListId: string) => Promise<{ success: boolean }>;
}

export function WaitingListManager({ waitingList, onPromoteCustomer, onCancelWaiting }: WaitingListManagerProps) {
  const [processingAction, setProcessingAction] = useState<string | null>(null);

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

  const handlePromoteCustomer = async (waitingListId: string) => {
    setProcessingAction(`promote-${waitingListId}`);
    
    try {
      const result = await onPromoteCustomer(waitingListId);
      
      if (result.success) {
        showNotification('Customer promoted from waiting list and table assigned!', 'success');
      }
    } catch (error) {
      console.error('Error promoting customer:', error);
      showNotification('Failed to promote customer. Please try again.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelWaiting = async (waitingListId: string) => {
    setProcessingAction(`cancel-${waitingListId}`);
    
    try {
      const result = await onCancelWaiting(waitingListId);
      
      if (result.success) {
        showNotification('Customer removed from waiting list.', 'success');
      }
    } catch (error) {
      console.error('Error cancelling waiting list entry:', error);
      showNotification('Failed to remove customer from waiting list. Please try again.', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'MMM d, yyyy');
  };

  const groupedByTimeSlot = waitingList.reduce((acc, entry) => {
    const timeKey = `${entry.requested_date}_${entry.requested_time}`;
    if (!acc[timeKey]) {
      acc[timeKey] = [];
    }
    acc[timeKey].push(entry);
    return acc;
  }, {} as Record<string, WaitingListWithDetails[]>);

  const isProcessing = (actionKey: string) => processingAction === actionKey;

  if (waitingList.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Waiting List</h2>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No customers on the waiting list</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        Waiting List ({waitingList.length} customers)
      </h2>
      
      <div className="space-y-6">
        {Object.entries(groupedByTimeSlot).map(([timeKey, entries]) => {
          const [date, time] = timeKey.split('_');
          
          return (
            <div key={timeKey} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <h3 className="font-semibold text-orange-800 mb-4">
                {formatDate(date)} at {formatTime(time)} ({entries.length} waiting)
              </h3>
              
              <div className="space-y-3">
                {entries
                  .sort((a, b) => a.priority_order - b.priority_order)
                  .map((entry, index) => (
                    <div
                      key={entry.id}
                      className="bg-white rounded-lg p-4 border border-orange-200"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded-full mr-3">
                              #{index + 1}
                            </span>
                            <h4 className="font-semibold text-gray-800">{entry.customer.name}</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-1" />
                              {entry.customer.phone}
                            </div>
                            {entry.customer.email && (
                              <div className="flex items-center">
                                <Mail className="w-4 h-4 mr-1" />
                                {entry.customer.email}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}
                            </div>
                          </div>

                          {entry.notes && (
                            <p className="text-sm text-gray-600 italic mb-3">
                              Note: {entry.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Added: {format(new Date(entry.created_at), 'h:mm a')}</span>
                            <span>Updated: {format(new Date(entry.updated_at), 'h:mm a')}</span>
                          </div>
                        </div>

                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handlePromoteCustomer(entry.id)}
                            disabled={processingAction !== null}
                            className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                            title="Promote to confirmed booking"
                          >
                            {isProcessing(`promote-${entry.id}`) ? (
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <ArrowUp className="w-4 h-4 mr-1" />
                            )}
                            Seat Now
                          </button>
                          <button
                            onClick={() => handleCancelWaiting(entry.id)}
                            disabled={processingAction !== null}
                            className="flex items-center px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                            title="Remove from waiting list"
                          >
                            {isProcessing(`cancel-${entry.id}`) ? (
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">Waiting List Management</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Customers are automatically added when all tables are booked</li>
          <li>• Priority is based on arrival time (first come, first served)</li>
          <li>• Use "Seat Now" to manually assign a table when available</li>
          <li>• System automatically notifies next customer when tables become available</li>
          <li>• All actions are immediately synchronized with the database</li>
        </ul>
      </div>
    </div>
  );
}