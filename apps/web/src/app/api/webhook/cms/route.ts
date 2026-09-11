import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * CMS Webhook endpoint for automatic cache revalidation
 * This endpoint should be configured in your CMS to trigger when:
 * - Product categories are created, updated, or deleted
 * - Any content that affects the home page is modified
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Revalidate product categories
    revalidateTag('product-categories', { expire: 0 });
    
    // Revalidate home page
    revalidatePath('/');
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error revalidating', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for webhook health check
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: 'CMS Webhook',
    timestamp: new Date().toISOString()
  });
}
