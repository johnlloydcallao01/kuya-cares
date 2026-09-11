import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for getting customer by user ID
 * GET /api/customers/user/[userId]
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  
  try {
    // Get user token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
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

    // Fetch customer by user ID from PayloadCMS
    const response = await fetch(`${API_BASE_URL}/customers?where[user][equals]=${userId}&limit=1`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: 'Unknown error' };
      } catch {
        errorData = { error: 'Invalid error response' };
      }
      return NextResponse.json(
        { error: 'Failed to fetch customer', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      return NextResponse.json({
        success: true,
        customer: data.docs[0]
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Customer not found'
    }, { status: 404 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}