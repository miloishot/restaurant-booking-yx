import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import QRCode from 'qrcode';
import { Restaurant, RestaurantTable, OrderSession } from '../types/database';
import { Printer, Download, Copy, Check, QrCode, RefreshCw, Settings } from 'lucide-react';

interface QRCodePrintingProps {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  onOpenPrinterSetup: () => void;
}

interface TableQRCode {
  tableId: string;
  tableNumber: string;
  qrUrl: string;
  qrDataUrl: string;
}

export function QRCodePrinting({ restaurant, tables, onOpenPrinterSetup }: QRCodePrintingProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableQRCodes, setTableQRCodes] = useState<TableQRCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [printSize, setPrintSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showQRPreview, setShowQRPreview] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${restaurant.name} - Table QR Codes`,
    onBeforeGetContent: () => {
      return new Promise<void>((resolve) => {
        generateQRCodes().then(() => {
          setShowQRPreview(true);
          resolve();
        });
      });
    },
    onAfterPrint: () => {
      setShowQRPreview(false);
    },
  });

  const generateQRCodes = async () => {
    if (selectedTables.length === 0) return;
    
    setLoading(true);
    
    try {
      const qrCodes: TableQRCode[] = [];
      
      for (const tableId of selectedTables) {
        const table = tables.find(t => t.id === tableId);
        if (!table) continue;
        
        // In a real implementation, you would create or get an actual session token
        // For now, we'll create a mock URL
        const sessionToken = crypto.randomUUID();
        const qrUrl = `${window.location.origin}/order/${sessionToken}`;
        
        // Generate QR code data URL
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 300,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        
        qrCodes.push({
          tableId: table.id,
          tableNumber: table.table_number,
          qrUrl,
          qrDataUrl,
        });
      }
      
      setTableQRCodes(qrCodes);
    } catch (error) {
      console.error('Error generating QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map(table => table.id));
    }
  };

  const handleSelectTable = (tableId: string) => {
    if (selectedTables.includes(tableId)) {
      setSelectedTables(selectedTables.filter(id => id !== tableId));
    } else {
      setSelectedTables([...selectedTables, tableId]);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const downloadQRCode = (dataUrl: string, tableNumber: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `table-${tableNumber}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getQRCodeSize = () => {
    switch (printSize) {
      case 'small': return 'w-32 h-32';
      case 'medium': return 'w-48 h-48';
      case 'large': return 'w-64 h-64';
      default: return 'w-48 h-48';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            QR Code Printing
          </h2>
          <p className="text-gray-600">Generate and print QR codes for table ordering</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onOpenPrinterSetup}
            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Printer Setup
          </button>
          
          <button
            onClick={handlePrint}
            disabled={selectedTables.length === 0 || loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Selected
          </button>
        </div>
      </div>

      {/* Table Selection */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-gray-800">Select Tables for QR Code Printing</h3>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedTables.length === tables.length ? 'Deselect All' : 'Select All'}
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">QR Size:</span>
              <select
                value={printSize}
                onChange={(e) => setPrintSize(e.target.value as 'small' | 'medium' | 'large')}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                selectedTables.includes(table.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => handleSelectTable(table.id)}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedTables.includes(table.id)}
                  onChange={() => handleSelectTable(table.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm font-medium text-gray-700">
                  Table {table.table_number}
                </label>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Capacity: {table.capacity} | Status: {table.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Code Preview */}
      {selectedTables.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-800">QR Code Preview</h3>
            <button
              onClick={generateQRCodes}
              disabled={loading}
              className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Generate QR Codes
            </button>
          </div>
          
          {tableQRCodes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tableQRCodes.map((qrCode) => (
                <div key={qrCode.tableId} className="border rounded-lg p-4 flex flex-col items-center">
                  <h4 className="font-semibold text-gray-800 mb-2">Table {qrCode.tableNumber}</h4>
                  <img 
                    src={qrCode.qrDataUrl} 
                    alt={`QR Code for Table ${qrCode.tableNumber}`} 
                    className="mb-3 w-40 h-40"
                  />
                  <div className="text-xs text-gray-500 mb-3 w-full truncate">
                    URL: {qrCode.qrUrl}
                  </div>
                  <div className="flex space-x-2 w-full">
                    <button
                      onClick={() => copyToClipboard(qrCode.qrUrl)}
                      className="flex-1 flex items-center justify-center px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      {copied === qrCode.qrUrl ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      Copy URL
                    </button>
                    <button
                      onClick={() => downloadQRCode(qrCode.qrDataUrl, qrCode.tableNumber)}
                      className="flex-1 flex items-center justify-center px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {loading ? 'Generating QR codes...' : 'Click "Generate QR Codes" to preview'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Print Preview (hidden until print is triggered) */}
      <div className={`fixed inset-0 bg-white z-50 p-8 ${showQRPreview ? 'block' : 'hidden'}`}>
        <div ref={printRef} className="print-container">
          <h1 className="text-2xl font-bold text-center mb-6">{restaurant.name} - Table QR Codes</h1>
          <p className="text-center text-gray-600 mb-8">Scan these QR codes to access the digital menu and ordering system</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
            {tableQRCodes.map((qrCode) => (
              <div key={qrCode.tableId} className="border rounded-lg p-6 flex flex-col items-center print:break-inside-avoid">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Table {qrCode.tableNumber}</h2>
                <img 
                  src={qrCode.qrDataUrl} 
                  alt={`QR Code for Table ${qrCode.tableNumber}`} 
                  className={`mb-4 ${getQRCodeSize()}`}
                />
                <p className="text-sm text-gray-600 text-center">
                  Scan to view menu and place your order
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Documentation Section */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">QR Code Printing Guide</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">How It Works</h4>
            <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
              <li>Select the tables you want to generate QR codes for</li>
              <li>Click "Generate QR Codes" to preview the codes</li>
              <li>Adjust the QR code size if needed</li>
              <li>Click "Print Selected" to print the QR codes</li>
              <li>Place the printed QR codes on the corresponding tables</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Printing Tips</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Use high-quality paper for better scanning</li>
              <li>Consider laminating the QR codes for durability</li>
              <li>Test the QR codes after printing to ensure they scan properly</li>
              <li>Print extra copies as backups</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Troubleshooting</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>If QR codes don't scan, try increasing the size</li>
              <li>Ensure there's good lighting for customers to scan the codes</li>
              <li>If using a network printer, make sure it's properly configured</li>
              <li>For direct printing issues, check printer connection and settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}