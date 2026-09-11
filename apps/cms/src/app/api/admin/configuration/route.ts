import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCached, getCached, setCached } from '@encreasl/cache'

function maskKey(key: string | null | undefined): string | null {
  if (!key || typeof key !== 'string') return null
  const s = key.trim()
  if (!s) return null
  if (s.length <= 8) return '****'
  return s.slice(0, 4) + '****' + s.slice(-4)
}

function boolFrom(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (t === 'true' || t === '1' || t === 'yes') return true
    if (t === 'false' || t === '0' || t === 'no') return false
  }
  return fallback
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const cacheKey = `admin:configuration:${admin.id}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Configuration-Cache': 'HIT' } })

    const sys: any = await payload.findGlobal({ slug: 'system-settings', depth: 0, overrideAccess: true } as any).catch(() => null)

    // DB-backed global values (sanitized: mask secrets)
    const lalamoveRaw = sys?.lalamove || {}
    const nativeRaw = sys?.native || {}
    const systemSettings = {
      maintenanceMode: !!sys?.maintenanceMode,
      deliveryProvider: sys?.deliveryProvider || 'lalamove',
      lalamove: {
        apiKeyMasked: maskKey(lalamoveRaw.apiKey),
        hasApiKey: !!lalamoveRaw.apiKey,
        apiSecretMasked: maskKey(lalamoveRaw.apiSecret),
        hasApiSecret: !!lalamoveRaw.apiSecret,
        market: lalamoveRaw.market || 'PH',
        sandbox: lalamoveRaw.sandbox !== false,
        // raw not exposed - only masked
      },
      native: {
        riderAppUrl: nativeRaw.riderAppUrl || null,
      },
      hasSystemSettings: !!sys,
      updatedAt: sys?.updatedAt ? String(sys.updatedAt) : null,
      createdAt: sys?.createdAt ? String(sys.createdAt) : null,
    }

    // ENV-backed runtime status (never expose raw secrets)
    const isLalamoveSandboxEnv = process.env.LALAMOVE_SANDBOX === 'true'
    const runtimeEnv = {
      lalamove: {
        sandbox: isLalamoveSandboxEnv,
        hasApiKey: !!(process.env.LALAMOVE_SANDBOX_API_KEY || process.env.LALAMOVE_API_KEY),
        hasApiSecret: !!(process.env.LALAMOVE_SANDBOX_API_SECRET || process.env.LALAMOVE_API_SECRET),
        market: process.env.LALAMOVE_MARKET || 'PH',
        baseUrl: isLalamoveSandboxEnv ? 'https://rest.sandbox.lalamove.com' : 'https://rest.lalamove.com',
        priorityFee: process.env.LALAMOVE_PRIORITY_FEE || '20',
        hasEnvKeys: !!(process.env.LALAMOVE_API_KEY || process.env.LALAMOVE_SANDBOX_API_KEY),
      },
      paymongo: {
        sandbox: process.env.PAYMONGO_SANDBOX === 'true',
        hasPublicKey: !!(process.env.PAYMONGO_PUBLIC_KEY_LIVE || process.env.PAYMONGO_SANDBOX_API_KEY),
        hasSecretKey: !!(process.env.PAYMONGO_SECRET_KEY_LIVE || process.env.PAYMONGO_SANDBOX_API_KEY),
        hasWebhookSecret: !!(process.env.PAYMONGO_WEBHOOK_SECRET || process.env.PAYMONGO_SANDBOX_WEBHOOK_SECRET),
        publicKeyMasked: maskKey(process.env.PAYMONGO_PUBLIC_KEY_LIVE || process.env.PAYMONGO_SANDBOX_API_KEY),
        secretKeyMasked: maskKey(process.env.PAYMONGO_SECRET_KEY_LIVE || process.env.PAYMONGO_SANDBOX_API_KEY),
        webhookSecretMasked: maskKey(process.env.PAYMONGO_WEBHOOK_SECRET || process.env.PAYMONGO_SANDBOX_WEBHOOK_SECRET),
        webhookUrl: 'https://cms.kuyacares.com/api/paymongo/webhook',
      },
      cors: {
        hasSecret: !!process.env.PAYLOAD_SECRET,
        secretLength: process.env.PAYLOAD_SECRET ? String(process.env.PAYLOAD_SECRET).length : 0,
      },
    }

    // divergence notice: DB vs ENV
    const divergence = {
      lalamoveApiKeyMismatch: systemSettings.lalamove.hasApiKey && !runtimeEnv.lalamove.hasApiKey ? 'DB has key but ENV missing (runtime uses ENV)' : null,
      marketMismatch: systemSettings.lalamove.market !== runtimeEnv.lalamove.market ? `DB market ${systemSettings.lalamove.market} vs ENV ${runtimeEnv.lalamove.market}` : null,
      sandboxMismatch: systemSettings.lalamove.sandbox !== runtimeEnv.lalamove.sandbox ? `DB sandbox ${systemSettings.lalamove.sandbox} vs ENV ${runtimeEnv.lalamove.sandbox} (runtime ENV wins, restart required)` : null,
    }

    const responseBody = {
      systemSettings,
      runtimeEnv,
      divergence,
      authPolicy: {
        tokenExpirationDays: 30,
        tokenExpirationSeconds: 30 * 24 * 60 * 60,
        maxLoginAttempts: 5,
        lockTimeMinutes: 10,
      },
      meta: { generatedAt: new Date().toISOString() },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Configuration-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/configuration] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load configuration' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const patch: Record<string, any> = {}

    // maintenanceMode
    if (body.maintenanceMode !== undefined) {
      patch.maintenanceMode = boolFrom(body.maintenanceMode, false)
    }

    // deliveryProvider
    if (body.deliveryProvider !== undefined) {
      const v = String(body.deliveryProvider).trim().toLowerCase()
      if (v !== 'lalamove' && v !== 'native') return NextResponse.json({ error: 'deliveryProvider must be lalamove or native' }, { status: 400 })
      patch.deliveryProvider = v
    }

    // lalamove group
    if (body.lalamove !== undefined && body.lalamove !== null && typeof body.lalamove === 'object') {
      const g: Record<string, any> = {}
      if (body.lalamove.apiKey !== undefined) {
        const v = body.lalamove.apiKey
        if (v === null || String(v).trim() === '') g.apiKey = null
        else g.apiKey = String(v).trim()
      }
      if (body.lalamove.apiSecret !== undefined) {
        const v = body.lalamove.apiSecret
        if (v === null || String(v).trim() === '') g.apiSecret = null
        else g.apiSecret = String(v).trim()
      }
      if (body.lalamove.market !== undefined) {
        const v = String(body.lalamove.market).trim().toUpperCase()
        if (v && v.length > 10) return NextResponse.json({ error: 'lalamove.market too long (max 10)' }, { status: 400 })
        g.market = v || 'PH'
      }
      if (body.lalamove.sandbox !== undefined) g.sandbox = boolFrom(body.lalamove.sandbox, true)
      if (Object.keys(g).length) patch.lalamove = g
    }

    // native group
    if (body.native !== undefined && body.native !== null && typeof body.native === 'object') {
      const g: Record<string, any> = {}
      if (body.native.riderAppUrl !== undefined) {
        const v = body.native.riderAppUrl
        if (v === null || String(v).trim() === '') g.riderAppUrl = null
        else {
          const s = String(v).trim()
          try {
            new URL(s)
          } catch {
            return NextResponse.json({ error: 'native.riderAppUrl must be a valid URL' }, { status: 400 })
          }
          g.riderAppUrl = s
        }
      }
      if (Object.keys(g).length) patch.native = g
    }

    // Block PayMongo writes (env-only)
    if (body.paymongo !== undefined || body.PAYMONGO_SECRET_KEY_LIVE !== undefined || body.paymongoPublicKey !== undefined) {
      return NextResponse.json({ error: 'PayMongo keys are env-only. Set PAYMONGO_SECRET_KEY_LIVE etc. in apps/cms/.env and redeploy.' }, { status: 400 })
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update. Allowed: maintenanceMode, deliveryProvider, lalamove{apiKey,apiSecret,market,sandbox}, native{riderAppUrl}' }, { status: 400 })

    // Merge groups: need to handle group partial updates via updateGlobal deep merge is not automatic - we need to fetch existing and merge
    const existing: any = await payload.findGlobal({ slug: 'system-settings', depth: 0, overrideAccess: true } as any).catch(() => null)
    const merged: Record<string, any> = { ...patch }
    if (patch.lalamove && existing?.lalamove) {
      merged.lalamove = { ...existing.lalamove, ...patch.lalamove }
      // If apiKey/apiSecret was explicitly set to null, keep null
      if (patch.lalamove.apiKey === null) merged.lalamove.apiKey = null
      if (patch.lalamove.apiSecret === null) merged.lalamove.apiSecret = null
    }
    if (patch.native && existing?.native) {
      merged.native = { ...existing.native, ...patch.native }
    }

    const updated: any = await payload.updateGlobal({ slug: 'system-settings', data: merged as any, overrideAccess: true, depth: 0 } as any)

    await deleteCached(`admin:configuration:${admin.id}`)
    return NextResponse.json({ success: true, message: 'Configuration updated successfully', systemSettings: updated })
  } catch (err: any) {
    console.error('[admin/configuration] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}
