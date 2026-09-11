import { NextRequest, NextResponse } from 'next/server'

// GET /api/lms/enrollments/[id] - Enrollment functionality no longer available
export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Enrollment functionality has been removed from the system' },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}

// PATCH /api/lms/enrollments/[id] - Enrollment functionality no longer available
export async function PATCH(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Enrollment functionality has been removed from the system' },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}

// DELETE /api/lms/enrollments/[id] - Enrollment functionality no longer available
export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Enrollment functionality has been removed from the system' },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}
