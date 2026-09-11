import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for customer operations
 * Proxies requests to PayloadCMS customers collection
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

/**
 * PATCH /api/customers/[id]
 * Update a specific customer (e.g., set active address)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();

    // Verify user authentication first
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('users API-Key '))) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Use service account API key for PayloadCMS access (Customers collection requires service/admin role)
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `users API-Key ${apiKey}`,
    };

    // Update the customer in PayloadCMS
    const updateResponse = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });

    if (!updateResponse.ok) {
      let errorData;
      try {
        const errorText = await updateResponse.text();
        errorData = errorText ? JSON.parse(errorText) : { error: 'Unknown error' };
      } catch {
        errorData = { error: 'Invalid error response' };
      }
      return NextResponse.json(
        { error: 'Failed to update customer', details: errorData },
        { status: updateResponse.status }
      );
    }

    let updatedCustomer;
    try {
      const responseText = await updateResponse.text();
      if (!responseText.trim()) {
        return NextResponse.json(
          { error: 'Invalid response from customer service' },
          { status: 502 }
        );
      }
      updatedCustomer = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response format from customer service' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: updatedCustomer
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customers/[id]
 * Get a specific customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Verify user authentication first
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('users API-Key '))) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Use service account API key for PayloadCMS access
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `users API-Key ${apiKey}`,
    };

    // Fetch the customer from PayloadCMS
    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorData;
      try {
        const errorText = await response.text();
        errorData = errorText ? JSON.parse(errorText) : { error: 'Unknown error' };
      } catch {
        errorData = { error: 'Invalid error response' };
      }
      return NextResponse.json(
        { error: 'Failed to fetch customer', details: errorData },
        { status: response.status }
      );
    }

    let customer;
    try {
      const responseText = await response.text();
      if (!responseText.trim()) {
        return NextResponse.json(
          { error: 'Invalid response from customer service' },
          { status: 502 }
        );
      }
      customer = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response format from customer service' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      customer
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}