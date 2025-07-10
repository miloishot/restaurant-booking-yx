import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { Printer, Settings, RefreshCw, Plus, Edit2, Trash2, Check, X, Wifi, Usb, Bluetooth, Globe, Key } from 'lucide-react';

interface PrinterConfigurationProps {
  restaurant: Restaurant;
}

interface PrinterConfig {
  id?: string;
  restaurant_id: string;
  printer_name: string;
  printer_type: 'network' | 'usb' | 'bluetooth';
  ip_address?: string;
  port?: number;
  device_id?: string;
  printer_id?: string;
  is_default: boolean;
  is_active: boolean;
}

interface PrinterDevice {
  deviceId: string;
  printers: {
    id: string;
    name: string;
  }[];
}

export function PrinterConfiguration({ restaurant }: PrinterConfigurationProps) {
  const [printerConfigs, setPrinterConfigs] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);
  const [formData, setFormData] = useState<PrinterConfig>({
    restaurant_id: restaurant.id,
    printer_name: '',
    printer_type: 'network',
    ip_address: '',
    port: 9100,
    device_id: '',
    printer_id: '',
    is_default: false,
    is_active: true
  });
  const [availableDevices, setAvailableDevices] = useState<PrinterDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState({
    apiUrl: localStorage.getItem('print_api_url') || '',
    apiKey: localStorage.getItem('print_api_key') || ''
  });
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [savingApiConfig, setSavingApiConfig] = useState(false);

  useEffect(() => {
    fetchPrinterConfigs();
  }, [restaurant.id]);

  const fetchPrinterConfigs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('printer_configs')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at');

      if (error) throw error;
      setPrinterConfigs(data || []);
    } catch (err) {
      console.error('Error fetching printer configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDevices = async () => {
    try {
      setLoadingDevices(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !apiConfig.apiUrl || !apiConfig.apiKey) {
        throw new Error('Missing configuration: Please ensure you are logged in and have configured the Print API URL and API Key in API Settings');
      }

      // Ensure the API URL ends with /api if it doesn't already
      const baseUrl = apiConfig.apiUrl.endsWith('/api') ? apiConfig.apiUrl : `${apiConfig.apiUrl}/api`;
      const fullUrl = `${baseUrl}/printers`;
      
      console.log('Fetching printer devices from:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiConfig.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse the error response, use the status text
        }
        throw new Error(`Failed to fetch printer devices - ${errorMessage}`);
      }

      const { devices } = await response.json();
      setAvailableDevices(devices || []);
    } catch (err) {
      console.error('Error fetching printer devices:', err);
      
      let errorMessage = 'Failed to fetch printer devices';
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          errorMessage = `Network error: Cannot connect to print middleware server at ${apiConfig.apiUrl}. Please check:
          
• Is the print middleware server running?
• Is the API URL correct in API Settings?
• Are there any firewall or network restrictions?
• Is CORS properly configured on the server?`;
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoadingDevices(false);
    }
  };

  const saveApiConfig = () => {
    try {
      setSavingApiConfig(true);
      
      // Save to localStorage
      localStorage.setItem('print_api_url', apiConfig.apiUrl);
      localStorage.setItem('print_api_key', apiConfig.apiKey);
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'API configuration saved successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
      setShowApiConfig(false);
    } catch (err) {
      console.error('Error saving API config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save API configuration');
    } finally {
      setSavingApiConfig(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // If this is set as default, unset any existing default printers
      if (formData.is_default) {
        await supabase
          .from('printer_configs')
          .update({ is_default: false })
          .eq('restaurant_id', restaurant.id)
          .eq('is_default', true);
      }

      if (editingPrinter) {
        // Update existing printer
        const { error } = await supabase
          .from('printer_configs')
          .update({
            printer_name: formData.printer_name,
            printer_type: formData.printer_type,
            ip_address: formData.printer_type === 'network' ? formData.ip_address : null,
            port: formData.printer_type === 'network' ? formData.port : null,
            device_id: formData.device_id || null,
            printer_id: formData.printer_id || null,
            is_default: formData.is_default,
            is_active: formData.is_active
          })
          .eq('id', editingPrinter.id);

        if (error) throw error;
      } else {
        // Create new printer
        const { error } = await supabase
          .from('printer_configs')
          .insert({
            restaurant_id: restaurant.id,
            printer_name: formData.printer_name,
            printer_type: formData.printer_type,
            ip_address: formData.printer_type === 'network' ? formData.ip_address : null,
            port: formData.printer_type === 'network' ? formData.port : null,
            device_id: formData.device_id || null,
            printer_id: formData.printer_id || null,
            is_default: formData.is_default,
            is_active: formData.is_active
          });

        if (error) throw error;
      }

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `Printer ${editingPrinter ? 'updated' : 'added'} successfully!`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

      resetForm();
      fetchPrinterConfigs();
    } catch (err) {
      console.error('Error saving printer config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save printer configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this printer configuration?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('printer_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Printer configuration deleted successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

      fetchPrinterConfigs();
    } catch (err) {
      console.error('Error deleting printer config:', err);
      alert('Failed to delete printer configuration. Please try again.');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // First, unset any existing default
      await supabase
        .from('printer_configs')
        .update({ is_default: false })
        .eq('restaurant_id', restaurant.id)
        .eq('is_default', true);
      
      // Then set the new default
      const { error } = await supabase
        .from('printer_configs')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      
      fetchPrinterConfigs();
    } catch (err) {
      console.error('Error setting default printer:', err);
      alert('Failed to set default printer. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      restaurant_id: restaurant.id,
      printer_name: '',
      printer_type: 'network',
      ip_address: '',
      port: 9100,
      device_id: '',
      printer_id: '',
      is_default: false,
      is_active: true
    });
    setEditingPrinter(null);
    setShowForm(false);
  };

  const editPrinter = (printer: PrinterConfig) => {
    setFormData({
      ...printer,
      restaurant_id: restaurant.id
    });
    setEditingPrinter(printer);
    setShowForm(true);
    
    // If this is a remote printer, fetch available devices
    if (printer.device_id) {
      fetchAvailableDevices();
    }
  };

  const getPrinterTypeIcon = (type: string) => {
    switch (type) {
      case 'network':
        return <Wifi className="w-4 h-4" />;
      case 'usb':
        return <Usb className="w-4 h-4" />;
      case 'bluetooth':
        return <Bluetooth className="w-4 h-4" />;
      default:
        return <Printer className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Printer className="w-5 h-5 mr-2" />
            Printer Configuration
          </h2>
          <p className="text-gray-600">Manage printers for QR code and receipt printing</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowApiConfig(true)}
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            API Settings
          </button>
          
          <button
            onClick={fetchAvailableDevices}
            disabled={loadingDevices}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingDevices ? 'animate-spin' : ''}`} />
            Refresh Devices
          </button>
          
          <button
            onClick={() => {
              setShowForm(true);
              fetchAvailableDevices();
            }}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Printer
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700 whitespace-pre-line">{error}</div>
          {error.includes('Network error') && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm font-medium">Troubleshooting Tips:</p>
              <ul className="text-yellow-700 text-sm mt-1 space-y-1">
                <li>• Try accessing {apiConfig.apiUrl} directly in your browser</li>
                <li>• Ensure the print middleware server is running and accessible</li>
                <li>• Check that the API URL in Settings matches your server address</li>
                <li>• Verify your API key is correct</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Printer List */}
      {loading ? (
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      ) : printerConfigs.length === 0 ? (
        <div className="text-center py-8">
          <Printer className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No printers configured yet</p>
          <button
            onClick={() => {
              setShowForm(true);
              fetchAvailableDevices();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Configure Your First Printer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {printerConfigs.map((printer) => (
            <div 
              key={printer.id} 
              className={`border rounded-lg p-4 ${
                printer.is_default ? 'border-green-300 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    {getPrinterTypeIcon(printer.printer_type)}
                    <h3 className="font-semibold text-gray-800 ml-2">{printer.printer_name}</h3>
                    {printer.is_default && (
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Default
                      </span>
                    )}
                    {!printer.is_active && (
                      <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Type: {printer.printer_type}</p>
                    {printer.printer_type === 'network' && (
                      <p>IP: {printer.ip_address}:{printer.port}</p>
                    )}
                    {printer.device_id && (
                      <p>Device ID: {printer.device_id}</p>
                    )}
                    {printer.printer_id && (
                      <p>Printer ID: {printer.printer_id}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {!printer.is_default && (
                    <button
                      onClick={() => handleSetDefault(printer.id!)}
                      className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                      title="Set as Default"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => editPrinter(printer)}
                    className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(printer.id!)}
                    className="p-2 text-red-600 hover:text-red-800 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Configuration Modal */}
      {showApiConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Print API Configuration</h3>
                <button
                  onClick={() => setShowApiConfig(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Print API URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={apiConfig.apiUrl}
                    onChange={(e) => setApiConfig({ ...apiConfig, apiUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="http://172.104.191.17:4000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The base URL of your print middleware server (e.g., http://172.104.191.17:4000)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Key className="w-4 h-4 inline mr-1" />
                    API Key *
                  </label>
                  <input
                    type="password"
                    required
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your API key"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The authentication key for your print middleware API
                  </p>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowApiConfig(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveApiConfig}
                    disabled={savingApiConfig}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {savingApiConfig ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    {savingApiConfig ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">
                  {editingPrinter ? 'Edit Printer' : 'Add New Printer'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
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
                    placeholder="e.g., Reception Printer, Kitchen Printer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Printer Type *
                  </label>
                  <select
                    required
                    value={formData.printer_type}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      printer_type: e.target.value as 'network' | 'usb' | 'bluetooth' 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="network">Network Printer</option>
                    <option value="usb">USB Printer</option>
                    <option value="bluetooth">Bluetooth Printer</option>
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
                        value={formData.ip_address || ''}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 192.168.1.100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        value={formData.port || 9100}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="9100"
                      />
                      <p className="text-xs text-gray-500 mt-1">Default port for most network printers is 9100</p>
                    </div>
                  </>
                )}

                {/* Remote Printer Configuration */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium text-gray-800 mb-2">Remote Printing Configuration</h4>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Device
                    </label>
                    <select
                      value={formData.device_id || ''}
                      onChange={(e) => {
                        const deviceId = e.target.value;
                        setFormData({ 
                          ...formData, 
                          device_id: deviceId,
                          // Reset printer_id when device changes
                          printer_id: '' 
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a device</option>
                      {availableDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.deviceId}
                        </option>
                      ))}
                    </select>
                    {loadingDevices && (
                      <div className="flex items-center mt-2 text-sm text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                        Loading available devices...
                      </div>
                    )}
                  </div>

                  {formData.device_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Printer
                      </label>
                      <select
                        value={formData.printer_id || ''}
                        onChange={(e) => setFormData({ ...formData, printer_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a printer</option>
                        {availableDevices
                          .find(d => d.deviceId === formData.device_id)
                          ?.printers.map((printer) => (
                            <option key={printer.id} value={printer.id}>
                              {printer.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-4">
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
                      Active
                    </label>
                  </div>
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
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Saving...' : editingPrinter ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">Printer Configuration Guide</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="font-medium text-blue-700 mb-1">API Configuration</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Click "API Settings" to configure the print API</li>
              <li>• Enter the URL of your print middleware server</li>
              <li>• Enter your API key for authentication</li>
              <li>• Save the configuration to enable printing</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-blue-700 mb-1">Network Printers</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Enter the IP address of your printer</li>
              <li>• Default port is usually 9100</li>
              <li>• Ensure printer is on the same network</li>
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <h5 className="font-medium text-blue-700 mb-1">Remote Printing</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Select a device from the available list</li>
              <li>• Choose a printer connected to that device</li>
              <li>• Ensure the Electron client is running</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-blue-700 mb-1">Testing</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Configure at least one printer</li>
              <li>• Generate a QR code for a table</li>
              <li>• Click "Print" to test the printing system</li>
              <li>• Check printer for output</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}