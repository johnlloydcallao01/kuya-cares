import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ searches: [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, query: body.query });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}
