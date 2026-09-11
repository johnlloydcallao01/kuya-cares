import { NextRequest, NextResponse } from 'next/server'

// GET /api/lms/enrollments - Enrollment functionality no longer available
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Enrollment functionality has been removed from the system' },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}

// POST /api/lms/enrollments - Enrollment functionality no longer available
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Enrollment functionality has been removed from the system' },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}
