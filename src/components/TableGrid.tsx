import React from 'react';
import { RestaurantTable } from '../types/database';
import { Users, MapPin } from 'lucide-react';

interface TableGridProps {
  tables: RestaurantTable[];
  onTableClick?: (table: RestaurantTable) => void;
  onMarkOccupied?: (table: RestaurantTable) => void;
  selectedTable?: RestaurantTable | null;
  showOccupiedButton?: boolean;
}

const statusColors = {
  available: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200',
  occupied: 'bg-red-100 border-red-300 text-red-800',
  reserved: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  maintenance: 'bg-gray-100 border-gray-300 text-gray-800'
};

const statusIcons = {
  available: '✓',
  occupied: '●',
  reserved: '○',
  maintenance: '🔧'
};

export function TableGrid({ 
  tables, 
  onTableClick, 
  onMarkOccupied,
  selectedTable, 
  showOccupiedButton = false 
}: TableGridProps) {
  const handleTableAction = (table: RestaurantTable) => {
    if (showOccupiedButton && table.status === 'available' && onMarkOccupied) {
      onMarkOccupied(table);
    } else if (onTableClick) {
      onTableClick(table);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {tables.map((table) => (
        <div
          key={table.id}
          className={`
            relative p-4 rounded-lg border-2 transition-all duration-200
            ${statusColors[table.status]}
            ${selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : ''}
            ${(onTableClick || onMarkOccupied) ? 'cursor-pointer hover:shadow-lg transform hover:scale-105' : ''}
          `}
          onClick={() => handleTableAction(table)}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">{table.table_number}</h3>
            <span className="text-xl">{statusIcons[table.status]}</span>
          </div>
          
          <div className="text-sm opacity-75 mb-3">
            <div className="flex items-center mb-1">
              <Users className="w-3 h-3 mr-1" />
              <span>Capacity: {table.capacity}</span>
            </div>
            <p className="capitalize font-medium">{table.status}</p>
            {table.location_notes && (
              <div className="flex items-center mt-1">
                <MapPin className="w-3 h-3 mr-1" />
                <p className="text-xs">{table.location_notes}</p>
              </div>
            )}
          </div>

          {/* Action Button for Walk-ins */}
          {showOccupiedButton && table.status === 'available' && (
            <div className="mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkOccupied?.(table);
                }}
                className="w-full px-3 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Mark Occupied
              </button>
            </div>
          )}

          {/* Status indicator for occupied tables */}
          {table.status === 'occupied' && (
            <div className="mt-2 text-xs text-red-700 font-medium">
              Walk-in Active
            </div>
          )}
        </div>
      ))}
    </div>
  );
}