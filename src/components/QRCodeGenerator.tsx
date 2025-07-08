import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant, RestaurantTable, OrderSession } from '../types/database';
import { QrCode, Download, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';

interface QRCodeGeneratorProps {
  restaurant: Restaurant;
  tables: RestaurantTable[];
}

interface TableWithSession extends RestaurantTable {
  session?: OrderSession;
  qrCodeUrl?: string;
}

export function QRCodeGenerator({ restaurant, tables }: QRCodeGeneratorProps) {
  const [tablesWithSessions, setTablesWithSessions] = useState<TableWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchTableSessions();
  }, [restaurant.id, tables]);

  const fetchTableSessions = async () => {
    try {
      setLoading(true);
      
      // Get all active order sessions for this restaurant
      const { data: sessions, error } = await supabase
        .from('order_sessions')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true);

      if (error) throw error;

      // Map tables with their sessions
      const enhancedTables: TableWithSession[] = tables.map(table => {
        const session = sessions?.find(s => s.table_id === table.id);
        const qrCodeUrl = session ? `${window.location.origin}/order/${session.session_token}` : undefined;
        
        return {
          ...table,
          session,
          qrCodeUrl
        };
      });

      setTablesWithSessions(enhancedTables);
    } catch (error) {
      console.error('Error fetching table sessions:', error);
      setTablesWithSessions(tables.map(table => ({ ...table })));
    } finally {
      setLoading(false);
    }
  };

  const generateQRSession = async (table: RestaurantTable) => {
    setGeneratingQR(table.id);
    
    try {
      const sessionToken = crypto.randomUUID();

      const { data, error } = await supabase
        .from('order_sessions')
        .insert({
          restaurant_id: restaurant.id,
          table_id: table.id,
          booking_id: null,
          session_token: sessionToken,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `QR code generated for Table ${table.table_number}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);

      await fetchTableSessions();
    } catch (error) {
      console.error('Error generating QR session:', error);
      alert('Failed to generate QR code. Please try again.');
    } finally {
      setGeneratingQR(null);
    }
  };

  const deactivateSession = async (session: OrderSession) => {
    try {
      const { error } = await supabase
        .from('order_sessions')
        .update({ is_active: false })
        .eq('id', session.id);

      if (error) throw error;

      await fetchTableSessions();
    } catch (error) {
      console.error('Error deactivating session:', error);
      alert('Failed to deactivate QR code. Please try again.');
    }
  };

  const copyToClipboard = async (url: string, tableNumber: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const downloadQRCode = (url: string, tableNumber: string) => {
    // Generate QR code using a QR code API service
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    
    // Create a temporary link to download the QR code
    const link = document.createElement('a');
    link.href = qrApiUrl;
    link.download = `table-${tableNumber}-qr-code.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openOrderingPage = (url: string) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
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
            <QrCode className="w-5 h-5 mr-2" />
            QR Code Management
          </h2>
          <p className="text-gray-600">Generate and manage QR codes for table ordering</p>
        </div>
        
        <button
          onClick={fetchTableSessions}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tablesWithSessions.map((table) => (
          <div key={table.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">Table {table.table_number}</h3>
                <p className="text-sm text-gray-600">Capacity: {table.capacity} people</p>
                {table.location_notes && (
                  <p className="text-xs text-gray-500">{table.location_notes}</p>
                )}
              </div>
              
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                table.session 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {table.session ? 'QR Active' : 'No QR'}
              </div>
            </div>

            {table.session && table.qrCodeUrl ? (
              <div className="space-y-3">
                {/* QR Code Preview */}
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(table.qrCodeUrl)}`}
                    alt={`QR Code for Table ${table.table_number}`}
                    className="mx-auto mb-2"
                  />
                  <p className="text-xs text-gray-600">Scan to order</p>
                </div>

                {/* URL Display */}
                <div className="bg-blue-50 rounded p-3">
                  <p className="text-xs text-blue-800 mb-1">Ordering URL:</p>
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-white px-2 py-1 rounded flex-1 truncate">
                      {table.qrCodeUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(table.qrCodeUrl!, table.table_number)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Copy URL"
                    >
                      {copiedUrl === table.qrCodeUrl ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openOrderingPage(table.qrCodeUrl!)}
                    className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Test
                  </button>
                  <button
                    onClick={() => downloadQRCode(table.qrCodeUrl!, table.table_number)}
                    className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </button>
                </div>

                <button
                  onClick={() => deactivateSession(table.session!)}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Deactivate QR
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-4">No QR code generated</p>
                <button
                  onClick={() => generateQRSession(table)}
                  disabled={generatingQR === table.id}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 w-full"
                >
                  {generatingQR === table.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-2" />
                  )}
                  Generate QR Code
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">QR Code Instructions</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Generate QR codes for each table to enable customer ordering</li>
          <li>• Print and place QR codes on tables for easy customer access</li>
          <li>• Customers scan the code to access the ordering interface</li>
          <li>• Each QR code is unique to a specific table</li>
          <li>• Deactivate QR codes when tables are not in use</li>
          <li>• Test the ordering flow by clicking "Test" button</li>
        </ul>
      </div>
    </div>
  );
}