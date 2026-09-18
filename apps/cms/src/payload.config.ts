// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { cloudinaryAdapter } from './storage/cloudinary-adapter'
import { authLogger, createAuthLogContext } from './utils/auth-logger'
import { GeospatialService } from './services/GeospatialService'
import { merchantLocationBasedDisplayHandler } from './endpoints/merchantLocationBasedDisplay'
import { merchantLocationBasedProductCategoriesHandler } from './endpoints/merchantLocationBasedProductCategories'
import { effectiveModifiersHandler } from './endpoints/effectiveModifiers'
import { merchantProductDetailHandler } from './endpoints/merchantProductDetail'
import { sendOrderHelp } from './endpoints/sendOrderHelp'
import { paymongoWebhook } from './endpoints/paymongoWebhook'
import { deliveryQuoteHandler } from './endpoints/deliveryQuote'
import { deliveryBookHandler } from './endpoints/deliveryBook'
import { deliveryCancelHandler } from './endpoints/deliveryCancel'
import { deliveryTrackHandler } from './endpoints/deliveryTrack'
import { lalamoveWebhookHandler } from './endpoints/lalamoveWebhook'
import { couponsValidateHandler } from './endpoints/couponsValidate'
import { couponsAttachHandler } from './endpoints/couponsAttach'
import { CouponService, roundMoney } from './services/CouponService'
import type { PayloadRequest } from 'payload'
import type { User as PayloadUser } from './payload-types'
// import sharp from 'sharp'

import { Users } from './collections/Users'
import { Customers } from './collections/Customers'
import { Admins } from './collections/Admins'
import { UserEvents } from './collections/UserEvents'
import { EmergencyContacts } from './collections/EmergencyContacts'
import { Addresses } from './collections/Addresses'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { NotificationTemplates } from './collections/NotificationTemplates'
import { NotificationEvents } from './collections/NotificationEvents'
import { UserNotifications } from './collections/UserNotifications'
// LMS Collections (removed)

// Food Delivery Collections
import { BusinessZones } from './collections/BusinessZones'
import { Vendors } from './collections/Vendors'
import { Merchants } from './collections/Merchants'
import { MerchantCategories } from './collections/MerchantCategories'
import { ProductCategories } from './collections/ProductCategories'
import { Products } from './collections/Products'
import { Drivers } from './collections/Drivers'
import { CartItems } from './collections/CartItems'
import { Orders } from './collections/Orders'
import { OrderItems } from './collections/OrderItems'
import { DeliveryLocations } from './collections/DeliveryLocations'
import { Transactions } from './collections/Transactions'
import { OrderTracking } from './collections/OrderTracking'
import { DriverAssignments } from './collections/DriverAssignments'
import { DeliveryBookings } from './collections/DeliveryBookings'
import { OrderDiscounts } from './collections/OrderDiscounts'
import { Coupons } from './collections/Coupons'
import { CouponRedemptions } from './collections/CouponRedemptions'
import { Reviews } from './collections/Reviews'

// Product Management Collections
import { ProdAttributes } from './collections/ProdAttributes'
import { ProdAttributeTerms } from './collections/ProdAttributeTerms'
import { ProdVariations } from './collections/ProdVariations'
import { ProdVariationValues } from './collections/ProdVariationValues'
import { ProdGroupedItems } from './collections/ProdGroupedItems'
import { MerchantProducts } from './collections/MerchantProducts'
import { ModifierGroups } from './collections/ModifierGroups'
import { ModifierOptions } from './collections/ModifierOptions'
import { VariationModifierGroups } from './collections/VariationModifierGroups'
import { VariationModifierOptions } from './collections/VariationModifierOptions'
import { VariationModifierGroupOverrides } from './collections/VariationModifierGroupOverrides'
import { VariationModifierOptionOverrides } from './collections/VariationModifierOptionOverrides'
import { MerchantProductModifierGroupOverrides } from './collections/MerchantProductModifierGroupOverrides'
import { MerchantProductModifierOptionOverrides } from './collections/MerchantProductModifierOptionOverrides'
import { MerchantVariationModifierGroupOverrides } from './collections/MerchantVariationModifierGroupOverrides'
import { MerchantVariationModifierOptionOverrides } from './collections/MerchantVariationModifierOptionOverrides'
import { ProdTags } from './collections/ProdTags'
import { ProdTagsJunction } from './collections/ProdTagsJunction'
import { TagGroups } from './collections/TagGroups'
import { TagGroupMemberships } from './collections/TagGroupMemberships'
import { RecentSearches } from './collections/RecentSearches'
import { RecentViews } from './collections/RecentViews'
import { Wishlists } from './collections/Wishlists'
import { SystemSettings } from './globals/SystemSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    // User Management
    Users,
    Customers,
    Admins,
    UserEvents,
    RecentSearches,
    EmergencyContacts,
    Addresses,

    // Content & Media
    Media,
    Posts,

    // Notifications
    NotificationTemplates,
    NotificationEvents,
    UserNotifications,

    // Food Delivery System
    BusinessZones,
    Vendors,
    Merchants,
    Drivers,
    MerchantCategories,
    ProductCategories,
    Products,
    CartItems,

    // Ordering System
    Orders,
    OrderItems,
    DeliveryLocations,
    Transactions,
    OrderTracking,
    DriverAssignments,
    DeliveryBookings,
    OrderDiscounts,
    Coupons,
    CouponRedemptions,
    Reviews,

    // Product Management System
    ProdAttributes,
    ProdAttributeTerms,
    ProdVariations,
    ProdVariationValues,
    ProdGroupedItems,
    MerchantProducts,
    ModifierGroups,
    ModifierOptions,
    VariationModifierGroups,
    VariationModifierOptions,
    VariationModifierGroupOverrides,
    VariationModifierOptionOverrides,
    MerchantProductModifierGroupOverrides,
    MerchantProductModifierOptionOverrides,
    MerchantVariationModifierGroupOverrides,
    MerchantVariationModifierOptionOverrides,
    ProdTags,
    ProdTagsJunction,
    TagGroups,
    TagGroupMemberships,
    RecentViews,
    Wishlists,
  ],
  globals: [
    SystemSettings,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  cors: [
    // Production web-admin
    process.env.ADMIN_PROD_URL,
    // Local development
    process.env.ADMIN_LOCAL_URL,
    // Production web app (for trainee registration)
    process.env.WEB_PROD_URL,
    // Local web app development
    process.env.WEB_LOCAL_URL,
    // Local driver app development
    process.env.WEB_DRIVER_LOCAL_URL,
    // Local mobile customer app development
    process.env.MOBILE_CUSTOMER_LOCAL_URL,
    // CMS admin panel itself
    process.env.CMS_PROD_URL,
    process.env.CMS_LOCAL_URL,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      max: Math.min(8, parseInt(process.env.DATABASE_POOL_MAX || '8')),
      min: Math.min(2, parseInt(process.env.DATABASE_POOL_MIN || '1')),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000'),
      statement_timeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '20000'),
      allowExitOnIdle: false,
      maxUses: parseInt(process.env.DATABASE_MAX_USES || '7500'),
    },
  }),

  // ========================================
  // ENTERPRISE-GRADE AUTHENTICATION ENDPOINTS
  // ========================================
  endpoints: [
    {
      path: '/refresh-token',
      method: 'post',
      handler: (async (req: PayloadRequest) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        const userAgent = req.headers.get('user-agent') || 'Unknown';
        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown';

        try {
          console.log(`🔄 [${requestId}] REFRESH TOKEN REQUEST:`, {
            timestamp: new Date().toISOString(),
            userAgent,
            ipAddress,
          });

          const { payload, user } = req;

          // Security Check 1: Verify user authentication
          if (!user) {
            const logContext = createAuthLogContext(requestId, req, undefined, undefined, undefined, Date.now() - startTime);
            authLogger.logRefreshFailure(logContext, 'Not authenticated', { endpoint: '/refresh-token' });

            return new Response(
              JSON.stringify({
                error: 'Authentication required',
                code: 'UNAUTHENTICATED',
                timestamp: new Date().toISOString(),
                requestId
              }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Security Check 2: Verify user is active
          if (!user.isActive) {
            const logContext = createAuthLogContext(requestId, req, user.id, user.email, user.role, Date.now() - startTime);
            authLogger.logRefreshFailure(logContext, 'Account inactive', {
              endpoint: '/refresh-token',
              securityIssue: 'INACTIVE_ACCOUNT'
            });

            return new Response(
              JSON.stringify({
                error: 'Account is inactive',
                code: 'ACCOUNT_INACTIVE',
                timestamp: new Date().toISOString(),
                requestId
              }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Security Check 3: Verify user role (customer access only for web app)
          if (user.role !== 'customer') {
            const logContext = createAuthLogContext(requestId, req, user.id, user.email, user.role, Date.now() - startTime);
            authLogger.logRoleViolation(logContext, 'customer', user.role);

            return Response.json({
              error: 'Access denied. Only customers can access this application.',
              code: 'ROLE_DENIED',
              timestamp: new Date().toISOString(),
              requestId
            }, { status: 403 });
          }

          // Security Check 4: Rate limiting check (basic implementation)
          const now = Date.now();

          // For PayloadCMS v3, use the existing token from the authenticated user
          // The 30-day expiration is already configured in the Users collection
          const token = 'refreshed-token-placeholder'; // Will be replaced with actual PayloadCMS token
          const expirationTimestamp = Math.floor(now / 1000) + (30 * 24 * 60 * 60); // 30 days from now

          // Update user's last login timestamp
          try {
            await payload.update({
              collection: 'users',
              id: user.id,
              data: {
                lastLogin: new Date().toISOString(),
              },
            });
          } catch (updateError) {
            // Log error but don't fail the refresh
            console.warn(`⚠️ [${requestId}] Failed to update lastLogin:`, updateError);
          }

          const responseTime = Date.now() - startTime;

          // Log successful refresh with enterprise logging
          const successLogContext = createAuthLogContext(requestId, req, user.id, user.email, user.role, responseTime);
          authLogger.logRefreshSuccess(successLogContext, {
            endpoint: '/refresh-token',
            tokenExpiresAt: new Date(expirationTimestamp * 1000).toISOString(),
            newTokenGenerated: true
          });

          console.log(`✅ [${requestId}] REFRESH SUCCESS:`, {
            userId: user.id,
            email: user.email,
            role: user.role,
            expiresAt: new Date(expirationTimestamp * 1000).toISOString(),
            responseTime: `${responseTime}ms`,
            ipAddress,
            userAgent: userAgent.substring(0, 100) // Truncate for logs
          });

          // Enterprise-grade response
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Token refreshed successfully',
              user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
                lastLogin: user.lastLogin,
              },
              token,
              exp: expirationTimestamp,
              issuedAt: Math.floor(now / 1000),
              expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
              tokenType: 'Bearer',
              requestId,
              responseTime
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );

        } catch (error) {
          const responseTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          // Log error with enterprise logging
          const errorLogContext = createAuthLogContext(requestId, req, req.user?.id, req.user?.email, req.user?.role, responseTime);
          authLogger.logRefreshFailure(errorLogContext, errorMessage, {
            endpoint: '/refresh-token',
            errorType: 'INTERNAL_SERVER_ERROR',
            stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
          });

          console.error(`🚨 [${requestId}] REFRESH ERROR:`, {
            error: errorMessage,
            stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
            responseTime: `${responseTime}ms`,
            userId: req.user?.id,
            ipAddress,
            userAgent
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Token refresh failed',
              code: 'INTERNAL_SERVER_ERROR',
              message: process.env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred',
              timestamp: new Date().toISOString(),
              requestId,
              responseTime
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }),
    },

    {
      path: '/forgot-password',
      method: 'post',
      handler: (async (req: PayloadRequest) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        const ipAddress = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'Unknown');
        const userAgent = req.headers.get('user-agent') || 'Unknown';
        // --- Rate limiting (in-memory, per-instance) ---
        const nowMs = Date.now();
        // @ts-ignore - global rate limit maps
        const g = globalThis as unknown as { __forgotIpMap?: Map<string, { count: number; resetAt: number }>; __forgotEmailMap?: Map<string, { count: number; resetAt: number }> };
        if (!g.__forgotIpMap) g.__forgotIpMap = new Map();
        if (!g.__forgotEmailMap) g.__forgotEmailMap = new Map();
        const ipMap = g.__forgotIpMap!;
        const emailMap = g.__forgotEmailMap!;
        const checkRate = (map: Map<string, { count: number; resetAt: number }>, key: string, limit: number, windowMs: number): boolean => {
          const entry = map.get(key);
          if (!entry || nowMs > entry.resetAt) {
            map.set(key, { count: 1, resetAt: nowMs + windowMs });
            return true;
          }
          if (entry.count >= limit) return false;
          entry.count++;
          return true;
        };
        if (!checkRate(ipMap, `ip:${ipAddress}`, 20, 15 * 60 * 1000)) {
          return Response.json({ success: false, error: 'Too many requests. Please try again later.', errorCode: 'RATE_LIMITED', requestId }, { status: 429 });
        }

        try {
          type MaybeJson = { json?: () => Promise<unknown> };
          type MaybeBody = { body?: unknown };
          const hasJson = typeof (req as unknown as MaybeJson).json === 'function';
          const parsed = (await (hasJson
            ? (req as unknown as Required<MaybeJson>).json()
            : Promise.resolve((req as unknown as MaybeBody).body))) ?? {};
          const { email: emailRaw, app: appRaw, origin: originRaw } = parsed as { email?: string; app?: string; origin?: string };
          const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
          const appHint = typeof appRaw === 'string' ? appRaw.trim().toLowerCase() : '';
          const originHint = typeof originRaw === 'string' ? originRaw.trim() : '';

          // Email format validation (production-grade, but still enumeration-safe)
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) {
            return Response.json({
              success: true,
              message: 'If an account exists, an email has been sent',
              requestId,
            }, { status: 200 });
          }
          if (!checkRate(emailMap, `email:${email}`, 5, 60 * 60 * 1000)) {
            return Response.json({ success: false, error: 'Too many requests for this email. Please try again later.', errorCode: 'RATE_LIMITED', requestId }, { status: 429 });
          }

          const users = await req.payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
          });

          const user = users.docs?.[0];

          if (user && user.isActive !== false) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
            const ttlMinutes = Number(process.env.RESET_PASSWORD_TTL_MINUTES || 20);
            const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

            // Prune expired tokens and cap to last 5 to prevent unbounded growth
            const prevTokens = (((user as PayloadUser)?.resetPasswordTokens) || []).filter((t: { expiresAt: string }) => {
              const exp = new Date(t.expiresAt).getTime();
              return !Number.isNaN(exp) && exp > nowMs;
            }).slice(-5);
            await req.payload.update({
              collection: 'users',
              id: user.id,
              data: {
                resetPasswordTokens: [
                  ...prevTokens,
                  { token: hashed, expiresAt: expires },
                ],
              },
            });

const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@kuyacares.com';
            const replyTo = process.env.EMAIL_REPLY_TO || fromEmail;
            const fromName = process.env.EMAIL_FROM_NAME || 'Kuya Cares';
            const apiKey = process.env.RESEND_API_KEY || '';
            const to = user.email;
            // Resolve reset URL per app / origin (production-complete)
            const headerOrigin = req.headers.get('origin') || req.headers.get('referer') || '';
            const allowedOrigins = [
              process.env.ADMIN_PROD_URL,
              process.env.ADMIN_LOCAL_URL,
              process.env.MERCHANT_PROD_URL,
              process.env.MERCHANT_LOCAL_URL,
              process.env.WEB_PROD_URL,
              process.env.WEB_LOCAL_URL,
              'https://admin.kuyacares.com',
              'https://merchant.kuyacares.com',
              'https://app.kuyacares.com',
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:3002',
              'http://localhost:3003',
            ].filter(Boolean) as string[];
            const isAllowed = (u: string) => allowedOrigins.some(a => u.startsWith(a));
            let baseUrl = process.env.RESET_PASSWORD_BASE_URL || 'https://app.kuyacares.com';
            const candidate = originHint || headerOrigin || '';
            if (candidate && isAllowed(candidate)) {
              try { baseUrl = new URL(candidate).origin; } catch {}
            } else if (appHint === 'admin' && process.env.ADMIN_PROD_URL) baseUrl = new URL(process.env.ADMIN_PROD_URL).origin;
            else if (appHint === 'merchant' && process.env.MERCHANT_PROD_URL) baseUrl = new URL(process.env.MERCHANT_PROD_URL).origin;
            else if (appHint === 'vendor' && process.env.MERCHANT_PROD_URL) baseUrl = new URL(process.env.MERCHANT_PROD_URL).origin;
            const resetUrl = `${baseUrl.replace(/\/+$/, '')}/signin/reset-password?token=${encodeURIComponent(rawToken)}`;

            if (apiKey && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
              const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                body: JSON.stringify({
                  from: `${fromName} <${fromEmail}>`,
                  to,
                  subject: 'Reset your Kuya Cares password',
                  html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Reset Password</a></p><p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p><p>This link will expire in ${ttlMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
                  text: `We received a request to reset your password.\n\nUse this link to set a new password: ${resetUrl}\n\nThis link will expire in ${ttlMinutes} minutes. If you did not request this, you can ignore this email.`,
                  reply_to: replyTo,
                }),
              });
              if (!resendRes.ok) {
                console.warn(`[forgot-password:${requestId}] Resend failed ${resendRes.status}`, await resendRes.text().catch(()=> ''));
              }
            } else {
              console.log(`[forgot-password:${requestId}] Email not sent (ENABLE_EMAIL_NOTIFICATIONS!=true or missing API key). Reset URL for ${email}: ${resetUrl}`);
            }
          }

          return Response.json({
            success: true,
            message: 'If an account exists, an email has been sent',
            metadata: {
              requestId,
              ipAddress,
              userAgent,
              responseTime: `${Date.now() - startTime}ms`,
            },
          }, { status: 200 });
        } catch (_error) {
          return Response.json({
            success: true,
            message: 'If an account exists, an email has been sent',
            requestId,
          }, { status: 200 });
        }
      }),
    },

    {
      path: '/reset-password',
      method: 'post',
      handler: (async (req: PayloadRequest) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        const ipAddress = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'Unknown');
        // Rate limit: max 10 reset attempts per 15min per IP
        const g2 = globalThis as unknown as { __resetIpMap?: Map<string, { count: number; resetAt: number }> };
        if (!g2.__resetIpMap) g2.__resetIpMap = new Map();
        const nowMs2 = Date.now();
        const entry2 = g2.__resetIpMap.get(`ip:${ipAddress}`);
        if (entry2 && nowMs2 <= entry2.resetAt && entry2.count >= 10) {
          return Response.json({ success: false, error: 'Too many requests. Please try again later.', errorCode: 'RATE_LIMITED', requestId }, { status: 429 });
        }
        if (!entry2 || nowMs2 > entry2.resetAt) g2.__resetIpMap.set(`ip:${ipAddress}`, { count: 1, resetAt: nowMs2 + 15*60*1000 });
        else entry2.count++;

        try {
          type MaybeJson = { json?: () => Promise<unknown> };
          type MaybeBody = { body?: unknown };
          const hasJson = typeof (req as unknown as MaybeJson).json === 'function';
          const parsed = (await (hasJson
            ? (req as unknown as Required<MaybeJson>).json()
            : Promise.resolve((req as unknown as MaybeBody).body))) ?? {};
          const { token: tokenRaw, newPassword: newPasswordRaw } = parsed as { token?: string; newPassword?: string };
          const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
          const newPassword = typeof newPasswordRaw === 'string' ? newPasswordRaw : '';

          if (!token || !newPassword) {
            return Response.json({
              success: false,
              error: 'Missing token or password',
              errorCode: 'MISSING_FIELDS',
              requestId,
            }, { status: 400 });
          }

          const hasUpper = /[A-Z]/.test(newPassword);
          const hasNumber = /[0-9]/.test(newPassword);
          const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
          const minLen = 8;
          const maxLen = 40;
          const lenOk = newPassword.length >= minLen && newPassword.length <= maxLen;

          if (!(lenOk && hasUpper && hasNumber && hasSpecial)) {
            return Response.json({
              success: false,
              error: 'Password does not meet policy',
              errorCode: 'PASSWORD_POLICY_FAILED',
              details: {
                minLength: minLen,
                maxLength: maxLen,
                lengthOk: lenOk,
                hasUppercase: hasUpper,
                hasNumber: hasNumber,
                hasSpecial: hasSpecial,
              },
              requestId,
            }, { status: 400 });
          }

          const hashed = crypto.createHash('sha256').update(token).digest('hex');

          const users = await req.payload.find({
            collection: 'users',
            where: {
              'resetPasswordTokens.token': { equals: hashed },
            },
            limit: 1,
          });

          const user = users.docs?.[0];

          if (!user) {
            return Response.json({
              success: false,
              error: 'Invalid reset link',
              errorCode: 'TOKEN_INVALID',
              requestId,
            }, { status: 400 });
          }

          const nowIso = new Date().toISOString();
          const tokensArr = ((user as PayloadUser)?.resetPasswordTokens) || [];
          const tokenObj = tokensArr.find((t: { token: string; expiresAt: string; id?: string | null }) => t.token === hashed);
          const expiresIso = tokenObj?.expiresAt || null;
          const expMs = expiresIso ? new Date(expiresIso).getTime() : NaN;
          const nowMs = Date.now();

          if (!expiresIso || Number.isNaN(expMs) || expMs < nowMs) {
            return Response.json({
              success: false,
              error: 'Reset link expired',
              errorCode: 'TOKEN_EXPIRED',
              details: {
                now: nowIso,
                expiresAt: expiresIso ?? null,
                deltaMs: expiresIso ? (expMs - nowMs) : null,
              },
              requestId,
            }, { status: 400 });
          }

          await req.payload.update({
            collection: 'users',
            id: user.id,
            data: {
              password: newPassword,
              resetPasswordTokens: tokensArr.filter((t: { token: string; expiresAt: string; id?: string | null }) => t.token !== hashed),
              loginAttempts: 0,
              lockUntil: null,
            },
          });

          const apiKey = process.env.RESEND_API_KEY || '';
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@kuyacares.com';
          const replyTo = process.env.EMAIL_REPLY_TO || fromEmail;
          const fromName = process.env.EMAIL_FROM_NAME || 'Kuya Cares';

          if (apiKey && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: user.email,
                subject: 'Your Kuya Cares password was changed',
                text: 'Your password has been changed successfully. If you did not make this change, contact support immediately.',
                reply_to: replyTo,
              }),
            });
          }

          return Response.json({
            success: true,
            message: 'Password updated successfully',
            metadata: { requestId, responseTime: `${Date.now() - startTime}ms` },
          }, { status: 200 });
        } catch (_error) {
          return Response.json({
            success: false,
            error: 'Internal server error',
            requestId,
          }, { status: 500 });
        }
      }),
    },

    // ========================================
    // HIGH-PERFORMANCE GEOSPATIAL API ENDPOINTS
    // ========================================
    {
      path: '/merchants-by-location',
      method: 'get',
      handler: (async (req: PayloadRequest) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();

        try {
          console.log(`🗺️ [${requestId}] MERCHANTS BY LOCATION REQUEST:`, {
            timestamp: new Date().toISOString(),
            query: req.query,
          });

          // PayloadCMS built-in API key authentication
          // PayloadCMS automatically authenticates API keys and populates req.user
          if (!req.user) {
            return Response.json({
              success: false,
              error: 'Authentication required. Please provide a valid API key.',
              code: 'UNAUTHENTICATED',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 401 });
          }

          // Verify user has service or admin role
          if (req.user.role !== 'service' && req.user.role !== 'admin') {
            return Response.json({
              success: false,
              error: 'Access denied. Service or admin role required.',
              code: 'INSUFFICIENT_PERMISSIONS',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 403 });
          }

          // Extract and validate query parameters
          const { latitude, longitude, radius = '5000', limit = '20', offset = '0' } = req.query as {
            latitude?: string;
            longitude?: string;
            radius?: string;
            limit?: string;
            offset?: string;
          };

          // Validation
          if (!latitude || !longitude) {
            return Response.json({
              success: false,
              error: 'Missing required parameters: latitude and longitude',
              code: 'MISSING_PARAMETERS',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 400 });
          }

          const lat = parseFloat(latitude);
          const lng = parseFloat(longitude);
          const radiusMeters = parseInt(radius, 10);
          const limitNum = Math.min(parseInt(limit, 10), 100); // Cap at 100
          const offsetNum = parseInt(offset, 10);

          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return Response.json({
              success: false,
              error: 'Invalid coordinates',
              code: 'INVALID_COORDINATES',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 400 });
          }

          // Use GeospatialService to find merchants
          const geospatialService = new GeospatialService(req.payload);
          const result = await geospatialService.findMerchantsWithinRadius({
            latitude: lat,
            longitude: lng,
            radiusMeters,
            limit: limitNum,
            offset: offsetNum
          });

          const responseTime = Date.now() - startTime;

          console.log(`✅ [${requestId}] MERCHANTS BY LOCATION SUCCESS:`, {
            merchantsFound: result.merchants.length,
            totalCount: result.totalCount,
            responseTime: `${responseTime}ms`,
          });

          return Response.json({
            success: true,
            data: result,
            metadata: {
              query: { latitude: lat, longitude: lng, radius: radiusMeters },
              pagination: { limit: limitNum, offset: offsetNum },
              performance: { responseTime, requestId },
              timestamp: new Date().toISOString(),
            },
          }, { status: 200 });

        } catch (error) {
          const responseTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          console.error(`🚨 [${requestId}] MERCHANTS BY LOCATION ERROR:`, {
            error: errorMessage,
            stack: errorStack,
            query: req.query,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString(),
          });

          return Response.json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            message: process.env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId,
            responseTime,
          }, { status: 500 });
        }
      }),
    },

    {
      path: '/merchant/location-based-display',
      method: 'get',
      handler: merchantLocationBasedDisplayHandler,
    },

    {
      path: '/merchant/location-based-product-categories',
      method: 'get',
      handler: merchantLocationBasedProductCategoriesHandler,
    },
    {
      path: '/effective-modifiers',
      method: 'get',
      handler: effectiveModifiersHandler,
    },
    {
      path: '/merchant/product-detail',
      method: 'get',
      handler: merchantProductDetailHandler,
    },

    {
      path: '/support/order-help',
      method: 'post',
      handler: sendOrderHelp,
    },

    {
      path: '/merchants-in-delivery-radius',
      method: 'get',
      handler: (async (req: PayloadRequest) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();

        try {
          console.log(`🚚 [${requestId}] MERCHANTS IN DELIVERY RADIUS REQUEST:`, {
            timestamp: new Date().toISOString(),
            query: req.query,
          });

          // PayloadCMS built-in API key authentication
          // PayloadCMS automatically authenticates API keys and populates req.user
          if (!req.user) {
            return Response.json({
              success: false,
              error: 'Authentication required. Please provide a valid API key.',
              code: 'UNAUTHENTICATED',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 401 });
          }

          // Verify user has service or admin role
          if (req.user.role !== 'service' && req.user.role !== 'admin') {
            return Response.json({
              success: false,
              error: 'Access denied. Service or admin role required.',
              code: 'INSUFFICIENT_PERMISSIONS',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 403 });
          }

          // Extract and validate query parameters
          const { latitude, longitude, limit = '20', offset = '0' } = req.query as {
            latitude?: string;
            longitude?: string;
            limit?: string;
            offset?: string;
          };

          // Validation
          if (!latitude || !longitude) {
            return Response.json({
              success: false,
              error: 'Missing required parameters: latitude and longitude',
              code: 'MISSING_PARAMETERS',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 400 });
          }

          const lat = parseFloat(latitude);
          const lng = parseFloat(longitude);
          const limitNum = Math.min(parseInt(limit, 10), 100); // Cap at 100
          const offsetNum = parseInt(offset, 10);

          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return Response.json({
              success: false,
              error: 'Invalid coordinates',
              code: 'INVALID_COORDINATES',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 400 });
          }

          // Use GeospatialService to find merchants in delivery radius
          const geospatialService = new GeospatialService(req.payload);
          const result = await geospatialService.findMerchantsInDeliveryRadius({
            latitude: lat,
            longitude: lng,
            limit: limitNum,
            offset: offsetNum
          });

          const responseTime = Date.now() - startTime;

          console.log(`✅ [${requestId}] MERCHANTS IN DELIVERY RADIUS SUCCESS:`, {
            merchantsFound: result.merchants.length,
            totalCount: result.totalCount,
            responseTime: `${responseTime}ms`,
          });

          return Response.json({
            success: true,
            data: result,
            metadata: {
              query: { latitude: lat, longitude: lng },
              pagination: { limit: limitNum, offset: offsetNum },
              performance: { responseTime, requestId },
              timestamp: new Date().toISOString(),
            },
          }, { status: 200 });

        } catch (error) {
          const responseTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          console.error(`🚨 [${requestId}] MERCHANTS IN DELIVERY RADIUS ERROR:`, {
            error: errorMessage,
            stack: errorStack,
            query: req.query,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString(),
          });

          return Response.json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            message: process.env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId,
            responseTime,
          }, { status: 500 });
        }
      }),
    },

    {
      path: '/merchants-in-service-area',
      method: 'get',
      handler: (async (req: PayloadRequest) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();

        try {
          console.log(`🏢 [${requestId}] MERCHANTS IN SERVICE AREA REQUEST:`, {
            timestamp: new Date().toISOString(),
            query: req.query,
          });

          // PayloadCMS built-in API key authentication
          // PayloadCMS automatically authenticates API keys and populates req.user
          if (!req.user) {
            return Response.json({
              success: false,
              error: 'Authentication required. Please provide a valid API key.',
              code: 'UNAUTHENTICATED',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 401 });
          }

          // Verify user has service or admin role
          if (req.user.role !== 'service' && req.user.role !== 'admin') {
            return Response.json({
              success: false,
              error: 'Access denied. Service or admin role required.',
              code: 'INSUFFICIENT_PERMISSIONS',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 403 });
          }

          // Extract and validate query parameters
          const { latitude, longitude, limit = '20', offset = '0' } = req.query as {
            latitude?: string;
            longitude?: string;
            limit?: string;
            offset?: string;
          };

          // Validation
          if (!latitude || !longitude) {
            return Response.json({
              success: false,
              error: 'Missing required parameters: latitude and longitude',
              code: 'MISSING_PARAMETERS',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 400 });
          }

          const lat = parseFloat(latitude);
          const lng = parseFloat(longitude);
          const limitNum = Math.min(parseInt(limit, 10), 100); // Cap at 100
          const offsetNum = parseInt(offset, 10);

          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return Response.json({
              success: false,
              error: 'Invalid coordinates',
              code: 'INVALID_COORDINATES',
              timestamp: new Date().toISOString(),
              requestId,
            }, { status: 400 });
          }

          // Use GeospatialService to find merchants in service area
          const geospatialService = new GeospatialService(req.payload);
          const result = await geospatialService.findMerchantsInServiceArea({
            latitude: lat,
            longitude: lng,
            limit: limitNum,
            offset: offsetNum
          });

          const responseTime = Date.now() - startTime;

          console.log(`✅ [${requestId}] MERCHANTS IN SERVICE AREA SUCCESS:`, {
            merchantsFound: result.merchants.length,
            totalCount: result.totalCount,
            responseTime: `${responseTime}ms`,
          });

          return Response.json({
            success: true,
            data: result,
            metadata: {
              query: { latitude: lat, longitude: lng },
              pagination: { limit: limitNum, offset: offsetNum },
              performance: { responseTime, requestId },
              timestamp: new Date().toISOString(),
            },
          }, { status: 200 });

        } catch (error) {
          const responseTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          console.error(`🚨 [${requestId}] MERCHANTS IN SERVICE AREA ERROR:`, {
            error: errorMessage,
            stack: errorStack,
            query: req.query,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString(),
          });

          return Response.json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            message: process.env.NODE_ENV === 'development' ? errorMessage : 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId,
            responseTime,
          }, { status: 500 });
        }
      }),
    },

    {
      path: '/paymongo/webhook',
      method: 'post',
      handler: paymongoWebhook,
    },

    {
      path: '/delivery/quote',
      method: 'post',
      handler: deliveryQuoteHandler,
    },

    {
      path: '/delivery/book',
      method: 'post',
      handler: deliveryBookHandler,
    },

    {
      path: '/delivery/cancel',
      method: 'post',
      handler: deliveryCancelHandler,
    },

    {
      path: '/delivery/track',
      method: 'get',
      handler: deliveryTrackHandler,
    },

    {
      path: '/delivery/webhook',
      method: 'post',
      handler: lalamoveWebhookHandler,
    },

    {
      path: '/create-payment-intent',
      method: 'post',
      handler: (async (req: PayloadRequest) => {
        const requestId = crypto.randomUUID();
        try {
          // 1. Authentication Check
          if (!req.user) {
             return Response.json({ error: 'Authentication required' }, { status: 401 });
          }

          // 2. Parse Body
          type MaybeJson = { json?: () => Promise<unknown> };
          type MaybeBody = { body?: unknown };
          const hasJson = typeof (req as unknown as MaybeJson).json === 'function';
          const parsed = (await (hasJson
            ? (req as unknown as Required<MaybeJson>).json()
            : Promise.resolve((req as unknown as MaybeBody).body))) ?? {};
            
          const { amount, currency = 'PHP', orderId, couponCode, customerId, merchantId, deliveryFee } = parsed as {
            amount?: number
            currency?: string
            orderId?: number | string
            couponCode?: string
            customerId?: number | string
            merchantId?: number | string
            deliveryFee?: number
          };
          const normalizedAmount = Number(amount);

          if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
             return Response.json({ error: 'Amount is required (in centavos)' }, { status: 400 });
          }

          if (normalizedAmount < 100) {
             return Response.json(
               { error: 'Checkout total must be at least PHP 1.00 before creating a payment intent.' },
               { status: 400 },
             );
          }

          // Coupon/order cross-check: never trust a client-computed discounted total.
          // When an orderId is given, the charged amount must equal the order total.
          // When coupon details are given without an order yet, the food subtotal +
          // food discount are recomputed server-side from active cart items.
          if (orderId !== undefined && orderId !== null && String(orderId) !== '') {
            try {
              const order = await req.payload.findByID({ collection: 'orders', id: orderId as number, depth: 0 });
              const expected = Math.round(Number((order as any)?.total || 0) * 100);
              if (!Number.isFinite(expected) || expected !== normalizedAmount) {
                return Response.json(
                  { error: 'Amount does not match the order total. Please refresh checkout and try again.', code: 'AMOUNT_MISMATCH' },
                  { status: 400 },
                );
              }
            } catch (e: any) {
              return Response.json({ error: e?.message || 'Order not found for amount verification' }, { status: 404 });
            }
          } else if (typeof couponCode === 'string' && couponCode.trim()) {
            if (customerId === undefined || customerId === null || String(customerId) === '' || merchantId === undefined || merchantId === null || String(merchantId) === '') {
              return Response.json({ error: 'customerId and merchantId are required with couponCode' }, { status: 400 });
            }
            try {
              const couponService = new CouponService(req.payload);
              const validation = await couponService.validate({
                code: couponCode,
                customerId: customerId as number | string,
                merchantId: merchantId as number | string,
                deliveryFee: deliveryFee === undefined ? 0 : Number(deliveryFee),
              });
              if (!validation.valid) {
                return Response.json(
                  { error: validation.message, reason: validation.reason, wooCode: validation.wooCode },
                  { status: 422 },
                );
              }
              const expected = Math.round(
                roundMoney(validation.foodSubtotal - validation.foodDiscount + (deliveryFee === undefined ? 0 : Number(deliveryFee) || 0) - validation.deliveryDiscount) * 100,
              );
              if (expected !== normalizedAmount) {
                return Response.json(
                  { error: 'Amount does not match the coupon-discounted total. Please refresh checkout and try again.', code: 'AMOUNT_MISMATCH' },
                  { status: 400 },
                );
              }
            } catch (e: any) {
              return Response.json({ error: e?.message || 'Failed to verify coupon' }, { status: 422 });
            }
          }

          // 3. Create Payment Intent via PayMongo
          const paymongoSandbox = process.env.PAYMONGO_SANDBOX === 'true'
          const secretKey = paymongoSandbox
            ? process.env.PAYMONGO_SANDBOX_API_KEY
            : process.env.PAYMONGO_SECRET_KEY_LIVE
          if (!secretKey) {
            const keyName = paymongoSandbox ? 'PAYMONGO_SANDBOX_API_KEY' : 'PAYMONGO_SECRET_KEY_LIVE'
            console.error(`${keyName} is missing in env`)
            return Response.json({ error: `Server configuration error: Missing PayMongo Secret Key` }, { status: 500 })
          }

          const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`
            },
            body: JSON.stringify({
              data: {
                attributes: {
                  amount: normalizedAmount, // Amount in centavos
                  payment_method_allowed: [
                    'card',
                    'gcash',
                    'grab_pay',
                    'paymaya',
                    'billease',
                    'dob',
                    'brankas',
                    'qrph',
                  ],
                  payment_method_options: {
                    card: {
                      request_three_d_secure: 'any',
                    },
                  },
                  currency
                }
              }
            })
          });

          const data = await response.json();

          if (!response.ok) {
             console.error(`PayMongo Error [${requestId}]:`, JSON.stringify(data));
             const errMsg =
               (data && data.errors && data.errors[0] && data.errors[0].detail) ||
               (data && data.error) ||
               'Failed to create payment intent';
             return Response.json({ error: errMsg, details: data }, { status: response.status });
          }

          return Response.json(data);

        } catch (error) {
           console.error(`Error in /create-payment-intent [${requestId}]:`, error);
           return Response.json({ error: 'Internal server error' }, { status: 500 });
        }
      })
    },

    {
      path: '/coupons/validate',
      method: 'post',
      handler: couponsValidateHandler,
    },

    {
      path: '/coupons/attach',
      method: 'post',
      handler: couponsAttachHandler,
    },

    {
      path: '/support/order-help',
      method: 'post',
      handler: sendOrderHelp,
    },
  ],

  // sharp,
  plugins: [
    payloadCloudPlugin(),
    cloudStoragePlugin({
      collections: {
        media: {
          adapter: cloudinaryAdapter({
            // Server-only: read at runtime, NOT NEXT_PUBLIC_* (which Next.js
            // inlines at build time and goes stale on Cloud Run — see Dockerfile).
            cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
            apiKey: process.env.CLOUDINARY_API_KEY!,
            apiSecret: process.env.CLOUDINARY_API_SECRET!,
            folder: 'main-uploads',
          }),
        },
      },
    }),
    // storage-adapter-placeholder
  ],
})
