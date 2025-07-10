import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';
import { Printer, Settings, RefreshCw, Plus, Edit2, Trash2, Check, X, ZapIcon } from 'lucide-react';
import { useRestaurantData } from '../hooks/useRestaurantData';

interface PrinterConfigurationProps {
  restaurant: Restaurant;
}

interface PrinterConfig {
  id?: string;
  restaurant_id: string;
  printer_name: string;
  printer_type?: string;
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
  const { refetch } = useRestaurantData();
  const [printerConfigs, setPrinterConfigs] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PrinterConfig>>({
    printer_name: '',
    device_id: '',
    printer_id: '',
    is_default: false,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [refreshingDevice, setRefreshingDevice] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    apiUrl: restaurant.print_api_url || '',
    apiKey: restaurant.print_api_key || ''
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrinterConfigs(data || []);
    } catch (err) {
      console.error('Error fetching printer configs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch printer configurations');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      setLoadingDevices(true);
      setError(null);
      
      // Get API configuration from restaurant
      const apiUrl = restaurant.print_api_url;
      const apiKey = restaurant.print_api_key;
      
      if (!apiUrl || !apiKey) {
        throw new Error('Print API not configured. Please set up API settings in Printer Configuration.');
      }

      // Call the Edge Function to proxy the request
      const commandUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-proxy/printers?restaurantId=${restaurant.id}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(commandUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (err) {
      console.error('Error fetching devices:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please check your API configuration and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch devices');
      }
    } finally {
      setLoadingDevices(false);
    }
  };

  const refreshDevicePrinters = async () => {
    try {
      setRefreshingDevice(true);
      setError(null);

      // Call the Edge Function to proxy the request
      const commandUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-proxy/refresh-device-printers`;
      
      const response = await fetch(commandUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          deviceId: formData.device_id,
          restaurantId: restaurant.id
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh device printers: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Refresh the devices list to get updated printers
      await fetchDevices();
    } catch (err) {
      console.error('Error refreshing device printers:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh device printers');
    } finally {
      setRefreshingDevice(false);
    }
  };

  const saveApiConfig = () => {
    try {
      setSavingApiConfig(true);

      // Save to database
      supabase
        .from('restaurants')
        .update({
          print_api_url: apiConfig.apiUrl,
          print_api_key: apiConfig.apiKey
        })
        .eq('id', restaurant.id)
        .then(({ error }) => {
          if (error) {
            throw error;
          }
          
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
          
          // Refresh restaurant data to get updated API config
          refetch();
        });
    } catch (err) {
      console.error('Error saving API config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save API configuration');
    } finally {
      setSavingApiConfig(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);

      const configData = {
        ...formData,
        restaurant_id: restaurant.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('printer_configs')
          .update(configData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('printer_configs')
          .insert([configData]);

        if (error) throw error;
      }

      await fetchPrinterConfigs();
      resetForm();
    } catch (err) {
      console.error('Error saving printer config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save printer configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (config: PrinterConfig) => {
    setFormData(config);
    setEditingId(config.id || null);
    setShowForm(true);
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
      await fetchPrinterConfigs();
    } catch (err) {
      console.error('Error deleting printer config:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete printer configuration');
    }
  };

  const resetForm = () => {
    setFormData({
      printer_name: '',
      device_id: '',
      printer_id: '',
      is_default: false,
      is_active: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const [printing, setPrinting] = useState<string | null>(null);
  const [printError, setPrintError] = useState<{ [key: string]: string }>({});
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [testPrinting, setTestPrinting] = useState(false);

  const generateQRCodeHtml = (tableNumber: string, qrCodeUrl: string) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - Table ${tableNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            margin: 20px;
          }
          .qr-container {
            border: 2px solid #000;
            padding: 20px;
            display: inline-block;
          }
          h1 { margin: 0 0 10px 0; }
          .qr-code { margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <h1>Table ${tableNumber}</h1>
          <div class="qr-code">
            <img src="${qrCodeUrl}" alt="QR Code for Table ${tableNumber}" />
          </div>
          <p>Scan to order</p>
        </div>
      </body>
      </html>
    `;
  };

  const printQRCode = async (table: any) => {
    try {
      setPrinting(table.id);
      setPrintError(prev => ({ ...prev, [table.id]: '' }));

      // Call the Edge Function to proxy the print request
      const printer = printerConfigs.find(p => p.id === selectedPrinter);
      if (!printer) throw new Error('Selected printer not found');

      const qrCodeHtml = generateQRCodeHtml(table.table_number, table.qrCodeUrl);
      const base64Content = btoa(qrCodeHtml);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-proxy/print`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          deviceId: printer.device_id,
          printerId: printer.printer_id,
          content: base64Content,
          options: {
            mimeType: 'text/html',
            copies: 1
          },
          jobName: `QR Code - Table ${table.table_number}`
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Print failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Print job failed');
      }

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `QR code printed successfully for Table ${table.table_number}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

    } catch (err) {
      console.error('Print error:', err);
      setPrintError(prev => ({ 
        ...prev, 
        [table.id]: err instanceof Error ? err.message : 'Failed to print QR code' 
      }));
    } finally {
      setPrinting(null);
    }
  };

  const sendTestPrint = async () => {
    if (!formData.device_id || !formData.printer_id) {
      setError('Please enter both Device ID and Printer ID to send a test print');
      return;
    }
    
    try {
      setTestPrinting(true);
      setError(null);
      
      // Generate a simple test page
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Printer Test</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            p { font-size: 14px; }
            .test-box { border: 1px solid #000; padding: 10px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Printer Test Page</h1>
          <p>Restaurant: ${restaurant.name}</p>
          <p>Printer: ${formData.printer_name || 'New Printer'}</p>
          <p>Date: ${new Date().toLocaleString()}</p>
          <div class="test-box">
            <p>If you can read this, your printer is working correctly!</p>
          </div>
        </body>
        </html>
      `;
      
      const base64Content = btoa(testHtml);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-proxy/print`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          deviceId: formData.device_id,
          printerId: formData.printer_id,
          content: base64Content,
          options: {
            mimeType: 'text/html',
            copies: 1
          },
          jobName: 'Test Print'
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Test print failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Test print job failed');
      }
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Test page sent to printer successfully!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
    } catch (err) {
      console.error('Test print error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test print');
    } finally {
      setTestPrinting(false);
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'network':
        return <Printer className="h-4 w-4" />;
      default:
        return <Printer className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading printer configurations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Printer className="h-6 w-6 text-gray-700 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Printer Configuration</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowApiConfig(true)}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Settings className="h-4 w-4 mr-1" />
            API Settings
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Printer
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* API Configuration Modal */}
      {showApiConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Print API Configuration</h3>
                <button
                  onClick={() => setShowApiConfig(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API URL
                  </label>
                  <input
                    type="url"
                    value={apiConfig.apiUrl}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://your-print-server.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your API key"
                  />
                </div>

                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <strong>Current Configuration:</strong><br />
                  API URL: {restaurant.print_api_url || 'Not configured'}<br />
                  API Key: {restaurant.print_api_key ? 'Configured' : 'Not configured'}<br />
                  Full endpoint URL: {restaurant.print_api_url ? `${restaurant.print_api_url}/api/command` : 'Not available'}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowApiConfig(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveApiConfig}
                  disabled={savingApiConfig}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingApiConfig ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printer Configuration Form */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingId ? 'Edit Printer Configuration' : 'Add Printer Configuration'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Printer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.printer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, printer_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Kitchen Printer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device ID
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.device_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, device_id: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Device ID from print server"
                    />
                    <button
                      type="button"
                      onClick={fetchDevices}
                      disabled={loadingDevices}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
                    >
                      {loadingDevices ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Fetch'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Printer ID
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={formData.printer_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, printer_id: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a printer</option>
                      {devices
                        .find(d => d.deviceId === formData.device_id)
                        ?.printers.map(printer => (
                          <option key={printer.id} value={printer.id}>
                            {printer.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={refreshDevicePrinters}
                      disabled={refreshingDevice || !formData.device_id}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
                    >
                      {refreshingDevice ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center mb-2">
                    <ZapIcon className="h-4 w-4 text-blue-600 mr-2" />
                    <h4 className="font-medium text-blue-800">Test Print</h4>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    Send a test page to verify your printer is working correctly.
                  </p>
                <button
                  type="button"
                  onClick={sendTestPrint}
                  disabled={testPrinting || !formData.device_id || !formData.printer_id}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {testPrinting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Sending Test Print...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Send Test Print
                    </>
                  )}
                </button>
                </div>
              </div>

              <div className="flex items-center space-x-4 mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as default printer</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Add')} Printer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printer Configurations List */}
      <div className="space-y-4">
        {printerConfigs.length === 0 ? (
          <div className="text-center py-8">
            <Printer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No printers configured</h3>
            <p className="text-gray-600 mb-4">Add your first printer to start printing QR codes and receipts.</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Printer
            </button>
          </div>
        ) : (
          printerConfigs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {getConnectionIcon(config.printer_type)}
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {config.printer_name}
                      {config.is_default && (
                        <span className="ml-2 text-xs font-medium text-blue-600">(Default)</span>
                      )}
                    </h4>
                    <div className="text-sm text-gray-600">
                      {config.device_id && (
                        <span>Device ID: {config.device_id}</span>
                      )}
                      {config.printer_id && (
                        <span> • Printer ID: {config.printer_id}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    config.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {!config.is_default && (
                  <button
                    onClick={async () => {
                      try {
                        // First, unset any existing default
                        await supabase
                          .from('printer_configs')
                          .update({ is_default: false })
                          .eq('restaurant_id', restaurant.id)
                          .eq('is_default', true);
                        
                        // Then set this one as default
                        await supabase
                          .from('printer_configs')
                          .update({ is_default: true })
                          .eq('id', config.id!);
                          
                        await fetchPrinterConfigs();
                      } catch (err) {
                        console.error('Error setting default printer:', err);
                        setError('Failed to set default printer');
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600"
                    title="Set as default"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleEdit(config)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(config.id!)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}