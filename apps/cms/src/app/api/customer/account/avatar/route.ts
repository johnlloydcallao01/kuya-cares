/**
 * Customer avatar upload/remove (mirrors vendor/profile/avatar).
 * POST   /api/customer/account/avatar  (multipart form-data, field "file")
 * DELETE /api/customer/account/avatar  (removes profilePicture)
 * Auth: customer JWT (self only — no userId param, IDOR impossible).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateCustomerOrMember, generateUniqueFilename } from '@/utils/mediaLibrary'
import { sanitizeAccountUser } from '../_shared'

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided (field "file" required)' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF or AVIF allowed' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitizedName = generateUniqueFilename(file.name)

    let media: Record<string, any>
    try {
      media = (await payload.create({
        collection: 'media',
        data: { alt: `Customer Avatar ${authUser.id} ${Date.now()}` },
        file: { data: buffer, mimetype: file.type, name: sanitizedName, filename: sanitizedName, size: file.size } as any,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to upload image' }, { status: 500 })
    }

    // Perf: no depth needed — the media URL is already known from create.
    const mediaUrl = (media.cloudinaryURL as string) || (media.url as string) || null
    try {
      await payload.update({
        collection: 'users',
        id: Number(authUser.id),
        data: { profilePicture: media.id },
        depth: 0,
        overrideAccess: true,
      })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Image uploaded but failed to link to profile' }, { status: 500 })
    }

    const updated = {
      ...authUser,
      profilePicture: { id: media.id, url: mediaUrl },
    } as unknown as Record<string, any>
    return NextResponse.json({ success: true, message: 'Profile picture updated', user: sanitizeAccountUser(updated) })
  } catch (err: any) {
    console.error('[customer/account/avatar] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateCustomerOrMember(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      await payload.update({
        collection: 'users',
        id: Number(authUser.id),
        data: { profilePicture: null },
        depth: 0,
        overrideAccess: true,
      })
      const updated = { ...authUser, profilePicture: null } as unknown as Record<string, any>
      return NextResponse.json({ success: true, message: 'Profile picture removed', user: sanitizeAccountUser(updated) })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to remove picture' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('[customer/account/avatar] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
