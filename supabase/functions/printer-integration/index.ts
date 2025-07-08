import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Function to handle CORS preflight requests
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// Function to create response with CORS headers
function createResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const path = url.pathname.split('/').filter(Boolean);
  
  // Validate authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createResponse({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return createResponse({ error: 'Invalid token' }, 401);
  }

  try {
    // Handle different endpoints
    if (path[1] === 'printers') {
      // GET /printer-integration/printers - Get all printers for user's restaurant
      if (req.method === 'GET') {
        // Get user's restaurant
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('restaurant_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          return createResponse({ error: 'Failed to get user profile' }, 500);
        }
        
        if (!userProfile?.restaurant_id) {
          return createResponse({ error: 'User has no associated restaurant' }, 400);
        }
        
        // Get printers for restaurant
        const { data: printers, error: printersError } = await supabase
          .from('printer_configs')
          .select('*')
          .eq('restaurant_id', userProfile.restaurant_id);
        
        if (printersError) {
          return createResponse({ error: 'Failed to get printers' }, 500);
        }
        
        return createResponse({ printers });
      }
      
      // POST /printer-integration/printers - Add a new printer
      if (req.method === 'POST') {
        const body = await req.json();
        
        // Validate request body
        if (!body.printer_name || !body.printer_type) {
          return createResponse({ error: 'Missing required fields' }, 400);
        }
        
        // Get user's restaurant
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('restaurant_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          return createResponse({ error: 'Failed to get user profile' }, 500);
        }
        
        if (!userProfile?.restaurant_id) {
          return createResponse({ error: 'User has no associated restaurant' }, 400);
        }
        
        // If setting as default, update all other printers
        if (body.is_default) {
          await supabase
            .from('printer_configs')
            .update({ is_default: false })
            .eq('restaurant_id', userProfile.restaurant_id);
        }
        
        // Add printer
        const { data: printer, error: printerError } = await supabase
          .from('printer_configs')
          .insert({
            restaurant_id: userProfile.restaurant_id,
            printer_name: body.printer_name,
            printer_type: body.printer_type,
            ip_address: body.ip_address,
            port: body.port,
            is_default: body.is_default || false,
            is_active: body.is_active || true
          })
          .select()
          .single();
        
        if (printerError) {
          return createResponse({ error: 'Failed to add printer' }, 500);
        }
        
        return createResponse({ printer });
      }
      
      // PUT /printer-integration/printers/:id - Update a printer
      if (req.method === 'PUT' && path[2]) {
        const printerId = path[2];
        const body = await req.json();
        
        // Get user's restaurant
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('restaurant_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          return createResponse({ error: 'Failed to get user profile' }, 500);
        }
        
        // Verify printer belongs to user's restaurant
        const { data: printer, error: printerError } = await supabase
          .from('printer_configs')
          .select('*')
          .eq('id', printerId)
          .eq('restaurant_id', userProfile.restaurant_id)
          .single();
        
        if (printerError || !printer) {
          return createResponse({ error: 'Printer not found' }, 404);
        }
        
        // If setting as default, update all other printers
        if (body.is_default) {
          await supabase
            .from('printer_configs')
            .update({ is_default: false })
            .eq('restaurant_id', userProfile.restaurant_id);
        }
        
        // Update printer
        const { data: updatedPrinter, error: updateError } = await supabase
          .from('printer_configs')
          .update({
            printer_name: body.printer_name,
            printer_type: body.printer_type,
            ip_address: body.ip_address,
            port: body.port,
            is_default: body.is_default,
            is_active: body.is_active
          })
          .eq('id', printerId)
          .select()
          .single();
        
        if (updateError) {
          return createResponse({ error: 'Failed to update printer' }, 500);
        }
        
        return createResponse({ printer: updatedPrinter });
      }
      
      // DELETE /printer-integration/printers/:id - Delete a printer
      if (req.method === 'DELETE' && path[2]) {
        const printerId = path[2];
        
        // Get user's restaurant
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('restaurant_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          return createResponse({ error: 'Failed to get user profile' }, 500);
        }
        
        // Verify printer belongs to user's restaurant
        const { data: printer, error: printerError } = await supabase
          .from('printer_configs')
          .select('*')
          .eq('id', printerId)
          .eq('restaurant_id', userProfile.restaurant_id)
          .single();
        
        if (printerError || !printer) {
          return createResponse({ error: 'Printer not found' }, 404);
        }
        
        // Delete printer
        const { error: deleteError } = await supabase
          .from('printer_configs')
          .delete()
          .eq('id', printerId);
        
        if (deleteError) {
          return createResponse({ error: 'Failed to delete printer' }, 500);
        }
        
        return createResponse({ success: true });
      }
      
      // POST /printer-integration/printers/:id/test - Test a printer connection
      if (req.method === 'POST' && path[2] && path[3] === 'test') {
        const printerId = path[2];
        
        // Get user's restaurant
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('restaurant_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          return createResponse({ error: 'Failed to get user profile' }, 500);
        }
        
        // Verify printer belongs to user's restaurant
        const { data: printer, error: printerError } = await supabase
          .from('printer_configs')
          .select('*')
          .eq('id', printerId)
          .eq('restaurant_id', userProfile.restaurant_id)
          .single();
        
        if (printerError || !printer) {
          return createResponse({ error: 'Printer not found' }, 404);
        }
        
        // In a real implementation, this would test the printer connection
        // For now, we'll just simulate a successful test
        
        return createResponse({ success: true });
      }
    }
    
    // Handle unknown endpoints
    return createResponse({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('Error handling request:', err);
    return createResponse({ error: 'Internal server error' }, 500);
  }
});