import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_COOKIE = 'kuyacares-token';

type RouteContext = {
  params: Promise<{ id: string }>
}

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
}

async function getPayloadToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value || null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: ticketId } = await context.params;

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    const payloadToken = await getPayloadToken();

    if (!payloadToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${getApiBase()}/support/tickets/thread?ticketId=${encodeURIComponent(ticketId)}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${payloadToken}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`Failed to fetch ticket: ${res.status} ${errorText}`);
      return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: ticketId } = await context.params;
    const body = await request.json();
    const { status } = body;

    if (!ticketId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payloadToken = await getPayloadToken();

    if (!payloadToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${getApiBase()}/support/tickets/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${payloadToken}`,
      },
      body: JSON.stringify({ ticketId, status }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`Failed to update ticket: ${res.status} ${errorText}`);
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error updating ticket:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
