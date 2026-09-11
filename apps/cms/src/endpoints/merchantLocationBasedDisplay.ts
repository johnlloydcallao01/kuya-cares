import type { PayloadRequest } from 'payload'
import crypto from 'crypto'
import { MerchantLocationService } from '../services/MerchantLocationService'

export const merchantLocationBasedDisplayHandler = async (req: PayloadRequest) => {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    console.log(`📍 [${requestId}] MERCHANT LOCATION-BASED DISPLAY REQUEST:`, {
      timestamp: new Date().toISOString(),
      query: req.query,
    })

    // PayloadCMS built-in API key authentication
    // PayloadCMS automatically authenticates API keys and populates req.user
    if (!req.user) {
      console.log(`❌ [${requestId}] Authentication failed - no user found`)
      console.log(`🔍 [${requestId}] Headers:`, Object.fromEntries(
        Object.entries(req.headers || {}).filter(([key]) => 
          key.toLowerCase().includes('auth') || key.toLowerCase().includes('api')
        )
      ))
      
      return Response.json({
        success: false,
        error: 'Authentication required. Please provide a valid API key in the format: Authorization: users API-Key <your-key>',
        code: 'UNAUTHENTICATED',
        timestamp: new Date().toISOString(),
        requestId,
        hint: 'Use header format: Authorization: users API-Key <your-api-key>'
      }, { status: 401 })
    }

    // Verify user has service or admin role
    if (req.user.role !== 'service' && req.user.role !== 'admin') {
      console.log(`❌ [${requestId}] Access denied - user role: ${req.user.role}`)
      
      return Response.json({
        success: false,
        error: 'Access denied. Service or admin role required.',
        code: 'INSUFFICIENT_PERMISSIONS',
        timestamp: new Date().toISOString(),
        requestId,
        userRole: req.user.role
      }, { status: 403 })
    }

    console.log(`✅ [${requestId}] Authentication successful - user: ${req.user.id}, role: ${req.user.role}`)

    // Extract and validate query parameters
    const { customerId, categoryId } = req.query as {
      customerId?: string
      categoryId?: string  // ← NEW: Category ID from URL (e.g., "9")
    }

    // Validation
    if (!customerId) {
      console.log(`❌ [${requestId}] Missing customerId parameter`)
      
      return Response.json({
        success: false,
        error: 'Missing required parameter: customerId',
        code: 'MISSING_PARAMETERS',
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 400 })
    }

    const customerIdNum = parseInt(customerId, 10)
    if (isNaN(customerIdNum)) {
      console.log(`❌ [${requestId}] Invalid customerId: ${customerId}`)
      
      return Response.json({
        success: false,
        error: 'Invalid customerId. Must be a valid number.',
        code: 'INVALID_PARAMETER',
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 400 })
    }

    console.log(`📋 [${requestId}] Processing request for customerId: ${customerIdNum}`, {
      categoryFilter: categoryId || 'none'
    })

    // Initialize the PostGIS-based location service
    console.log(`🔄 [${requestId}] Initializing MerchantLocationService (PostGIS-based)...`)
     const merchantLocationService = new MerchantLocationService(req.payload)
     
     console.log(`🔍 [${requestId}] Fetching merchants using PostGIS spatial queries...`)
     const result = await merchantLocationService.getMerchantsForLocationDisplay({
       customerId: customerIdNum,
       categoryId: categoryId || undefined  // ← PASS CATEGORY ID DIRECTLY
     })

    const responseTime = Date.now() - startTime
     console.log(`✅ [${requestId}] Successfully retrieved ${result.merchants?.length || 0} merchants using PostGIS (${responseTime}ms)`)
     
    if (categoryId) {
      console.log(`🏷️ [${requestId}] Category filter applied: "${categoryId}"`)
    }

     console.log(`✅ [${requestId}] Request completed successfully in ${responseTime}ms`)
    console.log(`📊 [${requestId}] Result summary:`, {
      customerFound: !!result.customer,
      addressFound: !!result.address,
      merchantCount: result.merchants?.length || 0,
      filterApplied: !!categoryId
    })

    return Response.json({
      success: true,
      data: result,
      filters: {
        categoryId: categoryId || null,
        applied: !!categoryId
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        responseTime,
        merchantCount: result.merchants?.length || 0
      }
    }, { status: 200 })

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Enhanced error categorization and logging
    let errorCode = 'INTERNAL_SERVER_ERROR'
    const statusCode = 500
    let specificError = 'An unexpected error occurred'
    
    // Categorize specific error types for better debugging
    if (error instanceof Error) {
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        errorCode = 'DATABASE_CONNECTION_ERROR'
        specificError = 'Database connection issue detected'
      } else if (error.message.includes('pool') || error.message.includes('acquire')) {
        errorCode = 'DATABASE_POOL_EXHAUSTED'
        specificError = 'Database connection pool exhausted'
      } else if (error.message.includes('PostGIS') || error.message.includes('geometry')) {
        errorCode = 'GEOSPATIAL_QUERY_ERROR'
        specificError = 'Geospatial query processing failed'
      } else if (error.message.includes('customer') || error.message.includes('address')) {
        errorCode = 'CUSTOMER_DATA_ERROR'
        specificError = 'Customer or address data retrieval failed'
      } else if (error.message.includes('merchant')) {
        errorCode = 'MERCHANT_QUERY_ERROR'
        specificError = 'Merchant data query failed'
      }
    }
    
    // Comprehensive error logging with context
    console.error(`🚨 [${requestId}] MERCHANT LOCATION-BASED DISPLAY ERROR:`, {
      errorCode,
      error: errorMessage,
      specificError,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      responseTime: `${responseTime}ms`,
      context: {
          userId: req.user?.id,
          userRole: req.user?.role,
          customerId: req.query?.customerId,
          categoryId: req.query?.categoryId,
          timestamp: new Date().toISOString(),
          requestId,
          userAgent: req.headers?.get('user-agent'),
          ipAddress: req.headers?.get('x-forwarded-for') || req.headers?.get('x-real-ip'),
        },
      performance: {
        responseTimeMs: responseTime,
        slowQuery: responseTime > 5000,
        verySlowQuery: responseTime > 10000,
      },
      debugging: {
        nodeEnv: process.env.NODE_ENV,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      }
    })

    // Log additional metrics for monitoring
    if (responseTime > 5000) {
      console.warn(`⚠️ [${requestId}] SLOW QUERY DETECTED: ${responseTime}ms - Consider optimization`)
    }
    
    if (responseTime > 10000) {
      console.error(`🔥 [${requestId}] VERY SLOW QUERY: ${responseTime}ms - Immediate attention required`)
    }

    return Response.json({
      success: false,
      error: 'Failed to fetch location-based merchants',
      code: errorCode,
      message: process.env.NODE_ENV === 'development' ? errorMessage : specificError,
      timestamp: new Date().toISOString(),
      requestId,
      responseTime,
      // Additional debugging info for development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          originalError: errorMessage,
          stack: errorStack,
          context: {
            customerId: req.query?.customerId,
            categoryId: req.query?.categoryId,
            userId: req.user?.id,
          }
        }
      })
    }, { status: statusCode })
  }
}