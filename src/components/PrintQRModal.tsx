import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import QRCode from 'qrcode';
import { Restaurant, RestaurantTable, OrderSession } from '../types/database';
import { supabase } from '../lib/supabase';
import { Printer, QrCode, X, Settings, RefreshCw } from 'lucide-react';

interface PrintQRModalProps {
  restaurant: Restaurant;
  table: RestaurantTable;
  session?: OrderSession;
  onClose: () => void;
  onOpenPrinterSetup: () => void;
}

export function PrintQRModal({ restaurant, table, session, onClose, onOpenPrinterSetup }: PrintQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [printSize, setPrintSize] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => {
    if (session) {
      setSessionToken(session.session_token);
      generateQRCode(session.session_token);
    } else {
      createOrderSession();
    }
  }, [session, table.id]);

  const createOrderSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Generate a unique session token
      const token = crypto.randomUUID();
      
      // Create a new order session
      const { data, error } = await supabase
        .from('order_sessions')
        .insert({
          restaurant_id: restaurant.id,
          table_id: table.id,
          booking_id: null,
          session_token: token,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      setSessionToken(token);
      generateQRCode(token);
    } catch (err) {
      console.error('Error creating order session:', err);
      setError('Failed to create QR code session. Please try again.');
      setLoading(false);
    }
  };

  const generateQRCode = async (token: string) => {
    try {
      const qrUrl = `${window.location.origin}/order/${token}`;
      
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${restaurant.name} - Table ${table.table_number} QR Code`,
  });

  const getQRCodeSize = () => {
    switch (printSize) {
      case 'small': return 'w-32 h-32';
      case 'medium': return 'w-48 h-48';
      case 'large': return 'w-64 h-64';
      default: return 'w-48 h-48';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Print QR Code
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {error ? (
            <div className="text-center py-8">
              <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-4">
                <p className="text-red-800">{error}</p>
              </div>
              <button
                onClick={createOrderSession}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Try Again
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Generating QR code...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Table {table.table_number}</h3>
                <div className="bg-gray-100 p-6 rounded-lg flex justify-center">
                  {qrDataUrl && (
                    <img 
                      src={qrDataUrl} 
                      alt={`QR Code for Table ${table.table_number}`} 
                      className={getQRCodeSize()}
                    />
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Scan to access digital menu and ordering
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code Size
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPrintSize('small')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm ${
                      printSize === 'small'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Small
                  </button>
                  <button
                    onClick={() => setPrintSize('medium')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm ${
                      printSize === 'medium'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setPrintSize('large')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm ${
                      printSize === 'large'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Large
                  </button>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={onOpenPrinterSetup}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Printer Setup
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print QR Code
                </button>
              </div>
              
              {/* Hidden print template */}
              <div className="hidden">
                <div ref={printRef} className="p-8 text-center">
                  <h1 className="text-2xl font-bold mb-2">{restaurant.name}</h1>
                  <h2 className="text-xl mb-6">Table {table.table_number}</h2>
                  
                  <div className="flex justify-center mb-6">
                    {qrDataUrl && (
                      <img 
                        src={qrDataUrl} 
                        alt={`QR Code for Table ${table.table_number}`} 
                        className={getQRCodeSize()}
                      />
                    )}
                  </div>
                  
                  <p className="text-lg font-medium mb-2">Scan to Order</p>
                  <p className="text-sm">Use your phone camera to scan this QR code</p>
                  <p className="text-sm">Browse our menu and place your order directly</p>
                  
                  <div className="mt-8 text-xs">
                    <p>Printed on: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}