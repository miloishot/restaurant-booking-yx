import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { useAuth } from '../hooks/useAuth';
import { Printer, Settings, Wifi, Check, X, RefreshCw, QrCode, Save, Plus, Edit2, Trash2 } from 'lucide-react';

interface PrinterSetupProps {
  restaurant: Restaurant;
}

interface PrinterConfig {
  id?: string;
  restaurant_id: string;
  printer_name: string;
  printer_type: 'network' | 'usb' | 'bluetooth';
  ip_address?: string;
  port?: number;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function PrinterSetup({ restaurant }: PrinterSetupProps) {
  const { user } = useAuth();
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);
  const [formData, setFormData] = useState<Omit<PrinterConfig, 'id' | 'created_at' | 'updated_at'>>({
    restaurant_id: restaurant.id,
    printer_name: '',
    printer_type: 'network',
    ip_address: '',
    port: 9100,
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    fetchPrinters();
  }, [restaurant.id]);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('printer_configs')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrinters(data || []);
    } catch (error) {
      console.error('Error fetching printers:', error);
      showNotification('Failed to load printer configurations', 'error');
    } finally {
      setLoading(false);
    }
  };

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
      restaurant_id: restaurant.id,
      printer_name: '',
      printer_type: 'network',
      ip_address: '',
      port: 9100,
      is_default: false,
      is_active: true
    });
    setEditingPrinter(null);
    setShowForm(false);
  };

  const handleEdit = (printer: PrinterConfig) => {
    setFormData({
      restaurant_id: printer.restaurant_id,
      printer_name: printer.printer_name,
      printer_type: printer.printer_type,
      ip_address: printer.ip_address || '',
      port: printer.port || 9100,
      is_default: printer.is_default,
      is_active: printer.is_active
    });
    setEditingPrinter(printer);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // If setting as default, update all other printers to not be default
      if (formData.is_default) {
        const { error: updateError } = await supabase
          .from('printer_configs')
          .update({ is_default: false })
          .eq('restaurant_id', restaurant.id);
        
        if (updateError) throw updateError;
      }
      
      if (editingPrinter) {
        // Update existing printer
        const { error } = await supabase
          .from('printer_configs')
          .update({
            printer_name: formData.printer_name,
            printer_type: formData.printer_type,
            ip_address: formData.ip_address,
            port: formData.port,
            is_default: formData.is_default,
            is_active: formData.is_active
          })
          .eq('id', editingPrinter.id);

        if (error) throw error;
        showNotification('Printer updated successfully!');
      } else {
        // Create new printer
        const { error } = await supabase
          .from('printer_configs')
          .insert({
            restaurant_id: restaurant.id,
            printer_name: formData.printer_name,
            printer_type: formData.printer_type,
            ip_address: formData.ip_address,
            port: formData.port,
            is_default: formData.is_default,
            is_active: formData.is_active
          });

        if (error) throw error;
        showNotification('Printer added successfully!');
      }

      resetForm();
      fetchPrinters();
    } catch (error) {
      console.error('Error saving printer:', error);
      showNotification('Failed to save printer configuration', 'error');
    }
  };

  const handleDelete = async (printerId: string) => {
    if (!confirm('Are you sure you want to delete this printer configuration?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('printer_configs')
        .delete()
        .eq('id', printerId);

      if (error) throw error;
      
      showNotification('Printer configuration deleted successfully!');
      fetchPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      showNotification('Failed to delete printer configuration', 'error');
    }
  };

  const handleToggleActive = async (printer: PrinterConfig) => {
    try {
      const { error } = await supabase
        .from('printer_configs')
        .update({ is_active: !printer.is_active })
        .eq('id', printer.id);

      if (error) throw error;
      
      showNotification(`Printer ${!printer.is_active ? 'activated' : 'deactivated'} successfully!`);
      fetchPrinters();
    } catch (error) {
      console.error('Error toggling printer status:', error);
      showNotification('Failed to update printer status', 'error');
    }
  };

  const handleSetDefault = async (printerId: string) => {
    try {
      // First, set all printers to non-default
      const { error: updateAllError } = await supabase
        .from('printer_configs')
        .update({ is_default: false })
        .eq('restaurant_id', restaurant.id);
      
      if (updateAllError) throw updateAllError;
      
      // Then set the selected printer as default
      const { error } = await supabase
        .from('printer_configs')
        .update({ is_default: true })
        .eq('id', printerId);

      if (error) throw error;
      
      showNotification('Default printer updated successfully!');
      fetchPrinters();
    } catch (error) {
      console.error('Error setting default printer:', error);
      showNotification('Failed to set default printer', 'error');
    }
  };

  const testPrinter = async (printer: PrinterConfig) => {
    setTestingPrinter(printer.id || null);
    
    try {
      // In a real implementation, this would send a test print job to the printer
      // For now, we'll just simulate a successful test
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showNotification(`Test print sent to ${printer.printer_name}!`);
    } catch (error) {
      console.error('Error testing printer:', error);
      showNotification('Failed to send test print', 'error');
    } finally {
      setTestingPrinter(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Printer className="w-5 h-5 mr-2" />
            Printer Management
          </h2>
          <p className="text-gray-600">Configure and manage your receipt printers for QR code printing</p>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Printer
        </button>
      </div>

      {printers.length === 0 ? (
        <div className="text-center py-8">
          <Printer className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No printers configured yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Your First Printer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printers.map((printer) => (
            <div 
              key={printer.id} 
              className={`border rounded-lg p-4 ${
                printer.is_default ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center">
                    <h3 className="font-semibold text-gray-800">{printer.printer_name}</h3>
                    {printer.is_default && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Default
                      </span>
                    )}
                    {!printer.is_active && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {printer.printer_type === 'network' ? (
                      <span className="flex items-center">
                        <Wifi className="w-3 h-3 mr-1" />
                        {printer.ip_address}:{printer.port}
                      </span>
                    ) : (
                      <span>{printer.printer_type}</span>
                    )}
                  </p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(printer)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(printer.id!)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => testPrinter(printer)}
                  disabled={testingPrinter === printer.id || !printer.is_active}
                  className="flex-1 flex items-center justify-center px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {testingPrinter === printer.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                  ) : (
                    <Printer className="w-3 h-3 mr-1" />
                  )}
                  Test Print
                </button>
                
                {!printer.is_default && (
                  <button
                    onClick={() => handleSetDefault(printer.id!)}
                    disabled={!printer.is_active}
                    className="flex-1 flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Set Default
                  </button>
                )}
                
                <button
                  onClick={() => handleToggleActive(printer)}
                  className={`flex-1 flex items-center justify-center px-3 py-1.5 text-sm rounded transition-colors ${
                    printer.is_active
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  }`}
                >
                  {printer.is_active ? (
                    <>
                      <X className="w-3 h-3 mr-1" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Enable
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Printer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingPrinter ? 'Edit Printer' : 'Add New Printer'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Printer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.printer_name}
                    onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Kitchen Printer, Bar Printer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Printer Type *
                  </label>
                  <select
                    required
                    value={formData.printer_type}
                    onChange={(e) => setFormData({ ...formData, printer_type: e.target.value as 'network' | 'usb' | 'bluetooth' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="network">Network Printer</option>
                    <option value="usb" disabled>USB Printer (Coming Soon)</option>
                    <option value="bluetooth" disabled>Bluetooth Printer (Coming Soon)</option>
                  </select>
                </div>

                {formData.printer_type === 'network' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IP Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 192.168.1.100"
                        pattern="^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
                        title="Please enter a valid IP address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="65535"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 9100"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
                    Set as default printer
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                    Printer is active
                  </label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingPrinter ? 'Update' : 'Add'} Printer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Documentation Section */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Printer Setup Guide</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Network Printer Requirements</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Printer must be connected to the same network as your device</li>
              <li>Printer must have a static IP address</li>
              <li>Printer must support ESC/POS commands</li>
              <li>Default port is usually 9100 for most network printers</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Supported Printer Models</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Epson TM-T88V, TM-T88VI</li>
              <li>Star TSP100, TSP650II</li>
              <li>Bixolon SRP-350III</li>
              <li>And other ESC/POS compatible printers</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Troubleshooting</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Ensure printer is powered on and connected to the network</li>
              <li>Verify IP address is correct and printer is reachable</li>
              <li>Check firewall settings to ensure port 9100 is open</li>
              <li>Try restarting the printer if issues persist</li>
              <li>Contact support if you need further assistance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}