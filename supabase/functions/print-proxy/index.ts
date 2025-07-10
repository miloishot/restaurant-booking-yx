import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// External printing middleware API configuration
const PRINT_API_URL = Deno.env.get('PRINT_API_URL');
const PRINT_API_KEY = Deno.env.get('PRINT_API_KEY');

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper function to create responses with CORS headers
function createResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the endpoint from the URL path
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createResponse({ error: 'Missing authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return createResponse({ error: 'Unauthorized' }, 401);
    }

    // Handle different endpoints
    switch (endpoint) {
      case 'printers':
        return handleGetPrinters(url);
      
      case 'refresh-device-printers':
        return handleRefreshDevicePrinters(req);
      
      case 'print':
        return handlePrintRequest(req, user.id);
      
      default:
        return createResponse({ error: 'Invalid endpoint' }, 404);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse({ error: 'Internal server error' }, 500);
  }
});

// Handler for getting available printers with optional deviceId filter
async function handleGetPrinters(url: URL) {
  try {
    // Check if API configuration is set
    if (!PRINT_API_URL || !PRINT_API_KEY) {
      return createResponse({ 
        error: 'Print API not configured. Please set PRINT_API_URL and PRINT_API_KEY environment variables.' 
      }, 500);
    }
    
    // Get deviceId from query parameters if provided
    const deviceId = url.searchParams.get('deviceId');
    
    let apiUrl = `${PRINT_API_URL}/api/printers`;
    if (deviceId) {
      apiUrl += `?deviceId=${encodeURIComponent(deviceId)}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': PRINT_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch printers: ${response.status}`);
    }

    const data = await response.json();
    return createResponse(data);
  } catch (error) {
    console.error('Error fetching printers:', error);
    return createResponse({ error: error.message }, 500);
  }
}

// Handler for refreshing printers for a specific device
async function handleRefreshDevicePrinters(req: Request) {
  try {
    // Check if API configuration is set
    if (!PRINT_API_URL || !PRINT_API_KEY) {
      return createResponse({ 
        error: 'Print API not configured. Please set PRINT_API_URL and PRINT_API_KEY environment variables.' 
      }, 500);
    }
    
    const { deviceId } = await req.json();

    // Validate required parameters
    if (!deviceId) {
      return createResponse({ error: 'Missing deviceId parameter' }, 400);
    }

    // Send refresh command to the middleware
    const response = await fetch(`${PRINT_API_URL}/api/command`, {
      method: 'POST',
      headers: {
        'x-api-key': PRINT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        command: 'get_printers',
        payload: {}
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to refresh printers: ${response.status}`);
    }

    const data = await response.json();
    return createResponse({ success: true, message: `Printer refresh command sent to device ${deviceId}` });
  } catch (error) {
    console.error('Error refreshing device printers:', error);
    return createResponse({ error: error.message }, 500);
  }
}

// Handler for print requests
async function handlePrintRequest(req: Request, userId: string) {
  try {
    // Check if API configuration is set
    if (!PRINT_API_URL || !PRINT_API_KEY) {
      return createResponse({ 
        error: 'Print API not configured. Please set PRINT_API_URL and PRINT_API_KEY environment variables.' 
      }, 500);
    }
    
    const { restaurantId, deviceId, printerId, content, options } = await req.json();

    // Validate required parameters
    if (!restaurantId || !deviceId || !printerId || !content) {
      return createResponse({ error: 'Missing required parameters: restaurantId, deviceId, printerId, content' }, 400);
    }

    // Verify user has access to this restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', userId)
      .single();

    if (restaurantError || !restaurant) {
      // Also check if user is staff member
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('restaurant_id')
        .eq('id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (profileError || !userProfile) {
        return createResponse({ error: 'You do not have access to this restaurant' }, 403);
      }
    }

    // Prepare print job payload
    const printPayload = {
      deviceId,
      command: 'print',
      payload: {
        printer_id: printerId,
        content,
        options: options || { mimeType: 'text/html', copies: 1 },
        jobName: `QR Code Print - ${new Date().toISOString()}`
      }
    };

    // Send print job to external API
    const response = await fetch(`${PRINT_API_URL}/api/command`, {
      method: 'POST',
      headers: {
        'x-api-key': PRINT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Print request failed: ${response.status}`);
    }

    const data = await response.json();
    return createResponse({ success: true, message: 'Print job sent successfully' });
  } catch (error) {
    console.error('Error processing print request:', error);
    return createResponse({ error: error.message }, 500);
  }
}