import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// Type for the request body
interface CustomerRegistrationBody {
  firstName: string
  lastName: string
  middleName?: string
  email: string
  password: string
}

// Simple CORS headers - allow all origins
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  let body: CustomerRegistrationBody = {} as CustomerRegistrationBody // Declare body outside try block for error logging

  try {
    console.log('🚀 === CUSTOMER REGISTRATION STARTED ===')

    console.log('🔧 Initializing PayloadCMS...')
    const payload = await getPayload({ config: configPromise })
    console.log('✅ PayloadCMS initialized successfully')

    console.log('📥 Parsing request body...')
    body = await request.json()
    console.log('✅ Request body parsed successfully')

    console.log('📋 Registration request received:', {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      hasPassword: !!body.password
    })

    // Validate required fields with detailed logging
    const requiredFields = [
      'firstName', 'lastName', 'email', 'password'
    ]

    console.log('🔍 Validating required fields...')
    for (const field of requiredFields) {
      const fieldValue = (body as unknown as Record<string, unknown>)[field]
      if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
        console.error(`❌ Missing required field: ${field}`)
        return NextResponse.json(
          {
            error: `Missing required field: ${field}`,
            field: field,
            received: fieldValue
          },
          { status: 400, headers: corsHeaders }
        )
      }
      console.log(`✅ Field ${field}: OK`)
    }
    console.log('✅ All required fields validated successfully')

    // Step 1: Create user account
    console.log('👤 Creating user account...')

    // Only include fields that are confirmed to exist in the current schema
    const userData = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
      role: 'customer' as const,
      ...(body.middleName && { middleName: body.middleName }),
    }

    console.log('📋 User data to create:', {
      ...userData,
      password: '[HIDDEN]'
    })

    console.log('🔍 User data field analysis:', {
      totalFields: Object.keys(userData).length,
      requiredFields: ['firstName', 'lastName', 'email', 'password', 'role'],
      optionalFields: Object.keys(userData).filter(key => !['firstName', 'lastName', 'email', 'password', 'role'].includes(key)),
      hasAllRequired: ['firstName', 'lastName', 'email', 'password', 'role'].every(field => userData[field as keyof typeof userData])
    })

    let user;
    try {
      console.log('🔄 Attempting to create user...')
      user = await payload.create({
        collection: 'users',
        data: userData
      })

      console.log('✅ User created successfully:', {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      })
    } catch (userCreationError) {
      console.error('💥 USER CREATION FAILED:', userCreationError)
      console.error('📋 Data that failed:', {
        ...userData,
        password: '[HIDDEN]'
      })

      // Preserve original error for downstream handlers to inspect
      throw userCreationError
    }

    // Step 2: Check if customer record was created by trigger, if not create manually (without SRN)
    console.log('🎓 Checking/Creating customer record...')

    // First, check if customer record was already created by the database trigger
    let customer;
    try {
      console.log('🔍 Checking if customer record exists (created by trigger)...')
      const existingCustomers = await payload.find({
        collection: 'customers',
        where: {
          user: {
            equals: user.id
          }
        },
        limit: 1
      })

      if (existingCustomers.docs.length > 0) {
        customer = existingCustomers.docs[0]
        console.log('✅ Customer record found (created by trigger):', {
          id: customer.id,
          userId: customer.user
        })
      } else {
        // No customer record found, create manually
        console.log('🔄 Creating customer record manually...')
        const customerData = {
          user: user.id,
          enrollmentDate: new Date().toISOString(),
          currentLevel: 'beginner' as const
        }

        console.log('📋 Customer data to create:', customerData)

        customer = await payload.create({
          collection: 'customers',
          data: customerData
        })

        console.log('✅ Customer created manually:', {
          id: customer.id,
          userId: customer.user
        })
      }
    } catch (customerError) {
      console.error('💥 CUSTOMER HANDLING FAILED:', customerError)
      throw new Error(`Customer handling failed: ${customerError instanceof Error ? customerError.message : String(customerError)}`)
    }

    // Emergency contact creation removed

    console.log('🎉 === CUSTOMER REGISTRATION COMPLETED SUCCESSFULLY ===')

    const successResponse = {
      success: true,
      message: 'Customer registration successful! Welcome to Tap2Go.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        customer: {
          id: customer.id
        },
        emergencyContact: undefined
      }
    }

    console.log('📤 Sending success response:', successResponse)

    return NextResponse.json(successResponse, { headers: corsHeaders })

  } catch (error: unknown) {
    console.error('💥 === CUSTOMER REGISTRATION ERROR ===')
    console.error('❌ Customer registration failed:', error)

    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name)
      console.error('❌ Error message:', error.message)
      console.error('❌ Error stack:', error.stack)

      // Check for specific error types
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        console.error('🔍 DUPLICATE KEY ERROR DETECTED')
      }
      if (error.message.includes('validation')) {
        console.error('🔍 VALIDATION ERROR DETECTED')
      }
    }

    // Log the full error object with better formatting
    try {
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    } catch (_jsonError) {
      console.error('❌ Could not stringify error object:', error)
    }

    // Log the request body for debugging (without sensitive data)
    console.error('📋 Request body (sanitized):', {
      ...body,
      password: '[REDACTED]',
      confirmPassword: '[REDACTED]'
    })

    console.error('💥 === END REGISTRATION ERROR ===')


    // Handle specific PayloadCMS validation errors
    if (error instanceof Error && (error.name === 'ValidationError' || error.message.includes('validation'))) {
      console.error('🔍 HANDLING VALIDATION ERROR')
      const errorData = (error as { data?: unknown; message: string }).data
      return NextResponse.json(
        {
          error: 'Registration validation failed',
          message: 'Please check your form data and try again.',
          details: errorData || error.message,
          type: 'validation'
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // Handle duplicate key errors (email already exists)
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const errObj = error as { code?: string | number; detail?: string; constraint?: string }
      if (String(errObj.code) === '23505') {
      console.error('🔍 HANDLING DUPLICATE KEY ERROR')
      let field = 'field'
      let friendlyField = 'field'
      const detail = errObj.detail ? String(errObj.detail) : ''
      const constraint = errObj.constraint ? String(errObj.constraint) : ''

      console.error('🔍 Duplicate key details:', { detail, constraint })

      if (detail.includes('email') || constraint.includes('email')) {
        field = 'email'
        friendlyField = 'email address'
      }

      return NextResponse.json(
        {
          error: `This ${friendlyField} is already registered`,
          message: `A user with this ${friendlyField} already exists. Please use a different ${friendlyField}.`,
          field: field,
          type: 'duplicate'
        },
        { status: 409, headers: corsHeaders }
      )
      }
    }

    // Fallback: detect duplicate email from Payload validation errors
    if (typeof error === 'object' && error !== null) {
      const errObj = error as { message?: string; data?: { errors?: { path?: string; message?: string }[] } }
      const message = errObj.message ? String(errObj.message) : ''
      const errorsList = Array.isArray(errObj.data?.errors) ? errObj.data!.errors! : []
      const hasEmailDuplicate = (
        message.toLowerCase().includes('email') && message.toLowerCase().includes('exist')
      ) || errorsList.some((e) => String(e?.path) === 'email' && /exist|registered|duplicate/i.test(String(e?.message)))

      if (hasEmailDuplicate) {
        return NextResponse.json(
          {
            error: 'This email address is already registered',
            message: 'A user with this email address already exists. Please use a different email address.',
            field: 'email',
            type: 'duplicate'
          },
          { status: 409, headers: corsHeaders }
        )
      }
    }

    // Handle PayloadCMS specific errors
    if (typeof error === 'object' && error !== null && 'data' in error) {
      console.error('🔍 HANDLING PAYLOADCMS ERROR')
      const payloadError = error as { data?: unknown; message?: string; status?: number }
      return NextResponse.json(
        {
          error: 'Registration failed due to data validation',
          message: payloadError.message || 'Please check your form data and try again.',
          details: payloadError.data,
          type: 'payload'
        },
        { status: payloadError.status || 400, headers: corsHeaders }
      )
    }

    // Return more detailed error information in development
    const isDevelopment = process.env.NODE_ENV === 'development'
    console.error('🔍 HANDLING GENERIC ERROR - Development mode:', isDevelopment)

    return NextResponse.json(
      {
        error: 'Registration failed due to an unexpected error',
        message: 'We encountered an unexpected error while processing your registration. Please try again in a few moments.',
        type: 'server_error',
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
