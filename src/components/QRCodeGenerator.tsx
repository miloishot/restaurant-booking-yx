import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Restaurant, RestaurantTable, OrderSession } from '../types/database';
import { QrCode, Download, ExternalLink, RefreshCw, Copy, Check, Printer, Receipt, CreditCard } from 'lucide-react';

interface QRCodeGeneratorProps {
  restaurant: Restaurant;
  tables: RestaurantTable[];
}

interface TableWithSession extends RestaurantTable {
  session?: OrderSession;
  qrCodeUrl?: string;
  qrCodeHtml?: string;
}

interface PrinterConfig {
  id: string;
  printer_name: string;
  device_id: string;
  printer_id: string;
  is_default: boolean;
  print_job_type: string | null; // NEW: fetch this column
}


export function QRCodeGenerator({ restaurant, tables }: QRCodeGeneratorProps) {
  const { employeeProfile } = useAuth();
  const [tablesWithSessions, setTablesWithSessions] = useState<TableWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [printerConfigs, setPrinterConfigs] = useState<PrinterConfig[]>([]);
  const [selectedQrPrinter, setSelectedQrPrinter] = useState<string | null>(null);
  const [selectedBillPrinter, setSelectedBillPrinter] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printReceiptError, setPrintReceiptError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTableSessions();
    fetchPrinterConfigs();
  }, [restaurant.id]);

  const fetchPrinterConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('printer_configs')
        .select('id, printer_name, device_id, printer_id, is_default')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .not('device_id', 'is', null)
        .not('printer_id', 'is', null);

      if (error) throw error;
      
      setPrinterConfigs(data || []);
      
      // Set default printer if available
      const defaultPrinter = data?.find(p => p.is_default);
      if (defaultPrinter) {
        setSelectedQrPrinter(defaultPrinter.id);
        setSelectedBillPrinter(defaultPrinter.id);
      } else if (data && data.length > 0) {
        setSelectedQrPrinter(data[0].id);
        setSelectedBillPrinter(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching printer configs:', error);
    }
  };

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
        
        // Generate QR code HTML for printing
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
      
      // Fetch the updated table data with the new session
      const { data: updatedTableData } = await supabase
        .from('order_sessions')
        .select(`
          *,
          table:restaurant_tables(*)
        `)
        .eq('table_id', table.id)
        .eq('is_active', true)
        .single();
      
      if (updatedTableData && selectedQrPrinter) {
        // Create a temporary table object with the QR code URL
        const tempTable: TableWithSession = {
          ...table,
          session: updatedTableData,
          qrCodeUrl: `${window.location.origin}/order/${updatedTableData.session_token}`
        };
        
        // Print the QR code
        await printQRCode(tempTable);
      }
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

  const generateQRCodeHtml = (tableNumber: string, qrCodeUrl: string) => {
    return `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              text-align: center;
            }
            .container {
              padding: 10px;
            }
<!DOCTYPE html>
<html>
<head>
  <title>QR Code - Table ${tableNumber}</title>
  <style>
    body { 
      font-family: monospace; 
      text-align: center; 
      margin: 0;
      padding: 0;
      width: 100%;
    }
    .receipt {
      width: 100%;
      max-width: 300px;
      margin: 0 auto;
      padding: 10px 0;
    }
    .header {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
      border-bottom: 1px dashed #000;
      padding-bottom: 5px;
    }
    .table-info {
      font-size: 18px;
      font-weight: bold;
      margin: 10px 0;
    }
    .qr-code { 
      margin: 15px 0; 
    }
    .instructions {
      font-size: 12px;
      margin: 10px 0;
    }
    .timestamp {
      font-size: 10px;
      margin-top: 10px;
      border-top: 1px dashed #000;
      padding-top: 5px;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      ${restaurant.name}
    </div>
    
    <div class="table-info">
      TABLE ${tableNumber}
    </div>
    
    <div class="qr-code">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code for Table ${tableNumber}" width="200" height="200" />
    </div>
    
    <div class="instructions">
      SCAN THIS CODE TO ORDER
      FOOD & DRINKS DIRECTLY
      FROM YOUR PHONE
    </div>
    
    <div class="divider"></div>
    
    <div class="instructions">
      No app download required
      Just scan and browse our menu
    </div>
    
    <div class="timestamp">
      Printed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
    </div>
  </div>
</body>
</html>
    `;
  };

  const printQRCode = async (table: TableWithSession) => {
    if (!table.qrCodeUrl || !selectedQrPrinter) return;
    
    setPrinting(table.id);
    setPrintError(null);
    
    try {
      const printer = printerConfigs.find(p => p.id === selectedQrPrinter);
      if (!printer) throw new Error('Selected printer not found');
      
      // Generate QR code HTML with enhanced receipt format
      const qrCodeHtml = generateQRCodeHtml(table.table_number, table.qrCodeUrl);
      
      const base64Content = btoa(qrCodeHtml);
      
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required for printing');
      }
      
      // Use Supabase Edge Function proxy for printing
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-proxy/print`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to print QR code');
      }
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `QR code for Table ${table.table_number} sent to printer!`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error printing QR code:', error);
      setPrintError(error instanceof Error ? error.message : 'Failed to print QR code');
    } finally {
      setPrinting(null);
    }
  };

  const printReceipt = async (table: TableWithSession) => {
    // First, fetch orders for this table
    const { data: sessions } = await supabase
      .from('order_sessions')
      .select('id')
      .eq('table_id', table.id)
      .eq('is_active', true);
      
    if (!sessions || sessions.length === 0) {
      alert('No active session found for this table');
      return;
    }
    
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          *,
          menu_item:menu_items(*)
        )
      `)
      .eq('session_id', sessions[0].id)
      .neq('payment_status', 'paid');
      
    if (!orders || orders.length === 0) {
      alert('No unpaid orders found for this table');
      return;
    }
    

    try {
      setPrintingReceipt(table.id); 
      setPrintReceiptError(prev => ({ ...prev, [table.id]: '' }));

      const printer = printerConfigs.find(p => p.id === selectedBillPrinter);
      if (!printer) throw new Error('Selected printer not found');

      // Calculate totals
      const subtotal = orders.reduce((sum, order) => sum + order.subtotal_sgd, 0);
      const discount = orders.reduce((sum, order) => sum + order.discount_sgd, 0);
      const netSubtotal = subtotal - discount;
      const gst = netSubtotal * 0.09; // 9% GST
      const total = netSubtotal + gst;

      // Generate receipt HTML
      const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - Table ${table.table_number}</title>
          <style>
            body { 
              font-family: monospace; 
              margin: 0;
              padding: 10px;
              width: 100%;
              font-size: 12px;
            }
            .receipt {
              width: 100%;
              max-width: 300px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .table-info {
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin: 10px 0;
            }
            .datetime {
              text-align: center;
              font-size: 10px;
              margin-bottom: 15px;
            }
            .items {
              margin: 15px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-size: 11px;
            }
            .item-name {
              flex: 1;
              padding-right: 10px;
            }
            .item-price {
              text-align: right;
              min-width: 60px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .totals {
              margin: 10px 0;
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
              font-size: 11px;
            }
            .total-line.final {
              font-weight: bold;
              font-size: 12px;
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 8px;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              margin-top: 15px;
              border-top: 1px dashed #000;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              ${restaurant.name}
            </div>
            
            <div class="table-info">
              TABLE ${table.table_number}
            </div>
            
            <div class="datetime">
              ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
            </div>
            
            <div class="items">
              ${orders.map(order => 
                order.items?.map(item => `
                  <div class="item">
                    <div class="item-name">${item.quantity}x ${item.menu_item?.name}</div>
                    <div class="item-price">$${item.total_price_sgd.toFixed(2)}</div>
                  </div>
                `).join('') || ''
              ).join('')}
            </div>
            
            <div class="divider"></div>
            
            <div class="totals">
              <div class="total-line">
                <span>Subtotal:</span>
                <span>$${subtotal.toFixed(2)}</span>
              </div>
              ${discount > 0 ? `
                <div class="total-line">
                  <span>Discount:</span>
                  <span>-$${discount.toFixed(2)}</span>
                </div>
                <div class="total-line">
                  <span>Net Subtotal:</span>
                  <span>$${netSubtotal.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="total-line">
                <span>GST (9%):</span>
                <span>$${gst.toFixed(2)}</span>
              </div>
              <div class="total-line final">
                <span>TOTAL:</span>
                <span>$${total.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="footer">
              Thank you for dining with us!<br>
              Please pay at the counter
            </div>
          </div>
        </body>
        </html>
      `;
      
      const base64Content = btoa(receiptHtml);
      
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
          jobName: `Receipt - Table ${table.table_number}`
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to print receipt');
      }
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `Receipt printed for Table ${table.table_number}!`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error printing receipt:', error);
      setPrintReceiptError(prev => ({ 
        ...prev, 
        [table.id]: error instanceof Error ? error.message : 'Failed to print receipt' 
      }));
    } finally {
      setPrintingReceipt(null);
    }
  };

  const openOrderingPage = (url: string) => {
    window.open(url, '_blank');
  };

  // Check if user has permission to manage QR codes
  const canManageQRCodes = employeeProfile?.role === 'owner' || employeeProfile?.role === 'manager';

  if (!canManageQRCodes) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <QrCode className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Restricted</h3>
          <p className="text-gray-600">
            Only restaurant owners and managers can manage QR codes.
          </p>
        </div>
      </div>
    );
  }

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
      
      {/* Printer Selection */}
      {printerConfigs.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-4">Printer Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <QrCode className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-blue-800">QR Code Printer:</span>
              </div>
              
              <select
                value={selectedQrPrinter || ''}
                onChange={(e) => setSelectedQrPrinter(e.target.value)}
                className="px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {printerConfigs.map(printer => (
                  <option key={printer.id} value={printer.id}>{printer.printer_name} {printer.is_default ? '(Default)' : ''}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Receipt className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800">Bill Printer:</span>
              </div>
              
              <select
                value={selectedBillPrinter || ''}
                onChange={(e) => setSelectedBillPrinter(e.target.value)}
                className="px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {printerConfigs.map(printer => (
                  <option key={printer.id} value={printer.id}>{printer.printer_name} {printer.is_default ? '(Default)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

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
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {printerConfigs.length > 0 && selectedQrPrinter && (
                    <button
                      onClick={() => printQRCode(table)}
                      disabled={printing === table.id}
                      className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      {printing === table.id ? 'Printing...' : 'Print'}
                    </button>
                  )}
                  
                  {printerConfigs.length > 0 && selectedBillPrinter && (
                    <button
                      onClick={() => printReceipt(table)}
                      disabled={printingReceipt === table.id}
                      className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Receipt className="w-4 h-4 mr-1" />
                      {printingReceipt === table.id ? 'Printing...' : 'Print Bill'}
                    </button>
                  )}
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

      {/* Print Error Message */}
      {(printError || Object.values(printReceiptError).some(e => e)) && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">Print Error</h4>
          <p className="text-red-700 text-sm">{printError || Object.values(printReceiptError).find(e => e)}</p>
          <p className="text-sm text-red-600 mt-2">Please check that your printer is properly configured and the Electron client is running.</p>
        </div>
      )}

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
          <li>• Print QR codes to place on tables for easy customer access</li>
        </ul>
      </div>
    </div>
  );
}