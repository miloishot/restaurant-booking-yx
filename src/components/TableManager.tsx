import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantTable } from '../types/database';
import { Plus, Edit2, Trash2, Save, X, Grid, List, Settings } from 'lucide-react';

interface TableManagerProps {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  onUpdate: () => void;
}

interface TableFormData {
  table_number: string;
  capacity: number;
  location_notes: string;
}

export function TableManager({ restaurant, tables, onUpdate }: TableManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [formData, setFormData] = useState<TableFormData>({
    table_number: '',
    capacity: 2,
    location_notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  const resetForm = () => {
    setFormData({
      table_number: '',
      capacity: 2,
      location_notes: ''
    });
    setEditingTable(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (table: RestaurantTable) => {
    setFormData({
      table_number: table.table_number,
      capacity: table.capacity,
      location_notes: table.location_notes || ''
    });
    setEditingTable(table);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingTable) {
        // Update existing table
        const { error } = await supabase
          .from('restaurant_tables')
          .update({
            table_number: formData.table_number,
            capacity: formData.capacity,
            location_notes: formData.location_notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTable.id);

        if (error) throw error;
        showNotification('Table updated successfully!');
      } else {
        // Create new table
        const { error } = await supabase
          .from('restaurant_tables')
          .insert({
            restaurant_id: restaurant.id,
            table_number: formData.table_number,
            capacity: formData.capacity,
            location_notes: formData.location_notes || null,
            status: 'available'
          });

        if (error) throw error;
        showNotification('Table created successfully!');
      }

      resetForm();
      onUpdate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save table';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (!confirm(`Are you sure you want to delete Table ${table.table_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .delete()
        .eq('id', table.id);

      if (error) throw error;
      
      showNotification('Table deleted successfully!');
      onUpdate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete table';
      showNotification(errorMessage, 'error');
    }
  };

  const generateTableNumbers = async () => {
    const count = parseInt(prompt('How many tables would you like to create?') || '0');
    if (count <= 0 || count > 50) {
      showNotification('Please enter a number between 1 and 50', 'error');
      return;
    }

    const capacity = parseInt(prompt('Default capacity for all tables?') || '4');
    if (capacity <= 0 || capacity > 20) {
      showNotification('Please enter a capacity between 1 and 20', 'error');
      return;
    }

    setLoading(true);
    try {
      const tablesToCreate = [];
      for (let i = 1; i <= count; i++) {
        tablesToCreate.push({
          restaurant_id: restaurant.id,
          table_number: i.toString(),
          capacity: capacity,
          status: 'available' as const,
          location_notes: null
        });
      }

      const { error } = await supabase
        .from('restaurant_tables')
        .insert(tablesToCreate);

      if (error) throw error;
      
      showNotification(`${count} tables created successfully!`);
      onUpdate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tables';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    available: 'bg-green-100 text-green-800 border-green-300',
    occupied: 'bg-red-100 text-red-800 border-red-300',
    reserved: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    maintenance: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  const statusIcons = {
    available: '✓',
    occupied: '●',
    reserved: '○',
    maintenance: '🔧'
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Table Management
          </h2>
          <p className="text-gray-600">Create and manage your restaurant tables</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          {tables.length === 0 && (
            <button
              onClick={generateTableNumbers}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Quick Setup
            </button>
          )}
          
          <button
            onClick={() => setShowForm(true)}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </button>
        </div>
      </div>

      {/* Table Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingTable ? 'Edit Table' : 'Add New Table'}
              </h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Table Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.table_number}
                    onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1, A1, VIP-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity *
                  </label>
                  <select
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'person' : 'people'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Notes
                  </label>
                  <input
                    type="text"
                    value={formData.location_notes}
                    onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Window seat, Near bar, Patio"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Saving...' : editingTable ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tables Display */}
      {tables.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Tables Yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first table to start managing bookings
          </p>
          <div className="space-y-3">
            <button
              onClick={generateTableNumbers}
              disabled={loading}
              className="block mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Quick Setup (Multiple Tables)
            </button>
            <button
              onClick={() => setShowForm(true)}
              disabled={loading}
              className="block mx-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Add Single Table
            </button>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${statusColors[table.status]}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{table.table_number}</h3>
                    <span className="text-xl">{statusIcons[table.status]}</span>
                  </div>
                  <div className="text-sm opacity-75 mb-3">
                    <p>Capacity: {table.capacity}</p>
                    <p className="capitalize">{table.status}</p>
                    {table.location_notes && (
                      <p className="text-xs mt-1">{table.location_notes}</p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(table)}
                      className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                    >
                      <Edit2 className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => handleDelete(table)}
                      className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tables.map((table) => (
                    <tr key={table.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {table.table_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.capacity} people
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[table.status]}`}>
                          {statusIcons[table.status]} {table.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.location_notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(table)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(table)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">Table Management Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Table numbers can be numeric (1, 2, 3) or alphanumeric (A1, VIP-1)</li>
              <li>• Capacity determines the maximum party size for automatic assignment</li>
              <li>• Location notes help staff identify table positions</li>
              <li>• Table status is automatically managed during booking operations</li>
              <li>• All changes are immediately synchronized across all devices</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}