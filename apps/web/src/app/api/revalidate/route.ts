import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * On-demand revalidation API route
 * This allows manual cache invalidation without waiting for the revalidate timer
 * or requiring a full rebuild
 */
export async function POST(request: NextRequest) {
  try {
    const { path, tag, secret } = await request.json();

    // Check for secret to prevent unauthorized revalidation
    if (process.env.REVALIDATE_SECRET && secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
    }

    if (path) {
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, path });
    }

    if (tag) {
      revalidateTag(tag, { expire: 0 });
      return NextResponse.json({ revalidated: true, tag });
    }

    return NextResponse.json({ message: 'No path or tag provided' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error revalidating', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual testing
 * Usage: GET /api/revalidate?path=/&secret=your_secret
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/';
    const tag = searchParams.get('tag');
    const secret = searchParams.get('secret');

    // Optional: Add a secret token for security in production
    if (process.env.REVALIDATION_SECRET && secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
    }

    // Revalidate specific path
    if (path) {
      revalidatePath(path);
    }

    // Revalidate specific cache tag
    if (tag) {
      revalidateTag(tag, { expire: 0 });
    }

    return NextResponse.json({ 
      revalidated: true, 
      now: Date.now(),
      path: path,
      tag: tag || null
    });

  } catch (error) {
    return NextResponse.json(
      { message: 'Error revalidating', error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
