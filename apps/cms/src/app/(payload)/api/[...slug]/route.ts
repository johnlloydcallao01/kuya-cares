/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'
 

// Wrap handlers with error logging
const wrapHandler = (handler: (req: Request, context: { params: Promise<{ slug: string[] }> }) => Promise<Response>, method: string) => {
  return async (req: Request, context: { params: Promise<{ slug: string[] }> }) => {
    console.log(`=== ${method} REQUEST START ===`)
    console.log('URL:', req.url)
    console.log('Method:', req.method)
    console.log('Headers:', Object.fromEntries(req.headers.entries()))
    console.log('Environment:', process.env.NODE_ENV)
    try {
      const p = await context.params
      console.log('Params:', p)
    } catch {}

    try {
      const result = await handler(req, context)
      console.log(`=== ${method} REQUEST SUCCESS ===`)
      console.log('Status:', result.status)
      return result
    } catch (error) {
      console.error(`=== ${method} REQUEST ERROR ===`)
      console.error('Error:', error)
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
      console.error(`=== END ${method} ERROR ===`)
      throw error
    }
  }
}

export const GET = wrapHandler(REST_GET(config), 'GET')
export const POST = wrapHandler(REST_POST(config), 'POST')
export const DELETE = wrapHandler(REST_DELETE(config), 'DELETE')
export const PATCH = wrapHandler(REST_PATCH(config), 'PATCH')
export const PUT = wrapHandler(REST_PUT(config), 'PUT')
export const OPTIONS = wrapHandler(REST_OPTIONS(config), 'OPTIONS')