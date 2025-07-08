import React, { useState, useEffect } from 'react';
import { Wifi, Printer, RefreshCw, AlertTriangle, Check } from 'lucide-react';

interface NetworkPrinterDiscoveryProps {
  onPrinterSelected: (printerInfo: { name: string; ip: string; port: number }) => void;
}

export function NetworkPrinterDiscovery({ onPrinterSelected }: NetworkPrinterDiscoveryProps) {
  const [scanning, setScanning] = useState(false);
  const [foundPrinters, setFoundPrinters] = useState<Array<{ name: string; ip: string; port: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);

  const startScan = async () => {
    setScanning(true);
    setError(null);
    setFoundPrinters([]);

    try {
      // In a real implementation, we would use the Network Service Discovery API
      // However, since it's not fully supported in all browsers, we'll simulate discovery
      
      // Simulate network scan delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate found printers
      const mockPrinters = [
        { name: 'HP LaserJet M15w', ip: '192.168.1.100', port: 9100 },
        { name: 'Epson TM-T88VI', ip: '192.168.1.101', port: 9100 },
        { name: 'Star TSP100', ip: '192.168.1.102', port: 9100 },
      ];
      
      setFoundPrinters(mockPrinters);
      
      // Check if Network Service Discovery API is available
      if ('getNetworkServices' in navigator) {
        setError('Your browser supports Network Service Discovery API, but it requires HTTPS and proper permissions.');
      } else {
        setError('Automatic printer discovery requires the Network Service Discovery API, which is not supported in this browser. You can still manually enter printer details.');
      }
    } catch (err) {
      setError('Failed to scan for printers. Please enter printer details manually.');
      console.error('Printer scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleSelectPrinter = (printer: { name: string; ip: string; port: number }) => {
    setSelectedPrinter(printer.ip);
    onPrinterSelected(printer);
  };

  useEffect(() => {
    // Check for API support on component mount
    if (!('getNetworkServices' in navigator)) {
      setError('Automatic printer discovery is not supported in this browser. Please enter printer details manually.');
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Wifi className="w-5 h-5 mr-2" />
            Network Printer Discovery
          </h2>
          <p className="text-gray-600">Find network printers on your local network</p>
        </div>
        
        <button
          onClick={startScan}
          disabled={scanning}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {scanning ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan Network
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-yellow-800">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {scanning ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Scanning for network printers...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      ) : foundPrinters.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-800 mb-2">Found Printers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {foundPrinters.map((printer) => (
              <div 
                key={printer.ip}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedPrinter === printer.ip
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => handleSelectPrinter(printer)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Printer className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-800">{printer.name}</h4>
                      <p className="text-sm text-gray-600">{printer.ip}:{printer.port}</p>
                    </div>
                  </div>
                  {selectedPrinter === printer.ip && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Printer className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No printers found</p>
          <p className="text-sm text-gray-500">
            Click "Scan Network" to search for network printers or enter printer details manually
          </p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-2">Manual Printer Setup</h3>
        <p className="text-sm text-gray-600">
          If automatic discovery doesn't find your printer, you can still add it manually by entering its IP address and port.
          Most network printers use port 9100 by default.
        </p>
      </div>
    </div>
  );
}