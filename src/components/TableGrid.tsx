import React from 'react';
import { RestaurantTable } from '../types/database';

interface TableGridProps {
  tables: RestaurantTable[];
  onTableClick?: (table: RestaurantTable) => void;
  selectedTable?: RestaurantTable | null;
}

const statusColors = {
  available: 'bg-green-100 border-green-300 text-green-800',
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

export function TableGrid({ tables, onTableClick, selectedTable }: TableGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {tables.map((table) => (
        <div
          key={table.id}
          className={`
            relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
            ${statusColors[table.status]}
            ${selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : ''}
            ${onTableClick ? 'hover:shadow-lg transform hover:scale-105' : ''}
          `}
          onClick={() => onTableClick?.(table)}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">{table.table_number}</h3>
            <span className="text-xl">{statusIcons[table.status]}</span>
          </div>
          <div className="text-sm opacity-75">
            <p>Capacity: {table.capacity}</p>
            <p className="capitalize">{table.status}</p>
          </div>
          {table.location_notes && (
            <p className="text-xs mt-2 opacity-60">{table.location_notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}