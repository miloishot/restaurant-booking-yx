import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

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
    // Get deviceId from query parameters if provided
  }
});
    
    if (!restaurantId) {
      return createResponse({ error: 'Missing restaurantId parameter' }, 400);
    }
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    if (!restaurant.print_api_url || !restaurant.print_api_key) {
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    const restaurantId = url.searchParams.get('restaurantId');
    
    if (!restaurantId) {
      return createResponse({ error: 'Missing restaurantId parameter' }, 400);
    }
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    const restaurantId = url.searchParams.get('restaurantId');
    
    if (!restaurantId) {
      return createResponse({ error: 'Missing restaurantId parameter' }, 400);
    }
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    if (!restaurant.print_api_url || !restaurant.print_api_key) {
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    
    let apiUrl = `${restaurant.print_api_url}/api/printers`;
    if (deviceId) {
      apiUrl += `?deviceId=${encodeURIComponent(deviceId)}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': restaurant.print_api_key,
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
)

// Handler for refreshing printers for a specific device
async function handleRefreshDevicePrinters(req: Request) {
  try {
    const { deviceId, restaurantId } = await req.json();
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    if (!restaurant.print_api_url || !restaurant.print_api_key) {
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    
    const apiUrl = restaurant.print_api_url;
    const apiKey = restaurant.print_api_key;

    // Send refresh command to the middleware
    const response = await fetch(`${apiUrl}/api/command`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
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
    const { restaurantId, deviceId, printerId, content, options, jobName } = await req.json();

    // Validate required parameters
    if (!restaurantId || !deviceId || !printerId || !content) {
      return createResponse({ error: 'Missing required parameters: restaurantId, deviceId, printerId, content' }, 400);
    }
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    if (!restaurant.print_api_url || !restaurant.print_api_key) {
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    const apiUrl = restaurant.print_api_url;
    const apiKey = restaurant.print_api_key;
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    if (!restaurant.print_api_url || !restaurant.print_api_key) {
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    
    const apiUrl = restaurant.print_api_url;
    const apiKey = restaurant.print_api_key;

    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      return createResponse({ error: 'Restaurant not found or error retrieving restaurant data' }, 404);
    }
    
    const apiUrl = restaurant.print_api_url;
    const apiKey = restaurant.print_api_key;
    
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
    
    // Get restaurant's print API configuration
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('print_api_url, print_api_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant || !restaurant.print_api_url || !restaurant.print_api_key) {
      return createResponse({ error: 'Print API not configured for this restaurant' }, 400);
    }
    

    // Prepare print job payload
    const printPayload = {
      deviceId,
      command: 'print',
      payload: {
        printer_id: printerId,
        content,
        options: options || { mimeType: 'text/html', copies: 1 },
        jobName: jobName || `QR Code Print - ${new Date().toISOString()}`
      }
    };

    // Send print job to external API
    const response = await fetch(`${restaurant.print_api_url}/api/command`, {
      method: 'POST',
      headers: {
        'x-api-key': restaurant.print_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
      throw new Error(errorData.error || `Print request failed: ${response.status}`);
    }

    const data = await response.json();
    return createResponse({ success: true, message: 'Print job sent successfully' });
  } catch (error) {
    console.error('Error processing print request:', error);
    return createResponse({ error: error.message }, 500);
  }
}