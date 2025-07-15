import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parse request body
    const { employeeId, email, password } = await req.json();

    // Validate required parameters
    if (!employeeId || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: employeeId, email, and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify that the employee exists
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('employee_id, name, role')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found or inactive' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify the password using Supabase Auth Admin API
    const { data: verifyData, error: verifyError } = await supabase.auth.admin.signInWithEmail(
      email,
      password
    );

    if (verifyError) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials', details: verifyError.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify that the authenticated user ID matches the employee ID
    if (verifyData.user?.id !== employeeId) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch with employee ID' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log the verification attempt
    await supabase
      .from('auth_logs')
      .insert({
        user_id: employeeId,
        identifier: email,
        success: true,
        auth_type: 'time_clock_verification'
      });

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        employee: {
          employee_id: employee.employee_id,
          name: employee.name,
          role: employee.role
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error verifying employee password:', error);
    
    // Log the failed attempt if possible
    try {
      if (req.body) {
        const { email } = await req.json();
        if (email) {
          await supabase
            .from('auth_logs')
            .insert({
              identifier: email,
              success: false,
              auth_type: 'time_clock_verification'
            });
        }
      }
    } catch (logError) {
      console.error('Error logging failed verification attempt:', logError);
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});