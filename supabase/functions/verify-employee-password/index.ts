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
  console.log('Function invoked. Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Method not POST, returning 405');
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  let requestBody: any; // Declare requestBody here to be accessible in catch block

  try {
    requestBody = await req.json();
    console.log('Request body parsed successfully.');
    const { employeeId, email, password } = requestBody;

    // Validate required parameters
    if (!employeeId || !email || !password) {
      console.log('Missing parameters, returning 400');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: employeeId, email, and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Attempting to verify employee: ${employeeId}, email: ${email}`);

    // Verify that the employee exists
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('employee_id, name, role')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .single();

    if (employeeError || !employee) {
      console.log('Employee not found or inactive:', employeeError?.message || 'No employee data');
      return new Response(
        JSON.stringify({ error: 'Employee not found or inactive' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Employee found. Attempting admin sign-in.');

    // Verify the password using Supabase Auth Admin API
    const { data: verifyData, error: verifyError } = await supabase.auth.admin.signInWithEmail(
      email,
      password
    );

    if (verifyError) {
      console.log('Admin sign-in failed:', verifyError.message);
      return new Response(
        JSON.stringify({ error: 'Invalid credentials', details: verifyError.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Admin sign-in successful. Verifying user ID match: ${verifyData.user?.id} vs ${employeeId}`);

    // Verify that the authenticated user ID matches the employee ID
    if (verifyData.user?.id !== employeeId) {
      console.log('User ID mismatch, returning 401');
      return new Response(
        JSON.stringify({ error: 'User ID mismatch with employee ID' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('User ID matched. Logging successful attempt.');

    // Log the verification attempt
    await supabase
      .from('auth_logs')
      .insert({
        user_id: employeeId,
        identifier: email,
        success: true,
        auth_type: 'time_clock_verification'
      });

    console.log('Verification successful, returning 200.');

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
      const emailToLog = requestBody?.email || 'unknown';
      console.error('Attempting to log failed verification for email:', emailToLog);
      await supabase
        .from('auth_logs')
        .insert({
          identifier: emailToLog,
          success: false,
          auth_type: 'time_clock_verification'
        });
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
