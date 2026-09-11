import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for user operations
 * Proxies requests to PayloadCMS users collection
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

/**
 * PATCH /api/users/[id]
 * Update a specific user (e.g., set active address)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();

    // Check authorization header
    const authHeader = request.headers.get('authorization');
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authHeader?.startsWith('Bearer ')) {
      headers['Authorization'] = authHeader;
    } else if (authHeader?.startsWith('users API-Key ')) {
      headers['Authorization'] = authHeader;
    } else {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Update the user in PayloadCMS
    const updateResponse = await fetch(`${API_BASE_URL}/users/${id}`, {
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
        { error: 'Failed to update user', details: errorData },
        { status: updateResponse.status }
      );
    }

    let updatedUser;
    try {
      const responseText = await updateResponse.text();
      if (!responseText.trim()) {
        return NextResponse.json(
          { error: 'Invalid response from user service' },
          { status: 502 }
        );
      }
      updatedUser = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response format from user service' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/[id]
 * Get a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Check authorization header
    const authHeader = request.headers.get('authorization');
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authHeader?.startsWith('Bearer ')) {
      headers['Authorization'] = authHeader;
    } else if (authHeader?.startsWith('users API-Key ')) {
      headers['Authorization'] = authHeader;
    } else {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Fetch the user from PayloadCMS
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
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
        { error: 'Failed to fetch user', details: errorData },
        { status: response.status }
      );
    }

    let user;
    try {
      const responseText = await response.text();
      if (!responseText.trim()) {
        return NextResponse.json(
          { error: 'Invalid response from user service' },
          { status: 502 }
        );
      }
      user = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response format from user service' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      user
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}