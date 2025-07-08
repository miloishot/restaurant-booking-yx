import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Restaurant } from '../types/database';

interface PrinterConfig {
  id?: string;
  restaurant_id: string;
  printer_name: string;
  printer_type: 'network' | 'usb' | 'bluetooth';
  ip_address?: string;
  port?: number;
  is_default: boolean;
  is_active: boolean;
}

interface PrinterIntegrationState {
  loading: boolean;
  error: string | null;
  printers: PrinterConfig[];
  addPrinter: (printer: Omit<PrinterConfig, 'id' | 'restaurant_id'>) => Promise<boolean>;
  updatePrinter: (id: string, updates: Partial<PrinterConfig>) => Promise<boolean>;
  deletePrinter: (id: string) => Promise<boolean>;
  testPrinter: (ip: string, port: number) => Promise<boolean>;
  refreshPrinters: () => Promise<void>;
}

export function usePrinterIntegration(restaurant: Restaurant): PrinterIntegrationState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);

  useEffect(() => {
    if (restaurant?.id) {
      fetchPrinters();
    }
  }, [restaurant?.id]);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('printer_configs')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrinters(data || []);
    } catch (err) {
      console.error('Error fetching printers:', err);
      setError('Failed to load printer configurations');
    } finally {
      setLoading(false);
    }
  };

  const addPrinter = async (printer: Omit<PrinterConfig, 'id' | 'restaurant_id'>) => {
    try {
      setError(null);
      
      // If setting as default, update all other printers to not be default
      if (printer.is_default) {
        const { error: updateError } = await supabase
          .from('printer_configs')
          .update({ is_default: false })
          .eq('restaurant_id', restaurant.id);
        
        if (updateError) throw updateError;
      }
      
      const { error } = await supabase
        .from('printer_configs')
        .insert({
          restaurant_id: restaurant.id,
          ...printer
        });

      if (error) throw error;
      
      await fetchPrinters();
      return true;
    } catch (err) {
      console.error('Error adding printer:', err);
      setError('Failed to add printer configuration');
      return false;
    }
  };

  const updatePrinter = async (id: string, updates: Partial<PrinterConfig>) => {
    try {
      setError(null);
      
      // If setting as default, update all other printers to not be default
      if (updates.is_default) {
        const { error: updateError } = await supabase
          .from('printer_configs')
          .update({ is_default: false })
          .eq('restaurant_id', restaurant.id);
        
        if (updateError) throw updateError;
      }
      
      const { error } = await supabase
        .from('printer_configs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      await fetchPrinters();
      return true;
    } catch (err) {
      console.error('Error updating printer:', err);
      setError('Failed to update printer configuration');
      return false;
    }
  };

  const deletePrinter = async (id: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('printer_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchPrinters();
      return true;
    } catch (err) {
      console.error('Error deleting printer:', err);
      setError('Failed to delete printer configuration');
      return false;
    }
  };

  const testPrinter = async (ip: string, port: number) => {
    try {
      setError(null);
      
      // In a real implementation, this would send a test print job to the printer
      // For now, we'll just simulate a successful test with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return true;
    } catch (err) {
      console.error('Error testing printer:', err);
      setError('Failed to test printer connection');
      return false;
    }
  };

  return {
    loading,
    error,
    printers,
    addPrinter,
    updatePrinter,
    deletePrinter,
    testPrinter,
    refreshPrinters: fetchPrinters
  };
}